import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

export const rendererVersion = "1.2026.8";
const root = fileURLToPath(new URL("../", import.meta.url));
const assets = join(root, "public/diagrams/plantuml");

export function diagramAsset(source) {
  const normalized = source.replace(/\r\n?/g, "\n").trim() + "\n";
  const hash = createHash("sha256")
    .update(`${rendererVersion}\n${normalized}`)
    .digest("hex")
    .match(/.{8}/g)
    .join("-");
  return {
    source: normalized,
    path: join(assets, `${hash}.svg`),
    url: `/diagrams/plantuml/${hash}.svg`,
  };
}

export function renderDiagram(source) {
  const asset = diagramAsset(source);
  const require = createRequire(import.meta.url);
  const jar = join(
    dirname(require.resolve("plantuml-cli/package.json")),
    "build",
    `plantuml-${rendererVersion}.jar`
  );
  const result = spawnSync(
    process.env.PLANTUML_JAVA || "java",
    [
      "-Djava.awt.headless=true",
      "-DPLANTUML_SECURITY_PROFILE=SANDBOX",
      "-jar",
      jar,
      "-tsvg",
      "-pipe",
      "-charset",
      "UTF-8",
      "-nometadata",
      "-failfast2",
    ],
    {
      input: asset.source,
      encoding: "utf8",
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    }
  );
  if (
    result.error ||
    result.status !== 0 ||
    !result.stdout.includes("<svg") ||
    result.stdout.includes("Syntax Error?")
  ) {
    const hint =
      result.error?.code === "ENOENT"
        ? " Install Java 21+ or set PLANTUML_JAVA to its executable."
        : " Check the diagram syntax and renderer prerequisites.";
    throw new Error(
      `PlantUML ${rendererVersion} rendering failed: ${result.error?.message || result.stderr.trim() || "invalid diagram"}.${hint}`
    );
  }
  mkdirSync(assets, { recursive: true });
  writeFileSync(asset.path, result.stdout);
  return asset;
}

/** Convert only PlantUML fences, before syntax highlighting. */
export default function remarkPlantuml({ render = false } = {}) {
  return (tree, file) => {
    function visit(parent) {
      for (let index = 0; index < (parent.children?.length || 0); index++) {
        const node = parent.children[index];
        if (node.type !== "code" || node.lang !== "plantuml") {
          visit(node);
          continue;
        }
        try {
          const source = node.value;
          if (
            !/^@startuml\b/.test(source.trim()) ||
            !/^@enduml\s*$/m.test(source) ||
            (source.match(/^@startuml\b/gm) || []).length !== 1 ||
            (source.match(/^@enduml\b/gm) || []).length !== 1 ||
            !/@enduml\s*$/.test(source)
          ) {
            throw new Error(
              "Use exactly one complete @startuml / @enduml diagram per fence."
            );
          }
          if (
            /^\s*!(?:include|import)\b/im.test(source) ||
            /%(?:load_json|load_yaml|load_file|getenv)\s*\(/i.test(source)
          ) {
            throw new Error(
              "External includes, file reads and environment reads are not supported; keep the diagram self-contained."
            );
          }
          const asset = render ? renderDiagram(source) : diagramAsset(source);
          let svg;
          try {
            svg = readFileSync(asset.path, "utf8");
          } catch {
            throw new Error(
              "Missing or stale SVG. Run pnpm diagrams:render and include the generated public/diagrams/plantuml SVG with the Markdown change."
            );
          }
          if (!svg.includes("<svg") || svg.includes("Syntax Error?"))
            throw new Error("Invalid cached SVG. Run pnpm diagrams:render.");
          parent.children[index] = {
            type: "image",
            url: asset.url,
            alt: node.meta?.trim() || "PlantUML diagram",
            position: node.position,
          };
        } catch (error) {
          file.fail(`PlantUML: ${error.message}`, node);
        }
      }
    }
    visit(tree);
  };
}
