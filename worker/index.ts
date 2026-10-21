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
const commentPost = (value: string) =>
  /^\/[a-zA-Z0-9\u4e00-\u9fff_./-]+\/?$/.test(value) && value.length <= 300;
async function publicComments(request: Request, env: Env) {
  if (!env.COMMENTS_DB) throw new HttpError(503, "评论服务尚未配置");
  const url = new URL(request.url);
  if (request.method === "GET") {
    const post = url.searchParams.get("post") || "";
    if (!commentPost(post)) throw new HttpError(400, "无效文章标识");
    const result = await env.COMMENTS_DB.prepare(
      "SELECT id, nickname, content, created_at FROM comments WHERE post = ? AND status = 'approved' ORDER BY created_at ASC"
    )
      .bind(post)
      .all();
    return json({ comments: result.results || [] });
  }
  if (request.method !== "POST") throw new HttpError(405, "请求方法不支持");
  if (Number(request.headers.get("Content-Length") || 0) > 12 * 1024)
    throw new HttpError(413, "评论内容过大");
  let body: any;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "请求内容无效");
  }
  const post = String(body?.post || "");
  const nickname = String(body?.nickname || "").trim();
  const email = String(body?.email || "").trim();
  const content = String(body?.content || "").trim();
  if (
    !commentPost(post) ||
    !nickname ||
    nickname.length > 80 ||
    !content ||
    content.length > 5000
  )
    throw new HttpError(400, "评论字段不符合要求");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new HttpError(400, "邮箱格式无效");
  await env.COMMENTS_DB.prepare(
    "INSERT INTO comments (id, post, nickname, email, content, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)"
  )
    .bind(
      crypto.randomUUID(),
      post,
      nickname,
      email,
      content,
      new Date().toISOString()
    )
    .run();
  return json({ accepted: true }, 202);
}
async function adminComments(request: Request, env: Env) {
  if (!env.COMMENTS_DB) throw new HttpError(503, "评论服务尚未配置");
  const url = new URL(request.url);
  if (url.pathname === "/api/admin/comments" && request.method === "GET") {
    const status = url.searchParams.get("status") || "pending";
    if (!["pending", "approved", "rejected", "deleted", "all"].includes(status))
      throw new HttpError(400, "无效状态");
    const page = Math.max(
      1,
      Math.min(1000, Number(url.searchParams.get("page") || 1))
    );
    const limit = 20;
    const offset = (page - 1) * limit;
    const query =
      status === "all"
        ? "SELECT id, post, nickname, email, content, status, created_at, moderated_at FROM comments ORDER BY created_at DESC LIMIT ? OFFSET ?"
        : "SELECT id, post, nickname, email, content, status, created_at, moderated_at FROM comments WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?";
    const result =
      status === "all"
        ? await env.COMMENTS_DB.prepare(query).bind(limit, offset).all()
        : await env.COMMENTS_DB.prepare(query)
            .bind(status, limit, offset)
            .all();
    return json({ comments: result.results || [], page, limit });
  }
  const match = url.pathname.match(
    /^\/api\/admin\/comments\/([^/]+)\/(approve|reject)$/
  );
  if (match && request.method === "POST") {
    const status = match[2] === "approve" ? "approved" : "rejected";
    const result = await env.COMMENTS_DB.prepare(
      "UPDATE comments SET status = ?, moderated_at = ? WHERE id = ? AND status != 'deleted'"
    )
      .bind(status, new Date().toISOString(), match[1])
      .run();
    if (!result.meta?.changes) throw new HttpError(404, "评论不存在");
    return json({ ok: true });
  }
  const deleteMatch = url.pathname.match(/^\/api\/admin\/comments\/([^/]+)$/);
  if (deleteMatch && request.method === "DELETE") {
    const result = await env.COMMENTS_DB.prepare(
      "UPDATE comments SET status = 'deleted', moderated_at = ? WHERE id = ?"
    )
      .bind(new Date().toISOString(), deleteMatch[1])
      .run();
    if (!result.meta?.changes) throw new HttpError(404, "评论不存在");
    return json({ ok: true });
  }
  throw new HttpError(404, "接口不存在");
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
    if (url.pathname === "/api/comments") {
      try {
        return await publicComments(request, env);
      } catch (e) {
        return json(
          { error: e instanceof Error ? e.message : "请求失败" },
          e instanceof HttpError ? e.status : 400
        );
      }
    }
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
      if (
        url.pathname === "/api/admin/comments" ||
        url.pathname.startsWith("/api/admin/comments/")
      )
        return await adminComments(request, env);
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
