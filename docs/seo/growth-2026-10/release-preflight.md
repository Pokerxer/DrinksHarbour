---
date: 2026-10-20
status: deployment target and reviewed release revision required
---

# Release preflight

Continuation requested after local implementation. No production deployment,
Git commit/push or project linking has been performed.

## Verified deployment context

- Repository: Pokerxer/DrinksHarbour, HTTPS origin configured locally.
- Current branch: feat/plan-entitlements-billing.
- Current HEAD: af125fa6f3689f364db54592a968ea1d189e9399.
- Shared working tree has hundreds of changes, including admin/backend/venue
  work outside this SEO release. It is not a reviewed SEO-only revision.
- Vercel CLI 60.1.3 is installed at /Users/mac/.npm-global/bin/vercel.
- `vercel project inspect --non-interactive` in client/apps/platform returned
  `link_required`. No existing app or repository project link was found.
- Public web-reader requests to the three new paths were inaccessible through
  that reader. This is not evidence of a live HTTP 404 or deployed content.

## Required decisions

1. Identify the existing Vercel team/project for apps/platform. Do not create
   a new project, infer the admin project, or auto-link from the current folder.
2. Select a reviewed release revision and its dependent changes. The repository
   [release procedure](../../operations/release.md) requires an exact reviewed
   main commit and successful CI/staging checks. A generic continuation does not
   identify which of the unrelated working-tree changes should be released.
3. Verify the intended production API and public origin with the project owner.
   Existing local Next build output uses local/development configuration and is
   not a Vercel production prebuilt artifact; do not upload it as one.

The repository also says not to commit or push without a same-turn request
(CLAUDE.md). Prepare the source and verification evidence first; release only
the explicit reviewed revision through the intended project.

## Review scope

Source areas for the SEO release are listed in
[the implementation resume](../../superpowers/specs/RESUME-seo-growth-implementation.md).
Prior performance/SEO/commerce patches and current shared dependencies were
already present when implementation began; keep their dependencies visible in
release review. Do not deploy the complete dirty checkout to avoid deciding scope.

Local tests/build results are in the release README and resume.
No live payment, external enquiry, review solicitation or newsletter submission
is part of smoke testing.

## Actual application HTTP checks

The existing production build was started temporarily on 127.0.0.1:3019 using
Next start, then stopped after checks. These requests exercised the built app
and its root layout, not an isolated component fixture.

| Route | HTTP | H1 count | Canonical | Structured data |
| --- | --- | --- | --- | --- |
| /bulk-drinks | 200 | 1 | HTTPS www, matching path | Parseable root + WebPage/BreadcrumbList |
| /occasions | 200 | 1 | HTTPS www, matching path | Parseable root + WebPage/BreadcrumbList |
| /occasions/weddings | 200 | 1 | HTTPS www, matching path | Parseable root + WebPage/BreadcrumbList |
| /occasions/corporate | 200 | 1 | HTTPS www, matching path | Parseable root + WebPage/BreadcrumbList |
| /occasions/house-parties | 200 | 1 | HTTPS www, matching path | Parseable root + WebPage/BreadcrumbList |
| /occasions/gifting | 200 | 1 | HTTPS www, matching path | Parseable root + WebPage/BreadcrumbList |
| /authenticity-guarantee | 200 | 1 | HTTPS www, matching path | Parseable root + WebPage/BreadcrumbList |
| /delivery/abuja | 200 | 1 | HTTPS www, matching path | Parseable root schema |
| /delivery/lagos | 200 | 1 | HTTPS www, matching path | Parseable root schema |
| /occasions/nonexistent-release-check | 404 | 0 | Noindex exclusion confirmed | No page schema |

All nine public pages returned index/follow metadata. HTML saved under
/tmp/drinksharbour-seo-implementation/app-smoke-*.html; parsed check results in
app-smoke-results.json in that same temporary directory. This verifies HTTP
rendering and HTML metadata locally; browser analytics receipt, catalogue/stock
API availability, checkout, live Google rendering and field CWV remain unverified.

## Continuation status

User asked where the folder was after the deployment-context question. Clarified
the storefront path is /Users/mac/Documents/drinksharbour/client/apps/platform;
the release docs are in docs/seo/growth-2026-10. The existing Vercel team/project
and reviewed release revision are still unspecified. No project was linked.
