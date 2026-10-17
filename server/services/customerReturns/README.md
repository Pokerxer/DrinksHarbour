# Inventory customer returns

GET reads only persisted Sales returned counters and POS refund item quantities.
Tenant comes from JWT authority behind inventory:read and requireOwnTenant.
Mongo aggregation filters/paginates the combined stream; totals cover all matched
lines, not just the loaded page. Existing ledger/refund records are never written.

Sales counters are raw Sales-origin quantities, not projected linked POS counters.
POS subtracts legacy salesReturnedQuantity overlap. Rows with no new returned
units disappear, without discarding historical money refund records elsewhere.

Confirmed customer-return InventoryMovement evidence proves restocking. Exclude
supplier and internal transfer returns. Absent evidence/date is unknown; never
infer updatedAt or replay stock. Sales lines summarize cumulative returns; date
is the latest matching movement, not a fabricated single return date. POS rows
represent persisted refund items. New Sales writers opt out of the generic
warehouse receipt mirror and retain a typed relatedSalesOrder reference.

Sales returnedQty remains visible when old fulfilledQty metadata is absent.
A proven full restock implies zero non-restocked units. Split destinations stay
visible; the location filter selects entire cumulative lines involving a site,
not a per-site allocation of the returned quantity. Duplicate POS refund indices
and ambiguous unsized products cannot share audit evidence. Non-restocked returns
have no invented destination taken from the original sale location.
