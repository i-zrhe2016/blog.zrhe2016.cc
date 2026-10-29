import { validateMarkdown } from "../src/admin/content";
import { slugifyStr } from "../src/utils/slugify";

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  ADMIN_EMAILS: string;
  ADMIN_ORIGIN: string;
  LOCAL_ADMIN_AUTH?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_WORKER_TAG?: string;
  COMMENTS_DB?: D1Database;
  MCP_TOKEN?: string;
  MCP_PREVIEW_BRANCH?: string;
  PREVIEW_ORIGIN?: string;
}
export interface D1Database {
  prepare(query: string): { bind(...values: unknown[]): any };
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function github(env: Env, path: string, init: RequestInit = {}) {
  if (!env.GITHUB_TOKEN) throw new HttpError(503, "GitHub 尚未配置");
  const response = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "blog-admin",
        "Content-Type": "application/json",
        ...init.headers,
      },
    }
  );
  if (!response.ok) {
    if ([409, 422].includes(response.status))
      throw new HttpError(409, "仓库已变化或文件冲突，请重新加载比较后发布");
    if (response.status === 404) throw new HttpError(404, "仓库或文章不存在");
    throw new HttpError(502, `GitHub 请求失败 (${response.status})`);
  }
  return response.json() as Promise<any>;
}
export const encodePath = (path: string) =>
  path.split("/").map(encodeURIComponent).join("/");
export function decode64(content: string) {
  return new TextDecoder().decode(
    Uint8Array.from(atob(content.replace(/\s/g, "")), c => c.charCodeAt(0))
  );
}
export function encode64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}
export async function getFile(env: Env, path: string, ref: string) {
  return github(
    env,
    `contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`
  );
}
export const mainBranch = (env: Env) => env.GITHUB_BRANCH || "main";
export const previewBranch = (env: Env) => env.MCP_PREVIEW_BRANCH || "preview";
export async function readBranchHead(env: Env, branch: string) {
  const ref = await github(env, `git/ref/heads/${encodeURIComponent(branch)}`);
  return String(ref.object.sha);
}
export async function createBranch(env: Env, branch: string, sha: string) {
  return github(env, "git/refs", {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
  });
}
/** Returns the branch head, creating the branch from the main branch when missing. */
export async function ensureBranch(env: Env, branch: string) {
  try {
    return await readBranchHead(env, branch);
  } catch (e) {
    if (!(e instanceof HttpError && e.status === 404)) throw e;
  }
  const base = await readBranchHead(env, mainBranch(env));
  try {
    await createBranch(env, branch, base);
    return base;
  } catch (e) {
    // A concurrent request created the branch between our read and create.
    if (e instanceof HttpError && e.status === 409)
      return readBranchHead(env, branch);
    throw e;
  }
}
export type TreeFile = {
  path: string;
  mode: string;
  type: string;
  sha: string | null;
};
/** Stages `files` in one tree, creates one commit and moves the branch with `force: false`. */
export async function commitFiles(
  env: Env,
  options: {
    branch: string;
    message: string;
    files: TreeFile[];
    parentSha?: string;
  }
) {
  const head = options.parentSha || (await readBranchHead(env, options.branch));
  const parent = await github(env, `git/commits/${head}`);
  const tree = await github(env, "git/trees", {
    method: "POST",
    body: JSON.stringify({ base_tree: parent.tree.sha, tree: options.files }),
  });
  const commit = await github(env, "git/commits", {
    method: "POST",
    body: JSON.stringify({
      message: options.message,
      tree: tree.sha,
      parents: [head],
    }),
  });
  await github(env, `git/refs/heads/${encodeURIComponent(options.branch)}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  return commit as { sha: string; html_url?: string };
}
export async function createBlob(env: Env, bytes: Uint8Array) {
  return github(env, "git/blobs", {
    method: "POST",
    body: JSON.stringify({ content: encode64(bytes), encoding: "base64" }),
  }) as Promise<{ sha: string }>;
}
export const isPostPath = (path: string) =>
  path.startsWith("src/content/posts/") &&
  path.endsWith(".md") &&
  !path.split("/").some(part => part.startsWith("_"));
/** Public route for a post file, mirroring `getPostSlug` without `astro:i18n`. */
export function postRoutePath(filePath: string) {
  const segments = filePath
    .replace(/^src\/content\/posts\//, "")
    .split("/")
    .filter(Boolean);
  const id = (segments.pop() || "").replace(/\.md$/, "");
  return ["", "posts", ...segments.map(slugifyStr), id, ""].join("/");
}
export function postUrl(origin: string | undefined, filePath: string) {
  if (!origin) return undefined;
  return `${origin.replace(/\/$/, "")}${postRoutePath(filePath)}`;
}
export async function listPosts(env: Env, branch = mainBranch(env)) {
  const head = await readBranchHead(env, branch);
  const tree = await github(env, `git/trees/${head}?recursive=1`);
  if (tree.truncated) throw new HttpError(502, "仓库目录过大，无法完整读取");
  const paths = tree.tree.filter(
    (f: any) => f.type === "blob" && isPostPath(f.path)
  );
  // Fetch in small batches to avoid a burst of concurrent GitHub requests.
  const posts: any[] = [];
  for (let i = 0; i < paths.length; i += 5) {
    posts.push(
      ...(await Promise.all(
        paths.slice(i, i + 5).map(async (f: any) => {
          try {
            const file = await getFile(env, f.path, head);
            const { metadata } = validateMarkdown(decode64(file.content));
            return {
              path: f.path,
              sha: f.sha,
              title: metadata.title,
              draft: !!metadata.draft,
              prerelease: !!metadata.prerelease,
              route: postRoutePath(f.path),
            };
          } catch {
            return {
              path: f.path,
              sha: f.sha,
              title: f.path.split("/").pop(),
              error: true,
            };
          }
        })
      ))
    );
  }
  return { sha: head, posts };
}
export async function deploymentStatus(
  env: Env,
  request: Request,
  sha: string
) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new HttpError(400, "无效提交");
  const markerResponse = await env.ASSETS.fetch(
    new Request(new URL("/admin/build.json", request.url))
  );
  if (
    markerResponse.ok &&
    markerResponse.headers.get("Content-Type")?.includes("application/json")
  ) {
    const marker: any = await markerResponse.json();
    if (marker.sha === sha)
      return {
        state: "success",
        message: "部署成功，当前站点已运行该版本",
      };
  }
  if (
    !env.CLOUDFLARE_API_TOKEN ||
    !env.CLOUDFLARE_ACCOUNT_ID ||
    !env.CLOUDFLARE_WORKER_TAG
  )
    return {
      state: "unknown",
      message: "已提交；尚未配置部署状态查询",
      url: `https://github.com/${env.GITHUB_REPO}/commit/${sha}`,
    };
  const dashboard = `https://dash.cloudflare.com/${env.CLOUDFLARE_ACCOUNT_ID}/workers-and-pages`;
  const base = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}`;
  const cf = async (path: string) => {
    const response = await fetch(`${base}/${path}`, {
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
    });
    const data: any = await response.json();
    if (!response.ok || !data.success)
      throw new HttpError(502, "Cloudflare 状态查询失败");
    return data.result;
  };
  const builds = await cf(
    `builds/workers/${encodeURIComponent(env.CLOUDFLARE_WORKER_TAG)}/builds?per_page=100`
  );
  const list: any[] = Array.isArray(builds) ? builds : builds.builds || [];
  const matching = list.filter(
    b =>
      b.build_trigger_metadata?.commit_hash === sha ||
      b.git_commit_hash === sha ||
      b.commit_hash === sha
  );
  if (!matching.length)
    return {
      state: "queued",
      message: "已提交，等待 Cloudflare 构建",
      url: dashboard,
    };
  const build = matching.sort((a, b) =>
    String(b.created_on).localeCompare(String(a.created_on))
  )[0];
  if (
    build.status === "stopped" &&
    ["fail", "cancelled", "terminated", "skipped"].includes(build.build_outcome)
  )
    return {
      state: "failed",
      message: "构建失败、被取消或跳过，请检查 Cloudflare 构建日志",
      url: dashboard,
    };
  if (build.status === "queued")
    return {
      state: "queued",
      message: "已提交，等待 Cloudflare 构建",
      url: dashboard,
    };
  if (build.status !== "stopped")
    return {
      state: "building",
      message: "Cloudflare 正在构建部署",
      url: dashboard,
    };

  return {
    state: "unknown",
    message: "构建完成，尚未确认该提交已上线",
    url: dashboard,
  };
}
