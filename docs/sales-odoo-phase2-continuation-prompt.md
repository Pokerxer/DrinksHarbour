# Continuation Prompt — Finish the Odoo-style Sales redesign (subsystems 3–8 of 8)

> Paste everything below the line into a NEW Claude Code session. It is
> self-contained. A previous session built subsystems 1–2 (Taxes, Payment
> Terms) of an 8-part "make /sales match Odoo" effort, in an isolated worktree,
> and stopped to hand off the remaining 6 to keep cost manageable. Your job is
> to build subsystems 3–8, each as its own committed unit.

---

## Where the work lives (do NOT recreate)

- **Worktree:** `.claude/worktrees/sales-odoo-phase2`, branch
  `worktree-sales-odoo-phase2`, based on `main` at `bf4a13d3`.
- **Run everything from that worktree.** `git status` there is clean.
- Commits so far on the branch:
  - `4918ca86` feat(sales): per-line taxes + Odoo Untaxed/Tax/Total (subsystem 1)
  - `22f6b127` feat(sales): payment terms + due date (subsystem 2)
- Base `bf4a13d3` (already on `main`) carries 3 critical bug fixes from a prior
  manual-E2E pass (POS-route auth, pricelist resolution, fulfillment
  `buildPostingLines` Mongoose-spread bug). Don't re-fix those.

### Worktree environment setup (do this first if node_modules are missing)

The worktree's `node_modules` are NOT auto-populated. Symlink them to the main
checkout (the pattern prior sessions used):

```bash
ROOT=/Users/mac/Documents/drinksharbour
ln -s $ROOT/client/node_modules                         client/node_modules
ln -s $ROOT/client/apps/isomorphic/node_modules         client/apps/isomorphic/node_modules
ln -s $ROOT/client/packages/isomorphic-core/node_modules client/packages/isomorphic-core/node_modules
```

`server/node_modules` in the worktree is a real (committed-snapshot) directory,
NOT a symlink, and it is **missing `node-cron`** (drift in the tracked
snapshot). If `npm test` errors with `Cannot find module 'node-cron'`, copy it
over: `cp -R $ROOT/server/node_modules/node-cron server/node_modules/node-cron`.

### Verify commands (the only "test runner" this stack has)

- Backend: `cd server && npm test` — must be **218/218** at the start (209
  base + 5 tax + 4 payment-terms). Repo convention: `node:test` with
  `t.mock.method`, **no DB** (mongodb-memory-server is not installed). Mirror
  `__tests__/salesOrder.tax.test.js` / `salesPaymentTerms.test.js` for new
  pure-helper tests.
- Frontend: `cd client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit` —
  must stay at **exactly 27 `TS2688`** errors (pre-existing dependency-typing
  noise) and **zero** others. There is no jest/vitest.

---

## The totals contract (READ THIS before Coupons/Rewards/Pro-forma)

Taxes (subsystem 1) redefined the money math. Everything downstream must respect it.

In `server/services/salesOrder.service.js`:
- `lineTotalOf(item)` = `(unitPrice - discount) * quantity` — the **untaxed**
  line total. Stored as `lineSchema.lineTotal`.
- `lineTaxOf(item)` = `round(lineTotalOf * taxRate/100)` — per-line tax
  (tax-EXCLUSIVE), stored as `lineSchema.taxAmount`. `taxRate` is a per-line %
  snapshot from `SubProduct.taxRate`, editable on the line.
- `computeTotals(items)` returns `{ subtotal, discountTotal, taxTotal, total }`:
  - `subtotal` = `sum(unitPrice * qty)` — GROSS, pre-discount
  - `discountTotal` = `sum(discount * qty)`
  - `taxTotal` = `sum(lineTaxOf)`
  - **`total` = `(subtotal - discountTotal) + taxTotal`**
  - The Odoo **"Untaxed Amount"** row = `subtotal - discountTotal` (derived, not stored).
- `SalesOrder` schema: line has `taxRate`, `taxAmount`, untaxed `lineTotal`;
  order has `subtotal`, `discountTotal`, `taxTotal`, `total`,
  `paymentTerms`, `dueDate`.
- `mapLine(it)` snapshots tax+totals on create/edit; `convertQuotationToOrder`
  copies the tax + payment-terms snapshot verbatim (then recomputes dueDate).

**Decision already made (subsystem 1):** tax is **exclusive**, **per-line**,
**snapshot from product, editable**. Frontend mirrors this with an editable
"Tax %" column and Untaxed/Tax/Total summary rows in `sales-create.tsx`, and a
tax breakdown in `sales-order-detail.tsx`, `sales-quotation-detail.tsx`,
`sales-invoice-view.tsx`.

**Payment terms (subsystem 2):** `PAYMENT_TERMS` catalog + `computeDueDate()` in
the service; enum on the model; `PAYMENT_TERMS` + `paymentTermsLabel()` in
`client/.../sales/sales-helpers.ts`; a select on the create page Other Info tab.

---

## How to build each remaining subsystem

The user has approved building **all 6 remaining**. For EACH one, in order:

1. Run `superpowers:brainstorming` to settle the real design decisions (several
   need genuine choices — see notes per subsystem). Use `AskUserQuestion` for
   the decisions flagged below.
2. Use `superpowers:test-driven-development`: write failing pure-helper tests
   first (backend math/validation), then implement, then frontend.
3. Keep the totals contract above intact.
4. Verify (218+/218 backend, 27-TS2688 frontend), then **commit that subsystem
   alone** with a `feat(sales): … (subsystem N of 8)` message and the
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.
5. Move to the next.

Suggested order (dependency-aware): **3 Addresses → 4 Coupons → 5 Rewards →
6 Line sections+Catalog → 7 Pro-forma+Print → 8 Activity log.**

### 3. Invoice/Delivery Address (small, independent)
Separate billing vs shipping address on the order, distinct from the customer
record, defaulting from the selected customer but overridable.
- Model: add `invoiceAddress` and `deliveryAddress` sub-objects to `SalesOrder`
  (e.g. `{ name, phone, street, city, state, country }`).
- Service: thread them through create/edit/convert (verbatim copy on convert).
- Frontend: two compact address blocks on the create page (new section or Other
  Info tab); prefill from the customer on select; show on detail + invoice.
- Decision to confirm: structured fields vs a single multiline textarea per
  address; whether to auto-copy invoice→delivery by default.

### 4. Coupon codes (depends on the totals contract)
Apply a discount code to a quotation/order, validated against the existing
`server/models/Coupon.js`.
- **Critical:** a coupon discount must reduce the **untaxed** base BEFORE tax is
  computed (discount-before-tax), so tax is charged on the post-coupon amount.
  Decide how to represent it: an order-level `couponDiscount` that lowers the
  untaxed base feeding `taxTotal`, OR a synthetic discount line. Whichever you
  pick, `computeTotals` (or a wrapper) must keep `total = (untaxed - coupon) +
  taxOnReducedBase`.
- Reuse existing coupon validation logic if the POS module already has it
  (grep `models/Coupon`, `coupon` in `controllers/`/`services/`).
- Frontend: coupon input + applied-coupon chip on the create page; show the
  discount line in totals + invoice.
- Decision to confirm: per-order single coupon vs stacking; percentage vs fixed;
  whether expired/min-spend rules are enforced server-side (they should be).

### 5. Rewards / loyalty redemption (depends on final total)
Redeem loyalty points against the order total at confirm time. Reuses the
existing loyalty system (already wired for POS — grep `mutateLoyalty`,
`posSettings`, `loyalty` in `services/`/`controllers/pos.controller.js`).
- Points→currency conversion comes from tenant `posSettings` (loyalty config).
- Apply at **confirm** (mirrors `confirmSalesOrder` / `salesPayment.service.js`),
  reducing amount due; rollback-safe like the existing wallet/loyalty capture.
- Frontend: a "redeem points" control in the confirm/payment modal in
  `sales-order-detail.tsx`.
- Decision to confirm: redeem at confirm only (recommended) vs on the draft;
  max-redemption rules.

### 6. Order-line sections + notes + Catalog grid picker (frontend-heavy)
- Line `displayType`/`lineType`: `'product' | 'section' | 'note'`. Section/note
  rows carry a `displayName`/`note` string and no pricing. `computeTotals` must
  skip non-product rows.
- Catalog: a grid/modal product browser as an alternative to the existing
  `product-line-search.tsx` typeahead (same data source).
- Mostly `sales-create.tsx`; small model/service tolerance for the new row types.

### 7. Pro-forma invoice send + Print/PDF (depends on Taxes for the doc)
- Reuse `sales-invoice-view.tsx` (already shows the tax breakdown). Add a
  "Pro-forma" heading variant + print-friendly CSS (`@media print`, the view
  already has `print:hidden` back buttons).
- Email send: a new endpoint on `salesOrder.routes.js`/controller using the
  server's existing email service (grep `emailService`/`sendEmail` in `server/`).
- Decision to confirm: PDF generation lib vs browser print-to-PDF (lean:
  browser print); what the pro-forma email contains.

### 8. Activity / chatter log (heaviest — no equivalent exists anywhere)
- New persistence: either an embedded `activities: [...]` array on `SalesOrder`
  or a dedicated `SalesActivity` model (`{ tenant, order, type, body, by, at }`).
  A dedicated model scales better; embedded is simpler.
- Timeline UI on the order + quotation detail pages; an internal note composer.
- Auto-log lifecycle events (sent/accepted/converted/confirmed/fulfilled/
  returned) in addition to manual notes — wire into the existing
  controller actions.
- Decision to confirm: dedicated model vs embedded; whether to auto-log
  lifecycle transitions.

---

## Dev-environment gotchas (if you run the app for manual E2E)

- **Servers:** backend `cd server && node -r dotenv/config server.js` (port
  5001); frontend `cd client/apps/isomorphic && npm run dev` (port 3000). Plain
  `node` does NOT hot-reload — restart after server edits.
- **Login:** `heroogene@gmail.com` / `DrinksHarbour@2026` (tenant_owner on the
  well-stocked `drinksharbour` tenant). Customer **"Ada obi"** has the **VIP**
  pricelist assigned (good for pricelist tests). Playwright: log in, wait for
  `**/ecommerce**`, then navigate; first hit to a `/sales/*` route compiles for
  ~2s in dev — wait on the URL, not a fixed sleep.
- **Dirty seed data (NOT bugs):** some `Size.sellingPrice` are `0` (e.g.
  Glenfiddich 40yo, Glenlivet Founders) while the SubProduct has a price — those
  lines legitimately show ₦0. Carlo Rossi Sweet Red (75cl) has a real price
  (₦9,300) and stock — use it for money-path tests.
- The `webapp-testing` skill + a fresh browser context with saved
  `storage_state` was the reliable Playwright pattern.

## Memory pointer

`MEMORY.md` → `sales_module_progress.md` has the durable resume note; update it
as you land each subsystem.
