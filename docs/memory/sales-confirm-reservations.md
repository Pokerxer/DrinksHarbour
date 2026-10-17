---
date: 2026-10-15
type: project
---

# Sales confirmation reservations

Approved design and implementation plan are implemented, with one agent in the
existing uncommitted feature checkout. No production data work or deployment.
Resume and verification evidence:
`docs/superpowers/specs/RESUME-sales-confirm-reservations.md`.

Confirm is now unpaid stock confirmation. SalesStockReservation owns exact
order/line/warehouse/variant held/consumed/released quantities; physical stock
stays unchanged until delivery. Waiting shortages can be topped up, even while
locked. Cancellation releases only unused own holds. Returns do not re-reserve.
Never reset WarehouseStock.reservedQuantity: it also protects expired quarantine.
Use native warehouse Size quantities; packaging labels do not multiply units.

Manual delivery and linked reserved POS use transactional consumption and stable
replay identities. Reserved POS wallet changes join the stock/receipt transaction.
Later reconciliation verifies a settled receipt and does not issue stock again.
Ordinary outflows/adjustments/transfers protect holds atomically. MongoDB needs
transaction support and unique reservation/operation indexes; no legacy backfill.

Payment remains explicit on detail, with one durable full-payment slot per order.
Pending/uncertain outcomes block further charging; failed capture keeps holds.
Do not remove needs_review records to retry. Partial debts need their existing
receivable workflow, not another full-total charge. Delivery reporting applies
line discount/promotion math correctly and preserves kobo; failed loyalty
redemption cannot mark a sale paid.

UI Confirm saves first and stops on failed save. It is shared by edit, new-sale
and detail entry points. Reserved/Waiting and named hold locations are read from
server projections. Existing lifecycle/read-only/session guards remain intact.
The shared request identity survives failed network responses and offline queues.

Final suite counts and local Mongo proof are in the resume. React interaction
checks were used; no authenticated live-account browser verification was claimed.

Verification: full backend3875 pass /16 optional skips, full frontend3011 pass;
then the final cancelled-Waiting projection regression and8 UI interactions pass.
Type check remains at the359 pre-existing diagnostics; new diagnostics corrected.
Touched-file lint and whitespace checks pass. Local replica-set integration passed
and its test server was stopped. See resume for exact logs and coverage limits.
