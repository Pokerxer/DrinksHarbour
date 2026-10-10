# Delivery history conventions

/inventory/deliveries is outgoing sold/shipped movement history, not proof of completed customer delivery. Do not add an extra stock-posting or fulfilment mutation from historical records. Returns, internal transfers and scrap keep their separate pages.

Issued units use confirmed negative recorded stock changes; pending/cancelled/rejected do not issue stock. Pending quantity, missing cost and unavailable/partial summary states are explicit. Distinct linked orders count persisted order IDs, not rows or reference text. Invoice tax and revenue belong on the linked sales document.

Source filter/sort and historical balances supplement combined product/warehouse/status/date filters. Delivery saved views retain source and the page's independent storage key. Sales references fall back to receipt/order number only when no raw movement reference exists; search both numbers. Single printing uses full Delivery Note; all/multiple prints Delivery history via explicit preset document settings. CSV/history preserves source, references, notes, SKU, batches and actor. Keep Stock/Moves/Receipts full-width style without outer margins.

Handoff and verification: docs/superpowers/specs/RESUME-inventory-deliveries.md.

Verified 2026-10-04: 240 admin files / 2,429 tests, focused delivery/receipt/movement TypeScript and whitespace checks passed. Backend unchanged; no authenticated browser verification.
