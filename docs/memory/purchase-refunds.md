# Purchase refunds and transfer returns

See [resume](../superpowers/specs/RESUME-purchase-refunds.md) for contracts and
file responsibilities, and [plan](../superpowers/plans/2026-10-02-purchase-refunds.md).

Key conventions:
- Purchase receivedQty is retained stock; returnedQty offsets it in outstanding.
  Transfer receivedQty is historical; returnable is received minus returned.
- Supplier refund is a recorded receipt of money/credit, independent of physical
  stock confirmation. Each settlement has history and its own journal identity.
- Never directly PATCH refunded status, refund totals/history or confirmed lines.
- UI sends requestId, retained across a failed request, to prevent duplicate writes.
- New module transfer return operations are transactional and tenant scoped.

Verification on 2026-10-02:
- Full server suite: 3,248 passed, zero failed (`node --test '__tests__/*.test.js'`).
  Log: `/tmp/purchase-refund-server-verified.log`. The initial sandboxed run
  could not open HTTP test sockets; rerunning with local socket access passed.
- Full admin suite: 189 files / 2,250 tests passed (`.bin/vitest run`).
  Log: `/tmp/purchase-refund-admin-complete.log`.
- Project typecheck still reports the existing 390 unrelated errors. No errors
  match the files modified for this task. Log: `/tmp/purchase-refund-types-complete.log`.
- Diff whitespace check passed. Manual review used because CodeRabbit isn't
  installed. New component files remain below 200 lines.
- No live stock/payment operations or migrations were performed. Supplier
  confirmation/cancellation retains its existing multi-write persistence;
  monetary refunds and module transfer returns use transactions.


## History verification — 2026-10-03

Refund history now includes actor names and preserves legacy amounts as labelled
summaries. Main transfer timeline includes chronologically sorted return entries
with stored refunded/remaining values. Mutation results reach parent state before
refreshing, so a failed GET cannot erase a successfully recorded event.

- Server suite: 3,249 passed, zero failures; `/tmp/refund-history-server.log`.
- Admin suite: 191 files / 2,252 tests passed; `/tmp/refund-history-admin.log`.
- Actual Mongoose subdocument casting separately verified: quantities, requestId,
  refundedValue and remainingValue survive `toObject()` (no live database write).
- Typecheck retains 390 existing unrelated errors; modified history paths clear.
- Diff whitespace check passed. No live refunds or inventory were changed.

## Whole-invoice return — 2026-10-03

Visible **Return all products** shortcuts now exist on purchase order detail,
linked supplier invoice detail, and the purchase return form. Transfer detail
has an inline review plus one transactional bulk return. Already returned,
unreceived and pending-reserved quantities are excluded; supplier selection
also respects the exact linked invoice. Existing supplier draft confirmation
and transfer history contracts remain in force. No standalone invoice stock
source was invented.

- Server: 3,252 passed / zero failed; `/tmp/return-all-server.log`.
- Admin: 192 files / 2,256 tests passed; `/tmp/return-all-admin-final.log`.
- Typecheck: 390 pre-existing unrelated errors; changed return components clear;
  `/tmp/return-all-types3.log`.
- Manual review and diff whitespace check passed. No live refunds, inventory
  operations, migrations, commits or deployments were performed.

## Transactional create guard — 2026-10-03

Mongoose requires `{ session, ordered: true }` for multi-document `create()`
inside a transaction. Transfer stock returns now use it for both warehouse and
unified inventory movement pairs. Retain this option on future changes. Two
regressions exercise real Mongoose create/save at the mocked driver boundary;
both reproduced the reported error before the change and passed afterwards.
Focused return tests: 27 passed; `/tmp/return-create-green.log`.
Full server verification: 3,254 passed, zero failed; `/tmp/return-create-server.log`.
Diff whitespace check and manual review passed. No frontend changes or live
stock/refund operations were performed for this correction.

## Invoices after returns — 2026-10-03

Both invoice pages and PDF builders now display invoice return adjustments.
Supplier invoice confirmation adjusts the exact linked invoice including paid/
partial/overdue statuses, snapshots its original items/money, and retains exact
active/inactive return adjustments for idempotent cancellation and history.
Payment records remain historical. Never infer another invoice's returns from
only the shared PO; invoice GET resolves explicit links or recorded adjustments.
Whole-invoice preselection treats snapshotted bill quantities as already net.
See RESUME for fields, component ownership and historical-data limits.

- Server: 3,258 passed / zero failed; `/tmp/invoice-after-return-server.log`.
- Admin: 194 files / 2,260 passed; `/tmp/invoice-after-return-admin-final.log`.
- Initial admin run had one unrelated pricelist loading timeout in
  `inventory-pricelist-modal.test.tsx`; isolated retry (7 tests) and full retry
  passed. Logs: `/tmp/invoice-after-return-admin.log` and
  `/tmp/invoice-pricelist-recheck.log`.
- Typecheck: 390 pre-existing errors; modified invoice UI paths clear;
  `/tmp/invoice-after-return-types2.log`.
- Real Mongoose invoice casting verified snapshots and cancelled history.
  Diff whitespace check/manual review passed. No live stock, refunds,
  historical migration, deployment or commit performed.
