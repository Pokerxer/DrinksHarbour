# Handoff — finish Sales quote change-history feature + fix Update-Prices data-loss bug

Paste the section below into a fresh Claude Code session in this repo (`/Users/mac/Documents/drinksharbour`).

---

You are continuing work on the DrinksHarbour repo. Follow `AGENTS.md` (skill-first: use `superpowers:systematic-debugging` for the bug, `superpowers:test-driven-development` for the fix, `superpowers:verification-before-completion` before declaring done). Work is on git branch **`feat/sales-quote-change-history`** (already checked out). `main` is UNTOUCHED and must not be merged until the bug below is fixed and verified.

## Context: what already shipped on this branch (do NOT redo)
A right-sidebar "change-history / chatter" panel on the Sales create/edit page, plus auto-logging and an Update-Prices button. Spec: `docs/superpowers/specs/2026-07-01-sales-quote-change-history-design.md`. Plan: `docs/superpowers/plans/2026-07-01-sales-quote-change-history.md`. Both are committed and accurate.
- Backend: `server/models/Activity.js` (added `log`/`message` types, `system`, `meta`), `server/services/salesActivity.service.js` (emitter + `diffPricelist`/`diffTotals`/`statusSubject`/`formatMoney`), auto-logs wired in `server/controllers/salesOrder.controller.js` (create/update/status), and `POST /api/sales-orders/:id/update-prices`.
- Frontend: `sales-activity-panel.tsx` / `-item` / `-composer` / `-helpers.ts`, `sales-confirm-modal.tsx`, Update-Prices button in `sales-customer-bar.tsx`, panel wired into `sales-create.tsx` (2-col grid `lg:grid-cols-[minmax(0,1fr)_360px]`), `updatePrices` in `client/apps/admin/src/services/salesOrder.service.ts`.
- The panel renders correctly and logs (verified in browser). Create page made full-width in `client/apps/admin/src/app/(hydrogen)/sales/create/page.tsx` (uncommitted).
- Also uncommitted in the working tree: an earlier **discount fix** (fixed ₦ discount = flat off the whole line, not per-unit; walk-in default when no customer) across `sales-create` helpers, `sales-line-table.tsx`, `customer-search.tsx`, `server/services/salesOrder.service.js`, `server/models/SalesOrder.js`, and updated tests `salesOrder.tax.test.js` / `salesOrder.guards.test.js`. Keep it.

## THE BUG TO FIX FIRST (blocks the merge)
After clicking **Update Prices** (and/or a normal edit that recomputes), product lines lose `subproduct`, `name`, `size`, and `quantity` → Qty shows 0, product cells revert to the "Search product…" empty state, line totals go ₦0.00, and the history logs a bogus "Total X → 0.00" entry.

**Root-cause lead (verify before fixing):** In `server/services/salesOrder.service.js`, `recomputeOrderPricing(so, { tenantId, clearOverrides })` (around line 357) builds its working set by spreading Mongoose subdocuments:
```js
source = so.items.map(raw => ({ ...raw, priceOverridden: false }));
```
Spreading a Mongoose subdocument does NOT copy field values (they live in the doc's internal `_doc`), so `quantity`/`subproduct`/`name`/`size` are lost before `resolveLinePricing` + `mapLine` run. The non-clearOverrides branch and `applyEdit`'s call at ~line 418 may share the flaw. Verify by reading `recomputeOrderPricing` (357–380) and `resolveLinePricing` (173+) FULLY, and check whether `unitPrice` genuinely survives (the browser screenshot showed unit prices retained, which is slightly inconsistent with the pure theory — confirm the actual data flow, don't assume).

**Systematic-debugging steps:**
1. Reproduce with a failing unit test (node:test, no DB, mirror `server/__tests__/salesUpdatePrices.test.js`): build a fake order whose `items` are Mongoose subdocuments (or documents) with real `quantity`/`subproduct`/`unitPrice`, call `updatePricesForOrder`/`recomputeOrderPricing`, assert `quantity` and `subproduct` are PRESERVED (currently they'll be lost).
2. Fix the root cause: use `raw.toObject()` (or `so.toObject().items`, or map explicit fields) so every line field is preserved before re-pricing. Apply the same fix to any sibling spread in `applyEdit`/`recomputeOrderPricing`.
3. Make the failing test pass; run the whole sales suite: `cd server && node --test $(ls __tests__/sales*.test.js)`. Only the 2 pre-existing `generateSalesOrderNumber` failures are allowed to remain.
4. Manually verify in the browser: add 2 products, change pricelist, click Update Prices → quantities and names must survive, totals stay correct, history shows a sensible recompute entry (no false "→ 0.00").

## After the bug is fixed — remaining tasks
1. Make the EDIT page full-width to match create: `client/apps/admin/src/app/(hydrogen)/sales/[id]/edit/page.tsx` (change `mx-auto max-w-7xl` → `w-full px-4 py-6 xl:px-6`, matching what create now uses).
2. Commit the discount fix, the full-width changes, and the bug fix with clear messages (end each commit body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`).
3. Merge to `main` — user chose "clean junk, merge the rest": before merging, `echo ".npm-cache/" >> .gitignore`, then `git rm -r --cached .npm-cache` (417 junk files this branch added), commit. Do NOT try to untrack the ~11,850 pre-existing `server/node_modules` files — that's a separate pre-existing repo problem the user deferred. Keep root `package.json` and `pnpm-lock.yaml` (legit). Then `git checkout main && git merge --no-ff feat/sales-quote-change-history`.
4. Run `superpowers:verification-before-completion`, then offer a `code-review`.

## Discipline
Keep tool calls tight — the prior session got expensive. Investigate → confirm root cause → one fix → test → verify. Don't refactor unrelated code.
