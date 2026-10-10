# Movement history conventions

/inventory/moves and the shared receipt/delivery/internal/adjustment/scrap browser load paginated history rather than a fixed 500/2,000 snapshot. getAllMovements is bounded at 10,000 records; incomplete views disable exports and ask for a narrower date range. Date filtering uses recorded createdAt, local bounds converted to ISO, inclusive end-minute milliseconds. Date shortcuts use local calendar parts instead of UTC date strings, preventing midnight/previous-month off-by-one errors.

Only confirmed on-hand movementDelta contributes posted in/out/net/gross units and cost. Reservations and releases are history but not physical stock changes. Transfer/return legs keep their posted warehouse direction. Gross units count both legs of a transfer; do not present them as distinct transferred quantities. Unknown recorded costs are disclosed/excluded, not invented.

Filter warehouses by actual leg ID; endpoint matching is a legacy fallback only when actual warehouse is absent. Match any selected SubProduct, intersect other filters, normalize accent/SKU/alternative text. Preserve selections across pages; remove hidden selections. Keep print/CSV scope all matching or selected, never current-page-only. Shared DocumentModel printing avoids raw HTML interpolation; CSV protects spreadsheet formulas.

Keep inventory/stock's full-width theme without outer margins. Page, hook, header, filters, table and row are separate focused modules. Handoff and verification: docs/superpowers/specs/RESUME-inventory-moves.md.

Verified 2026-10-04: 2,407 admin tests, 3,341 backend tests and focused movement TypeScript check pass. Use one admin test worker with 30-second test/hook limits on this machine; concurrent verification previously hit resource-related test/RPC timeouts.
