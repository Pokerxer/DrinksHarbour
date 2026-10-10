# Warehouse demand from transfers

Posted source warehouse transfers count like sales for operational demand:
automatic minima, forecasts, stock cover, donor reserves and movement priority.
`server/services/restock/local-demand.js` combines net customer sales with dated
outflow from `transfer-demand.js`. Returns reduce demand; mirrored document/ledger
evidence counts once. Pending intentions remain outgoing commitments. Current
document workflow reduces source physical stock when receipts are posted.
Never create sales transactions or inflate financial/customer-sales totals.

Warehouse modal primary metric uses combined 30-day movement and movement/30
for its average daily rate. Its breakdown retains customer sales and transfers.
Demand facts remain gated by report permissions. `insights/list-rules.ts` must
preserve explicit null combined demand; only undefined legacy combined fields
fall back to sales. Custom-period missing demand likewise remains unknown.

Handoff and verification: docs/superpowers/specs/RESUME-transfer-out-demand.md.
No physical stock mutation or metadata refresh is needed for this presentation fix.
