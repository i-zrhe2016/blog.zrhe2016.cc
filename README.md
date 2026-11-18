# My blog

Personal blog for [blog.zrhe2016.cc](https://blog.zrhe2016.cc), built with [AstroPaper](https://github.com/satnaing/astro-paper).

Install the locked dependencies with `pnpm install --frozen-lockfile` (Node >=22.12), run `pnpm dev` for development, and `pnpm build` for the static site and Pagefind search index. `pnpm preview` serves the build locally.

GitHub Actions builds the blog on pushes to `main` and `preview`, pull requests, manual runs, and a daily schedule. It deploys `main` to Cloudflare Workers and uploads `preview` as the Worker preview alias; pull requests only build. The `blog-dist` artifact contains the generated site. Set the repository Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, then disable the existing Cloudflare Git builds after verifying the new deployments to avoid duplicate deployments.

See [documentation](docs/README.md) for content migration, checks and repository state. Blog content lives in `src/content/posts`; About content lives in `src/content/pages/about.md`. Site metadata and features are configured in `astro-paper.config.ts`.

The Markdown editor at `/admin/` uses browser drafts, Cloudflare Access, and GitHub publication. See [setup and deployment](docs/Admin_Editor.md).

The Worker also serves a publishing MCP server at `/mcp` (bearer token, prerelease branch previews). See [publishing MCP](docs/MCP.md).
