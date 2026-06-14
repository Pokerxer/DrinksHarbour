# Purchases Settings — Make It Real and Enforced

**Date:** 2026-06-14
**Status:** Approved (design)
**Area:** Purchases → `/purchases/settings` (the "Purchase Settings" page)

## Problem

The purchase-settings surface is effectively non-functional end to end:

1. **Frontend is fake.** `purchases-settings.tsx` keeps Bill Control, Default
   Currency, and Require Approval in local `useState`; "Save" is a `setTimeout`
   that toasts success. Nothing is loaded or persisted.
2. **Schema duplication silently drops settings.** `Tenant.js` declares
   `purchaseSettings` **twice** (≈ lines 244 and 529). Mongoose keeps only the
   second block, so the keys the PO controller actually uses
   (`defaultCurrency`, `defaultBillControlPolicy`, `rfqValidityDays`,
   `defaultLeadTimeDays`, `lockConfirmedOrders`) are not in the effective schema.
   `PATCH /api/purchase-orders/settings` therefore `$set`s keys Mongoose strips —
   they never save — and `getTenantPurchaseSettings` always returns defaults.
3. **Two divergent vocabularies.** The PO controller's
   `PURCHASE_SETTING_VALIDATORS` / `PURCHASE_SETTINGS_DEFAULTS` use the first
   block's key names; `tenant.controller.js` `buildTenantData` writes the second
   block's names (`billControlPolicy`, `enable3WayMatching`, `approvalThreshold`,
   …). The admin-tenant path and the settings page write different keys.
4. **`approvalThreshold` is dead.** It exists in the schema and admin path but is
   never read when deciding whether a PO needs approval — approval is
   all-or-nothing via `requirePOApproval`.

## Goals

- One canonical `Tenant.purchaseSettings` schema; settings actually persist and
  read back.
- A real settings page that loads and saves the full set.
- Enforce each setting in its related flow (approval + threshold, default
  currency, default bill-control, auto-generate bill, partial receipts, lead
  time, RFQ validity, lock-confirmed).

## Non-goals

- Per-vendor or per-user settings overrides (tenant-level only).
- Changing the existing `/api/purchase-orders/settings` route shape (still
  `{ purchaseSettings }`).
- Reworking the admin tenant CRUD UI; only its purchase-settings key names are
  reconciled.

## Canonical settings (confirmed)

Single `purchaseSettings` block, union of both current blocks. Tenant-level
**defaults** keep the `default*` prefix; per-PO fields are unchanged.

| Key | Type | Default | Enforced in |
|---|---|---|---|
| `defaultCurrency` | enum NGN/USD/EUR/GBP | `NGN` | PO create currency default |
| `defaultBillControlPolicy` | enum ordered/received | `received` | new PO `billControlPolicy` |
| `requirePOApproval` | Boolean | `true` | PO approval gating |
| `approvalThreshold` | Number ≥ 0 | `0` | PO approval gating (0 = all POs) |
| `enable3WayMatching` | Boolean | `true` | bill validation (existing) |
| `autoGenerateBill` | Boolean | `false` | PO validation → draft bill |
| `allowPartialReceipts` | Boolean | `true` | receiving |
| `rfqValidityDays` | Number 0–365 | `30` | RFQ create validity default |
| `defaultLeadTimeDays` | Number 0–365 | `7` | pricelist auto-sync + new lines |
| `defaultPaymentTerms` | String | `Net 30` | PO/bill prefill |
| `lockConfirmedOrders` | Boolean | `false` | block edits on confirmed+ POs |
| `defaultReceivingLocation` | String | `''` | receiving prefill |

**Naming decision (confirmed):** keep `defaultBillControlPolicy` (tenant default)
and `billControlPolicy` (per-PO) as distinct fields.

## Server changes

### `server/models/Tenant.js`
- Delete the duplicate `purchaseSettings` block; keep a single block with the
  canonical fields above. No data migration needed — new/renamed fields default
  sensibly; previously-unsaved keys simply begin saving.

### `server/controllers/purchaseOrder.controller.js`
- **Validators:** extend `PURCHASE_SETTING_VALIDATORS` to the full set —
  `approvalThreshold` (`number ≥ 0`), `enable3WayMatching` (bool),
  `autoGenerateBill` (bool), `allowPartialReceipts` (bool), `defaultPaymentTerms`
  (string), `defaultReceivingLocation` (string), alongside the existing six.
- **Defaults:** align `PURCHASE_SETTINGS_DEFAULTS` to the full set / table above.
- **Approval gating helper (pure, exported):**
  `requiresApproval(poTotal, settings)` →
  `settings.requirePOApproval && (!(settings.approvalThreshold > 0) || poTotal >= settings.approvalThreshold)`.
  Use it in PO create and confirm so a PO below the threshold auto-approves.
- **Default bill-control:** new PO `billControlPolicy` defaults from
  `defaultBillControlPolicy` when not supplied.
- **Auto-generate bill:** in the PO-validation handler, after the existing
  inventory + pricelist sync, if `autoGenerateBill` is true and no bill exists
  yet, create the draft vendor bill via the existing create-bill path using the
  resolved bill-control policy. Non-blocking (try/catch; a bill failure must not
  fail validation), mirroring the pricelist-sync hook.
- **Lock-confirmed:** in `updatePurchaseOrder`, if `lockConfirmedOrders` and the
  PO status is `confirmed`/`received`/`validated`, reject edits with a clear
  message.

### `server/controllers/purchaseOrder.controller.js` — receiving & RFQ
- **Partial receipts:** when `allowPartialReceipts` is false, the receive
  handler rejects a receipt whose quantity is less than the outstanding ordered
  quantity for a line.
- **RFQ validity:** RFQ create defaults its validity/expiry window from
  `rfqValidityDays` when the client doesn't pass one.

### `server/controllers/tenant.controller.js`
- Reconcile `buildTenantData`'s `ps*` mapping to the canonical key names so the
  admin-tenant update path writes the same keys as the settings page
  (`defaultBillControlPolicy` default, plus the full set). Per-PO `billControlPolicy`
  is not a tenant field and is removed from this mapping.

### `server/services/vendorPricelistSync.service.js` / pricelist helper
- Replace the hardcoded `leadTimeDays: 7` for newly-appended auto lines with the
  tenant's `defaultLeadTimeDays` (passed through from the controller that calls
  the sync, which already resolves tenant settings).

## Client changes

### `client/.../services/purchaseOrder.service.ts`
- Add a `PurchaseSettings` interface (the canonical set).
- Add `getSettings(token)` → `GET /api/purchase-orders/settings` and
  `updateSettings(settings, token)` → `PATCH` with `{ purchaseSettings }`.

### `client/.../purchases/purchases-settings.tsx` (rewrite)
- Load settings on mount; show a skeleton while loading and an error state on
  failure.
- Edit the full set, grouped into cards: **Order Policy** (default currency,
  default bill-control, default payment terms, default lead time), **Approval**
  (require approval, approval threshold), **Billing** (auto-generate bill,
  3-way matching), **Receiving** (allow partial receipts, default location,
  lock confirmed orders), **RFQ** (validity days).
- Dirty-tracking: Save disabled until changed; Save calls `updateSettings`,
  toasts the real result, and resets the baseline. Replace the `setTimeout`.
- Use the purchases design system (cream `#FAF8F3`, red `#b20202`, border
  `#ece4d6`, `fraunces` headings) — consistent with the rest of the module
  (the current page uses plain gray).

## Error handling

- PATCH ignores unknown/invalid keys (declarative validators); if nothing valid
  is sent it returns the existing `No valid purchase settings provided` error.
- Auto-bill and pricelist sync on validation stay non-blocking (try/catch).
- Lock-confirmed and partial-receipt rejections surface as clear validation
  errors, not 500s.
- Frontend surfaces load/save failures as toasts and keeps the form editable.

## Testing

- **Server:** `node:assert` script for the pure `requiresApproval(total, settings)`
  helper — covers approval off, threshold 0 (all POs), total below threshold
  (auto-approve), total at/above threshold (needs approval). No DB needed.
  Module-load checks for the controller/routes after edits.
- **Client:** `tsc --noEmit` clean on changed files; `next lint` clean.
- **Manual:** save settings → reload persists; set threshold and create POs
  above/below; toggle auto-bill and validate a PO; toggle partial receipts and
  attempt a short receipt; lock-confirmed and attempt to edit a confirmed PO.

## File touch list

- `server/models/Tenant.js` — merge duplicate `purchaseSettings` into one block.
- `server/controllers/purchaseOrder.controller.js` — validators/defaults, pure
  `requiresApproval`, bill-control default, auto-bill on validation, lock-confirmed,
  partial-receipt + RFQ-validity enforcement.
- `server/controllers/tenant.controller.js` — reconcile `buildTenantData` keys.
- `server/services/vendorPricelistSync.service.js` (+ `utils/pricelistHistory.js`)
  — use `defaultLeadTimeDays` for new auto lines.
- `server/scripts/test-purchase-settings.js` — `requiresApproval` tests (new).
- `client/.../services/purchaseOrder.service.ts` — `PurchaseSettings` type + 2 methods.
- `client/.../purchases/purchases-settings.tsx` — full rewrite (load/save/themed).
</content>
