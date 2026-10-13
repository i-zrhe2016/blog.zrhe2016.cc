import { splitMarkdown } from "./content";

// Preview tolerates pasted bodies and leading whitespace; publication stays strict.
export function previewSource(raw: string, fallbackTitle = "") {
  const source = raw.trimStart();
  if (/^---(?:\r?\n|$)/.test(source)) {
    if (!/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.test(source))
      throw new Error("YAML frontmatter 缺少结束分隔符（单独一行 ---）");
    const { metadata, body } = splitMarkdown(source);
    return { title: String(metadata.title || "未命名文章"), body };
  }
  return { title: fallbackTitle.trim() || "未命名文章", body: raw };
}
