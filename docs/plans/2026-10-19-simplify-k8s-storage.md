# Plan: Simplify Kubernetes storage article

- ID: 2026-10-19-simplify-k8s-storage
- Status: locally_verified
- Branch/base: docs/simplify-k8s-storage / main @ 1ffef75
- Intent: Explain core Kubernetes storage mechanisms to application developers without implementation detail.
- Publication: User authorized commit, push, PR creation and merge on 2026-10-19.

## Ticket: simplify-k8s-storage-01

- Outcome: Replace the 18-section article with seven sections covering Volume, PV/PVC/StorageClass, Pod usage, configuration, StatefulSet, a working example and troubleshooting.
- Constraints: Preserve URL, title, publication timestamp and tags. Remove low-level CSI/OS internals; retain CSI only as a one-sentence responsibility statement. Use an existing StorageClass in examples.
- Acceptance: Seven coherent sections, one simple relationship diagram, correct lifecycle/access/reclaim semantics, linked YAML names, clear example prerequisites and basic diagnostic commands.
- Validation: Formatting check, full site build, rendered-page inspection and YAML/metadata checks. Main-agent self-verification; no delegation.
- Source: Clean local checkout matches remote main and the public article; previous article addition merged as PR #44. This is a new requirement.

## Evidence

- simplify-k8s-storage-01: Source located in blog-k8s-storage-pr; remote main verified at 1ffef750151e54222055457f4449db629f1921c7 before changes.

- simplify-k8s-storage-01: PASS — metadata comparison against HEAD preserves title, publication timestamp, tags and draft; exactly seven H2 sections. YAML parser accepts both resources and confirms PVC/volume references.
- simplify-k8s-storage-01: PASS — Prettier check and pnpm build (exit 0), including diagram preflight, Astro check (0 errors), static route generation and Pagefind. Existing deprecated returnValue hint and bundle-size warning remain.
- simplify-k8s-storage-01: PASS — local browser inspection at /posts/k8s-storage/ confirms seven sequential sections, relationship diagram, tables, highlighted YAML, commands and reference links render. Desktop screenshot inspected; no missing image references remain in the article.
- simplify-k8s-storage-01: Example reviewed statically; no Kubernetes cluster was used, so provisioning and persistence were not executed. The article explicitly states required StorageClass capabilities. Recreated Pod does not rewrite the test file.
- simplify-k8s-storage-01: Documentation impact is limited to the article and this Plan. No architecture or repository capability changes; no README/current-state update required. Previously generated shared-addressed SVG assets left intact to avoid unrelated deletions. No commit, push, PR or deployment performed.


- simplify-k8s-storage-01: Publication batch authorized by user: article and this Plan only. Remote identity confirmed; prior full build and browser self-verification remain applicable; no product changes since validation.
