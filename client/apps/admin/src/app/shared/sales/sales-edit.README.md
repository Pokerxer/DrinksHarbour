# Sales edit order operations

The route composes `sales-edit` (session-scoped document loading) and the shared
editor. Cancel, Lock/Unlock and Delivery live in small separate components.
The user approved the bounded behavior in this chat on 2026-10-15.

- `locked`, `lockedAt`, `lockedBy` are persisted SalesOrder fields. POST
  `/api/sales-orders/:id/lock` and `/unlock` use the resolved tenant; repeated
  requests with the same lock state are idempotent. Changes record activity.
- Commercial edits, price updates, coupons, draft confirmation, quotation transitions
  and bulk cancellation/deletion cannot bypass a lock. Locking does not block
  fulfillment or goods returns. Unlock restores the existing lifecycle rules;
  it never changes confirmed/paid/closed orders back to draft.
- The editor disables all controls and autosave for noneditable records. Printing
  reads saved data directly for read-only documents. Lock saves pending edits
  first and aborts if saving fails. Cancellation discards pending edits only
  after success; its confirmation explains that no stock/refund is created.
- Read-only amounts come from the saved source, not live pricing previews.
  Information tabs remain available for inspection while their fields are inert.
- Cancellation eligibility is checked on the server and reflected in the UI.
  Paid/partially paid, delivered, already cancelled, converted quotations and
  issued invoice evidence block cancellation. Delivered goods use returns;
  credits and cash refunds remain separate workflows. Bulk cancellation uses
  the same policy. The existing DELETE action changes lifecycle, not deletion.
- Delivery shows actual line quantities and history. Original remaining quantity
  is ordered minus gross fulfilled; returns do not erase unshipped demand or
  create automatic replacement deliveries. The action opens the existing source
  warehouse / quantity fulfillment screen; no second stock-posting mechanism.
- Loaded document state belongs to id + session token. Ignore old completions;
  sign-out ends loading, failed reads expose Retry. Successful lifecycle actions
  replace the editor snapshot and remount it to prevent stale form state.

References and verification: `docs/superpowers/specs/RESUME-sales-edit-order-actions.md`.


## Confirm and reserve stock

Confirm saves pending edits first and reserves available selling quantities at
its saved warehouse. It leaves payment unpaid and on-hand unchanged. New-sale
and detail confirmation use the same operation. Confirmed snapshots are read-only
under the existing lifecycle rules; unlocking does not reopen line editing.

Delivery shows Ordered, Delivered, Remaining, Reserved, Waiting and named hold
locations. Check availability tops up waiting units, including on locked orders.
Remaining excludes returns; waiting excludes already held units as well.

Record payment is separate on order detail. Full-total capture rejects partial
payments and bill-later tender; unsettled payment outcomes require review. Locked
confirmed orders can receive payment. Delivery uses a persisted retry identity;
linked POS persists its identity through offline queueing and lost responses.

Backend ownership, transaction requirements and verification:
`docs/superpowers/specs/RESUME-sales-confirm-reservations.md`.

## Document rows and adjustments

See `sales-editor-controls.README.md` for sections, multiline descriptions/notes,
discount conversion, tax/shipping, shared money rules and preview/print contracts.
These controls remain inside existing read-only/lock/lifecycle boundaries.
