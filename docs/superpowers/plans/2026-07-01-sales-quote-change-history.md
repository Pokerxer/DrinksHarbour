# Sales Quote Change-History + Working Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Odoo-style right-sidebar change-history ("chatter") panel to the Sales create/edit page, auto-log lifecycle events, add a working "Update Prices" control, and audit the header buttons.

**Architecture:** Server emits best-effort `Activity` log entries from the sales-order lifecycle (create/update/status/update-prices); the admin page renders them in a sticky right-sidebar panel with a note/message composer. A new `POST /:id/update-prices` endpoint recomputes prices from the pricelist.

**Tech Stack:** Node.js + Express + Mongoose (server), Next.js App Router + React + TypeScript + Tailwind (admin). Tests via `node:test` (server).

## Global Constraints

- Multi-tenant: all reads/writes scope by `req.tenant._id` (never client-supplied). See AGENTS.md Workstream A/B.
- Currency ₦ (NGN), grouped, 2 decimals in money strings.
- Activity logging is **best-effort** — a logging failure MUST NOT throw into the save/status handler.
- Files under ~200–300 lines; decompose UI sections into their own components.
- Branch: `feat/sales-quote-change-history` (already checked out).
- Brand color token is `brand` (Tailwind), e.g. `text-brand`, `bg-brand`.

---

## Agent A — Backend

### Task A1: Extend the `Activity` model

**Files:**
- Modify: `server/models/Activity.js`

**Interfaces:**
- Produces: `Activity` doc shape `{ _id, tenant, salesOrder, type:'note'|'call'|'email'|'meeting'|'task'|'log'|'message', subject, description?, meta?, system:boolean, createdBy?, createdAt, updatedAt }`.

- [ ] **Step 1:** In `activitySchema`, change the `type` enum to `['note','call','email','meeting','task','log','message']`. Add `system: { type: Boolean, default: false }` and `meta: { type: mongoose.Schema.Types.Mixed }`.
- [ ] **Step 2:** Commit: `git add server/models/Activity.js && git commit -m "feat(sales): Activity model — log/message types, system flag, meta"`

### Task A2: Activity emitter service + pure diff helpers

**Files:**
- Create: `server/services/salesActivity.service.js`
- Test: `server/__tests__/salesActivity.service.test.js`

**Interfaces:**
- Produces:
  - `formatMoney(n:number) -> string` — e.g. `269500` → `"269,500.00 ₦"`.
  - `diffPricelist(from?:string, to?:string) -> {from,to}|null` — null when equal or both falsy.
  - `diffTotals(prev, next) -> { total?:{from,to}, untaxed?:{from,to} }|null` where `untaxed = subtotal - discountTotal - promotionTotal`; null when nothing changed.
  - `statusSubject(docType:'quotation'|'order', action:string) -> string`.
  - `logActivity(tenantId, salesOrderId, { subject, description?, meta?, userId?, type='log', system=true }) -> Promise<doc|null>` (best-effort).

- [ ] **Step 1: Write failing tests**

```js
const test = require('node:test');
const assert = require('node:assert');
const svc = require('../services/salesActivity.service');

test('formatMoney groups to 2dp with ₦', () => {
  assert.strictEqual(svc.formatMoney(269500), '269,500.00 ₦');
  assert.strictEqual(svc.formatMoney(238931.67), '238,931.67 ₦');
});

test('diffPricelist returns from/to only on change', () => {
  assert.deepStrictEqual(svc.diffPricelist('A', 'B'), { from: 'A', to: 'B' });
  assert.strictEqual(svc.diffPricelist('A', 'A'), null);
  assert.strictEqual(svc.diffPricelist(undefined, undefined), null);
});

test('diffTotals reports total + untaxed deltas', () => {
  const prev = { total: 100, subtotal: 100, discountTotal: 0, promotionTotal: 0 };
  const next = { total: 90,  subtotal: 100, discountTotal: 10, promotionTotal: 0 };
  assert.deepStrictEqual(svc.diffTotals(prev, next), {
    total:   { from: 100, to: 90 },
    untaxed: { from: 100, to: 90 },
  });
  assert.strictEqual(svc.diffTotals(prev, prev), null);
});

test('statusSubject maps lifecycle actions', () => {
  assert.strictEqual(svc.statusSubject('quotation', 'sent'), 'Quotation sent');
  assert.strictEqual(svc.statusSubject('quotation', 'converted'), 'Converted to Sales Order');
  assert.strictEqual(svc.statusSubject('order', 'confirmed'), 'Sales Order confirmed');
});
```

- [ ] **Step 2:** Run `node --test __tests__/salesActivity.service.test.js` — expect FAIL (module not found).
- [ ] **Step 3: Implement**

```js
// server/services/salesActivity.service.js
const Activity = require('../models/Activity');

function formatMoney(n) {
  const v = Number(n) || 0;
  return `${v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₦`;
}

function diffPricelist(from, to) {
  const a = from || '', b = to || '';
  if (a === b) return null;
  if (!a && !b) return null;
  return { from: a || '—', to: b || '—' };
}

function untaxedOf(t) {
  return (Number(t.subtotal) || 0) - (Number(t.discountTotal) || 0) - (Number(t.promotionTotal) || 0);
}

function diffTotals(prev, next) {
  const out = {};
  if ((Number(prev.total) || 0) !== (Number(next.total) || 0)) {
    out.total = { from: Number(prev.total) || 0, to: Number(next.total) || 0 };
  }
  const pu = untaxedOf(prev), nu = untaxedOf(next);
  if (pu !== nu) out.untaxed = { from: pu, to: nu };
  return Object.keys(out).length ? out : null;
}

const STATUS_SUBJECTS = {
  sent: 'Quotation sent',
  accepted: 'Quotation accepted',
  rejected: 'Quotation rejected',
  converted: 'Converted to Sales Order',
  confirmed: 'Sales Order confirmed',
  cancelled: 'Cancelled',
};
function statusSubject(_docType, action) {
  return STATUS_SUBJECTS[action] || `Status: ${action}`;
}

async function logActivity(tenantId, salesOrderId, opts = {}) {
  try {
    return await Activity.create({
      tenant: tenantId,
      salesOrder: salesOrderId,
      type: opts.type || 'log',
      system: opts.system !== undefined ? opts.system : true,
      subject: opts.subject,
      description: opts.description,
      meta: opts.meta,
      createdBy: opts.userId,
    });
  } catch (err) {
    console.warn('[salesActivity] log failed:', err && err.message);
    return null;
  }
}

module.exports = { formatMoney, diffPricelist, diffTotals, untaxedOf, statusSubject, logActivity };
```

- [ ] **Step 4:** Run `node --test __tests__/salesActivity.service.test.js` — expect PASS.
- [ ] **Step 5:** Commit: `git add server/services/salesActivity.service.js server/__tests__/salesActivity.service.test.js && git commit -m "feat(sales): activity emitter + pure diff helpers"`

### Task A3: Wire auto-logs into create/update/status controllers

**Files:**
- Modify: `server/controllers/salesOrder.controller.js`

**Interfaces:**
- Consumes: `salesActivity.service` (A2).

- [ ] **Step 1:** At top of controller, `const salesLog = require('../services/salesActivity.service');`.
- [ ] **Step 2:** In `createSalesOrder`, after the order is created (`const order = ...`), before responding:

```js
await salesLog.logActivity(tenantId, order._id, {
  subject: order.docType === 'quotation' ? 'Quotation created' : 'Sales Order created',
  userId: req.user?._id,
});
```

- [ ] **Step 3:** In `updateSalesOrder`, capture a snapshot BEFORE the edit is applied:

```js
const before = {
  pricelistName: existing.appliedPricelist?.pricelistName,
  total: existing.total, subtotal: existing.subtotal,
  discountTotal: existing.discountTotal, promotionTotal: existing.promotionTotal,
};
```
(`existing` = the loaded tenant-scoped doc the handler already fetches before applyEdit — reuse that variable name if it differs.)

After the save succeeds, using the updated doc (`updated`):

```js
const plDiff = salesLog.diffPricelist(before.pricelistName, updated.appliedPricelist?.pricelistName);
if (plDiff) {
  await salesLog.logActivity(tenantId, updated._id, {
    subject: `Pricelist: ${plDiff.from} → ${plDiff.to}`,
    meta: { field: 'pricelist', ...plDiff }, userId: req.user?._id,
  });
}
const tDiff = salesLog.diffTotals(before, updated);
if (tDiff && tDiff.total) {
  await salesLog.logActivity(tenantId, updated._id, {
    subject: `Total ${salesLog.formatMoney(tDiff.total.from)} → ${salesLog.formatMoney(tDiff.total.to)}`,
    description: tDiff.untaxed ? `Untaxed ${salesLog.formatMoney(tDiff.untaxed.from)} → ${salesLog.formatMoney(tDiff.untaxed.to)}` : undefined,
    meta: { field: 'total', ...tDiff }, userId: req.user?._id,
  });
}
```

- [ ] **Step 4:** In each status handler (`sendQuotation`, `acceptQuotation`, `rejectQuotation`, `convertQuotation`, `confirmSalesOrder`, and cancel if present), after the state change is saved, add (use the action word matching the handler):

```js
await salesLog.logActivity(tenantId, so._id, {
  subject: salesLog.statusSubject(so.docType, 'sent'), userId: req.user?._id,
});
```
(Replace `'sent'` with `accepted`/`rejected`/`converted`/`confirmed`/`cancelled` per handler; use the correct order/quotation variable name in scope.)

- [ ] **Step 5:** Run the sales suite: `node --test $(ls __tests__/sales*.test.js)` — expect no NEW failures (the 2 pre-existing `generateSalesOrderNumber` failures may remain).
- [ ] **Step 6:** Commit: `git add server/controllers/salesOrder.controller.js && git commit -m "feat(sales): auto-log create/update/status to activity timeline"`

### Task A4: `POST /:id/update-prices` endpoint

**Files:**
- Modify: `server/controllers/salesOrder.controller.js`, `server/routes/salesOrder.routes.js`
- Modify (maybe export a recompute helper): `server/services/salesOrder.service.js`
- Test: `server/__tests__/salesUpdatePrices.test.js`

**Interfaces:**
- Produces: `POST /api/sales-orders/:id/update-prices` → `{ success:true, data:<SalesOrder> }`. Clears `priceOverridden` on all product lines, recomputes unit prices from the order's current pricelist, re-snapshots line + order totals, logs a recompute entry.

- [ ] **Step 1:** In `salesOrder.service.js`, export a reusable recompute used by both `applyEdit` and update-prices. If `applyEdit` already inlines the recompute (resolveLinePricing → resolveLinePromotions → mapLine → computeTotals), extract it as `async function recomputeOrderPricing(so, { tenantId, clearOverrides=false })` that mutates `so.items`/totals and returns `so`; have `applyEdit` call it. Add to `module.exports`.
- [ ] **Step 2: Write failing test** (`salesUpdatePrices.test.js`) — mock `SalesOrder.findOne` to return an editable order with one `priceOverridden:true` line, mock `save`, call `svc.updatePricesForOrder(orderDoc, { tenantId })` (a thin service wrapper), assert `items[0].priceOverridden === false` and totals recomputed. Mirror the `t.mock.method` style in `salesOrder.tax.test.js`.
- [ ] **Step 3:** Implement the service wrapper `updatePricesForOrder(so, { tenantId })` = `recomputeOrderPricing(so, { tenantId, clearOverrides:true })` then `computeTotals`; export it.
- [ ] **Step 4:** Add controller `updatePrices`: load `{ _id:req.params.id, tenant:tenantId }`; 404 if missing; `if(!canEdit(so)) return 4xx`; capture before-totals; `await svc.updatePricesForOrder(so, { tenantId })`; `await so.save()`; emit `salesLog.logActivity(tenantId, so._id, { subject: 'Product prices recomputed according to pricelist ' + (so.appliedPricelist?.pricelistName || 'base'), userId:req.user?._id })` and a totals-diff log if changed; respond `{ success:true, data: so }`.
- [ ] **Step 5:** Route: add `router.post('/:id/update-prices', updatePrices);` next to the other `/:id/*` POST routes; import `updatePrices` in the controller destructure at the route file top.
- [ ] **Step 6:** Run `node --test __tests__/salesUpdatePrices.test.js` — expect PASS. Then run full sales suite for regressions.
- [ ] **Step 7:** Commit: `git add -A && git commit -m "feat(sales): POST /:id/update-prices recompute endpoint + logging"`

---

## Agent B — Frontend: Activity Panel

### Task B1: Service method typing

**Files:**
- Modify: `client/apps/admin/src/services/salesOrder.service.ts`

**Interfaces:**
- Produces: `updatePrices(id, token) -> { success, data }`; `createActivity` body `type: 'note'|'message'|'log'`.

- [ ] **Step 1:** Add after `createActivity`:

```ts
  async updatePrices(id: string, token: string): Promise<{ success: boolean; data: any }> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/update-prices`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to update prices');
    return response.json();
  },
```
Widen `createActivity` body type to `{ type: 'note' | 'message' | 'log'; subject: string; description?: string }`.

- [ ] **Step 2:** Commit: `git add client/apps/admin/src/services/salesOrder.service.ts && git commit -m "feat(sales): updatePrices service method + activity type widening"`

### Task B2: Activity helpers + item + composer + panel

**Files:**
- Create: `client/apps/admin/src/app/shared/sales/sales-activity-helpers.ts`
- Create: `client/apps/admin/src/app/shared/sales/sales-activity-item.tsx`
- Create: `client/apps/admin/src/app/shared/sales/sales-activity-composer.tsx`
- Create: `client/apps/admin/src/app/shared/sales/sales-activity-panel.tsx`

**Interfaces:**
- Consumes: `salesOrderService.getActivities/createActivity` (existing), Activity JSON `{ _id, type, subject, description?, meta?, system, createdBy?, createdAt }`.
- Produces: `export default function SalesActivityPanel({ token, orderId, refreshKey }: { token: string; orderId?: string; refreshKey?: number })`.

- [ ] **Step 1:** `sales-activity-helpers.ts`: `export interface SalesActivity {...}`; `groupByDay(items): { label: string; items: SalesActivity[] }[]` (label = "Today" / "Yesterday" / `toLocaleDateString`); `initialsFrom(name?: string): string`; `timeOf(iso): string` (`toLocaleTimeString` h:mm). No `any`.
- [ ] **Step 2:** `sales-activity-item.tsx`: renders one entry — avatar (initials), subject, time; if `meta?.from`/`meta?.to`, render `from → to` with `text-brand`/red emphasis on amounts; `description` as muted secondary line; a small icon distinguishing `system` (log) vs manual note/message.
- [ ] **Step 3:** `sales-activity-composer.tsx`: "Log note" / "Send message" toggle, a textarea, and a Send button. On submit calls `salesOrderService.createActivity(orderId, { type: mode === 'message' ? 'message':'note', subject: firstLine, description: rest }, token)`, clears, and calls `onPosted()`. Disabled while `orderId` is falsy or text empty.
- [ ] **Step 4:** `sales-activity-panel.tsx`: header "History"; if `!orderId` show empty state "History appears after the first save."; else `useEffect` on `[orderId, refreshKey]` fetches `getActivities`, stores state, renders `groupByDay` → day header + `SalesActivityItem`s; on fetch error show "Couldn't load history — Retry" button. Renders `SalesActivityComposer` at top with `onPosted` re-fetching. Panel wrapper `rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04] p-4`.
- [ ] **Step 5:** Commit: `git add client/apps/admin/src/app/shared/sales/sales-activity-*.ts* && git commit -m "feat(sales): activity panel, item, composer, helpers"`

### Task B3: Integrate panel into the create/edit layout

**Files:**
- Modify: `client/apps/admin/src/app/shared/sales/sales-create.tsx`
- Modify: `client/apps/admin/src/app/shared/sales/hooks/useSalesAutosave.ts` (expose `draftId`)

**Interfaces:**
- Consumes: `SalesActivityPanel` (B2).

- [ ] **Step 1:** In `useSalesAutosave.ts`, add `const [draftId, setDraftId] = useState<string|null>(initial?._id ?? null)`; whenever `draftIdRef.current` is set to a new id, also `setDraftId(newId)`; return `draftId` in the hook's return object.
- [ ] **Step 2:** In `sales-create.tsx`, add `const [historyKey, setHistoryKey] = useState(0);`. Bump it when `autoSaveStatus === 'saved'` (via a `useEffect` on `autoSaveStatus`). Compute `const orderId = initial?._id ?? draftId ?? undefined;` (destructure `draftId` from the autosave hook).
- [ ] **Step 3:** Wrap the main content block and the panel: change the outer `<div className="pb-24">` inner structure so the header stays full-width, but the customer bar + tabs column and the panel sit in `grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]`. Put `<SalesActivityPanel token={token} orderId={orderId} refreshKey={historyKey} />` in the right column with `className` wrapper `lg:sticky lg:top-4 lg:self-start`.
- [ ] **Step 4:** Verify build/typecheck compiles for these files (no `any` leaks). Commit: `git add -A && git commit -m "feat(sales): right-sidebar history panel on create/edit page"`

---

## Agent C — Frontend: Update Prices + Button Audit

### Task C1: Generic confirm modal

**Files:**
- Create: `client/apps/admin/src/app/shared/sales/sales-confirm-modal.tsx`

**Interfaces:**
- Produces: `export default function SalesConfirmModal({ open, title, body, confirmLabel='Ok', busy=false, onConfirm, onClose }: { open:boolean; title:string; body:string; confirmLabel?:string; busy?:boolean; onConfirm:()=>void; onClose:()=>void })`.

- [ ] **Step 1:** Build a centered modal (overlay `fixed inset-0 z-50 bg-black/40`, card `rounded-2xl bg-white p-6`) with `PiX` close, title, body text, and Ok/Cancel buttons (Ok = `bg-brand text-white`, disabled while `busy`). Return `null` when `!open`. Match the styling language of `sales-confirm-payment-modal.tsx`.
- [ ] **Step 2:** Commit: `git add client/apps/admin/src/app/shared/sales/sales-confirm-modal.tsx && git commit -m "feat(sales): generic confirm modal"`

### Task C2: Update-Prices control in the customer bar

**Files:**
- Modify: `client/apps/admin/src/app/shared/sales/sales-customer-bar.tsx`
- Modify: `client/apps/admin/src/app/shared/sales/sales-create.tsx`

**Interfaces:**
- Consumes: `SalesConfirmModal` (C1), `salesOrderService.updatePrices` (B1), `ensureSaved` (autosave hook).

- [ ] **Step 1:** Add to `SalesCustomerBarProps`: `onUpdatePrices?: () => void`. Next to the pricelist `<select>`, when `pricelistId` is set, render a button `Update Prices` with `PiArrowsClockwise` icon (`text-brand`) that calls `onUpdatePrices`.
- [ ] **Step 2:** In `sales-create.tsx`: add state `const [confirmPrices, setConfirmPrices] = useState(false); const [pricesBusy, setPricesBusy] = useState(false);`. Pass `onUpdatePrices={() => setConfirmPrices(true)}` to `SalesCustomerBar`.
- [ ] **Step 3:** Render `<SalesConfirmModal open={confirmPrices} title="Confirmation" body="This will update the unit price of all products based on the new pricelist." busy={pricesBusy} onClose={() => setConfirmPrices(false)} onConfirm={handleUpdatePrices} />`.
- [ ] **Step 4:** Implement `handleUpdatePrices`: `setPricesBusy(true)`; `const id = await ensureSaved(); if(!id){toast.error('Add a product first'); ...return;}`; `const res = await salesOrderService.updatePrices(id, token)`; reseed `form.setLines(...)` from `res.data.items` mapping to `DraftLine` (same mapping as edit-seeding: `subProductId: it.subproduct, baseUnitPrice: it.unitPrice, discount: it.discount, discountType: it.discountType, priceOverridden:false, ...`); `toast.success('Prices updated'); setHistoryKey(k=>k+1); setConfirmPrices(false);` in `finally setPricesBusy(false)`.
- [ ] **Step 5:** Commit: `git add -A && git commit -m "feat(sales): Update Prices button + confirmation + recompute wiring"`

### Task C3: Header button audit

**Files:**
- Modify: `client/apps/admin/src/app/shared/sales/sales-create-header.tsx` (only if fixes needed)

**Interfaces:**
- Consumes: `salesOrderService` action methods.

- [ ] **Step 1:** For each gear/action handler (Print, Send PRO-FORMA, Request Signature, Duplicate, Accrued Revenue, Payment Link, Send email, Mark as Sent, Share, Create Project, Confirm/Save), confirm: (a) the `salesOrderService` method exists and hits a real route in `server/routes/salesOrder.routes.js`; (b) order-scoped actions guard on `orderId` and call `ensureSaved`-equivalent or toast if absent; (c) success/failure toasts fire.
- [ ] **Step 2:** Fix any handler that no-ops or targets a missing route (e.g., wrong path in the service). If everything already works, note it and make no change.
- [ ] **Step 3:** Commit (only if changed): `git add -A && git commit -m "fix(sales): header button audit"`

---

## Integration & Close-out (after A, B, C)

- [ ] Run full server sales suite: `cd server && node --test $(ls __tests__/sales*.test.js)` — only the 2 pre-existing `generateSalesOrderNumber` failures may remain.
- [ ] Typecheck the touched admin files compile (no `any` leaks introduced).
- [ ] `superpowers:verification-before-completion`, then `code-review` on the branch diff.

## Self-Review Notes

- Spec §1.1→A1, §1.2→A2, §1.3→A3, §1.4→A4, §2.1→B2, §2.2→B3, §2.3→C1+C2, §2.4→C3, §2.5→B1. All covered.
- Best-effort logging enforced in `logActivity` try/catch (A2) — used everywhere.
- Type names consistent: `SalesActivity`, `SalesActivityPanel({token,orderId,refreshKey})`, `SalesConfirmModal({open,title,body,confirmLabel,busy,onConfirm,onClose})`, `updatePrices(id,token)`, `updatePricesForOrder(so,{tenantId})`, `recomputeOrderPricing(so,{tenantId,clearOverrides})`.
