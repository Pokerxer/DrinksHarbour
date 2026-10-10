---
name: POS quotation tax snapshots
description: Quote tax must survive POS checkout; zero tax overrides terminal VAT estimates.
type: project
---

2026-09-28: SO00007 / RCP-20260917-0001 (Wyn City, tenant
699165839f3308b1baeca8fc) was inspected read-only. Both store zero tax and
₦2,193,041.28 total; all 17 quotation lines have taxRate/taxAmount 0. No historical
money or stock repair is justified by these records. Conversion is in-place and
does not reset rates. The terminal receipt previously inferred inclusive VAT
from settings; at 7.5% this falsely displays ₦153,002.88 on that receipt.

Separate confirmed defect: taxable quotes lost their rates in cart mapping;
server quoted-price resolution carried only net prices. POS total excluded tax.
Fix snapshots taxRate and taxAmount per Order item and sums Order.taxAmount;
server rates come from a tenant-scoped SalesOrder lookup, never cart claims.
Quote prices bypass current pricelist/bundle transformations in the cart.
Tax is computed after line discounts, before footer adjustments, using the
quotation service's per-line rounding. Partial/split sales use sold quantities.

Cart, payment payload, offline receipt/history, live response, history endpoints,
thermal receipt and A4 invoice/preview carry tax. An explicit zero is authoritative
and must not fall back to the terminal tax setting. Ordinary unlinked receipts
retain their existing settings-based estimate. Taxed stale checkout totals are
rejected with 409 and stock rolled back; offline sync parks conflicts for review.

No new endpoint or migration is needed: Order already had taxAmount; optional
line tax snapshots were added. Existing receipts remain unchanged. Earlier
SO00007 warehouse correction is preserved. See
`docs/superpowers/specs/RESUME-pos-quotation-tax.md` for verification and limits.

Verification: 2,932 server tests and 2,019 admin tests pass. Full TypeScript check
reports 374 errors outside the changed POS/invoice files. Browser runtime could
not initialize, so no live terminal sale was exercised. Reload cached POS/PWA.
