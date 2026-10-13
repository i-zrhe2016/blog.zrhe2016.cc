# Repository Current State

Last verified: 2026-10-13 @ working tree

## Implemented

- Public Bear Blog posts and About content use AstroPaper static pages; source compatibility and content inventory are described in the [migration reference](reference/bearblog-migration.md).
- Imported post code blocks use theme-aware colors and preserve source whitespace when copied; see the [migration reference](reference/bearblog-migration.md).
- Chinese site metadata, Pagefind article search, RSS and sitemap are configured for `blog.zrhe2016.cc`.
- Homepage presentation uses the English UI, omits the hero section, and hides Posts, Tags, and Archives from the header navigation.
- About omits contact details from its body; GitHub and email links are available through footer icons.
- The site title is `zrhe2016`; post list cards display titles and dates without excerpts.
- The homepage omits the Recent Posts heading and uses compact spacing and `YYYY-MM-DD` dates without calendar icons; other date displays keep their existing format.
- Page navigation disables view-transition animations and named post-title/tag transitions.
- `wrangler.jsonc` declares the static-assets Worker and branch preview configuration; deployment details are in the [migration reference](reference/bearblog-migration.md).

## Constraints

- Node >=22.12 and locked pnpm dependencies; fonts are bundled locally and the build copy step is portable.
- Cloudflare-compatible redirects are hosting metadata; local Astro preview serves final routes directly.

## Architecture Snapshot

- Astro content collections render Markdown posts and About, with public local images and static search assets.

- All posts and About use editable Markdown; migration validation preserves code whitespace and source text.
