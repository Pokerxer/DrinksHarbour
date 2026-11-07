# POS report variant identity — server parity (DRI-10, 2026-11-05)

The POS report surfaces and the till cart must never disagree about a line's variant identity, for any
business type (DRI-6 CEO decision: shared report views generalize, no per-industry forks). Three server
sources now share ONE label authority:

- `server/services/posReportOrder.service.js` exports `sizeVariantLabel(size)` and
  `orderLineVariant(item)`. The composed label is `displayName · colorName · optionName` joined with
  ` · ` — the semantics of `client/apps/admin/src/utils/size-variant-label.ts`. `mapReportLine` uses it
  as the fallback when the till's `_variant` snapshot is absent.
- `server/controllers/pos.report.controller.js#buildProductBreakdown` (Z-report productBreakdown, daily
  and range topProducts) keys by `product||variant` and labels `name · variant` through
  `orderLineVariant`; colour-less rows render the bare name, never a dangling ` · `.
- Report queries populate `items.size` (`displayName colorName optionName`) and
  `items.product` (`name`) so the compose has data on legacy/foreign-sourced orders.

## Invariants (pinned in `server/__tests__/posReportVariantParity.test.js` + the Mongo fixture)

- Legacy rows without colour data emit byte-for-byte the pre-change string
  (`item._variant || item.size?.displayName || ''`); the raw DRI-4-style control emits `''`.
- Retail rows keep colour/option identity identical to the till label semantics.
- Two colour variants of one product are two Z-report rows, not one collapsed row.
- Tenant isolation holds on every report read (/orders, /orders/analysis, /reports/session/:id 404 for
  foreign tenants, /reports/daily, /reports/summary).

Deliberate divergence from the client util: the server head term is `displayName` only, NOT
`displayName ?? size` — substituting the Size `size` code would change colour-less legacy output, which
the byte-parity requirement forbids.

## Strict-strip finding (follow-up on record)

`orderItemSchema` (`server/models/Order.js`, `strict: true`) never declared `_name`/`_variant`/`_sku`, so
persisted POS receipts have ALWAYS dropped the till's cart snapshots (same class as the documented hold/
recall strip in `posHoldRecallRoundTrip.test.js`). The composed fallback is the identity carrier for all
persisted receipts. Declaring the three fields on `orderItemSchema` would freeze the till label at sale
time but changes persisted order shapes — keep out of any variant work unless explicitly authorized and
re-verify the DRI-4/DRI-7/DRI-10 fixtures plus the byte-parity oracle after.

Evidence: `docs/reports/dri6-pos-reports-server-acceptance-2026-11-05.md`;
resume: `docs/superpowers/specs/RESUME-pos-reports-variant-parity.md`.
Frontend-side surface/export adoption: `docs/reports/dri6-pos-reports-frontend-acceptance-2026-11-05.md` (DRI-11, 2026-11-06) — all client surfaces audit-only against the server string; exports pinned by unit tests.
