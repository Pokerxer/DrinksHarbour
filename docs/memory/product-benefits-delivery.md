# Product shopping benefits and regional free delivery

2026-10-19. User requested correcting the benefit section on /product/[slug].
Explicit clarification: retain Abuja/FCT free delivery from ₦2,000,000; all other
states from ₦10,000,000. Existing >= thresholds remain authoritative; no backend
fee/rate changes and no migrations.

## Changes

- Product/Detail/ShoppingBenefits.tsx replaces the embedded four-card block in
  Detail/index.tsx. Compact icons, two-column layout, wrapping text, accessible
  policy links and focus rings retain existing pastel brand surfaces.
- Delivery shows both regional thresholds in NGN rather than attaching the
  selected product's currency symbol to an incorrect 10,000 threshold.
- Delivery card links /shipping-info. User follow-up replaced the returns card
  with Order updates, a package icon and /order-tracking link. The returns policy
  is no longer promoted in this product benefit section. Payment no longer claims
  absolute 100% protection.
- Linked shipping-info interstate/hero/footer copy now matches the confirmed
  regional thresholds; previously it incorrectly promised ₦2m nationwide.
- Initial nationwide interpretation was explicitly superseded by the user's
  clarification before backend changes. The temporary failing nationwide test
  was removed; server/data/shipping-zones.js is unchanged.

## Checks

Lint passes for the three changed frontend files. Actual component static render
(with Next Link replaced by an anchor at the framework boundary) verifies four
cards, both threshold texts, seven-day returns and both policy links. Real server
shipping calculation verified below/at/above each regional threshold.

Full platform run: 122 passed, 16 failed, all failures are missing next/link or
next/image in unrelated existing suites. The platform/node_modules/next symlink
points to an absent Next 16.1.6 package. Type check reports 384 diagnostics largely
from that missing framework; new component's diagnostic is missing next/link.
Required full backend suite: 4,025 passed, 30 skipped, zero failures.
No dependency or lockfile mutation, no live browser visual check. Logs: docs/superpowers/specs/RESUME-product-benefits-delivery.md.

Follow-up verification: Order updates card rendered with /order-tracking, no returns
card/link in this section. Scoped lint passed. This copy/icon/link change does not
change shipping or returns processing; prior full-suite results above are historical.
