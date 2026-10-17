# Order-owned warehouse reservations

Confirmation holds the existing warehouse variant quantity; it does not deduct
on-hand, charge money, issue invoices, or multiply pack display metadata.
SalesStockReservation owns the Sales contribution to reservedQuantity. Other
orders and expired-lot quarantine retain their independent holds.

All ownership/counter mutations require a MongoDB transaction and resolved tenant.
Legacy orders have no fabricated reservations. Locks leave holds intact; returns
do not recreate consumed holds. Operation identities protect replayed shipments.

Design and task progress: `docs/superpowers/specs/RESUME-sales-confirm-reservations.md`.

## Operation boundaries

- `allocate`: unpaid in-place confirmation and partial/top-up ownership.
- `consume`/`fulfill`: same-session stock, batch, ledger, Sales and delivery writes.
- `pos`/`posReceipt`: own reservation, receipt and wallet debit commit together;
  reconciliation verifies the actual settled receipt and never issues stock again.
- `payment`: permanent full-payment claim before wallet/loyalty side effects;
  settled replays do not charge, uncertain/pending attempts block another charge.
- `release`: cancellation releases exact unused held quantities; quarantine and
  other orders retain their contribution to reservedQuantity.
- `projection`: line-owned Reserved/Waiting with tenant-scoped warehouse names.

The database must support transactions (replica set or sharded deployment).
Final successful manual or POS delivery snapshots the completing staff member
in SalesOrder.fulfillmentAttribution and mirrors its name/reference to salesperson.
Pass the authenticated actor object with actorId. This snapshot is saved inside
the stock/receipt transaction and is not replaced by partials or receipt retries.
Model guards protect frozen names/IDs from document and query updates; returns
and later payment updates retain the snapshot. See RESUME-sales-fulfillment-attribution.md.
The unique ledger/operation indexes are required before accepting concurrent
traffic. Existing unversioned orders retain their workflow; no backfill or live
migration was run. `needs_review` payment records require an operator to inspect
wallet/loyalty/receipt evidence before resolving them; never delete them to retry.

Local integration check uses only a validated `127.0.0.1:29127` database with the
`drinks_sales_reservation_test_` prefix via
`DRINKSHARBOUR_SALES_RESERVATION_TEST_MONGO_URI`. Its fixture drops that test DB.
The ordinary suite skips this opt-in test. Never point it at customer data.
