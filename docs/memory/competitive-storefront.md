# Competitive storefront: selected offers, delivery and bulk clarity

2026-10-20. User approved implementing the first competitive release after the
Drinks.ng comparison and organic visibility brief. Scope: trustworthy selected
bottle information, consistent regional delivery copy and clearer single/bulk
buying; the 90-day editorial/outreach programme remains subsequent work.

## Behaviour

- `client/apps/platform/src/utils/offerVolume.ts` resolves an unambiguous selected
  ml/cl/l size before offer volume. A selected offer never inherits catalogue
  volume; only absent offers may use catalogue fallback. Pack/weight/accessory
  labels are not parsed as a single bottle. Display adapters reuse this helper.
- Product detail badges, size-card measurements, specification props and quick
  view now follow the selected selling offer. No database sizes were relabelled.
- Quick view reuses `purchaseLimits`/`clampPurchaseQuantity`: available stock,
  seller cap, minimum order and unavailable status apply together. Pack selection
  changes quantity, and purchase is disabled/rejected outside those limits.
- `deliveryCopy.ts` contains standard delivery text only: Abuja/FCT ₦2m+, other
  states ₦10m+. Announcement/top/footer defaults, homepage benefits, FAQ and
  existing product benefits reuse it. Existing shipping-info correction retained.
  First-order offers keep their separate server eligibility. Admin-managed live
  banners are not overwritten; their stored copy needs operational review.
- `PackPricingCard` identifies selected size, single-unit/bulk unit prices, pack
  total and savings. Its action says Select N units, with no inert action when
  no callback exists. Pricing still comes from the existing commerce resolver.
- `commerce-core/src/commerce-policy.ts` removes an unsupported and inaccurate
  nationwide freeShippingThreshold property. Regional descriptions link the
  real shipping policy. This changes published metadata, not checkout rates.

## Verification

Observed failing regressions before fixes: detail showed catalogue 1000ml instead
of selected 750ml; default banner omitted regional qualification; bulk card lacked
size/selection semantics; quickview exceeded stock when seller cap was higher.
All targeted regressions now pass. Full platform: 172 pass / 1 fail. The failure,
`homepage sends hero while catalog is pending, then sends server catalog`, cannot
resolve `@/lib/venue/server` in the existing test loader. The concurrently changed
homepage is async and the test also assumes a synchronous shell. Neither homepage
nor its test is changed by this release.

TypeScript and focused ESLint pass. Shared commerce tests: 52/52 pass. Required
backend suite with network access: 4,092 pass, 36 skipped, zero fail. The initial
restricted run failed 158 HTTP tests because local listeners were denied; it is
superseded by the successful network-enabled rerun.

Initial and final production Webpack builds passed (exit 0). Default Next dev preview hit EMFILE watchers and unavailable local API on
port 5001, yielding a product 404. A static preview of actual product components
with labelled test data was rendered and opened locally; its DOM verified 70cl /
700ml, bulk totals and regional benefits. This is not an end-to-end checkout or
full mobile visual test. CodeRabbit CLI is absent; scoped diff self-review done.

## Continuation

No commit, push, deployment, inventory mutation, outreach or publishing. Existing
worktree changes preserved. Before release, review admin-managed banner content,
confirm live API/catalogue data, deploy the scoped patch with required existing
changes, then verify live pages and request a fresh SEO crawl. No ranking gain,
traffic increase or competitor superiority has been measured.

Plan: docs/superpowers/plans/2026-10-20-competitive-storefront.md.
Spec: docs/superpowers/specs/2026-10-20-competitive-storefront-design.md.
