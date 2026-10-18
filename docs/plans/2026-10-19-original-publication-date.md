# Plan: Display original publication dates

- ID: 2026-10-19-original-publication-date
- Status: locally_verified
- Branch/base: fix/original-publication-date / main
- Scope: Visible article dates only; retain modification metadata and existing sorting.

## Ticket: original-publication-date-01

- Outcome: Lists and article pages display the first publication date without an Updated label.
- Acceptance: Shared Datetime uses pubDatetime only; build passes; modified article renders its original date.
- Evidence: Self-verification PASS: pnpm build exit 0, Astro 0 errors; generated homepage and agent-harness article both contain the original 2026-10-12T11:59:00.000Z time element and no Updated label. Existing deprecation hint and bundle warning remain. No new tests needed for this display-only change.
- original-publication-date-01: User authorized commit, push, PR and merge. Publication scope: shared date display and this Plan. Documentation impact: no interface, dependency or architecture changes; existing repository date-format facts remain accurate. Main unchanged since verified build.
