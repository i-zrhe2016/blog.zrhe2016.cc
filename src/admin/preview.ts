import { unified } from "unified";
import type { Root, RootContent } from "hast";
import rehypeSlug from "rehype-slug";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import {
  remarkPlugins,
  rehypePlugins,
  highlightTransformers,
} from "../utils/markdown";
function preserveCodeMeta() {
  return (tree: Root) => {
    function walk(node: Root | RootContent) {
      if (
        "tagName" in node &&
        node.tagName === "code" &&
        typeof node.data?.meta === "string"
      )
        node.properties.dataMeta = node.data.meta;
      if ("children" in node) for (const child of node.children) walk(child);
    }
    walk(tree);
  };
}
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkPlugins)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(preserveCodeMeta)
  .use(rehypeRaw)
  .use(rehypePlugins)
  .use(rehypeSlug)
  .use(rehypeSanitize, {
    ...defaultSchema,
    clobberPrefix: "preview-",
    attributes: {
      ...defaultSchema.attributes,
      "*": [...(defaultSchema.attributes?.["*"] || []), "className"],
      code: [
        ...(defaultSchema.attributes?.code || []),
        "dataMeta",
        ["className", /^language-./],
      ],
    },
  })
  .use(rehypeStringify);
let shiki: Promise<typeof import("shiki")> | undefined;
export async function renderPreview(body: string): Promise<string> {
  const result = String(await processor.process(body));
  const doc = new DOMParser().parseFromString(result, "text/html");
  for (const link of doc.querySelectorAll("a")) {
    const href = link.getAttribute("href") || "";
    if (href.startsWith("#")) {
      try {
        const id = "preview-" + decodeURIComponent(href.slice(1));
        if (doc.getElementById(id)) link.setAttribute("href", "#" + id);
      } catch {
        /* Keep malformed anchors inert. */
      }
      continue;
    }
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  const blocks = Array.from(doc.querySelectorAll("pre > code")).slice(0, 30);
  if (blocks.length) {
    const loaded = await (shiki ??= import("shiki")).catch(() => {
      shiki = undefined;
      return undefined;
    });
    if (!loaded) return doc.body.innerHTML;
    const { codeToHtml, bundledLanguages } = loaded;
    await Promise.all(
      blocks.map(async code => {
        const lang =
          Array.from(code.classList)
            .find(c => c.startsWith("language-"))
            ?.slice(9) || "text";
        const text = code.textContent || "";
        if (text.length > 100_000) return;
        try {
          const html = await codeToHtml(text.replace(/\n$/, ""), {
            lang:
              lang in bundledLanguages
                ? (lang as keyof typeof bundledLanguages)
                : "text",
            themes: { light: "min-light", dark: "night-owl" },
            defaultColor: false,
            meta: { __raw: code.getAttribute("data-meta") || "" },
            transformers: [
              ...highlightTransformers,
              {
                pre(node) {
                  this.addClassToHast(node, "astro-code");
                },
              },
            ],
          });
          code.parentElement!.outerHTML = html;
        } catch {
          /* Keep sanitized plain code if a language cannot load. */
        }
      })
    );
  }
  return doc.body.innerHTML;
}
