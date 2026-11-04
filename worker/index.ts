import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  validateMarkdown,
  validatePostPath,
  validImage,
  imageTypes,
} from "../src/admin/content";
import {
  HttpError,
  json,
  github,
  decode64,
  getFile,
  commitFiles,
  createBlob,
  deploymentStatus,
  listPosts,
  type Env,
} from "./lib";
import { handleMcp } from "./mcp";

const jwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
async function authenticate(request: Request, env: Env) {
  const url = new URL(request.url);
  if (
    env.LOCAL_ADMIN_AUTH === "true" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    return;
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAILS)
    throw new HttpError(503, "后台认证尚未配置");
  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  let key = jwks.get(issuer);
  if (!key) {
    key = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    jwks.set(issuer, key);
  }
  try {
    const { payload } = await jwtVerify(
      request.headers.get("Cf-Access-Jwt-Assertion") || "",
      key,
      { issuer, audience: env.ACCESS_AUD }
    );
    const allowed = env.ADMIN_EMAILS.toLowerCase()
      .split(",")
      .map(s => s.trim());
    if (
      !payload.exp ||
      !payload.email ||
      !allowed.includes(String(payload.email).toLowerCase())
    )
      throw new Error("unauthorized");
  } catch {
    throw new HttpError(401, "请通过 Cloudflare Access 登录");
  }
}
async function publish(request: Request, env: Env) {
  if (Number(request.headers.get("Content-Length")) > 23 * 1024 * 1024)
    throw new HttpError(413, "发布内容过大");
  // Enforce the limit while streaming, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "请求内容为空");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 23 * 1024 * 1024) {
      await reader.cancel();
      throw new HttpError(413, "发布内容过大");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const form = await new Response(bytes, {
    headers: { "Content-Type": request.headers.get("Content-Type") || "" },
  }).formData();
  const path = validatePostPath(String(form.get("path") || ""));
  const source = form.get("markdown");
  if (!(source instanceof File) || source.size > 2 * 1024 * 1024)
    throw new HttpError(400, "Markdown 必须以文件上传且不能超过 2 MB");
  const raw = await source.text();
  const { metadata } = validateMarkdown(raw);
  const baseSha = String(form.get("baseSha") || "");
  const editOnlyMessage =
    "后台只允许修改已有已发布文章，不允许新建、发布草稿或更改发布状态";
  if (!baseSha) throw new HttpError(403, editOnlyMessage);
  const branch = env.GITHUB_BRANCH || "main";
  const head = await github(env, `git/ref/heads/${encodeURIComponent(branch)}`);
  let existing: any;
  try {
    existing = await getFile(env, path, head.object.sha);
  } catch (e) {
    if (!(e instanceof HttpError && e.status === 404)) throw e;
  }
  if (!existing) throw new HttpError(403, editOnlyMessage);
  const originalRaw = decode64(existing.content);
  const original = validateMarkdown(originalRaw).metadata;
  if (
    original.draft ||
    original.prerelease ||
    metadata.draft ||
    metadata.prerelease
  )
    throw new HttpError(403, editOnlyMessage);
  const rawBytes = new TextEncoder().encode(raw);
  if (originalRaw === raw)
    return json({
      sha: head.object.sha,
      fileSha: existing.sha,
      recovered: true,
    });
  if ((existing?.sha || "") !== baseSha)
    throw new HttpError(409, "远端文章已修改，请保留草稿并重新加载比较");
  const files: { path: string; mode: string; type: string; sha: string }[] = [];
  let total = 0;
  const images = form.getAll("images");
  if (images.length > 100) throw new HttpError(400, "图片数量过多");
  for (const image of images) {
    if (!(image instanceof File)) throw new HttpError(400, "无效图片");
    const bytes = new Uint8Array(await image.arrayBuffer());
    total += bytes.length;
    if (total > 20 * 1024 * 1024 || !validImage(bytes, image.type))
      throw new HttpError(400, "图片格式或大小不符合要求");
    if (
      !new RegExp(`^[a-f0-9-]{36}\\.${imageTypes[image.type]}$`).test(
        image.name
      )
    )
      throw new HttpError(400, "无效图片文件名");
    const blob = await createBlob(env, bytes);
    files.push({
      path: `public/images/uploads/${image.name}`,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }
  const blob = await createBlob(env, rawBytes);
  files.push({ path, mode: "100644", type: "blob", sha: blob.sha });
  const commit = await commitFiles(env, {
    branch,
    message: `content: update ${path.split("/").pop()}`,
    files,
    parentSha: head.object.sha,
  });
  return json({ sha: commit.sha, fileSha: blob.sha });
}
async function deployment(request: Request, env: Env, sha: string) {
  return json(await deploymentStatus(env, request, sha));
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/mcp") return handleMcp(request, env);
    const protectedPath =
      url.pathname === "/admin" ||
      url.pathname.startsWith("/admin/") ||
      url.pathname.startsWith("/api/admin/");
    if (!protectedPath) return env.ASSETS.fetch(request);
    try {
      await authenticate(request, env);
      if (!["GET", "HEAD"].includes(request.method)) {
        const expected =
          env.LOCAL_ADMIN_AUTH === "true" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
            ? url.origin
            : env.ADMIN_ORIGIN;
        if (!expected || request.headers.get("Origin") !== expected)
          throw new HttpError(403, "请求来源无效");
      }
      if (!url.pathname.startsWith("/api/admin/")) {
        const response = await env.ASSETS.fetch(request);
        const headers = new Headers(response.headers);
        headers.set("Cache-Control", "no-store");
        headers.set("X-Robots-Tag", "noindex, nofollow");
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }
      const branch = env.GITHUB_BRANCH || "main";
      if (url.pathname === "/api/admin/posts" && request.method === "GET") {
        const { posts } = await listPosts(env, branch);
        return json({ posts });
      }
      if (url.pathname === "/api/admin/post" && request.method === "GET") {
        const path = validatePostPath(url.searchParams.get("path") || "");
        const file = await getFile(env, path, branch);
        return json({ path, sha: file.sha, markdown: decode64(file.content) });
      }
      if (url.pathname === "/api/admin/publish" && request.method === "POST")
        return await publish(request, env);
      if (
        url.pathname.startsWith("/api/admin/deployments/") &&
        request.method === "GET"
      )
        return await deployment(request, env, url.pathname.split("/").pop()!);
      return json({ error: "接口不存在" }, 404);
    } catch (e) {
      return json(
        {
          error:
            e instanceof HttpError
              ? e.message
              : e instanceof Error
                ? e.message
                : "请求失败",
        },
        e instanceof HttpError ? e.status : 400
      );
    }
  },
};
