import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import worker from "../worker/index";
import {
  splitMarkdown,
  joinMarkdown,
  validateMarkdown,
  validatePostPath,
  validImage,
} from "../src/admin/content";

type Env = Parameters<typeof worker.fetch>[1];
const path = "src/content/posts/hello.md";
const oldRaw = joinMarkdown(
  {
    title: "原文章",
    description: "摘要",
    pubDatetime: "2025-04-17T12:32:00Z",
    tags: [],
  },
  "\n```text\n  keep whitespace\n```\n"
);
const newRaw = oldRaw.replace("原文章", "新文章");
const headSha = "a".repeat(40),
  commitSha = "b".repeat(40),
  blobSha = "c".repeat(40);
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
    LOCAL_ADMIN_AUTH: "true",
    ...extra,
  };
}
function request(raw = newRaw, baseSha = "old", images: File[] = []) {
  const form = new FormData();
  form.set("path", path);
  form.set(
    "markdown",
    new Blob([raw], { type: "text/markdown" }),
    "article.md"
  );
  form.set("baseSha", baseSha);
  images.forEach(f => form.append("images", f));
  return new Request("http://localhost/api/admin/publish", {
    method: "POST",
    headers: { Origin: "http://localhost" },
    body: form,
  });
}
function mockGithub(
  t: TestContext,
  options: { existing?: string; conflict?: boolean; existingSha?: string } = {}
) {
  const calls: { url: string; method: string; body: any }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (resource: string | URL | Request, init?: RequestInit) => {
      const url = String(resource);
      const method = init?.method || "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url, method, body });
      if (url.includes("git/ref/heads/"))
        return Response.json({ object: { sha: headSha } });
      if (url.includes("contents/"))
        return Response.json({
          sha: options.existingSha || "old",
          content: Buffer.from(options.existing || oldRaw).toString("base64"),
        });
      if (url.endsWith("git/blobs")) return Response.json({ sha: blobSha });
      if (url.endsWith(`git/commits/${headSha}`))
        return Response.json({ tree: { sha: "tree" } });
      if (url.endsWith("git/trees")) return Response.json({ sha: "newtree" });
      if (url.endsWith("git/commits")) return Response.json({ sha: commitSha });
      if (url.includes("git/refs/heads/"))
        return options.conflict
          ? Response.json({}, { status: 422 })
          : Response.json({ object: { sha: commitSha } });
      throw new Error(`Unexpected fetch ${url}`);
    }
  );
  return calls;
}
test("all existing articles round-trip without changing body, metadata or path", async () => {
  const names = (await readdir("src/content/posts")).filter(n =>
    n.endsWith(".md")
  );
  assert.ok(names.length > 0);
  for (const name of names) {
    validatePostPath(`src/content/posts/${name}`);
    const raw = await readFile(`src/content/posts/${name}`, "utf8");
    const original = validateMarkdown(raw);
    const roundtrip = splitMarkdown(
      joinMarkdown(original.metadata, original.body)
    );
    assert.deepEqual(roundtrip, original, name);
  }
});
test("reject traversal, underscored drafts, MDX, duplicate YAML and invalid metadata", () => {
  for (const path of [
    "../x.md",
    "src/content/posts/../x.md",
    "src/content/posts/_hidden.md",
    "src/content/posts/a.mdx",
    "src/content/posts/a%2fb.md",
  ])
    assert.throws(() => validatePostPath(path));
  assert.throws(() => validateMarkdown("---\ntitle: one\ntitle: two\n---\n"));
  assert.throws(() =>
    validateMarkdown(newRaw.replace("2025-04-17T12:32:00Z", "invalid"))
  );
  assert.throws(() =>
    validateMarkdown(newRaw.replace("description: 摘要", "description: ''"))
  );
});
test("validate image signatures and size", () => {
  assert.ok(
    validImage(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), "image/png")
  );
  assert.ok(
    !validImage(
      new TextEncoder().encode("<script>alert(1)</script>"),
      "image/png"
    )
  );
  assert.ok(!validImage(new Uint8Array(5 * 1024 * 1024 + 1), "image/png"));
  assert.ok(!validImage(new TextEncoder().encode("<svg/>"), "image/svg+xml"));
});
test("public assets bypass auth; every admin entry requires auth even on alternate host", async () => {
  const configured = env({ LOCAL_ADMIN_AUTH: undefined });
  assert.equal(
    (await worker.fetch(new Request("https://blog.example/"), configured))
      .status,
    200
  );
  for (const route of [
    "/admin",
    "/admin/",
    "/admin/index.html",
    "/admin/build.json",
    "/api/admin/posts",
  ]) {
    const response = await worker.fetch(
      new Request(`https://alternate.workers.dev${route}`),
      configured
    );
    assert.equal(response.status, 401, route);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  assert.equal(
    (await worker.fetch(new Request("https://blog.example/admin/"), env()))
      .status,
    401,
    "local auth never bypasses production hostname"
  );
});
test("JWT signature, issuer, audience, expiration and allowed email are verified", async t => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "test";
  jwk.alg = "RS256";
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ keys: [jwk] })
  );
  const configured = env({
    LOCAL_ADMIN_AUTH: undefined,
    ACCESS_TEAM_DOMAIN: "jwt-test.cloudflareaccess.com",
  });
  const issuer = `https://${configured.ACCESS_TEAM_DOMAIN}`;
  async function token(
    email = "me@example.com",
    aud = "aud",
    iss = issuer,
    expiration = "1h"
  ) {
    return new SignJWT({ email })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer(iss)
      .setAudience(aud)
      .setIssuedAt()
      .setExpirationTime(expiration)
      .sign(privateKey);
  }
  const send = (jwt: string) =>
    worker.fetch(
      new Request("https://blog.example/admin/", {
        headers: { "Cf-Access-Jwt-Assertion": jwt },
      }),
      configured
    );
  assert.equal((await send(await token())).status, 200);
  assert.equal((await send(await token("other@example.com"))).status, 401);
  assert.equal(
    (await send(await token("me@example.com", "wrong"))).status,
    401
  );
  assert.equal(
    (await send(await token("me@example.com", "aud", "https://wrong"))).status,
    401
  );
  assert.equal(
    (await send(await token("me@example.com", "aud", issuer, "-1h"))).status,
    401
  );
  assert.equal((await send("forged.payload.signature")).status, 401);
});
test("reject cross-origin writes before GitHub access", async () => {
  const req = request();
  req.headers.set("Origin", "https://evil.example");
  assert.equal((await worker.fetch(req, env())).status, 403);
});
test("publish article and image atomically with non-force ref update", async t => {
  const calls = mockGithub(t);
  const name = "12345678-1234-1234-1234-123456789abc.png";
  const image = new File(
    [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])],
    name,
    { type: "image/png" }
  );
  const response = await worker.fetch(request(newRaw, "old", [image]), env());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sha: commitSha, fileSha: blobSha });
  const tree = calls.find(c => c.url.endsWith("git/trees"))!.body;
  assert.deepEqual(
    tree.tree.map((f: any) => f.path),
    [`public/images/uploads/${name}`, path]
  );
  const commits = calls.filter(
    c => c.method === "POST" && c.url.endsWith("git/commits")
  );
  assert.equal(commits.length, 1);
  assert.deepEqual(commits[0].body.parents, [headSha]);
  assert.equal(calls.at(-1)!.body.force, false);
});
test("remote file changes return 409 without mutations", async t => {
  const calls = mockGithub(t, { existingSha: "changed" });
  assert.equal((await worker.fetch(request(), env())).status, 409);
  assert.ok(calls.every(c => c.method === "GET"));
});
test("concurrent branch update cannot be overwritten", async t => {
  mockGithub(t, { conflict: true });
  assert.equal((await worker.fetch(request(), env())).status, 409);
});
test("retry after response loss recovers existing commit without duplicate writes", async t => {
  const calls = mockGithub(t, { existing: newRaw, existingSha: blobSha });
  const response = await worker.fetch(request(), env());
  assert.deepEqual(await response.json(), {
    sha: headSha,
    fileSha: blobSha,
    recovered: true,
  });
  assert.ok(calls.every(c => c.method === "GET"));
});
test("invalid image is rejected before creating blobs", async t => {
  const calls = mockGithub(t);
  const image = new File(
    ["not a png"],
    "12345678-1234-1234-1234-123456789abc.png",
    { type: "image/png" }
  );
  assert.equal(
    (await worker.fetch(request(newRaw, "old", [image]), env())).status,
    400
  );
  assert.ok(calls.every(c => c.method === "GET"));
});
test("deployment only reports success when active asset marker matches", async () => {
  const url = `http://localhost/api/admin/deployments/${commitSha}`;
  const response = await worker.fetch(
    new Request(url),
    env({ ASSETS: { fetch: async () => Response.json({ sha: commitSha }) } })
  );
  assert.equal(((await response.json()) as any).state, "success");
  const pending = await worker.fetch(new Request(url), env());
  assert.equal(((await pending.json()) as any).state, "unknown");
});
test("Cloudflare failed build and completed but inactive build stay distinct", async t => {
  let outcome = "fail";
  t.mock.method(
    globalThis,
    "fetch",
    async (resource: string | URL | Request) => {
      assert.match(
        String(resource),
        /builds\/workers\/worker-tag\/builds\?per_page=100/
      );
      return Response.json({
        success: true,
        result: [
          {
            build_trigger_metadata: { commit_hash: commitSha },
            status: "stopped",
            build_outcome: outcome,
          },
        ],
      });
    }
  );
  const configured = env({
    CLOUDFLARE_API_TOKEN: "test",
    CLOUDFLARE_ACCOUNT_ID: "account",
    CLOUDFLARE_WORKER_TAG: "worker-tag",
  });
  const send = () =>
    worker.fetch(
      new Request(`http://localhost/api/admin/deployments/${commitSha}`),
      configured
    );
  assert.equal(((await (await send()).json()) as any).state, "failed");
  outcome = "success";
  assert.equal(((await (await send()).json()) as any).state, "unknown");
});

test("reject oversized streaming bodies even without Content-Length", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(23 * 1024 * 1024 + 1));
      controller.close();
    },
  });
  const req = new Request("http://localhost/api/admin/publish", {
    method: "POST",
    headers: {
      Origin: "http://localhost",
      "Content-Type": "multipart/form-data; boundary=test",
    },
    body: stream,
    duplex: "half",
  } as RequestInit);
  assert.equal((await worker.fetch(req, env())).status, 413);
});
test("downloading article preserves UTF-8 and code whitespace", async t => {
  mockGithub(t);
  const response = await worker.fetch(
    new Request(
      `http://localhost/api/admin/post?path=${encodeURIComponent(path)}`
    ),
    env()
  );
  assert.equal(response.status, 200);
  assert.equal(((await response.json()) as any).markdown, oldRaw);
});
test("new articles can be created; existing names cannot be overwritten", async t => {
  const calls = mockGithub(t);
  assert.equal((await worker.fetch(request(newRaw, ""), env())).status, 409);
  assert.ok(calls.every(c => c.method === "GET"));
  t.mock.restoreAll();
  const absent = mockGithub(t);
  const mock = globalThis.fetch;
  t.mock.method(
    globalThis,
    "fetch",
    async (resource: string | URL | Request, init?: RequestInit) =>
      String(resource).includes("contents/")
        ? Response.json({}, { status: 404 })
        : mock(resource, init)
  );
  assert.equal((await worker.fetch(request(newRaw, ""), env())).status, 200);
  assert.ok(absent.some(c => c.method === "PATCH"));
});
test("invalid dates cannot reach a GitHub mutation", async t => {
  const calls = mockGithub(t);
  assert.equal(
    (
      await worker.fetch(
        request(newRaw.replace("2025-04-17T12:32:00Z", "2026-02-31T12:00:00Z")),
        env()
      )
    ).status,
    400
  );
  assert.equal(calls.length, 0);
});
