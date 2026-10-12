# Bear Blog migration

> Type: Reference
> Status: Active
> Scope: Public source inventory, preserved content, compatibility redirects and migration checks

[Inventory](migration-inventory.json) owns original paths, titles, UTC publication timestamps, tags, target routes, source HTML hashes, normalized body hashes, code-block hashes and image mappings. The public source has 29 posts and no tags. About contact links are intentional public content.

`public/_redirects` maps each old post path to its corresponding `/posts/<original-slug>/` route, plus `/blog/` to `/posts/`, `/about-me/` to `/about/`, and `/feed/` to `/rss.xml`; both slash variants are covered. These rules require a hosting platform that supports this file. Astro preview does not apply Cloudflare redirects.

The import retains sanitized HTML in Markdown to preserve paragraphs, tables, IDs and all code exactly. It strips executable page scripts, forms, embeds, event attributes and unsafe URL schemes, while code containing script examples remains escaped text. Referenced images are downloaded under `public/images/bearblog`; internal blog links are rewritten to migrated routes. External links remain external.

To repeat the import, install Python `beautifulsoup4`, then run `python scripts/import-bearblog.py <snapshot-directory-outside-checkout>`. This replaces the posts directory and About content; inspect changes before retaining them. Source HTML captures stay outside Git. Build with `pnpm build`, then run `python scripts/check-migration.py` to compare every rendered body and code block against inventory and check titles, dates, routes, images, redirects and search assets.

The build uses a portable Node copy step for Pagefind. The public-file lookup treats files as URLs, so hosting metadata is not parsed as JavaScript. Google Sans Code normal/italic at static weights 400/700 is bundled from the official [google/fonts source](https://github.com/google/fonts/tree/main/ofl/googlesanscode), instantiated from the upstream variable fonts using FontTools for Satori compatibility, with its OFL license in `src/assets/fonts/OFL.txt`, avoiding Google font metadata at build time. Chinese glyphs use browser system fallbacks.
