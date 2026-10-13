import { parseDocument, stringify } from "yaml";
import { z } from "zod";

const dateSchema = z
  .union([z.iso.datetime({ offset: true }), z.iso.date(), z.date()])
  .pipe(z.coerce.date());
export const metadataSchema = z.looseObject({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  pubDatetime: dateSchema,
  modDatetime: dateSchema.nullable().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
  draft: z.boolean().optional(),
  featured: z.boolean().optional(),
  ogImage: z.string().optional(),
  canonicalURL: z.string().optional(),
  hideEditPost: z.boolean().optional(),
  timezone: z.string().optional(),
});
export type Metadata = Record<string, unknown>;
export function splitMarkdown(raw: string): {
  metadata: Metadata;
  body: string;
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw);
  if (!match) throw new Error("文章缺少 YAML frontmatter");
  const doc = parseDocument(match[1], { uniqueKeys: true });
  if (doc.errors.length)
    throw new Error("YAML 格式错误：" + doc.errors[0].message);
  const metadata: unknown = doc.toJS({ maxAliasCount: 50 });
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    throw new Error("元数据必须是对象");
  return { metadata: metadata as Metadata, body: raw.slice(match[0].length) };
}
export function joinMarkdown(metadata: Metadata, body: string) {
  return `---\n${stringify(metadata, { lineWidth: 0 })}---\n${body}`;
}
export function validateMarkdown(raw: string) {
  if (new TextEncoder().encode(raw).length > 2 * 1024 * 1024)
    throw new Error("文章不能超过 2 MB");
  const parsed = splitMarkdown(raw);
  metadataSchema.parse(parsed.metadata);
  return parsed;
}
export function validatePostPath(path: string) {
  if (
    !/^src\/content\/posts\/(?:[a-zA-Z0-9\u4e00-\u9fff][a-zA-Z0-9\u4e00-\u9fff_-]*\/)*[a-zA-Z0-9\u4e00-\u9fff][a-zA-Z0-9\u4e00-\u9fff_-]*\.md$/.test(
      path
    )
  )
    throw new Error("无效文章路径");
  return path;
}
export const imageTypes: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
export function validImage(bytes: Uint8Array, type: string) {
  if (!imageTypes[type] || bytes.length === 0 || bytes.length > 5 * 1024 * 1024)
    return false;
  const start = Array.from(bytes.slice(0, 12))
    .map(n => String.fromCharCode(n))
    .join("");
  return type === "image/png"
    ? bytes.slice(0, 8).join() === "137,80,78,71,13,10,26,10"
    : type === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : type === "image/gif"
        ? /^GIF8[79]a/.test(start)
        : start.startsWith("RIFF") && start.slice(8, 12) === "WEBP";
}
