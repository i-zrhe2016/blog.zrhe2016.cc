# Bear Blog migration

> Type: Reference
> Status: Active
> Scope: Public source inventory, preserved content, compatibility redirects and migration checks

[Inventory](migration-inventory.json) owns original paths, titles, UTC publication timestamps, tags, target routes, source HTML hashes, normalized body hashes, code-block hashes and image mappings. The public source has 29 posts and no tags. About contact links are intentional public content.

`public/_redirects` maps each old post path to its corresponding `/posts/<original-slug>/` route, plus `/blog/` to `/posts/`, `/about-me/` to `/about/`, and `/feed/` to `/rss.xml`; both slash variants are covered. These rules require a hosting platform that supports this file. Astro preview does not apply Cloudflare redirects.

The import retains sanitized HTML in Markdown to preserve paragraphs, tables, IDs and all code exactly. It strips executable page scripts, forms, embeds, event attributes and unsafe URL schemes, while code containing script examples remains escaped text. Referenced images are downloaded under `public/images/bearblog`; internal blog links are rewritten to migrated routes. External links remain external.

Imported raw HTML code blocks use the site's foreground and muted background in both themes; Shiki blocks retain their token themes. Post copy buttons preserve code text and whitespace, including raw `<pre>` blocks, and exclude the button label.

To repeat the import, install Python `beautifulsoup4`, then run `python scripts/import-bearblog.py <snapshot-directory-outside-checkout>`. This replaces the posts directory and About content; inspect changes before retaining them. Source HTML captures stay outside Git. Build with `pnpm build`, then run `python scripts/check-migration.py` to compare every rendered body and code block against inventory and check titles, dates, routes, images, redirects and search assets.

The build uses a portable Node copy step for Pagefind. The public-file lookup treats files as URLs, so hosting metadata is not parsed as JavaScript. Google Sans Code normal/italic at static weights 400/700 is bundled from the official [google/fonts source](https://github.com/google/fonts/tree/main/ofl/googlesanscode), instantiated from the upstream variable fonts using FontTools for Satori compatibility, with its OFL license in `src/assets/fonts/OFL.txt`, avoiding Google font metadata at build time. Chinese glyphs use browser system fallbacks.

`wrangler.jsonc` configures the scriptless Cloudflare Workers static-assets deployment named `astro-paper`, serving `./dist` with compatibility date `2026-10-12` and workers.dev enabled. Its empty `previews` block enables the branch build's `npx wrangler preview` command; assets and compatibility settings remain at the top level. The existing `blog.zrhe2016.cc/*` production route is managed in the Cloudflare dashboard and is not declared in this configuration. Build the site before deployment.

Article bodies and About use standard Markdown. Fenced code retains original trailing newlines; smart punctuation is disabled to preserve source text. Migration checks normalize syntax-highlighting spans as presentation and preserve original inventory hashes alongside reconciled baselines for prior authorized article edits.
