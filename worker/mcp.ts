import { z } from "zod";
import {
  HttpError,
  json,
  github,
  getFile,
  decode64,
  createBlob,
  commitFiles,
  readBranchHead,
  createBranch,
  ensureBranch,
  listPosts,
  mainBranch,
  previewBranch,
  postUrl,
  deploymentStatus,
  type Env,
  type TreeFile,
} from "./lib";
import {
  validateMarkdown,
  validatePostPath,
  joinMarkdown,
  validImage,
  imageTypes,
} from "../src/admin/content";

const PROTOCOL_VERSION = "2025-06-18";
/** Legacy revisions this server implements; newer clients negotiate down to one of these. */
const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_BODY = 24 * 1024 * 1024;
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

type JsonRpcId = string | number | null;
type ToolResult = Record<string, unknown>;

function message(e: unknown) {
  return e instanceof Error ? e.message : "请求失败";
}
function safeEqual(a: string, b: string) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++)
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}
function rpcResult(id: JsonRpcId, result: unknown) {
  return json({ jsonrpc: "2.0", id, result });
}
function rpcError(
  id: JsonRpcId,
  code: number,
  text: string,
  status = 200,
  data?: unknown
) {
  return json(
    {
      jsonrpc: "2.0",
      id,
      error: { code, message: text, ...(data === undefined ? {} : { data }) },
    },
    status
  );
}
async function authorize(request: Request, env: Env) {
  if (!env.MCP_TOKEN) throw new HttpError(503, "MCP 尚未配置 MCP_TOKEN");
  const header = request.headers.get("Authorization") || "";
  const token = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim() || "";
  if (!safeEqual(token, env.MCP_TOKEN))
    throw new HttpError(401, "MCP 令牌无效");
  const origin = request.headers.get("Origin");
  if (!origin) return;
  const local =
    env.LOCAL_ADMIN_AUTH === "true" &&
    LOCAL_HOSTS.includes(new URL(origin).hostname);
  if (!local && origin !== env.ADMIN_ORIGIN)
    throw new HttpError(403, "请求来源无效");
}

const statusEnum = z.enum(["published", "prerelease", "draft"]);
const imageSchema = z.object({
  name: z.string(),
  mediaType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
  data: z.string(),
});

type Tool = {
  description: string;
  inputSchema: Record<string, unknown>;
  schema: z.ZodTypeAny;
  annotations?: Record<string, unknown>;
  run: (env: Env, args: any, request: Request) => Promise<ToolResult>;
};

async function readPost(env: Env, path: string, branch: string) {
  const head = await readBranchHead(env, branch);
  let file: any;
  try {
    file = await getFile(env, path, head);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404)
      throw new HttpError(404, `分支 ${branch} 中没有 ${path}`);
    throw e;
  }
  return { head, file };
}
async function existingFile(env: Env, path: string, ref: string) {
  try {
    return await getFile(env, path, ref);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return undefined;
    throw e;
  }
}
function decodeBase64(data: string) {
  try {
    return Uint8Array.from(atob(data.replace(/\s/g, "")), c => c.charCodeAt(0));
  } catch {
    throw new HttpError(400, "图片内容不是有效的 base64");
  }
}
async function imageFiles(
  env: Env,
  images: { name: string; mediaType: string; data: string }[]
) {
  if (images.length > 100) throw new HttpError(400, "图片数量过多");
  const files: TreeFile[] = [];
  let total = 0;
  for (const image of images) {
    const bytes = decodeBase64(image.data);
    total += bytes.length;
    if (total > 20 * 1024 * 1024 || !validImage(bytes, image.mediaType))
      throw new HttpError(400, "图片格式或大小不符合要求");
    if (
      !new RegExp(`^[a-f0-9-]{36}\\.${imageTypes[image.mediaType]}$`).test(
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
  return files;
}
async function commitPost(
  env: Env,
  options: {
    path: string;
    markdown: string;
    branch: string;
    message: string;
    baseSha: string;
    parentSha: string;
    extraFiles?: TreeFile[];
  }
) {
  const rawBytes = new TextEncoder().encode(options.markdown);
  const existing = await existingFile(env, options.path, options.parentSha);
  if (
    existing &&
    decode64(existing.content) === options.markdown &&
    !options.extraFiles?.length
  )
    return {
      sha: options.parentSha,
      fileSha: existing.sha,
      recovered: true,
    };
  if (
    (existing?.sha || "") !== options.baseSha &&
    !(existing && decode64(existing.content) === options.markdown)
  )
    throw new HttpError(
      409,
      `分支 ${options.branch} 上的文章已变化（当前 sha：${existing?.sha || "无文件"}），请先用 get_post 读取该分支后再发布`
    );
  const blob = await createBlob(env, rawBytes);
  const files: TreeFile[] = [
    ...(options.extraFiles || []),
    { path: options.path, mode: "100644", type: "blob", sha: blob.sha },
  ];
  const commit = await commitFiles(env, {
    branch: options.branch,
    message: options.message,
    files,
    parentSha: options.parentSha,
  });
  return { sha: commit.sha, fileSha: blob.sha, commitUrl: commit.html_url };
}

async function previewFiles(env: Env, head: string) {
  const tree = await github(env, `git/trees/${head}?recursive=1`);
  if (tree.truncated) throw new HttpError(502, "仓库目录过大，无法完整读取");
  return tree.tree as TreeFile[];
}
async function previousPreviews(env: Env, head: string, keep?: string) {
  const files = await previewFiles(env, head);
  const removed: TreeFile[] = [];
  for (const file of files) {
    if (
      file.type !== "blob" ||
      file.path === keep ||
      !file.path.startsWith("src/content/posts/") ||
      !file.path.endsWith(".md")
    )
      continue;
    const source = await getFile(env, file.path, head);
    const { metadata } = validateMarkdown(decode64(source.content));
    if (metadata.prerelease) removed.push({ ...file, sha: null });
  }
  return removed;
}
async function clearPreview(env: Env, path: string, fileSha: string) {
  const branch = previewBranch(env);
  try {
    const head = await readBranchHead(env, branch);
    const file = await existingFile(env, path, head);
    if (!file) return { cleared: true, sha: head };
    if (file.sha !== fileSha)
      return {
        cleared: false,
        message: "文章已发布，但预览已有新修改，保留新预览",
      };
    const commit = await commitFiles(env, {
      branch,
      parentSha: head,
      message: `content: clear preview ${path.split("/").pop()}`,
      files: [{ path, mode: "100644", type: "blob", sha: null }],
    });
    return { cleared: true, sha: commit.sha };
  } catch (e) {
    return {
      cleared: false,
      message: `文章已发布，预览清理失败：${message(e)}`,
    };
  }
}

const TOOLS: Record<string, Tool> = {
  list_posts: {
    description: "列出文章元数据（路径、标题、草稿、预发布状态、文件 sha）。",
    inputSchema: {
      type: "object",
      properties: {
        branch: { type: "string", description: "分支，默认正式分支 main" },
      },
      additionalProperties: false,
    },
    schema: z.object({ branch: z.string().min(1).optional() }),
    annotations: { readOnlyHint: true },
    async run(env, args) {
      const branch = args.branch || mainBranch(env);
      const { sha, posts } = await listPosts(env, branch);
      return { branch, sha, posts };
    },
  },
  get_post: {
    description: "读取文章完整 Markdown 与文件 sha（作为后续 baseSha）。",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "如 src/content/posts/hello.md" },
        branch: { type: "string" },
      },
      required: ["path"],
      additionalProperties: false,
    },
    schema: z.object({
      path: z.string().min(1),
      branch: z.string().min(1).optional(),
    }),
    annotations: { readOnlyHint: true },
    async run(env, args) {
      const path = validatePostPath(args.path);
      const branch = args.branch || mainBranch(env);
      const { head, file } = await readPost(env, path, branch);
      return {
        path,
        branch,
        sha: file.sha,
        head,
        markdown: decode64(file.content),
      };
    },
  },
  publish_post: {
    description:
      "写入文章。status=published 发布到正式分支；prerelease 替换上一篇预览，仅预览当前文章；draft 在正式分支标记为草稿。",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        markdown: {
          type: "string",
          description: "含完整 YAML frontmatter 的 Markdown",
        },
        status: { type: "string", enum: ["published", "prerelease", "draft"] },
        baseSha: { type: "string", description: "文件当前 sha；新建文章省略" },
        images: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "形如 <uuid>.png" },
              mediaType: { type: "string" },
              data: { type: "string", description: "base64 内容" },
            },
            required: ["name", "mediaType", "data"],
          },
        },
      },
      required: ["path", "markdown"],
      additionalProperties: false,
    },
    schema: z.object({
      path: z.string().min(1),
      markdown: z.string().min(1),
      status: statusEnum.optional(),
      baseSha: z.string().optional(),
      images: z.array(imageSchema).max(100).optional(),
    }),
    annotations: { destructiveHint: true },
    async run(env, args) {
      const path = validatePostPath(args.path);
      const { metadata, body } = validateMarkdown(args.markdown);
      const status: "published" | "prerelease" | "draft" =
        args.status || "published";
      const branch =
        status === "prerelease" ? previewBranch(env) : mainBranch(env);
      const updated: Record<string, unknown> = { ...metadata };
      if (status === "draft") {
        updated.draft = true;
        delete updated.prerelease;
      } else if (status === "prerelease") {
        updated.draft = false;
        updated.prerelease = true;
      } else {
        updated.draft = false;
        delete updated.prerelease;
      }
      if (args.baseSha) updated.modDatetime = new Date().toISOString();
      const markdown = joinMarkdown(updated, body);
      const parentSha =
        status === "prerelease"
          ? await ensureBranch(env, branch)
          : await readBranchHead(env, branch);
      const removed =
        status === "prerelease"
          ? await previousPreviews(env, parentSha, path)
          : [];
      const extraFiles = [
        ...removed,
        ...(await imageFiles(env, args.images || [])),
      ];
      const result = await commitPost(env, {
        path,
        markdown,
        branch,
        message: `content: ${status} ${path.split("/").pop()}`,
        baseSha: args.baseSha || "",
        parentSha,
        extraFiles,
      });
      return {
        ...result,
        path,
        branch,
        status,
        url: postUrl(
          status === "prerelease" ? env.PREVIEW_ORIGIN : env.ADMIN_ORIGIN,
          path
        ),
      };
    },
  },
  promote_post: {
    description:
      "把当前预览文章及图片发布到正式分支，成功提交后自动移除预览文章；返回 previewCleanup 清理结果。",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        baseSha: {
          type: "string",
          description: "正式分支上该文件的 sha；正文被本地修改过时必填",
        },
      },
      required: ["path"],
      additionalProperties: false,
    },
    schema: z.object({
      path: z.string().min(1),
      baseSha: z.string().optional(),
    }),
    annotations: { destructiveHint: true },
    async run(env, args) {
      const path = validatePostPath(args.path);
      const preview = previewBranch(env);
      const { head: previewHead, file: previewFile } = await readPost(
        env,
        path,
        preview
      );
      const { metadata, body } = validateMarkdown(
        decode64(previewFile.content)
      );
      if (!metadata.prerelease)
        throw new HttpError(409, "该文章不是待发布的预览文章");
      const updated: Record<string, unknown> = {
        ...metadata,
        draft: false,
      };
      delete updated.prerelease;
      const branch = mainBranch(env);
      const parentSha = await readBranchHead(env, branch);
      const mainFiles = await previewFiles(env, parentSha);
      const mainAssets = new Map(mainFiles.map(file => [file.path, file.sha]));
      const assets = (await previewFiles(env, previewHead)).filter(
        file =>
          file.type === "blob" &&
          !mainAssets.has(file.path) &&
          (file.path.startsWith("public/images/uploads/") ||
            file.path.startsWith("public/diagrams/plantuml/"))
      );
      const result = await commitPost(env, {
        path,
        markdown: joinMarkdown(updated, body),
        branch,
        message: `content: publish ${path.split("/").pop()}`,
        baseSha: args.baseSha || "",
        parentSha,
        extraFiles: assets,
      });
      const previewCleanup = await clearPreview(env, path, previewFile.sha);
      return {
        ...result,
        previewCleanup,
        path,
        branch,
        url: postUrl(env.ADMIN_ORIGIN, path),
      };
    },
  },
  unpublish_post: {
    description: "在正式分支把文章标记为草稿，重新构建后从公开站点移除。",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" }, baseSha: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
    schema: z.object({
      path: z.string().min(1),
      baseSha: z.string().optional(),
    }),
    annotations: { destructiveHint: true },
    async run(env, args) {
      const path = validatePostPath(args.path);
      const branch = mainBranch(env);
      const { head, file } = await readPost(env, path, branch);
      const { metadata, body } = validateMarkdown(decode64(file.content));
      const baseSha = args.baseSha || file.sha;
      const result = await commitPost(env, {
        path,
        markdown: joinMarkdown(
          { ...metadata, draft: true, modDatetime: new Date().toISOString() },
          body
        ),
        branch,
        message: `content: unpublish ${path.split("/").pop()}`,
        baseSha,
        parentSha: head,
      });
      return { ...result, path, branch, status: "draft" };
    },
  },
  sync_preview: {
    description:
      "把预览分支对齐到正式分支。预览分支有未提升改动时需要显式 force。",
    inputSchema: {
      type: "object",
      properties: {
        force: {
          type: "boolean",
          description: "丢弃预览分支上未提升的改动并对齐正式分支",
        },
      },
      additionalProperties: false,
    },
    schema: z.object({ force: z.boolean().optional() }),
    annotations: { destructiveHint: true },
    async run(env, args) {
      const main = mainBranch(env);
      const preview = previewBranch(env);
      const mainHead = await readBranchHead(env, main);
      let previewHead: string;
      try {
        previewHead = await readBranchHead(env, preview);
      } catch (e) {
        if (!(e instanceof HttpError && e.status === 404)) throw e;
        await createBranch(env, preview, mainHead);
        return { branch: preview, sha: mainHead, created: true };
      }
      if (previewHead === mainHead)
        return { branch: preview, sha: mainHead, upToDate: true };
      const compare: any = await github(
        env,
        `compare/${mainHead}...${previewHead}`
      );
      const files: string[] = (compare.files || []).map((f: any) => f.filename);
      const inSync =
        compare.status === "identical" || compare.status === "behind";
      if (!inSync && !args.force)
        throw new HttpError(
          409,
          `预览分支有 ${files.length} 处未提升的改动：${files.join("、")}；确认丢弃请传 force: true`
        );
      await github(env, `git/refs/heads/${encodeURIComponent(preview)}`, {
        method: "PATCH",
        body: JSON.stringify({ sha: mainHead, force: !inSync }),
      });
      return {
        branch: preview,
        sha: mainHead,
        previous: previewHead,
        ...(inSync ? {} : { discarded: files }),
      };
    },
  },
  deployment_status: {
    description: "查询某个提交在 Cloudflare Workers 上的构建/部署状态。",
    inputSchema: {
      type: "object",
      properties: { sha: { type: "string", description: "40 位提交 SHA" } },
      required: ["sha"],
      additionalProperties: false,
    },
    schema: z.object({ sha: z.string().min(1) }),
    annotations: { readOnlyHint: true },
    async run(env, args, request) {
      return deploymentStatus(env, request, args.sha);
    },
  },
};

function toolList() {
  return Object.entries(TOOLS).map(([name, tool]) => ({
    name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    ...(tool.annotations ? { annotations: tool.annotations } : {}),
  }));
}
async function callTool(
  id: JsonRpcId,
  params: any,
  env: Env,
  request: Request
) {
  const name = String(params?.name || "");
  const tool = TOOLS[name];
  if (!tool) return rpcError(id, -32602, `未知工具：${name}`);
  const parsed = tool.schema.safeParse(params?.arguments ?? {});
  if (!parsed.success)
    return rpcError(
      id,
      -32602,
      `参数无效：${parsed.error.issues
        .map(issue => `${issue.path.join(".") || "arguments"} ${issue.message}`)
        .join("；")}`
    );
  try {
    const data = await tool.run(env, parsed.data, request);
    return rpcResult(id, {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: data,
    });
  } catch (e) {
    return rpcResult(id, {
      content: [{ type: "text", text: message(e) }],
      isError: true,
    });
  }
}
export async function handleMcp(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST")
    return json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "MCP 端点只接受 POST" },
      },
      405
    );
  try {
    await authorize(request, env);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 400;
    return json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32001, message: message(e) },
      },
      status
    );
  }
  if (Number(request.headers.get("Content-Length") || 0) > MAX_BODY)
    return rpcError(null, -32600, "请求内容过大", 413);
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return rpcError(null, -32700, "JSON 解析失败", 400);
  }
  if (Array.isArray(payload))
    return rpcError(null, -32600, "不支持批量请求", 400);
  if (
    !payload ||
    typeof payload !== "object" ||
    payload.jsonrpc !== "2.0" ||
    typeof payload.method !== "string"
  )
    return rpcError(null, -32600, "无效的 JSON-RPC 请求", 400);
  // Newer clients probe with `server/discover`; answer it before version gating so
  // they can learn which revisions this server speaks and negotiate down.
  if (payload.method === "server/discover")
    return rpcResult(payload.id ?? null, {
      resultType: "complete",
      supportedVersions: SUPPORTED_VERSIONS,
      capabilities: { tools: {} },
      _meta: {
        "io.modelcontextprotocol/serverInfo": {
          name: "blog-publisher",
          version: "1.0.0",
        },
      },
      ttlMs: 3_600_000,
      cacheScope: "private",
    });
  const requested = request.headers.get("MCP-Protocol-Version");
  if (requested && !SUPPORTED_VERSIONS.includes(requested))
    return rpcError(
      payload.id ?? null,
      -32022,
      `不支持的协议版本：${requested}`,
      400,
      { supported: SUPPORTED_VERSIONS }
    );
  const id: JsonRpcId = payload.id ?? null;
  // Notifications and client responses carry no id and need no reply.
  if (payload.id === undefined || payload.id === null)
    return new Response(null, {
      status: 202,
      headers: { "Cache-Control": "no-store" },
    });
  switch (payload.method) {
    case "initialize": {
      const asked = String(payload.params?.protocolVersion || "");
      return rpcResult(id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(asked)
          ? asked
          : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "blog-publisher", version: "1.0.0" },
        instructions:
          "发布博客文章。publish_post(status=prerelease) 仅保留当前一篇预览并替换旧预览；审阅后用 promote_post 发布到正式分支并自动移除预览。",
      });
    }
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: toolList() });
    case "tools/call":
      return callTool(id, payload.params, env, request);
    default:
      return rpcError(id, -32601, `未知方法：${payload.method}`);
  }
}
