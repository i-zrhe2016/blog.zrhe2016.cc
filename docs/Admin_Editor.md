# Markdown 文章后台

后台入口为 `https://blog.zrhe2016.cc/admin/`。文章仍保存在 GitHub 的 `src/content/posts`，公开网站继续使用 Astro 静态构建。编辑自动保存；预览仅在点击“预览”时生成，点击发布后需要等待 Cloudflare 构建部署。

后台同时提供评论审核。文章页提交的评论先保存为待审核，管理员在“评论审核”面板中通过、拒绝或删除；只有通过的评论会显示在文章页。评论数据保存在 Cloudflare D1，不随文章构建发布。

## 功能与使用

- 粘贴本站完整 HTTPS 文章链接并点击“打开文章”，直接编辑对应 Markdown。后台不加载文章列表、搜索或筛选，也不批量读取文章元数据。末尾斜线、查询参数和锚点可保留；外站、非文章页面、无效编码与路径穿越会被拒绝。
- 后台与博客使用相同的居中最大宽度，所有屏幕都在“编辑”和“预览”单一面板之间切换。只有点击“预览”才生成最新快照；打开、输入、发布和部署查询不会自动渲染。
- 新建 Markdown 文章，编辑标题、摘要、标签、发布日期、置顶和完整 Markdown 源码。高级 frontmatter 字段通过源码编辑；已有未知字段保留。
- 预览复用博客 Markdown 插件、代码高亮转换器与文章样式，并清理危险 HTML。代码高亮异步加载；高亮失败时保留纯文本代码。
- 可直接粘贴不带 YAML frontmatter 的正文并点击“预览”，标题使用元数据表单中的标题或“未命名文章”；预览不会改写源码。已有 frontmatter 会提取标题和正文，格式错误仍会提示。发布仍要求源码以完整、有效的 frontmatter 开头，包含标题、摘要和发布日期。
- 选择、拖拽或粘贴 PNG、JPEG、WebP、GIF；单张不超过 5 MB，一次发布总量不超过 20 MB，最多 100 张。图片暂存在浏览器，随文章一次性提交到 `public/images/uploads/`。
- 草稿在输入停止 600 ms 后保存到当前浏览器的 IndexedDB。刷新页面自动恢复最近保存的草稿，也可通过“恢复本地草稿”选择其他本地草稿，包括尚无公开链接的新文章。不同设备、浏览器或源站地址之间不共享草稿；清理浏览器数据会删除未发布内容。保存失败会提示导出 Markdown；导出不包含图片，请保留图片原文件。
- “保存草稿”只写入浏览器；“发布文章”提交 `draft: false`；“下架”提交 `draft: true`。两者均需构建部署后公开生效。已有文章的修改时间在发布时更新，发布日期保持原值。
- 源码中未来的发布日期遵循现有博客的过滤规则；第一版没有定时构建，因此不会保证未来时间到达时自动上线。需要届时手动触发构建或发布。
- 仓库冲突时不覆盖远端。“读取远端比较”可并排查看两个版本，先导出本地内容，再选择基于远端重新编辑。
- 第一版仅支持 `.md`，不提供文章删除、网址重命名、About 编辑或多人协作。请避免在多个标签页同时编辑同一篇文章。

文章链接索引通过 Astro 内容集合和公开文章 URL 函数在构建时生成，包含仓库草稿的路径映射，不包含文章标题或正文，并受后台认证保护。尚未构建部署的新文章只能从本地草稿恢复；部署完成后其链接才进入索引。新建时检查仓库文件是否存在，认证或网络错误不会被当作空文件。

## 首次部署

### 1. Cloudflare Access

在 Zero Trust 中创建 Self-hosted 应用，配置同一个应用的两个路径：

- `blog.zrhe2016.cc/admin*`
- `blog.zrhe2016.cc/api/admin/*`

启用 One-time PIN 邮箱验证码，只允许自己的邮箱。将此应用的 Audience (AUD) 和团队域名记下。Worker 同时校验 Access JWT 的签名、签发方、受众、有效期以及允许邮箱，所以 workers.dev、版本预览与直接 API 请求也无法绕过认证。若需要在这些域名登录，也必须为它们配置同一个 Access 应用及对应路径；否则后台会拒绝访问。

### 2. Worker 配置与凭据

`wrangler.jsonc` 已配置 Worker 入口、静态资源绑定、后台优先路由，以及：

| 配置            | 默认值 / 说明                                    |
| --------------- | ------------------------------------------------ |
| `GITHUB_REPO`   | `i-zrhe2016/blog.zrhe2016.cc`                    |
| `GITHUB_BRANCH` | `main`                                           |
| `ADMIN_ORIGIN`  | `https://blog.zrhe2016.cc`；写请求必须来自此源站 |

在 Worker 的 Settings → Variables and Secrets 中添加以下 Secrets，或执行 `pnpm exec wrangler secret put <名称>`：

| Secret               | 用途                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `GITHUB_TOKEN`       | GitHub fine-grained PAT，仅授权当前仓库，Repository permissions → Contents: Read and write |
| `ACCESS_TEAM_DOMAIN` | 例如 `your-team.cloudflareaccess.com`，不包含协议或路径                                    |
| `ACCESS_AUD`         | Access 应用的 Audience                                                                     |
| `ADMIN_EMAILS`       | 允许的邮箱，多个邮箱用英文逗号分隔                                                         |

GitHub 的目标分支必须允许此 token 直接更新；第一版不走 PR 审批流程。

不要将凭据放入 `PUBLIC_*` 变量、Markdown 或仓库。Worker API 固定仓库和分支，只允许指定的文章目录和图片目录。认证与接口响应使用 `no-store`。

### 3. 自动构建发布

### 评论 D1

首次部署前创建 D1 数据库并将数据库 ID 写入 `wrangler.jsonc` 的 `COMMENTS_DB` 绑定，然后执行：

```bash
pnpm exec wrangler d1 migrations apply blog-comments --remote
```

本地开发使用 `--local` 应用同一 migration。公开评论接口为 `/api/comments`，后台审核接口位于 `/api/admin/comments` 并继续受 Cloudflare Access 保护。

在当前 `astro-paper` Worker 的 Settings → Builds 连接 GitHub 仓库，生产分支选择 `main`：

- 安装：`pnpm install --frozen-lockfile`
- 构建：`pnpm build`
- 生产部署：`pnpm exec wrangler deploy`
- Node 使用 24，pnpm 使用 11.3.0。
- 构建监听范围至少包含 `src/content/posts/**` 与 `public/images/uploads/**`，推荐监听整个仓库。
- 生产路由继续使用 Cloudflare 控制台中的 `blog.zrhe2016.cc/*`。

`pnpm build` 最后生成 `dist/admin/build.json`，记录 `WORKERS_CI_COMMIT_SHA`；本地构建回退到 `git rev-parse HEAD`。后台查询当前 Worker 静态资源绑定里的此标记，仅在它匹配发布提交时显示“部署成功”。首次手动部署前必须先构建。

如需显示排队、构建中和失败状态，再添加以下 Secrets：

| Secret                  | 用途                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | 对目标账户具有 Workers CI Read 权限的 API token                                                                 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID                                                                                              |
| `CLOUDFLARE_WORKER_TAG` | Worker 的系统生成 tag，**不是** `astro-paper` 名称；可从 Workers Builds 的触发器数据中取得 `external_script_id` |

状态接口读取最近 100 次构建并匹配提交 SHA。缺少状态凭据、记录超过查询窗口或已有更新版本上线时，显示“尚未确认”并保留提交信息，不推测部署成功。每 10 秒查询一次，最多 15 分钟，重新打开文章可再次查询。构建失败不会替换上一个成功部署，也不会自动撤销 Git 提交；修正文章或构建问题后再发布/重跑构建。

## 本地开发

```bash
pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
# 填写 GITHUB_TOKEN。建议另配测试仓库和分支，避免本地发布修改正式文章。
pnpm admin:dev
```

访问 Wrangler 打印的 localhost 地址下的 `/admin/`。`LOCAL_ADMIN_AUTH="true"` 只对 localhost、127.0.0.1、[::1] 请求生效。`.dev.vars` 已忽略，绝不能将此开关配置到线上。使用 `pnpm dev` 可以开发页面，但 Astro 开发服务器不提供 Worker API；完整调试使用 Wrangler。

前端变更后需要重新构建静态资源。调试实际 GitHub 发布时，在本地配置中把 `GITHUB_REPO`、`GITHUB_BRANCH` 指向测试仓库/分支。第一次验证应在测试环境完成邮箱登录、发布含图片文章、等待部署、检查文章/搜索/RSS，以及下架流程。

## 检查

```bash
pnpm test:admin
pnpm exec playwright install chromium
pnpm test:admin:browser
pnpm lint
pnpm build
pnpm exec wrangler deploy --dry-run --outdir /tmp/blog-worker-check
```

自动测试覆盖全部现有文章的元数据与正文往返、路径限制、图片签名与大小、JWT 校验、同源限制、文章与图片原子提交、并发冲突、重复请求恢复，以及部署状态。浏览器测试使用真实本地 Worker 与模拟的远端接口，覆盖中文输入、图片恢复、脚本清理、手机布局、冲突和发布重试。真实 Access 登录、GitHub 写入和 Cloudflare 构建需配置账户后做集成验收。

参考：[Worker 静态资源路由](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)、[Access JWT 校验](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)、[Workers Builds API](https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/)、[GitHub Git Data API](https://docs.github.com/en/rest/git)。

### PlantUML 兼容

保留主分支已有的 PlantUML 构建检查。后台可以编辑包含图示的文章，预览暂显示 PlantUML 源码；如果修改图示源码，需要在本地执行 `pnpm diagrams:render` 并提交生成的 SVG 后再构建，否则部署会报告缺少图示文件。
