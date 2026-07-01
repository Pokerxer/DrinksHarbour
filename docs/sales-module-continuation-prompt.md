# Continuation Prompt — /sales Module: Cleanup + Frontend (Phase 5)

> Paste everything below the line into a new Claude Code session at the repo root
> (`/Users/mac/Documents/drinksharbour`). It is self-contained.

---

## Context: what already exists (do NOT rebuild)

The **backend** of the `/sales` module (sell-side mirror of the `purchases` module) is **already built, reviewed, and merged into `main`** (merge commit `72394657`). It was built TDD via subagents in a prior session. Your job now is two things: (1) a small git cleanup, then (2) build the **frontend (phase 5 client UI)**, which was deliberately deferred.

**Read these first** (the authoritative design + plan):
- Spec: `docs/superpowers/specs/2026-06-21-sales-module-design.md`
- Backend plan (already executed): `docs/superpowers/plans/2026-06-21-sales-module-backend.md`

**Backend that exists on `main`:**
- Model: `server/models/SalesOrder.js` — single model, `docType: 'quotation' | 'order'`. Line items carry `quantity, unitPrice, discount, lineTotal, fulfilledQty, postedQty, returnedQty`. Order has `orderStatus (draft|confirmed|partially_fulfilled|fulfilled|cancelled)`; quotation has `quoteStatus (draft|sent|accepted|rejected|expired|converted)`. Plus `customer/customerSnapshot, pricelist/appliedPricelist, paymentMethod/paymentStatus/amountPaid/walletTxRef/loyaltyEarned, fulfillments[], convertedFrom/convertedTo, relatedSales[]`.
- Services: `server/services/salesOrder.service.js` (create/edit/convert/totals/guards), `salesFulfill.helpers.js` (pure: `outstanding`, `applyFulfillment`, `fulfillStatus`, `buildPostingLines`, `postShippedStock`, `buildSalesRow`), `salesFulfill.service.js` (`fulfillOrder`, `returnOrder`), `salesPayment.service.js` (`capturePayment` — wallet + loyalty).
- Controller/routes: `server/controllers/salesOrder.controller.js`, `server/routes/salesOrder.routes.js`, mounted at **`/api/sales-orders`** behind `protect, attachTenant`.
- 10 test suites `server/__tests__/sales*.test.js` — all green (run: `NODE_PATH=server/node_modules node --test server/__tests__/sales*.test.js`). NOTE: this repo has NO `mongodb-memory-server`; all tests use Node's `t.mock.method`. Follow that convention.

### The backend API you will consume from the frontend

All under `/api/sales-orders`, tenant-scoped, responses shaped `{ success, data, ... }`:

| Method | Path | Body / query | Purpose |
|---|---|---|---|
| GET | `/` | query: `docType`, `status`, `customer` | list quotations/orders |
| POST | `/` | `{ docType:'quotation'\|'order', customer?, customerSnapshot?, pricelist?, appliedPricelist?, items:[{product,subproduct,size,sku,name,quantity,unitPrice,discount}], validUntil?, notes?, terms? }` | create |
| GET | `/:id` | — | detail |
| PUT | `/:id` | `{ items?, notes?, terms?, validUntil? }` (guarded: quotation editable draft/sent, order editable draft) | edit / re-price |
| DELETE | `/:id` | — | cancel (guarded) |
| POST | `/:id/send` | — | quotation draft→sent |
| POST | `/:id/accept` | — | sent→accepted |
| POST | `/:id/reject` | — | →rejected |
| POST | `/:id/convert` | — | quotation→order (returns new order) |
| POST | `/:id/confirm` | `{ paymentMethod, amountTendered?, splitPayments? }` | capture full-total payment (wallet/loyalty), draft→confirmed |
| POST | `/:id/fulfill` | `{ warehouseId, items:[{ lineId, qty }] }` | additive partial fulfillment; advances status; writes Sales rows; response also has `posting` (inspect `posting.failCount`/`failures`) |
| POST | `/:id/return` | `{ warehouseId, items:[{ lineId, qty }] }` | restock + ledger reversal; response has `restock` |

Important client behaviors to honor: payment is captured ONCE at **confirm** (full total). **Fulfillment** is separate and additive — show an **Outstanding** column (`outstanding = quantity − fulfilledQty − returnedQty`). Partial fulfillment can return HTTP 200 with `posting.failCount > 0` — surface partial failures to the user.

---

## Step 1 — Git cleanup (do this first; it's quick)

A worktree and the now-merged feature branch are left over from the backend build:

```bash
# from repo root; confirm the merge is on main first
git -C /Users/mac/Documents/drinksharbour log --oneline -1 main   # expect 72394657 Merge feat/sales-module
# remove the worktree (must NOT be cwd inside it)
cd /Users/mac/Documents/drinksharbour
git worktree remove .claude/worktrees/sales-module
git worktree prune
# delete the merged branch
git branch -d feat/sales-module
```

If `git worktree remove` complains the worktree is dirty, inspect it first (`git -C .claude/worktrees/sales-module status`) — the only expected dirty content is the gitignored `.superpowers/sdd/` scratch (safe to force-remove with `--force` after confirming nothing important is uncommitted).

---

## Step 2 — Build the frontend (Phase 5)

**Use the brainstorming → writing-plans → subagent-driven-development workflow** (superpowers skills), the same as the backend. Branch off `main` (which now contains the sales backend). The spec already describes phase 5; you may write a focused **frontend plan** from it rather than re-brainstorming the whole design — but confirm scope/UX choices with the user before building.

### Scope (mirror `shared/purchases/*` + `(hydrogen)/purchases/*` conventions exactly)

Routing convention in this repo: `src/app/(hydrogen)/<module>/<sub>/page.tsx` are thin route shells; the real components live in `src/app/shared/<module>/<module>-*.tsx`; a `<module>-nav-header.tsx` gives in-module tab nav. Base dir: `client/apps/isomorphic`.

**Routes** (`src/app/(hydrogen)/sales/`): `page` (list), `create`, `[id]` (detail), `quotations`, `orders`, `fulfill`, `returns`, `analytics`, `settings` — each a thin `page.tsx`.

**Components** (`src/app/shared/sales/`), mirroring the purchases equivalents:
- `sales-nav-header.tsx`
- `sales-quotations.tsx`, `sales-orders.tsx` (list/filter/search)
- `sales-create.tsx` — customer picker with **pricelist auto-apply** (reuse the POS sell page's `usePOSCustomerPricelistSync` hook + live line pricing); save as quotation or order
- `sales-order-detail.tsx` — status-machine action buttons (Send / Accept / Convert / Confirm / Fulfill / Invoice / Return) + **Outstanding** column for partial fulfillment
- `sales-quotation-detail.tsx`
- `sales-fulfill-detail.tsx` — additive fulfill form (model it on `purchases-receipt-detail.tsx`)
- `sales-returns.tsx`, `sales-return-create.tsx`, `sales-return-detail.tsx`
- `sales-analytics.tsx`, `sales-settings.tsx`
- Reuse `shared/invoice/*` for quote/order/invoice PDFs.

Study the parallel purchases files first and copy their conventions (data fetching, table components, drawers, toast patterns, money formatting — NGN integer).

### Reference surfaces to reuse (do not duplicate)
- Customer picker + pricelist auto-apply: the POS sell page (`src/app/shared/point-of-sale/*`, esp. the customer-pricelist sync hook). Selecting a customer should auto-apply their `POSCustomer.pricelist` exactly like POS.
- Invoice rendering: `src/app/shared/invoice/*`.

### Verification (acceptance)
- Client typecheck: `cd client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit` — **no new errors beyond the existing 27 `TS2688` baseline**.
- Manually drive the flow against the API: create quotation → convert → confirm → partial fulfill ×2 → return; confirm the Outstanding column, status transitions, and partial-failure surfacing behave.

---

## Open follow-up items (backend; fix opportunistically, not blocking phase 5)
- DRY: `applyEdit` duplicates line-construction from `createSalesOrderDoc` → extract a shared `buildLineItems(items)`.
- Partial-failure HTTP semantics: `fulfill`/`return` return 200 even when some lines failed (caller must inspect `posting`/`restock`). Decide if the UI should treat this as a partial-success state.
- `generateSalesOrderNumber` uses a daily `countDocuments`+1 (race-prone; inherited from `generateOrderNumber`; `{tenant, soNumber}` unique index guards collisions).
- Test coverage gaps: wallet-without-saved-customer branch; return restock-failure path.
- Invoice endpoint (`POST /:id/invoice`) was deferred — wire it when you build the invoice UI (decide: generate an `Invoice` doc vs render on the fly, by reading `shared/invoice/*`).

## Memory pointer
See `MEMORY.md` → `sales_module_progress.md` for the durable resume note.
