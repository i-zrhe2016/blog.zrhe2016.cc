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
      throw new Error("List must never be fetched");
    if (url.pathname.endsWith("/post")) {
      const path = url.searchParams.get("path");
      if (path?.endsWith("new-article.md"))
        return route.fulfill({ status: 404, json: { error: "不存在" } });
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
  await page.route("**/admin/post-paths.json", route =>
    route.fulfill({ json: { "/posts/one": first, "/posts/two": second } })
  );
  await page.goto(`${origin}/admin/`);
  await page.locator("#article-url").waitFor();
  return errors;
}
async function openLink(page: Page, slug: string) {
  await page
    .locator("#article-url")
    .fill(`https://blog.zrhe2016.cc/posts/${slug}`);
  await page.locator("#open-link").click();
}
async function openFirst(page: Page) {
  await openLink(page, "one");
  await page.locator("#title").waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.querySelector<HTMLInputElement>("#title")?.value === "第一篇"
  );
}
test(
  "browser: plain Markdown preview preserves source and cannot publish",
  { timeout: 30_000 },
  async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      const errors = await fixture(page);
      let publishRequests = 0;
      page.on("request", request => {
        if (request.url().endsWith("/api/admin/publish")) publishRequests++;
      });
      await openFirst(page);
      const source =
        '# 纯正文\n\n**加粗**\n<script>window.__plainAttack=true</script>\n<img src="x" onerror="window.__plainAttack=true">\n[危险](javascript:alert(1))';
      await page.locator(".cm-content").fill(source);
      assert.equal(await page.locator("#preview").textContent(), "");
      await page.locator("#view-preview").click();
      await page.locator("#preview strong").waitFor();
      assert.equal(await page.locator("#preview h1").textContent(), "纯正文");
      assert.equal(
        await page.locator("#preview-title").textContent(),
        "第一篇"
      );
      assert.equal(
        await page
          .locator(
            "#preview script, #preview [onerror], #preview a[href^='javascript:']"
          )
          .count(),
        0
      );
      assert.equal(
        await page.evaluate(() => (window as any).__plainAttack),
        undefined
      );
      await page.locator("#publish").click();
      await page.waitForFunction(() =>
        document.querySelector("#notice")?.textContent?.includes("frontmatter")
      );
      assert.equal(publishRequests, 0);
      await page.locator("#view-edit").click();
      assert.equal(
        (await page.locator(".cm-content .cm-line").allTextContents()).join(
          "\n"
        ),
        source
      );
      const downloadPromise = page.waitForEvent("download");
      await page.locator("#export").click();
      const download = await downloadPromise;
      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
      assert.equal(Buffer.concat(chunks).toString(), source);
      await page.locator("#save").click();
      await page.reload();
      await page.locator(".cm-content").waitFor();
      assert.equal(
        (await page.locator(".cm-content .cm-line").allTextContents()).join(
          "\n"
        ),
        source
      );
      assert.equal(await page.locator("#preview").textContent(), "");
      await page.locator(".cm-content").fill(raw("恢复有效标题"));
      await page.locator("#view-preview").click();
      await page.waitForFunction(
        () =>
          document.querySelector("#preview-title")?.textContent ===
          "恢复有效标题"
      );
      await page.locator("#view-edit").click();
      await page
        .locator(".cm-content")
        .fill("---\ntitle: [\n---\n不得泄漏的正文");
      await page.locator("#view-preview").click();
      await page.waitForFunction(() =>
        document
          .querySelector("#preview")
          ?.textContent?.includes("YAML 格式错误")
      );
      assert.equal(await page.locator("#preview-title").textContent(), "");
      assert.equal(await page.locator("#preview h1, #preview p").count(), 0);
      await page.locator("#publish").click();
      await page.waitForFunction(() =>
        document
          .querySelector("#notice")
          ?.textContent?.includes("YAML 格式错误")
      );
      assert.equal(publishRequests, 0);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  }
);

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
    assert.equal(await page.locator("#preview").textContent(), "");
    assert.equal(
      await page.locator(".sidebar, #search, #filter, #posts").count(),
      0
    );
    const shell = await page.locator(".admin-shell").boundingBox();
    assert.ok(
      shell &&
        shell.width <= 768 &&
        Math.abs(shell.x - (1440 - shell.width) / 2) < 2
    );
    if (process.env.ADMIN_SCREENSHOT_DIR)
      await page.screenshot({
        path: `${process.env.ADMIN_SCREENSHOT_DIR}/admin-desktop.png`,
        fullPage: true,
      });
    await page.locator("#view-preview").click();
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
    await page.locator("#view-edit").click();
    await page.locator("#title").fill("中文标题已修改");
    await page.waitForTimeout(400);
    assert.equal(
      await page.locator("#preview-title").textContent(),
      "第一篇",
      "edit does not render"
    );
    await page.locator("#save").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#save-status")
        ?.textContent?.includes("已保存到当前浏览器")
    );
    await page.reload();
    await page.locator("#title").waitFor();
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
    await page.locator("#view-preview").click();
    await page.waitForFunction(() => {
      const img = document.querySelector<HTMLImageElement>("#preview img");
      return !!img?.src.startsWith("blob:") && img.naturalWidth > 0;
    });
    await page.reload();
    await page.locator("#title").waitFor();
    assert.equal(await page.locator("#preview").textContent(), "");
    await page.locator("#view-preview").click();
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLImageElement>("#preview img")
          ?.naturalWidth === 1
    );
    const source = `${raw("安全预览")}\n<script>window.__previewAttack = true</script>\n<img src="x" onerror="window.__previewAttack=true">\n[危险](javascript:alert(1))\n`;
    await page.locator("#view-edit").click();
    await page.locator(".cm-content").fill(source);
    await page.locator("#view-preview").click();
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
    await openLink(page, "two");
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
    if (process.env.ADMIN_SCREENSHOT_DIR)
      await page.screenshot({
        path: `${process.env.ADMIN_SCREENSHOT_DIR}/admin-mobile.png`,
        fullPage: true,
      });
    await page.locator("#new").click();
    await page.locator("#new-slug").fill("new-article");
    await page.getByRole("button", { name: "创建草稿" }).click();
    await page.waitForFunction(() =>
      document
        .querySelector("#document-path")
        ?.textContent?.endsWith("new-article.md")
    );
    assert.equal(await page.locator("#title").inputValue(), "未命名文章");
    await page.reload();
    await page.locator("#title").waitFor();
    assert.equal(await page.locator("#title").inputValue(), "未命名文章");
    await page.locator("#local-draft").selectOption(first);
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLInputElement>("#title")?.value === "安全预览"
    );
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
      await page.locator("#open-link").isDisabled(),
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
    assert.equal(
      await page.locator("#preview").textContent(),
      "",
      "publish and poll never render"
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

test(
  "browser: rejected links and expired authentication preserve local editing",
  { timeout: 30_000 },
  async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = await fixture(page);
    await openFirst(page);
    for (const url of [
      "https://foreign.example/posts/one",
      "https://blog.zrhe2016.cc/about",
      "https://blog.zrhe2016.cc/posts/%2e%2e/one",
      "https://blog.zrhe2016.cc/posts/missing",
    ]) {
      await page.locator("#article-url").fill(url);
      await page.locator("#open-link").click();
      await page.waitForFunction(
        () =>
          document.querySelector("#notice")?.getAttribute("data-error") ===
          "true"
      );
      assert.equal(await page.locator("#title").inputValue(), "第一篇");
    }
    await page.route("**/api/admin/post?**", route =>
      route.fulfill({ status: 401, contentType: "text/html", body: "Login" })
    );
    await openLink(page, "two");
    await page.waitForFunction(() =>
      document.querySelector("#notice")?.textContent?.includes("登录已过期")
    );
    assert.equal(await page.locator("#title").inputValue(), "第一篇");
    await page.locator("#new").click();
    await page.locator("#new-slug").fill("auth-failure");
    await page.getByRole("button", { name: "创建草稿" }).click();
    await page.waitForFunction(() =>
      document.querySelector("#notice")?.textContent?.includes("登录已过期")
    );
    assert.ok(
      await page.locator("#new-dialog").isVisible(),
      "auth failure is not a missing filename"
    );
    assert.equal(await page.locator("#title").inputValue(), "第一篇");
    assert.deepEqual(errors, []);
    await context.close();
  }
);
