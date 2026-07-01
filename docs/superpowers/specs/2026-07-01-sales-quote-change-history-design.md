# Sales Quote Change-History ("Chatter") + Working Buttons — Design

Date: 2026-07-01
Area: `client/apps/admin/src/app/(hydrogen)/sales/create` (+ shared `sales/*`), `server` sales-order lifecycle.
Reference: Odoo sales-order form screenshots (2026-07-01) — pricelist dropdown, "Update Prices" control + confirmation modal, and the right-hand activity/change-history "chatter".

## Goal

Bring the Sales create/edit page to parity with the Odoo reference on two fronts:

1. A persistent **right-sidebar change-history ("chatter") panel** on both the create and edit page, showing an automatic, chronological log of what happened to the quote/order plus a composer for manual notes/messages.
2. **All header/pricing buttons working**, specifically the **"Update Prices"** control next to the pricelist (with a confirmation modal), and an audit/fix pass on the existing header actions.

Currency is Naira (₦). Multi-tenant: every read/write is tenant-scoped via `req.tenant._id` (never client-supplied) per AGENTS.md Workstream A/B.

## Non-Goals

- No real-time push (WebSocket) — the panel refetches on save/status events and on mount. Polling optional, off by default.
- No email/WhatsApp threading. "Send message" logs an internal message entry only (no outbound send in this scope).
- No scheduled-activity ("Activity" reminders with due dates) system — only the timeline log + manual note/message.
- No changes to POS or the storefront.

## Decisions (from brainstorming)

- Panel placement: **right sidebar (Odoo-style)**, on both create and edit.
- Auto-logged events: **created/saved**, **status changes**, **pricelist change & price recompute**, **totals changed** (all four).

---

## 1. Backend

### 1.1 `Activity` model extension (`server/models/Activity.js`)

Current: `{ tenant, salesOrder, type: enum['note','call','email','meeting','task'], subject, description, createdBy, timestamps }`.

Changes (backward compatible — additive only):

- `type` enum adds `'log'` (system change entry) and `'message'` (manual internal message). Existing values retained.
- `system: { type: Boolean, default: false }` — `true` for auto-generated log entries.
- `meta: { type: mongoose.Schema.Types.Mixed }` — optional structured payload for change entries, e.g. `{ field: 'pricelist', from: 'Website Price (NGN)', to: 'Resellerss (NGN)' }` or `{ field: 'total', from: 238931.67, to: 269500 }`.

`subject` remains required (used as the human-readable one-liner). Existing index `{ tenant, salesOrder }` unchanged.

### 1.2 Emitter — `server/services/salesActivity.service.js` (new)

```
logActivity(tenantId, salesOrderId, { subject, description?, meta?, userId?, type='log', system=true }) -> Promise<Activity|null>
```

- Creates one `Activity`. **Best-effort**: wrapped so a failure logs and returns `null` — it MUST NOT throw into the parent request (mirrors the existing best-effort promotion pattern in `salesOrder.service.js`).
- Pure helpers (unit-testable without a DB connection) live alongside it:
  - `diffPricelist(prevAppliedName, nextAppliedName) -> {from,to}|null`
  - `diffTotals(prev, next) -> { total?, untaxed? }|null` where each is `{from,to}`; returns `null` when nothing changed. "untaxed" = `subtotal - discountTotal - promotionTotal`.
  - `formatMoney(n) -> string` (₦ grouped, 2dp) for subjects.
  - `statusSubject(docType, action) -> string` mapping (`sent`→"Quotation sent", `accepted`→"Quotation accepted", `rejected`→"Quotation rejected", `converted`→"Converted to Sales Order", `confirmed`→"Sales Order confirmed", `cancelled`→"Cancelled").

### 1.3 Lifecycle wiring (`server/controllers/salesOrder.controller.js`)

The controller layer emits (not the pure service functions, so unit tests of totals math stay DB-free):

- **createSalesOrder** (after successful create): `logActivity(... subject: docType==='quotation' ? 'Quotation created' : 'Sales Order created', system:true, userId)`.
- **updateSalesOrder**: capture `{ appliedPricelist?.pricelistName, total, subtotal, discountTotal, promotionTotal }` from the loaded doc **before** `applyEdit`, then after save:
  - if `diffPricelist` non-null → log `"Pricelist: <from> → <to>"` with `meta`.
  - if `diffTotals` non-null → log `"Total <from> → <to>"` (include untaxed in `description`/`meta`).
  - Emitted as separate entries so the timeline reads like the screenshot.
- **status endpoints** (`sendQuotation`, `acceptQuotation`, `rejectQuotation`, `convertQuotation`, `confirmSalesOrder`, and cancel if present): log the mapped `statusSubject`.
- **update-prices endpoint** (below): log `"Product prices recomputed according to pricelist <name>"`.

All emits pass `userId: req.user?._id` so the panel can show the author.

### 1.4 New endpoint — `POST /:id/update-prices`

Route: `server/routes/salesOrder.routes.js`, under the existing `protect, attachTenant, tenantUserOnly` stack.

Controller `updatePrices`:
1. Load the tenant-scoped order (`{ _id, tenant }`); 404 if missing; guard `canEdit(so)`.
2. Clear `priceOverridden` on all product lines, then re-run the existing `resolveLinePricing` (pricelist engine) + `resolveLinePromotions` + `mapLine` + `computeTotals` (reuse `applyEdit`'s internals or a shared recompute helper) against the order's current `pricelist`.
3. Save; capture pre/post totals; emit the recompute log + a totals-change log if totals moved.
4. Return the updated order (`{ success, data }`).

Client `salesOrderService.updatePrices(id, token)`.

### 1.5 Server tests (`server/__tests__/salesActivity.*.test.js`)

Pure-helper `node:test` assertions (no DB), matching repo convention:
- `diffPricelist` / `diffTotals` return correct `{from,to}` and `null` on no-change.
- `statusSubject` mapping.
- `formatMoney` formatting.
- `updatePrices` recompute path via mocked `SalesOrder` (mirroring `salesOrder.tax.test.js`'s `t.mock.method`), asserting overrides cleared + totals re-snapshotted.

---

## 2. Frontend (admin app)

### 2.1 Components (`client/apps/admin/src/app/shared/sales/`)

- **`sales-activity-panel.tsx`** (`SalesActivityPanel`) — the sidebar. Props: `{ token, orderId?: string; refreshKey?: number }`.
  - When `!orderId`: render an empty state ("History appears after the first save.").
  - Else fetch `getActivities(orderId)`; group entries by day (Today / "MMM D"); newest first, like the reference.
  - Refetches when `refreshKey` changes (parent bumps it after `saved`/status actions).
- **`sales-activity-item.tsx`** (`SalesActivityItem`) — one row: author initials avatar, timestamp, subject; for `meta` change entries render `from → to` with the same red-amount styling as the screenshot; `description` shown as secondary text.
- **`sales-activity-composer.tsx`** (`SalesActivityComposer`) — "Log note" / "Send message" toggle + textarea + submit → `createActivity(orderId,{type,subject,description})`; on success clears + triggers parent refresh.

Each file <200 lines; extract shared bits (avatar/initials, day grouping) into `sales-activity-helpers.ts` if needed.

### 2.2 Layout integration (`sales-create.tsx`)

- Wrap the existing form column and the new panel in `grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]`.
- Pass `orderId = initial?._id ?? draftIdRef current` (expose the draft id from `useSalesAutosave`) and a `refreshKey` bumped on `autoSaveStatus==='saved'` and after status actions.
- The panel is `lg:sticky lg:top-4 lg:self-start` so it tracks scroll like Odoo's chatter.

### 2.3 Update-Prices control (`sales-customer-bar.tsx`)

- Next to the pricelist `<select>`, add an **Update Prices** button (refresh icon) — visible when a pricelist is selected.
- On click → open **`sales-confirm-modal.tsx`** (small generic confirm: title, body, Ok/Cancel; reuse styling from `sales-confirm-payment-modal.tsx`) with body "This will update the unit price of all products based on the new pricelist."
- On confirm: `ensureSaved()` (create draft if needed) → `salesOrderService.updatePrices(id)` → **reseed the form lines from the response** (`data.items`, mapping back to `DraftLine` the same way edit-mode seeding does, with `priceOverridden:false`) → toast + bump `refreshKey`.
- New props threaded through `SalesCustomerBar` → provided by `sales-create.tsx`.

### 2.4 Header button audit (`sales-create-header.tsx`)

- Verify each action calls a real endpoint and surfaces success/failure via toast:
  Print, Send PRO-FORMA, Request Signature, Duplicate, Accrued Revenue, Payment Link, Send email, Mark as Sent, Share, Create Project, Confirm/Save.
- Fix any handler that no-ops or points at a missing route. Ensure `orderId` is present before order-scoped actions (ensureSaved where it makes sense).
- The right-sidebar panel supersedes the need for a separate "Activity" modal button on the create page; leave the list-view activities modal untouched.

### 2.5 Service methods (`client/apps/admin/src/services/salesOrder.service.ts`)

- `getActivities` / `createActivity` already exist. Add `updatePrices(id, token)`.
- Extend `createActivity` body typing to accept `type: 'note' | 'message'`.

---

## 3. Data Flow

```
save/update/status/update-prices (controller)
      └─ logActivity(system) ─────────────► Activity collection
form save 'saved' | status action
      └─ bump refreshKey ► SalesActivityPanel.getActivities ► render timeline
manual note/message (composer)
      └─ createActivity ► refetch
```

## 4. Error Handling

- Server logging is best-effort: `logActivity` never throws into the save/status handler. A failed log is silently dropped (with a server-side `console` warn).
- Panel fetch failure: quiet inline "Couldn't load history — retry" affordance; never blocks the form.
- `updatePrices` on a non-editable order returns 4xx; client shows the message and does not mutate lines.

## 5. Testing

- Server: pure-helper unit tests (§1.5) + `updatePrices` mocked-model test. Run the existing sales suite to confirm no regressions.
- Client: render smoke test for `SalesActivityPanel` (empty state + a couple of entries) if the app has a test runner wired; otherwise manual verification via `/run`.

## 6. Execution Plan (subagents)

- **Agent A (backend, first):** §1.1–1.5. Defines the wire contracts: `Activity` shape, `updatePrices` request/response, activity JSON returned by `getActivities`.
- **Agent B (frontend panel):** §2.1, 2.2, 2.5 (getActivities/createActivity typing). Consumes A's activity JSON + service methods.
- **Agent C (frontend controls):** §2.3, 2.4, and `updatePrices` service method. Consumes A's endpoint.

B and C depend only on the interfaces A fixes in this spec, so they can proceed against those contracts. Integration + `verification-before-completion` + code review after all three land.

## 7. Interfaces (contract, so agents don't collide)

- **Activity JSON** (from `GET /:id/activities`): `{ _id, type, subject, description?, meta?, system, createdBy?, createdAt }`.
- **`POST /:id/update-prices`** → `{ success: true, data: <SalesOrder> }`.
- **`SalesActivityPanel` props**: `{ token: string; orderId?: string; refreshKey?: number }`.
- **`SalesConfirmModal` props**: `{ open: boolean; title: string; body: string; confirmLabel?: string; onConfirm: () => void; onClose: () => void }`.
