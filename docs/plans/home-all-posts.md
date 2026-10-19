# Homepage lists all posts

Status: locally_verified (not published or merged)
Date: 2026-10-19
Plan ID: home-all-posts
Branch/base: feat/home-all-posts / main (base 17f67cc)
Publication: user authorized commit, push, PR creation and merge on 2026-10-19.

## Ticket home-all-posts-1

### Contract

Render every eligible post once on the homepage in the existing updated/publication date descending order. Remove Featured grouping, the homepage count limit and the All Posts button. Keep compact cards, existing draft/scheduled filtering and the separate posts routes. No public API changes.

### Acceptance

- Homepage count, unique links and ordering match eligible content.
- Cards retain titles and compact dates, with working article links and mobile layout.
- Astro type checking and production build pass.

### Evidence

- [home-all-posts-1] Initial inspection: homepage splits featured/recent posts and limits recent posts to perIndex=10. Existing getSortedPosts owns ordering and eligibility; reuse unchanged.
- [home-all-posts-1] Git metadata is absent, so historical Issue/branch ID checks are unavailable; use a descriptive local Plan ID.
- [home-all-posts-1] Implemented one sorted list using the existing filter/order utility and compact Card component; removed Featured grouping, truncation and All Posts button.
- [home-all-posts-1] PASS: pnpm build, including Astro checking (71 files, zero errors/warnings, one pre-existing admin returnValue deprecation hint), static generation, Pagefind and admin asset build. Build also reports a bundle-size advisory and existing verification HTML without an outer html element.
- [home-all-posts-1] Initial browser assertion failed because the check expected URLs without trailing slashes; actual links follow Astro's trailing-slash convention. Corrected the check expectation; no application repair was required.
- [home-all-posts-1] PASS: headless Chromium production preview confirms all 29 eligible posts from 30 Markdown sources, unique links, exact source-derived ordering and titles, compact dates, every article link HTTP 200, no Featured/All Posts UI and /posts/ HTTP 200. No horizontal overflow at 375px or 1280px.
- [home-all-posts-1] PASS: focused Prettier check after formatting the homepage. Self-verification performed by the main agent; no delegation. Documentation impact: updated current-state summary and documentation index.

- [home-all-posts-1] Publication revalidation: cloned i-zrhe2016/blog.zrhe2016.cc main at 17f67cc and transferred only this requirement. Existing original-publication-date display and new Kubernetes article are preserved. pnpm build PASS; Chromium confirms all 30 eligible posts (one draft excluded), source-derived ordering/titles, unique working links, compact dates, /posts/ HTTP 200 and no horizontal overflow at 375/1280px. Main-agent self-verification PASS for full Plan scope. Historical local no-Git limitation is resolved by this clone; descriptive Plan ID remains unique.
