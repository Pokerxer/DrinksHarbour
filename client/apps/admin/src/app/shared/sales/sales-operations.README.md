# Sales deliveries and returns

`sales-fulfill` and `sales-returns` compose the same compact read-only workspace.
Route wrappers retain the approved full-width spacing. State, toolbar, results,
and pure helpers are separate small files; no new state library or backend API.

- Load every page of the two eligible lifecycle statuses. A failed status/page
  fails the whole load; never present a partial list as complete or empty.
- Both loaders request composed Sales/POS return evidence and deduplicate orders
  across status/page changes. Empty pages claiming more data fail explicitly.
- Session-scoped results ignore old request completions and unmounts. Missing
  authentication terminates loading. Refresh performs GETs only.
- Search combines reference/customer/order-warehouse with original order status
  and order-warehouse filters. Pagination is applied after filtering all loaded
  records. Counts/quantities cover all matches, not just the visible25 rows.
- Warehouse is the order's warehouse, not proof of a return's restock destination.
  Status describes the original order, not an invented return-transfer workflow.
- Selling quantities follow each line's UOM; do not label them physical bottles.
  Presentation lines do not contribute. Money remains per-order in its currency;
  never sum mixed-currency totals or label order value as refunded value.
- Original unshipped quantity is ordered minus gross fulfilled quantity. Returned
  goods were already fulfilled; subtracting returns again cancels unrelated open
  demand. A full delivery followed by a return does not automatically create a
  replacement delivery. Client/server helpers agree; existing shipment caps remain.
- Goods returns, credit notes, and cash refunds remain separate records. Review
  links lead to existing workflows; the queues never issue credits/refunds or
  change stock. The overview links to deliveries, return history and invoices.

Odoo reference and verification: `docs/superpowers/specs/RESUME-sales-operations-workspaces.md`.
