import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";

const origin = "http://localhost:18787";
let server: ChildProcess;
let browser: Browser;
let serverLog = "";
before(
  async () => {
    server = spawn(
      process.execPath,
      [
        "node_modules/wrangler/bin/wrangler.js",
        "dev",
        "--local",
        "--port",
        "18787",
        "--var",
        "LOCAL_ADMIN_AUTH:true",
      ],
      { stdio: "pipe" }
    );
    server.stdout?.on("data", chunk => {
      serverLog += chunk;
    });
    server.stderr?.on("data", chunk => {
      serverLog += chunk;
    });
    for (let i = 0; i < 120; i++) {
      try {
        if ((await fetch(`${origin}/admin/`)).ok) break;
      } catch {
        /* Wait for local workerd startup. */
      }
      if (i === 119) throw new Error(`Wrangler failed to start: ${serverLog}`);
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  },
  { timeout: 40_000 }
);
after(async () => {
  await browser?.close();
  server?.kill("SIGTERM");
});

const first = "src/content/posts/one.md";
const second = "src/content/posts/two.md";
const raw = (title: string) =>
  `---\ntitle: ${title}\ndescription: 测试摘要\npubDatetime: 2026-10-01T00:00:00Z\ntags: [技术]\ncustomField: preserve-me\n---\n\n## 正文\n\n\`\`\`js file="demo.js"\nconst answer = 42;\n\`\`\`\n`;
async function fixture(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/admin/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/posts"))
      return route.fulfill({
        json: {
          posts: [
            { path: first, sha: "old", title: "第一篇", draft: false },
            { path: second, sha: "second", title: "第二篇", draft: false },
          ],
        },
      });
    if (url.pathname.endsWith("/post")) {
      const path = url.searchParams.get("path");
      return route.fulfill({
        json: {
          path,
          sha: path === first ? "old" : "second",
          markdown: raw(path === first ? "第一篇" : "第二篇"),
        },
      });
    }
    if (url.pathname.includes("/deployments/"))
      return route.fulfill({ json: { state: "success", message: "部署成功" } });
    return route.fulfill({
      status: 500,
      json: { error: "unexpected API request" },
    });
  });
  await page.goto(`${origin}/admin/`);
  await page.locator(".post-item").first().waitFor();
  return errors;
}
async function openFirst(page: Page) {
  await page.getByRole("button", { name: /第一篇/ }).click();
  await page.locator("#title").waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.querySelector<HTMLInputElement>("#title")?.value === "第一篇"
  );
}
test(
  "browser: Chinese edits, sanitized highlighted preview, drafts, images, new posts and mobile",
  { timeout: 60_000 },
  async () => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    const errors = await fixture(page);
    await openFirst(page);
    await page.locator("#preview pre.shiki.astro-code").waitFor();
    assert.ok(
      (await page.locator("#preview pre.astro-code").textContent())?.includes(
        "demo.js"
      ),
      "filename metadata uses the shared highlighter"
    );
    assert.equal(
      await page.locator("#preview h2").first().getAttribute("id"),
      "preview-正文"
    );
    await page.locator("#title").fill("中文标题已修改");
    await page.locator("#save").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#save-status")
        ?.textContent?.includes("已保存到当前浏览器")
    );
    await page.reload();
    await page.getByRole("button", { name: /中文标题已修改/ }).click();
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLInputElement>("#title")?.value ===
        "中文标题已修改"
    );
    // Inserting an image with the cursor initially at document start must preserve frontmatter.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0WQAAAAASUVORK5CYII=",
      "base64"
    );
    await page
      .locator("#image-input")
      .setInputFiles({ name: "paste.png", mimeType: "image/png", buffer: png });
    await page.waitForFunction(() => {
      const img = document.querySelector<HTMLImageElement>("#preview img");
      return !!img?.src.startsWith("blob:") && img.naturalWidth > 0;
    });
    await page.reload();
    await page.getByRole("button", { name: /中文标题已修改/ }).click();
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLImageElement>("#preview img")
          ?.naturalWidth === 1
    );
    const source = `${raw("安全预览")}\n<script>window.__previewAttack = true</script>\n<img src="x" onerror="window.__previewAttack=true">\n[危险](javascript:alert(1))\n`;
    await page.locator(".cm-content").fill(source);
    await page.waitForFunction(
      () => document.querySelector("#preview-title")?.textContent === "安全预览"
    );
    assert.equal(
      await page.evaluate(() => (window as any).__previewAttack),
      undefined
    );
    assert.equal(
      await page
        .locator(
          "#preview script, #preview [onerror], #preview a[href^='javascript:']"
        )
        .count(),
      0
    );
    await page.getByRole("button", { name: /第二篇/ }).click();
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLInputElement>("#title")?.value === "第二篇"
    );
    await page.locator(".cm-content").focus();
    await page.keyboard.press("Control+z");
    assert.equal(
      await page.locator("#title").inputValue(),
      "第二篇",
      "undo cannot cross articles"
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#view-preview").click();
    assert.ok(await page.locator(".preview-pane").isVisible());
    assert.ok(!(await page.locator(".editor-pane").isVisible()));
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      ),
      "mobile layout must not overflow"
    );
    await page.locator("#new").click();
    await page.locator("#new-slug").fill("new-article");
    await page.getByRole("button", { name: "创建草稿" }).click();
    await page.waitForFunction(() =>
      document
        .querySelector("#document-path")
        ?.textContent?.endsWith("new-article.md")
    );
    assert.equal(await page.locator("#title").inputValue(), "未命名文章");
    assert.deepEqual(errors, []);
    await context.close();
  }
);

test(
  "browser: publishing preserves exact Markdown, recovers response loss and handles conflicts",
  { timeout: 60_000 },
  async () => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    const errors = await fixture(page);
    await openFirst(page);
    const submissions: string[] = [];
    await page.route("**/api/admin/publish", async route => {
      const incoming = route.request();
      const form = await new Request(incoming.url(), {
        method: "POST",
        headers: incoming.headers(),
        body: new Uint8Array(incoming.postDataBuffer()!),
      }).formData();
      const file = form.get("markdown");
      assert.ok(file instanceof File);
      submissions.push(await file.text());
      if (submissions.length === 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
        return route.abort("connectionreset");
      }
      return route.fulfill({ json: { sha: "b".repeat(40), fileSha: "new" } });
    });
    await page.locator("#title").fill("发布测试");
    await page.locator("#publish").click();
    assert.ok(
      await page.getByRole("button", { name: /第二篇/ }).isDisabled(),
      "publishing locks article switching before asynchronous saves"
    );
    assert.equal(
      await page.locator(".cm-content").getAttribute("contenteditable"),
      "false"
    );
    await page.waitForFunction(() =>
      document
        .querySelector("#deploy-status")
        ?.textContent?.includes("发布未确认成功")
    );
    await page.locator("#publish").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#deploy-status")
        ?.textContent?.includes("部署成功")
    );
    assert.equal(submissions.length, 2);
    assert.equal(
      submissions[0],
      submissions[1],
      "retry must preserve the exact submitted timestamp and source"
    );
    assert.ok(submissions[0].includes("customField: preserve-me"));
    assert.ok(!submissions[0].includes("\r\n"));
    await page.route("**/api/admin/publish", route =>
      route.fulfill({ status: 409, json: { error: "远端文章已修改" } })
    );
    await page.locator("#title").fill("冲突后保留");
    await page.locator("#publish").click();
    await page.waitForFunction(() =>
      document.querySelector("#notice")?.textContent?.includes("远端文章已修改")
    );
    assert.equal(await page.locator("#title").inputValue(), "冲突后保留");
    await page.locator("#remote").click();
    await page.locator("#compare-dialog").waitFor({ state: "visible" });
    assert.ok(
      (await page.locator("#compare-local").inputValue()).includes("冲突后保留")
    );
    assert.ok(
      (await page.locator("#compare-remote").inputValue()).includes("第一篇")
    );
    await page.locator("#compare-close").click();
    assert.deepEqual(errors, []);
    await context.close();
  }
);
