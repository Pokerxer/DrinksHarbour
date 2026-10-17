# Quotations and returned orders

`sales-quotations.tsx` opts the shared list into `includeReturnedOrders`.
When the active document filter is quotation, list parameters send
`includeReturnedOrders=1`. Ordinary Sales list callers retain their filters.

The server resolves actual returned selling quantities using the existing linked
Sales/POS projection. It unions quotation documents with returned order IDs
before search/filter pagination, counting, and grouping. Every query is scoped
to the resolved tenant. It recognizes convertedFrom links on legacy orders;
unmatched receipt refunds and unfulfilled quantities cannot qualify an order.
No saved document type, stock, refund, or quotation status is changed.

The read-only `hasReturns` marker adds Returned to the existing lifecycle label
in table/spreadsheet/CSV. The quotation board uses a Returned orders bucket so
converted or directly-created orders cannot vanish or appear as draft quotes.
Export uses the same parameter builder and walks the same result set.

Handoff: `docs/superpowers/specs/RESUME-sales-quotations-returns.md`.

## Salesperson attribution

New quotations snapshot the authenticated staff member's first/last name
(display name or email if needed), plus a separate salespersonUser reference.
Client document fields cannot impersonate a salesperson. Successful quotation
content edits, price recomputations and coupon changes assign the authenticated
editor as salesperson; reassignment is logged after saving. Failed/read-only
updates preserve assignment. Sales-order edits and conversion keep assignment;
duplication retains it until edited. CSV imports capture the importing actor.
Once all ordered goods are fulfilled, the completing warehouse/POS staff member
becomes the final salesperson. fulfillmentAttribution snapshots their name,
user reference and completion time. Lists/export/detail prefer that frozen name;
detail labels it Fulfilled by. Later profile changes, payments, returns and
retries cannot reassign it. Earlier partial-delivery actors remain in history.
Table, board, spreadsheet and export display the same salesperson snapshot.

My Quotations sends myQuotations=1. The server resolves authentication and
composes ownership with tenant, search, advanced filters and returned orders.
Linked documents match the stable user ID, so staff name changes do not lose
ownership and two new staff records with equal names remain distinct. Legacy
documents without a user reference can match their existing name snapshot;
unknown or ambiguous historical names cannot be retroactively verified.
Blank historical assignments are not fabricated or rewritten.

Handoff: docs/superpowers/specs/RESUME-sales-salesperson-tracking.md.
