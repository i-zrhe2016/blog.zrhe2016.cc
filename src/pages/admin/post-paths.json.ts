import { getCollection } from "astro:content";
import { getPostUrl } from "@/utils/getPostPaths";
import { validatePostPath } from "@/admin/content";

export async function GET() {
  const paths: Record<string, string> = {};
  for (const post of await getCollection("posts")) {
    if (!post.filePath?.endsWith(".md")) continue;
    const path = post.filePath.replaceAll("\\", "/").replace(/^\.\//, "");
    const route = decodeURIComponent(
      getPostUrl(post.id, post.filePath)
    ).replace(/\/$/, "");
    if (paths[route]) throw new Error(`Ambiguous article URL: ${route}`);
    paths[route] = validatePostPath(path);
  }
  return Response.json(paths);
}
