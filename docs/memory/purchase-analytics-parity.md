# Purchase analytics filtering and receipt/return totals

2026-10-04. Handoff: `docs/superpowers/specs/RESUME-purchase-analytics-parity.md`.

`/purchases/analytics` reuses warehouse receipt/return logic globally. Request PO pages with `analytics=true` to obtain authoritative per-line receiptMetrics, scoped to tenant and page PO IDs. Null warehouse means all locations; product-size keys isolate lines. Applied return documents plus counter remainder must be deduplicated. Repeated product-size lines get weighted costs and allocated metrics once.

Product/category/brand filters PROJECT contributing lines before every aggregation, with OR within a dimension and AND across dimensions on the same line. Source invoice objects remain intact. Save selected IDs and explicit UTC creation range/reference in the existing filter string array so saved searches restore them.

Do not count all invoice lines after matching one product. Do not use cash refunds or current stock as purchase/return goods values. Separate gross received, returned and net purchases per currency; ordered value remains distinct. Creation dates select invoices; later returns stay cumulative. Single and stacked bars render all groups with finite widths and no eight-product renderer switch. Never restore the 30-group chart cap. The pagination safety cap must always show a persistent incomplete-totals warning.

Verification: full backend 3,334 passed; full admin 213 files / 2,334 passed. TypeScript remains at the existing 390-error baseline, with no errors in the changed analytics files. No authenticated live-browser verification was performed.
