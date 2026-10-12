# My blog

Personal blog for [blog.zrhe2016.cc](https://blog.zrhe2016.cc), built with [AstroPaper](https://github.com/satnaing/astro-paper).

Install the locked dependencies with `pnpm install --frozen-lockfile` (Node >=22.12), run `pnpm dev` for development, and `pnpm build` for the static site and Pagefind search index. `pnpm preview` serves the build locally.

See [documentation](docs/README.md) for content migration, checks and repository state. Blog content lives in `src/content/posts`; About content lives in `src/content/pages/about.md`. Site metadata and features are configured in `astro-paper.config.ts`.
