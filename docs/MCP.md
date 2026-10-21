# 发布 MCP

Worker 在 `/mcp` 提供远程 MCP 服务（Streamable HTTP，JSON-RPC 2.0）。AI 客户端可以直接列出、读取、发布文章，并支持「预发布」：先把稿子提交到 `preview` 分支，Cloudflare 构建出可分享的预览地址，确认后再提升到 `main` 正式上线。

MCP 复用后台已有的 `GITHUB_TOKEN`、文章校验和部署状态查询，因此同样遵守「文章保存在 GitHub，提交后由 Cloudflare 构建发布」的流程。两者互不影响：后台编辑器走 Cloudflare Access，MCP 走独立的 Bearer 令牌。

## 1. Worker 配置

### Secret

在 Worker 的 Settings → Variables and Secrets 添加：

| Secret     | 用途                                                             |
| ---------- | ---------------------------------------------------------------- |
| `MCP_TOKEN` | 长随机字符串，等同密码。未配置时 `/mcp` 返回 503，不会放行任何请求 |

```bash
openssl rand -base64 36
```

```bash
corepack pnpm exec wrangler secret put MCP_TOKEN
```

`GITHUB_TOKEN` 沿用后台的配置，权限仍只需当前仓库的 Contents: Read and write。不要将任何凭据写入 `vars`、`PUBLIC_*` 变量、Markdown 或仓库。

### 普通变量

| 变量                 | 默认值                     | 说明                                                        |
| -------------------- | -------------------------- | ----------------------------------------------------------- |
| `MCP_PREVIEW_BRANCH` | `preview`                  | 预发布提交的目标分支                                        |
| `PREVIEW_ORIGIN`     | 空                         | 预览部署的稳定地址，用于返回预览链接；为空时只返回提交信息 |

## 2. Cloudflare 侧：让 `preview` 分支产生预览部署

代码只能把提交推到 `preview` 分支，**预览部署本身必须在 Cloudflare 控制台打开**：

1. Workers & Pages → 当前 Worker → Settings → Build → Branch control，把 `preview` 加入允许构建的分支，并确认该分支使用 Preview 环境（不是 Production）。
2. 一次推送后，在 Deployments 里拿到该分支预览的地址，例如 `https://preview-astro-paper.<subdomain>.workers.dev`。
3. 把该地址填进 `PREVIEW_ORIGIN`。若使用自定义域名，同样填解析后的完整地址（不带结尾斜线）。
4. 预览地址默认是公开的。如需只让自己访问，可为它单独创建一个 Cloudflare Access 应用；MCP 客户端本身不访问该地址，Access 不影响发布。

构建期通过 `WORKERS_CI_BRANCH` 判断：非 `main` 分支的构建会把带 `prerelease: true` 的文章一起生成，`main` 构建始终排除它们。因此预览站能看到预发布文章，正式站不会。本地开发时所有文章都可见（`import.meta.env.DEV`）。

## 3. 客户端接入

Claude Code 的项目级配置 `.mcp.json`（令牌从环境变量读取，避免写进仓库）：

```json
{
  "mcpServers": {
    "blog": {
      "type": "http",
      "url": "https://blog.zrhe2016.cc/mcp",
      "headers": {
        "Authorization": "Bearer ${BLOG_MCP_TOKEN}"
      }
    }
  }
}
```

也可以直接添加：

```bash
claude mcp add --transport http blog https://blog.zrhe2016.cc/mcp --header "Authorization: Bearer <MCP_TOKEN>"
```

服务是无状态的，不返回 `Mcp-Session-Id`，每个请求独立认证。支持协议版本 `2025-06-18`、`2025-03-26`、`2024-11-05`；带 `MCP-Protocol-Version` 头时必须是其中之一，否则返回 `-32022` 并附上支持的版本列表。`GET /mcp` 返回 405（不提供服务端推送流）。

## 4. 工具

| 工具                | 参数                                                                 | 行为                                                              |
| ------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `list_posts`        | `branch?`                                                            | 列出文章：`path`、`title`、`draft`、`prerelease`、`sha`、`route`  |
| `get_post`          | `path`、`branch?`                                                    | 返回原始 Markdown 与文件 `sha`；该 `sha` 用作下次的 `baseSha`     |
| `publish_post`      | `path`、`markdown`、`status?`、`baseSha?`、`images?`                  | 见下                                                              |
| `promote_post`      | `path`、`baseSha?`                                                   | 从预览分支读取，去掉 `prerelease`、置 `draft: false`，提交到 `main` |
| `unpublish_post`    | `path`、`baseSha?`                                                   | 在 `main` 上置 `draft: true`（下架）                              |
| `sync_preview`      | `force?`                                                             | 把预览分支对齐到 `main`；预览分支有独立提交时须显式 `force: true` |
| `deployment_status` | `sha`                                                                | 查询该提交的 Cloudflare 构建/上线状态                             |

`publish_post` 的 `status`：

| status       | 目标分支                  | frontmatter                        |
| ------------ | ------------------------- | ---------------------------------- |
| `published`  | `main`                    | `draft: false`，删除 `prerelease`  |
| `prerelease` | `MCP_PREVIEW_BRANCH`      | `draft: false` + `prerelease: true` |
| `draft`      | `main`                    | `draft: true`，删除 `prerelease`   |

`images` 为 `[{ name, mediaType, data }]`，`data` 是 base64，`name` 必须是 UUID 形式的文件名（如 `3f0c…9a.png`），写入 `public/images/uploads/` 后正文用 `/images/uploads/<name>` 引用。单张 5 MB、一次合计 20 MB、最多 100 张。

所有写工具都使用非强制引用更新：`baseSha` 与分支上当前文件不一致时返回冲突，不覆盖远端。不传 `baseSha` 时按「新建文件」处理，已有文件会冲突。相同内容重复提交会识别为已完成（`recovered: true`），不会产生第二个提交。

路径必须是 `src/content/posts/` 下的 `.md`，不能包含 `..`、下划线开头的文件或目录；frontmatter 仍需通过后台相同的校验（标题、摘要、日期）。

## 5. 预发布 → 正式发布

```
publish_post(status: "prerelease")  →  提交 preview 分支  →  Cloudflare 预览构建
        ↓  在 PREVIEW_ORIGIN/posts/<slug>/ 确认
promote_post                        →  同一份内容提交 main（去掉 prerelease）→  正式构建
```

提升之后预览分支仍然停在旧提交上，可以继续在上面预发布下一篇文章；需要把它归位时调用 `sync_preview`。若预览分支上有尚未提升的改动，`sync_preview` 会拒绝并列出会被丢弃的文件，确认后才用 `force: true`。

## 6. 本地开发

`.dev.vars` 中设置 `LOCAL_ADMIN_AUTH="true"` 与任意 `MCP_TOKEN`，然后：

```bash
corepack pnpm admin:dev
```

```bash
curl -s http://127.0.0.1:8787/mcp -H "Authorization: Bearer $env:MCP_TOKEN" -H "Content-Type: application/json" -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}'
```

带 `Origin` 头的请求只接受 `ADMIN_ORIGIN`；本地开发且 `LOCAL_ADMIN_AUTH="true"` 时也接受 `localhost`、`127.0.0.1`、`[::1]`。服务端到服务端调用通常不发 `Origin`，照常通过。

测试：`corepack pnpm test:mcp`（认证、协议协商、预发布分支与提升流程、冲突与幂等、构建期可见性）。

## 7. 已知限制

- 预览部署与其他分支共用同一套绑定：预览站的评论会写入正式 D1，`GITHUB_TOKEN` 也与正式环境相同。需要完全隔离时应另建 Cloudflare 环境，本期不做。
- `preview` 分支会随时间落后于 `main`（正式站新增的文章在预览站看不到），用 `sync_preview` 归位。
- 第一版不提供删除文章、重命名路由与多人协作。
