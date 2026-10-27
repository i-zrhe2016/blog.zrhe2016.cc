import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { diagramAsset } from "./plantuml.mjs";
import { mkdir, writeFile, access } from "node:fs/promises";

const root = fileURLToPath(new URL("../src/content", import.meta.url));
const endpoint = process.env.PLANTUML_RENDER_URL || "https://kroki.io/plantuml/svg";

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await walk(path);
    else if (/\.mdx?$/.test(entry.name)) {
      const source = await readFile(path, "utf8");
      const matches = source.matchAll(/^```plantuml(?:[\t ]+[^\r\n]*)?\r?\n([\s\S]*?)\r?\n```[\t ]*$/gm);
      for (const match of matches) {
        const asset = diagramAsset(match[1]);
        try { await access(asset.path); continue; } catch {}
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "text/plain; charset=utf-8", accept: "image/svg+xml" },
          body: asset.source,
        });
        if (!response.ok) throw new Error(`PlantUML remote renderer failed (${response.status})`);
        const svg = await response.text();
        if (!svg.includes("<svg")) throw new Error("PlantUML remote renderer returned invalid SVG");
        await mkdir(dirname(asset.path), { recursive: true });
        await writeFile(asset.path, svg);
      }
    }
  }
}
await walk(root);
