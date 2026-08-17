# Sales Orders list — audit findings and repair plan

**Date:** 2026-08-16. **Branch:** `feat/mobile-phase-1-foundation`.
Page: `client/apps/admin/src/app/(hydrogen)/sales/orders/page.tsx` →
`shared/sales/sales-list*.tsx`; server `salesOrder.controller.js` +
`salesOrder.service.js`.

Triggered by the `paymentStatus` enum widening in `ede9fdb1` (see
[`../specs/RESUME-pos-fulfill-quotes.md`](../specs/RESUME-pos-fulfill-quotes.md)):
the list surface was never audited after that change.

---

## The one sentence

The list's advanced filters were not merely inert — the same code path let one
tenant read another's sales orders — and every column that was supposed to say
what state an order is in (status, salesperson, payment) was rendering a
constant.

---

## Findings, in repair order

### G — `filters` overwrites the tenant scope — SECURITY, live

`getSalesOrders` builds `q = { tenant: tenantId }` then
`Object.assign(q, svc.buildFilterQuery(filters))`. `buildFilterQuery` copies any
`f.field` into the query verbatim, `tenant` included, so the assign clobbers the
scope:

```
GET /api/sales-orders?filters=[{"field":"tenant","operator":"equals","value":"<other tenant _id>"}]
```

returns another tenant's orders. Proven against the real function. The admin UI
never sends `field` (see B), which is why this was never observed from a
browser — the browser's payload is discarded and a hand-crafted one is obeyed.

**Fix:** the Mongoose schema is the allowlist. A filter field is honoured only
if it is a real `SalesOrder` schema path AND not in a denylist
(`tenant`, `_id`, `__v`). The controller must also never let a filter key
survive over the tenant key — assign the filter query *first*, tenant last.

### B — every filter the UI sends is silently dropped

The client emits `{ fieldId, operator, value, label }` where `fieldId` is the
config **id** (`advanced-search-filter-list.tsx:33`, `fieldId = config.id`, e.g.
`payment_method`). The server keys off `f.field` and `continue`s when it is
absent, so all ~60 filters do nothing: the chip appears in the search bar and
the result set never changes. No error, no test.

Compounding it, `fieldId` is snake_case while the Mongo path is camelCase, and
most configs' `field` values (`invoiceStatus`, `salesTeam`, `deliveryStatus`,
`tasks`, `website`, `expectedDate`) are not `SalesOrder` paths at all — so
simply forwarding `field` would still leave most filters dead.

**Fix:** `FilterValue` carries `field` (the real Mongo path) alongside `fieldId`
(the UI identity). `FILTER_CONFIGS` is pruned to configs with a real path and
corrected where the path was wrong. A `payment_status` filter is added —
without it a `partial` order is unfindable, which is the bug class the
`ede9fdb1` change set was about.

### A — the Status column is a constant, including for cancelled orders

`DocTypeBadge` (`sales-list.tsx:34`) returns a green "Sales Order" pill whenever
`docType === 'order'`; `orderStatus` is never read. On `/sales/orders` every row
is `docType: 'order'`, so draft, confirmed, partially_fulfilled, fulfilled and
**cancelled** all render identically. Same in the spreadsheet view
(`sales-list-spreadsheet.tsx:35`) and the CSV (`statusText`). Kanban is the only
surface that reads `orderStatus`, and it reads it correctly.

Payment state is not rendered on the list at all — no column, badge, filter or
group-by mentions `paymentStatus`. So a `partial` order does not render as
"Unpaid"; money already taken is simply invisible.

**Fix:** a pure `sales-list-status.ts` (badge descriptors for doc status,
payment, invoice status), consumed by the table, the spreadsheet and the CSV so
the three cannot disagree.

### C — `salesperson` is a String; the client type declared an object

`SalesOrder.js:74` — `salesperson: { type: String }`, written from
`req.user?.name`, never populated. The client type declared
`{ _id, name } | null`, so:

- the Salesperson column always renders `—` (`sales-list.tsx:529` gates on
  `typeof === 'object'`);
- CSV and spreadsheet always print `None`;
- **"My Quotations" always returns zero rows** — `sales-list.tsx:165` sends the
  user's ObjectId into a field holding names; Mongoose casts it to a string,
  matches nothing, throws nothing.

Server group-by handles the string correctly (`salesOrder.service.js:834`),
which is the proof of the real shape. Same pattern as §3 of the POS-fulfill
spec: a local type invented the shape, so the wrong access typechecked.

**Fix:** type it `string`; send the user's *name* for the "my" filter.

### D — 8 of 14 optional columns are dead toggles

`OPTIONAL_COLS` declares `deliveryDate, expectedDate, salesTeam, tasks, tags,
invoiceStatus, customerRef, expiration`; `colVisible` is consulted only for
`creationDate, website, activities, untaxedAmount, total, warehouse`. The other
eight render no header and no cell. `website` is wired but renders a hardcoded
`—`. Several have no backing schema field at all.

`visibleColCount` is a hand-maintained arithmetic expression that must be kept
in sync with the JSX by eye.

**Fix:** one `sales-list-columns.ts` declaring the column set as data —
key, label, alignment, optional, default visibility. Headers, the colspan count
and `OPTIONAL_COLS` all derive from it, so they cannot drift. Columns with no
backing field are removed; `expiration` (`validUntil`) and `invoiceStatus`
(`relatedInvoice`) are wired because those fields exist; `payment` is added.

### E — group-by fetches the entire tenant, unbounded

`load()` drops `page`/`limit` whenever grouping is on (`sales-list.tsx:162`) and
`getGroupedOrders` runs `SalesOrder.find(matchQuery).lean()` with no limit and
no projection — every order with its full `items[]`, `notes`, `terms` and
addresses, none of which the list renders.

**Fix:** project away what the list never reads, cap the fetch, and report the
cap. A silent truncation reads as "that's all of them" — the failure mode of
`pos_catalogue_silent_cap`.

### F — "Export all" exports one page

`exportAll` calls `downloadCsv(orders, …)` — the ≤80 loaded rows — under a menu
item labelled Export. The CSV also carries no payment column.

**Fix:** re-fetch the full result set under the current filters before writing
the file.

---

## Method

TDD. Tests assert on the payload that reaches the wire — the query object handed
to `SalesOrder.find`, the response body, the row object handed to the CSV —
never on a helper's return value alone. Server tests drive the real handler with
stubbed models, per `posLinkedSalesOrderPricing.test.js`; the stub query object
must be **thenable as well as chainable**. Admin tests are Vitest
`environment: 'node'` — no jsdom, so all list logic lands in pure modules.

## Gates

```bash
cd server && node --test '__tests__/*.test.js'
cd client/apps/admin && npx vitest run
cd client/apps/admin && ./node_modules/.bin/tsc --noEmit 2>&1 | grep "error TS" | grep -v "\.next/"
```

Baselines at `ede9fdb1`: server 2047/2050 (3 known failures), admin vitest
806/806 (43 files), admin tsc 530 source-only. Prove a tsc change by diffing the
sorted error list, never by the count.
