# RESUME — the Sales Orders list, audited and repaired

**Status:** all seven findings FIXED and covered by tests. **UNCOMMITTED**, on
`feat/mobile-phase-1-foundation`. Not yet opened in a browser — see *Still to do*.
**Audited + built:** 2026-08-16/17.

Findings and their reasoning:
[`../plans/2026-08-16-sales-orders-list-audit.md`](../plans/2026-08-16-sales-orders-list-audit.md).
Triggered by the `paymentStatus` enum widening in `ede9fdb1`
([`RESUME-pos-fulfill-quotes.md`](./RESUME-pos-fulfill-quotes.md)), whose list
surface was never audited.

Page: `client/apps/admin/src/app/(hydrogen)/sales/orders/page.tsx` →
`shared/sales/sales-list*.tsx`. Server: `salesOrder.controller.js` +
`salesOrder.service.js`.

---

## The one sentence

The list's filters were not merely inert — **the same code path let one tenant
read another's sales orders** — and every column meant to say what state an
order was in was rendering a constant.

---

## The answer to the question that started this

**The list had no payment rendering at all** — no column, badge, filter or
group-by mentioned `paymentStatus` (the only three references in
`shared/sales/` were the three detail views already fixed in `ede9fdb1`). So a
`'partial'` order did *not* render as "Unpaid"; money the till had taken was
simply absent from the page. `salesOrderService.list` already accepted a
`paymentStatus` param and `salesOrder.controller.js:76` already honoured it —
**no caller ever passed it.**

---

## What changed

### G — `filters` could overwrite the tenant scope — SECURITY, was live

`getSalesOrders` built `q = { tenant: tenantId }` then
`Object.assign(q, buildFilterQuery(filters))`, and `buildFilterQuery` copied any
`f.field` in verbatim. So this returned another tenant's orders:

```
GET /api/sales-orders?filters=[{"field":"tenant","operator":"equals","value":"<other tenant _id>"}]
```

Never observed from a browser because the admin UI sent `fieldId`, not `field`
(finding B) — the browser's payload was discarded and a hand-crafted one obeyed.

- **The Mongoose schema is now the allowlist.** `isFilterablePath(field)` accepts
  a field only if `SalesOrder.schema.paths` has it and `NEVER_FILTERABLE`
  (`tenant`, `_id`, `__v`) does not. A field added to the schema becomes
  filterable for free; there is no second list to drift.
- **Defense in depth:** the controller re-asserts `q.tenant = tenantId` *after*
  the merge. Nothing a caller sends decides which tenant's orders come back.

### B — every filter the UI sent was dropped

Client emitted `{ fieldId, operator, value, label }` (`fieldId = config.id`,
snake_case); server keyed off `field` and `continue`d without one. All ~60
filters did nothing — chip appeared, result set never moved, no error, no test.

- `FilterValue` gained `field` (the document path); `advanced-search-filter-list.tsx`
  emits it on all 8 operator branches.
- `buildListParams` resolves a missing `field` from `FILTER_CONFIGS` by
  `fieldId`, so **favourites saved to localStorage before this key existed do
  not go dead**.
- **`FILTER_CONFIGS` cut from 64 entries to 16.** The removed ones named fields
  SalesOrder does not have (`activityState`, `salesTeam`, `tasks`, `website`,
  `invoiceStatus`, `deliveryStatus`, `expectedDate`…) — controls that could
  never work. `customer` was repointed to `customerSnapshot.name`; the single
  `status` config was split into `order_status` and `quote_status`, because
  orders and quotations carry separate lifecycle fields and one control cannot
  name both. **`payment_status` added** (unpaid/partial/paid) — without it a
  partially-paid order is unfindable.

### A — the Status column was a constant, cancelled orders included

`DocTypeBadge` returned a green "Sales Order" pill for every `docType === 'order'`
row and never read `orderStatus`. On /sales/orders every row is an order, so
draft, confirmed, partially_fulfilled, fulfilled and **cancelled** rendered
identically. Same in the spreadsheet view and the CSV. Kanban was the only
surface reading `orderStatus`, and read it correctly.

- New pure `sales-list-status.ts`: `docStatusBadge`, `paymentBadge`,
  `invoiceStatusText`, `TONE_CLASS`. Table, spreadsheet and CSV all consume it,
  so the three cannot disagree about one order.
- `paymentBadge` returns `{ label, tone, paid, outstanding }` as **numbers** —
  the caller formats. `outstanding` is never negative; an order with no
  `paymentStatus` is **unpaid, never paid** — payment is never inferred from
  silence.
- Quotation labels are now honest too: `sent` and `expired` had been collapsed
  into "Quotation", and `accepted` was mislabelled "Quotation Sent".

### C — `salesperson` is a String; the client type declared an object

`SalesOrder.js:74` is `{ type: String }`, written from `req.user.name`, never
populated. The client type said `{ _id, name } | null`, so the column rendered
`—` for every order ever written, CSV/spreadsheet said `None`, and **"My
Quotations" returned zero rows** — `sales-list.tsx` sent the user's ObjectId
into a name field; Mongoose cast it to a string and matched nothing.

Typed `string`; the "my" filter now sends `session.user.name`, and sends
**nothing at all** when the session has no name rather than an empty
`salesperson=` that matches nothing while looking like a filter that ran.

> Same shape as §3 of the POS-fulfill spec: a local type invented the shape, so
> the wrong access typechecked. Server group-by had handled the string correctly
> all along (`salesOrder.service.js:834`) — that was the tell.

### D — 8 of 14 optional columns were dead toggles

New `sales-list-columns.ts` declares the column set as data (key, label, align,
optional, default). **Headers, cells, colspan and `OPTIONAL_COLS` all derive
from it** — the header row and body now `.map()` the same array, so the old
hand-summed `visibleColCount` arithmetic is gone and cannot drift.

Removed (no backing field): `deliveryDate`, `expectedDate`, `salesTeam`,
`tasks`, `tags`, `customerRef`, and `website` (which was wired but rendered a
hardcoded `—`). Wired: `expiration` (`validUntil`), `invoiceStatus`
(`relatedInvoice`). Added: `payment`, visible by default.

Also removed the `defaultSalesPriceInclude` group-by — its extractor returned
the literal `'N/A'`, so the grouping was one bucket called N/A. Replaced with
`paymentStatus` and `orderStatus` groupings.

### E — grouping fetched the whole tenant, unbounded

`getGroupedOrders` ran `SalesOrder.find(matchQuery).lean()` with no limit and no
projection — every order with its full `items[]`, `fulfillments[]`, addresses
and free text, none of which reaches a cell.

Now `.select('-items -fulfillments -invoiceAddress -deliveryAddress -notes -terms')`
and `.limit(GROUP_FETCH_CAP)` (2000). When the cap is hit the response carries
`truncated / fetched / total` and the page shows an amber banner naming both
numbers. **A silent truncation reads as "that is all of them"** — the failure
mode of `pos_catalogue_silent_cap`.

### F — "Export all" exported one page

`downloadCsv(orders, …)` wrote the ≤80 loaded rows. `exportAll` now walks the
result set with `collectAllPages` (100/request, the server's `parsePagination`
cap), and **toasts when it stops short** instead of writing a partial file that
looks whole. CSV gained Payment Status / Amount Paid / Outstanding, and its
Status and Salesperson columns are now real.

Bonus: `salesOrderService.list` serialises its params generically. The old
hand-written `if (params.x) qs.set(...)` list silently dropped any param it had
not learned about — the same class of bug.

---

## Tests added

| file | n | covers |
|---|---|---|
| `server/__tests__/salesOrderListFilters.test.js` | 7 | G + B, driving the real `getSalesOrders` and asserting on the query handed to `SalesOrder.find` |
| `server/__tests__/salesOrderListGrouping.test.js` | 7 | E + the two new group-by extractors |
| `client/.../sales/sales-list-status.test.ts` | 15 | A |
| `client/.../sales/sales-list-columns.test.ts` | 12 | D |
| `client/.../sales/sales-list-helpers.test.ts` | 24 | B, C, F |

The server tests use the `posLinkedSalesOrderPricing.test.js` pattern. The stub
query object is **chainable and thenable** — some queries in this controller are
awaited without `.lean()`, and a merely-truthy chain object is mistaken for a
document (a 10s Mongoose buffering timeout that looks like a hang).

## Verify

```bash
cd server && node --test '__tests__/*.test.js'
cd client/apps/admin && npx vitest run
cd client/apps/admin && ./node_modules/.bin/tsc --noEmit 2>&1 | grep "error TS" | grep -v "\.next/"
```

| gate | before | after |
|---|---|---|
| server | 2050 / 2047 pass (3 known failures) | **2064 / 2061**, same 3 |
| admin vitest | 806/806 (43 files) | **857/857 (46 files)** |
| admin tsc | **452** source-only | **452**, diff empty both ways |

⚠️ **The admin tsc baseline is 452, not the 530 recorded against `ede9fdb1`.**
Measured twice on this branch. Whatever produced 530 is not reproducible here —
re-measure before trusting either number, and **prove a change by diffing the
error list with line/column stripped**, never by the count. My first diff showed
33 "new" errors that were all pre-existing ones shifted by a 14-line deletion:

```bash
sed -E 's/\([0-9]+,[0-9]+\)//' errs.txt | sort   # then comm -13 baseline after
```

## Still to do

1. **Open the page in a browser.** Nothing here has been rendered — the gates
   are types and pure logic. Check: a cancelled order shows a red pill; a
   partially-paid one shows an amber "Partial" with `₦x of ₦y`; the column
   chooser's toggles all do something; "My Quotations" returns your own orders.
2. **Exercise the filters**, especially Payment Status = Partial — the whole
   pipeline was dead, so it has never once run end to end from the UI.
3. **Re-test the tenant hole** against the running backend to confirm it is
   closed in the deployed build, not only in source. Restart the backend first —
   several server changes on this branch are uncommitted and unrestarted.
4. Group a tenant with >2000 matching orders and confirm the amber banner.
5. Consider whether `warehouse` and `pricelist` deserve picker-based filters;
   both are ObjectId refs, so a text filter on them was meaningless and I
   dropped them rather than leave a control that cannot work.

## Two traps

- **The tenant hole was invisible from the browser.** Any future audit of a
  `filters`-style passthrough should test the *hand-crafted* payload, not the
  one the UI happens to send. The UI being broken is what hid it.
- **`node --test '__tests__/*.test.js'` from anywhere but `server/` reports
  `# fail 0` having run nothing.** The Bash cwd drifted mid-session and three
  "passing" runs had tested zero files. Sanity-check the test COUNT.

Related: [[pos_fulfill_linked_so]], [[sales_module_progress]],
[[tenant_owned_module_isolation]], [[pos_catalogue_silent_cap]],
[[select_narrower_than_consumers]] — finding C is that pattern again, and
finding G is what `tenant_owned_module_isolation` exists to prevent.
