import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import remarkPlantuml from "./plantuml.mjs";

const processor = await createMarkdownProcessor({
  syntaxHighlight: false,
  remarkPlugins: [[remarkPlantuml, { render: !process.argv.includes("--check") }]],
});
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (/\.mdx?$/.test(entry.name)) {
      try {
        await processor.render(await readFile(path, "utf8"));
      } catch (error) {
        throw new Error(`${path}: ${error.message}`, { cause: error });
      }
    }
  }
}
await walk(fileURLToPath(new URL("../src/content", import.meta.url)));
