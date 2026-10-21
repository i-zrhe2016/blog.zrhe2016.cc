import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index";
import { isPostVisible } from "../src/utils/postVisibility";

type Env = Parameters<typeof worker.fetch>[1];
type Call = { url: string; method: string; body: any };

const MAIN_HEAD = "a".repeat(40);
const PREVIEW_HEAD = "b".repeat(40);
const COMMIT = "c".repeat(40);
const BLOB = "d".repeat(40);
const FILE_SHA = "e".repeat(40);
const postPath = "src/content/posts/preview-demo.md";
const markdown = `---
title: 预发布示例
description: 通过 MCP 发布的文章
pubDatetime: 2026-10-21T08:00:00Z
tags:
  - MCP
draft: false
---

正文
`;

function env(extra: Partial<Env> = {}): Env {
  return {
    ASSETS: { fetch: async () => Response.json({ sha: "other" }) },
    GITHUB_TOKEN: "test",
    GITHUB_REPO: "owner/blog",
    GITHUB_BRANCH: "main",
    ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
    ACCESS_AUD: "aud",
    ADMIN_EMAILS: "me@example.com",
    ADMIN_ORIGIN: "https://blog.example",
    MCP_TOKEN: "secret",
    MCP_PREVIEW_BRANCH: "preview",
    PREVIEW_ORIGIN: "https://preview.blog.example",
    ...extra,
  };
}
function mcp(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://blog.example/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer secret",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
function call(name: string, args: Record<string, unknown>, id = 1) {
  return mcp({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args },
  });
}
function blobSource(calls: Call[], index = 0) {
  const blobs = calls.filter(
    c => c.method === "POST" && c.url.endsWith("git/blobs")
  );
  return Buffer.from(blobs[index].body.content, "base64").toString("utf8");
}
function mockGithub(
  t: TestContext,
  options: {
    preview?: boolean;
    /** Map of `<ref sha>:<path>` to file content. */
    files?: Record<string, string>;
    compare?: { status: string; files?: { filename: string }[] };
  } = {}
) {
  const calls: Call[] = [];
  const branches = new Map<string, string>([["main", MAIN_HEAD]]);
  if (options.preview !== false) branches.set("preview", PREVIEW_HEAD);
  t.mock.method(
    globalThis,
    "fetch",
    async (resource: string | URL | Request, init?: RequestInit) => {
      const url = String(resource);
      const method = init?.method || "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url, method, body });
      const refHead = url.match(/git\/ref\/heads\/([^/?]+)/);
      if (method === "GET" && refHead) {
        const sha = branches.get(decodeURIComponent(refHead[1]));
        return sha
          ? Response.json({ object: { sha } })
          : Response.json({ message: "Not Found" }, { status: 404 });
      }
      if (url.endsWith("git/refs") && method === "POST") {
        branches.set(String(body.ref).replace("refs/heads/", ""), body.sha);
        return Response.json({ ref: body.ref }, { status: 201 });
      }
      if (url.includes("contents/") && method === "GET") {
        const path = decodeURIComponent(
          url.split("contents/")[1].split("?")[0]
        );
        const ref = new URL(url).searchParams.get("ref")!;
        const content = options.files?.[`${ref}:${path}`];
        if (content === undefined)
          return Response.json({ message: "Not Found" }, { status: 404 });
        return Response.json({
          sha: FILE_SHA,
          content: Buffer.from(content).toString("base64"),
        });
      }
      if (url.includes("compare/"))
        return Response.json({
          status: options.compare?.status || "identical",
          files: options.compare?.files || [],
        });
      if (url.endsWith("git/blobs")) return Response.json({ sha: BLOB });
      if (/git\/commits\/[a-f0-9]{40}$/.test(url) && method === "GET")
        return Response.json({ tree: { sha: "t".repeat(40) } });
      if (url.endsWith("git/trees"))
        return Response.json({ sha: "t".repeat(40) });
      if (url.endsWith("git/commits") && method === "POST")
        return Response.json({
          sha: COMMIT,
          html_url: `https://github.com/commit/${COMMIT}`,
        });
      if (url.includes("git/refs/heads/") && method === "PATCH")
        return Response.json({ object: { sha: body.sha } });
      throw new Error(`Unexpected fetch ${url}`);
    }
  );
  return calls;
}

test("mcp requires a configured bearer token", async () => {
  assert.equal(
    (
      await worker.fetch(
        mcp({ jsonrpc: "2.0", id: 1, method: "ping" }),
        env({ MCP_TOKEN: undefined })
      )
    ).status,
    503
  );
  for (const authorization of [null, "Bearer wrong", "basic x"]) {
    const response = await worker.fetch(
      new Request("https://blog.example/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authorization ? { Authorization: authorization } : {}),
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
      }),
      env()
    );
    assert.equal(response.status, 401, String(authorization));
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  const ok = await worker.fetch(
    mcp({ jsonrpc: "2.0", id: 1, method: "ping" }),
    env()
  );
  assert.deepEqual(await ok.json(), { jsonrpc: "2.0", id: 1, result: {} });
});
test("rejects cross-origin browser callers but allows server-to-server calls", async () => {
  const body = { jsonrpc: "2.0", id: 1, method: "ping" };
  assert.equal(
    (await worker.fetch(mcp(body, { Origin: "https://evil.example" }), env()))
      .status,
    403
  );
  assert.equal(
    (await worker.fetch(mcp(body, { Origin: "https://blog.example" }), env()))
      .status,
    200
  );
});
test("negotiates protocol versions and answers the discovery probe", async () => {
  const init = await worker.fetch(
    mcp({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26" },
    }),
    env()
  );
  const result = ((await init.json()) as any).result;
  assert.equal(result.protocolVersion, "2025-03-26");
  assert.deepEqual(result.capabilities, { tools: { listChanged: false } });

  const unknown = await worker.fetch(
    mcp({
      jsonrpc: "2.0",
      id: 2,
      method: "initialize",
      params: { protocolVersion: "2030-01-01" },
    }),
    env()
  );
  assert.equal(
    ((await unknown.json()) as any).result.protocolVersion,
    "2025-06-18"
  );

  const rejected = await worker.fetch(
    mcp(
      { jsonrpc: "2.0", id: 3, method: "tools/list" },
      { "MCP-Protocol-Version": "2026-07-28" }
    ),
    env()
  );
  assert.equal(rejected.status, 400);
  const error = ((await rejected.json()) as any).error;
  assert.equal(error.code, -32022);
  assert.ok(error.data.supported.includes("2025-06-18"));

  const discover = await worker.fetch(
    mcp(
      { jsonrpc: "2.0", id: 4, method: "server/discover" },
      { "MCP-Protocol-Version": "2026-07-28" }
    ),
    env()
  );
  assert.equal(discover.status, 200);
  assert.ok(
    ((await discover.json()) as any).result.supportedVersions.includes(
      "2025-06-18"
    )
  );
});
test("accepts notifications without a body and refuses non-POST methods", async () => {
  const notification = await worker.fetch(
    mcp({ jsonrpc: "2.0", method: "notifications/initialized" }),
    env()
  );
  assert.equal(notification.status, 202);
  assert.equal(await notification.text(), "");
  for (const method of ["GET", "DELETE"]) {
    const response = await worker.fetch(
      new Request("https://blog.example/mcp", {
        method,
        headers: { Authorization: "Bearer secret" },
      }),
      env()
    );
    assert.equal(response.status, 405, method);
  }
});
test("lists the publishing tools with object input schemas", async () => {
  const response = await worker.fetch(
    mcp({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    env()
  );
  const tools = ((await response.json()) as any).result.tools as any[];
  assert.deepEqual(tools.map(tool => tool.name).sort(), [
    "deployment_status",
    "get_post",
    "list_posts",
    "promote_post",
    "publish_post",
    "sync_preview",
    "unpublish_post",
  ]);
  for (const tool of tools) {
    assert.equal(tool.inputSchema.type, "object", tool.name);
    assert.equal(typeof tool.description, "string");
  }
});
test("unknown tool and bad arguments are protocol errors", async () => {
  const unknown = await worker.fetch(call("nope", {}), env());
  assert.equal(((await unknown.json()) as any).error.code, -32602);
  const wrongType = await worker.fetch(
    call("get_post", { path: 42 as any }),
    env()
  );
  assert.equal(((await wrongType.json()) as any).error.code, -32602);
  const badPath = await worker.fetch(
    call("get_post", { path: "../secret.md" }),
    env()
  );
  assert.equal(((await badPath.json()) as any).result.isError, true);
});
test("prerelease creates the preview branch and marks the post", async t => {
  const calls = mockGithub(t, { preview: false });
  const response = await worker.fetch(
    call("publish_post", { path: postPath, markdown, status: "prerelease" }),
    env()
  );
  const result = (await response.json()) as any;
  assert.equal(result.result.isError, undefined, JSON.stringify(result));
  assert.deepEqual(calls.find(c => c.url.endsWith("git/refs"))!.body, {
    ref: "refs/heads/preview",
    sha: MAIN_HEAD,
  });
  assert.match(calls.at(-1)!.url, /git\/refs\/heads\/preview$/);
  assert.equal(calls.at(-1)!.body.force, false);
  const written = blobSource(calls);
  assert.match(written, /prerelease: true/);
  assert.match(written, /draft: false/);
  assert.equal(result.result.structuredContent.branch, "preview");
  assert.equal(result.result.structuredContent.status, "prerelease");
  assert.equal(
    result.result.structuredContent.url,
    "https://preview.blog.example/posts/preview-demo/"
  );
});
test("publishing to main strips the prerelease marker", async t => {
  const calls = mockGithub(t);
  const source = markdown.replace(
    "draft: false",
    "draft: false\nprerelease: true"
  );
  const response = await worker.fetch(
    call("publish_post", {
      path: postPath,
      markdown: source,
      status: "published",
    }),
    env()
  );
  assert.equal(((await response.json()) as any).result.isError, undefined);
  const written = blobSource(calls);
  assert.doesNotMatch(written, /prerelease/);
  assert.match(written, /draft: false/);
  assert.match(calls.at(-1)!.url, /git\/refs\/heads\/main$/);
});
test("stale baseSha is reported without any mutation", async t => {
  const calls = mockGithub(t, {
    files: { [`${PREVIEW_HEAD}:${postPath}`]: markdown },
  });
  const response = await worker.fetch(
    call("publish_post", {
      path: postPath,
      markdown,
      status: "prerelease",
      baseSha: "stale",
    }),
    env()
  );
  const result = (await response.json()) as any;
  assert.equal(result.result.isError, true);
  assert.match(result.result.content[0].text, /get_post/);
  assert.ok(calls.every(c => c.method === "GET"));
});
test("identical prerelease retry recovers without writing", async t => {
  const existing = markdown.replace(
    "draft: false",
    "draft: false\nprerelease: true"
  );
  const calls = mockGithub(t, {
    files: { [`${PREVIEW_HEAD}:${postPath}`]: existing },
  });
  const response = await worker.fetch(
    call("publish_post", { path: postPath, markdown, status: "prerelease" }),
    env()
  );
  const result = (await response.json()) as any;
  assert.equal(result.result.structuredContent.recovered, true);
  assert.ok(calls.every(c => c.method === "GET"));
});
test("promote copies the preview content to main without the marker", async t => {
  const existing = markdown.replace(
    "draft: false",
    "draft: false\nprerelease: true"
  );
  const calls = mockGithub(t, {
    files: { [`${PREVIEW_HEAD}:${postPath}`]: existing },
  });
  const response = await worker.fetch(
    call("promote_post", { path: postPath }),
    env()
  );
  const result = (await response.json()) as any;
  assert.equal(result.result.isError, undefined, JSON.stringify(result));
  const written = blobSource(calls);
  assert.doesNotMatch(written, /prerelease/);
  assert.match(written, /draft: false/);
  assert.match(written, /modDatetime/);
  assert.match(calls.at(-1)!.url, /git\/refs\/heads\/main$/);
  assert.equal(
    result.result.structuredContent.url,
    "https://blog.example/posts/preview-demo/"
  );
});
test("sync_preview refuses to drop unpromoted work unless forced", async t => {
  const calls = mockGithub(t, {
    compare: { status: "diverged", files: [{ filename: postPath }] },
  });
  const guarded = await worker.fetch(call("sync_preview", {}), env());
  assert.equal(((await guarded.json()) as any).result.isError, true);
  assert.ok(calls.every(c => c.method === "GET"));

  const forced = await worker.fetch(
    call("sync_preview", { force: true }),
    env()
  );
  const result = (await forced.json()) as any;
  assert.equal(result.result.structuredContent.sha, MAIN_HEAD);
  assert.deepEqual(calls.at(-1)!.body, { sha: MAIN_HEAD, force: true });
});
test("prerelease posts stay hidden outside preview builds", () => {
  const data = { pubDatetime: "2026-01-01T00:00:00Z", prerelease: true };
  assert.equal(
    isPostVisible(data, { dev: false, prereleaseBuild: false }),
    false
  );
  assert.equal(
    isPostVisible(data, { dev: false, prereleaseBuild: true }),
    true
  );
  assert.equal(
    isPostVisible(data, { dev: true, prereleaseBuild: false }),
    true
  );
  assert.equal(
    isPostVisible(
      { pubDatetime: "2026-01-01T00:00:00Z", draft: true, prerelease: true },
      { dev: true, prereleaseBuild: true }
    ),
    false
  );
});
