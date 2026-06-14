# Purchases Settings — Persist & Enforce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the purchases settings real — one canonical persisted schema, a working load/save settings page, and enforcement of each setting (threshold-gated approval, default bill-control, auto-generate bill, partial-receipt control, default lead time) across the related flows.

**Architecture:** Collapse the duplicate `Tenant.purchaseSettings` schema into one block so every key persists. Extend the existing `/api/purchase-orders/settings` validators/defaults to the full set. Add a pure `requiresApproval(total, settings)` helper and wire it into PO create/confirm. Extract the existing bill-building logic into a reusable helper and call it from the PO-validation hook when `autoGenerateBill` is on. Rewrite the frontend settings page to load/save via two new service methods.

**Tech Stack:** Node/Express + Mongoose (server), Next.js + React + Tailwind + react-icons/pi + react-hot-toast (client). No test framework — server logic verified with `node:assert` scripts under `server/scripts/`; client with `./node_modules/.bin/tsc --noEmit` and `./node_modules/.bin/next lint`.

**Already wired (do NOT re-implement):** RFQ-validity default (`createPurchaseOrder` lines 240-246), default currency at create (line 254), and lock-confirmed (`updatePurchaseOrder:370` blocks `isLocked`; the confirm branch sets `isLocked` when `lockConfirmedOrders`). These only need the schema merge so the values persist.

**Conventions:** controllers return `{ success, data, message }`, use `resolveTenantId(req)` / `req.user._id`. Client purchases theme: red `#b20202`, cream `#FAF8F3`, border `#ece4d6`, `fraunces` headings.

---

## File Structure

**Server**
- Modify `server/models/Tenant.js` — merge the two `purchaseSettings` blocks into one.
- Modify `server/controllers/purchaseOrder.controller.js` — full defaults/validators, `requiresApproval` + `poTotal` helpers, bill-control default at create, threshold gating in create/confirm, `buildBillFromPO` helper + auto-bill hook, partial-receipt guard.
- Modify `server/controllers/tenant.controller.js` — reconcile `buildTenantData` purchase-settings keys.
- Modify `server/services/vendorPricelistSync.service.js` + `server/utils/pricelistHistory.js` — thread `defaultLeadTimeDays` into new auto lines.
- Create `server/scripts/test-purchase-settings.js` — `requiresApproval` tests.

**Client**
- Modify `client/apps/isomorphic/src/services/purchaseOrder.service.ts` — `PurchaseSettings` type + `getSettings`/`updateSettings`.
- Modify `client/apps/isomorphic/src/app/shared/purchases/purchases-settings.tsx` — full rewrite.

---

## Task 1: Merge the duplicate `purchaseSettings` schema

**Files:**
- Modify: `server/models/Tenant.js`

- [ ] **Step 1: Delete the SECOND `purchaseSettings` block**

Remove the entire block at ~lines 526-569 (the "Purchase Settings (Odoo-style)" comment through its closing `},`):

```js
    // ────────────────────────────────────────────────
    // Purchase Settings (Odoo-style)
    // ────────────────────────────────────────────────
    purchaseSettings: {
      // Bill Control Policy
      billControlPolicy: {
        type: String,
        enum: ["ordered", "received"],
        default: "received",
      },
      // Enable 3-way matching
      enable3WayMatching: {
        type: Boolean,
        default: true,
      },
      // Require approval for all POs
      requirePOApproval: {
        type: Boolean,
        default: true,
      },
      // Approval threshold amount (0 = all POs require approval)
      approvalThreshold: {
        type: Number,
        default: 0,
        min: 0,
      },
      // Default payment terms for POs
      defaultPaymentTerms: {
        type: String,
        default: "Net 30",
      },
      // Auto-generate vendor bill when goods received
      autoGenerateBill: {
        type: Boolean,
        default: false,
      },
      // Allow partial receipts
      allowPartialReceipts: {
        type: Boolean,
        default: true,
      },
      // Default receiving location/warehouse
      defaultReceivingLocation: String,
    },
```

- [ ] **Step 2: Replace the FIRST `purchaseSettings` block (~lines 244-263) with the canonical union**

Replace:

```js
    purchaseSettings: {
      // When false, POs skip the approval step and can be confirmed directly
      requirePOApproval: { type: Boolean, default: true },
      // Auto-lock POs against edits once confirmed
      lockConfirmedOrders: { type: Boolean, default: false },
      // Default bill control policy for new POs (overridable per bill)
      defaultBillControlPolicy: {
        type: String,
        enum: ['ordered', 'received'],
        default: 'received',
      },
      // Default quotation validity window; 0 disables the default
      rfqValidityDays: { type: Number, min: 0, max: 365, default: 30 },
      defaultCurrency: {
        type: String,
        enum: ['NGN', 'USD', 'EUR', 'GBP'],
        default: 'NGN',
      },
      defaultLeadTimeDays: { type: Number, min: 0, max: 365, default: 7 },
    },
```

with the single canonical block:

```js
    purchaseSettings: {
      // When false, POs skip the approval step and can be confirmed directly
      requirePOApproval: { type: Boolean, default: true },
      // Require approval only when PO total >= threshold (0 = all POs)
      approvalThreshold: { type: Number, min: 0, default: 0 },
      // Auto-lock POs against edits once confirmed
      lockConfirmedOrders: { type: Boolean, default: false },
      // Default bill control policy for new POs (overridable per bill)
      defaultBillControlPolicy: {
        type: String,
        enum: ['ordered', 'received'],
        default: 'received',
      },
      // Enable 3-way matching on vendor bills
      enable3WayMatching: { type: Boolean, default: true },
      // Auto-generate a draft vendor bill when a PO is validated
      autoGenerateBill: { type: Boolean, default: false },
      // Allow receiving less than the ordered quantity
      allowPartialReceipts: { type: Boolean, default: true },
      // Default quotation validity window; 0 disables the default
      rfqValidityDays: { type: Number, min: 0, max: 365, default: 30 },
      defaultCurrency: {
        type: String,
        enum: ['NGN', 'USD', 'EUR', 'GBP'],
        default: 'NGN',
      },
      defaultLeadTimeDays: { type: Number, min: 0, max: 365, default: 7 },
      defaultPaymentTerms: { type: String, default: 'Net 30' },
      defaultReceivingLocation: { type: String, default: '' },
    },
```

- [ ] **Step 3: Verify the model loads with exactly one purchaseSettings path**

Run:
```bash
cd server && node -e "const T=require('./models/Tenant'); const p=T.schema.path('purchaseSettings'); console.log('keys:', Object.keys(p.schema.paths).sort().join(','))"
```
Expected (one line, all canonical keys present once):
`keys: allowPartialReceipts,approvalThreshold,autoGenerateBill,defaultBillControlPolicy,defaultCurrency,defaultLeadTimeDays,defaultPaymentTerms,defaultReceivingLocation,enable3WayMatching,lockConfirmedOrders,requirePOApproval,rfqValidityDays`

- [ ] **Step 4: Commit**

```bash
git add server/models/Tenant.js
git commit -m "fix(server): merge duplicate Tenant.purchaseSettings into one canonical schema"
```

---

## Task 2: `requiresApproval` helper + tests

**Files:**
- Modify: `server/controllers/purchaseOrder.controller.js`
- Test: `server/scripts/test-purchase-settings.js`

- [ ] **Step 1: Write the failing test**

Create `server/scripts/test-purchase-settings.js`:

```js
// Run: node scripts/test-purchase-settings.js   (from server/)
const assert = require('node:assert');
const { requiresApproval, poTotal } = require('../controllers/purchaseOrder.controller');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`  ok - ${name}`); }

test('approval off → never requires approval', () => {
  assert.strictEqual(requiresApproval(1000, { requirePOApproval: false, approvalThreshold: 0 }), false);
  assert.strictEqual(requiresApproval(1000, { requirePOApproval: false, approvalThreshold: 500 }), false);
});
test('threshold 0 → all POs require approval', () => {
  assert.strictEqual(requiresApproval(0, { requirePOApproval: true, approvalThreshold: 0 }), true);
  assert.strictEqual(requiresApproval(50, { requirePOApproval: true, approvalThreshold: 0 }), true);
});
test('below threshold → auto-approve (no approval needed)', () => {
  assert.strictEqual(requiresApproval(499, { requirePOApproval: true, approvalThreshold: 500 }), false);
});
test('at/above threshold → requires approval', () => {
  assert.strictEqual(requiresApproval(500, { requirePOApproval: true, approvalThreshold: 500 }), true);
  assert.strictEqual(requiresApproval(900, { requirePOApproval: true, approvalThreshold: 500 }), true);
});
test('poTotal sums unitCost * quantity', () => {
  assert.strictEqual(poTotal({ items: [{ unitCost: 100, quantity: 2 }, { unitCost: 50, quantity: 3 }] }), 350);
  assert.strictEqual(poTotal({ items: [] }), 0);
  assert.strictEqual(poTotal({}), 0);
});

console.log(`\n${passed} passed`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node scripts/test-purchase-settings.js`
Expected: FAIL — `requiresApproval is not a function` (not yet exported).

- [ ] **Step 3: Add the helpers and export them**

In `server/controllers/purchaseOrder.controller.js`, immediately after the `getTenantPurchaseSettings` function (ends ~line 137), add:

```js
/**
 * Total order value of a PO document (unitCost * quantity over its items).
 * Pure — safe to unit-test without a DB.
 */
const poTotal = (po) =>
  (po?.items || []).reduce(
    (s, i) => s + (Number(i.unitCost) || 0) * (Number(i.quantity) || 0),
    0
  );

/**
 * Whether a PO with the given total needs approval under tenant settings.
 * Approval is required only when enabled AND (threshold is 0 → all POs, or the
 * total meets/exceeds the threshold). Pure.
 */
const requiresApproval = (total, settings = {}) => {
  if (!settings.requirePOApproval) return false;
  const threshold = Number(settings.approvalThreshold) || 0;
  return threshold <= 0 || total >= threshold;
};
```

Then add both to the `module.exports` object at the bottom of the file (find the existing `module.exports = {` block and add these two keys):

```js
  requiresApproval,
  poTotal,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node scripts/test-purchase-settings.js`
Expected: PASS — `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/purchaseOrder.controller.js server/scripts/test-purchase-settings.js
git commit -m "feat(server): pure requiresApproval/poTotal helpers + tests"
```

---

## Task 3: Full settings defaults + validators

**Files:**
- Modify: `server/controllers/purchaseOrder.controller.js`

- [ ] **Step 1: Extend `PURCHASE_SETTINGS_DEFAULTS`**

Replace the existing object (~lines 123-130):

```js
const PURCHASE_SETTINGS_DEFAULTS = {
  requirePOApproval: true,
  lockConfirmedOrders: false,
  defaultBillControlPolicy: "received",
  rfqValidityDays: 30,
  defaultCurrency: "NGN",
  defaultLeadTimeDays: 7,
};
```

with:

```js
const PURCHASE_SETTINGS_DEFAULTS = {
  requirePOApproval: true,
  approvalThreshold: 0,
  lockConfirmedOrders: false,
  defaultBillControlPolicy: "received",
  enable3WayMatching: true,
  autoGenerateBill: false,
  allowPartialReceipts: true,
  rfqValidityDays: 30,
  defaultCurrency: "NGN",
  defaultLeadTimeDays: 7,
  defaultPaymentTerms: "Net 30",
  defaultReceivingLocation: "",
};
```

- [ ] **Step 2: Extend `PURCHASE_SETTING_VALIDATORS`**

Replace the existing object (~lines 1494-1501):

```js
const PURCHASE_SETTING_VALIDATORS = {
  requirePOApproval: (v) => typeof v === "boolean",
  lockConfirmedOrders: (v) => typeof v === "boolean",
  defaultBillControlPolicy: (v) => ["ordered", "received"].includes(v),
  rfqValidityDays: (v) => typeof v === "number" && v >= 0 && v <= 365,
  defaultCurrency: (v) => ["NGN", "USD", "EUR", "GBP"].includes(v),
  defaultLeadTimeDays: (v) => typeof v === "number" && v >= 0 && v <= 365,
};
```

with:

```js
const PURCHASE_SETTING_VALIDATORS = {
  requirePOApproval: (v) => typeof v === "boolean",
  approvalThreshold: (v) => typeof v === "number" && v >= 0,
  lockConfirmedOrders: (v) => typeof v === "boolean",
  defaultBillControlPolicy: (v) => ["ordered", "received"].includes(v),
  enable3WayMatching: (v) => typeof v === "boolean",
  autoGenerateBill: (v) => typeof v === "boolean",
  allowPartialReceipts: (v) => typeof v === "boolean",
  rfqValidityDays: (v) => typeof v === "number" && v >= 0 && v <= 365,
  defaultCurrency: (v) => ["NGN", "USD", "EUR", "GBP"].includes(v),
  defaultLeadTimeDays: (v) => typeof v === "number" && v >= 0 && v <= 365,
  defaultPaymentTerms: (v) => typeof v === "string" && v.length <= 100,
  defaultReceivingLocation: (v) => typeof v === "string" && v.length <= 200,
};
```

- [ ] **Step 3: Verify the controller still loads**

Run: `cd server && node -e "require('./controllers/purchaseOrder.controller'); console.log('controller ok')"`
Expected: `controller ok`.

- [ ] **Step 4: Commit**

```bash
git add server/controllers/purchaseOrder.controller.js
git commit -m "feat(server): full purchase-settings defaults + validators"
```

---

## Task 4: Threshold-gated approval + default bill-control at create

**Files:**
- Modify: `server/controllers/purchaseOrder.controller.js`

- [ ] **Step 1: Use `requiresApproval` in `createPurchaseOrder`**

Replace the `isConfirmedOnCreate` block (~lines 236-238):

```js
  const isConfirmedOnCreate =
    (status === "confirmed" || !purchSettings.requirePOApproval) &&
    type !== "rfq";
```

with (compute the PO total from enriched items and apply the threshold):

```js
  const orderTotal = poTotal({ items: enrichedItems });
  const needsApproval = requiresApproval(orderTotal, purchSettings);
  const isConfirmedOnCreate =
    (status === "confirmed" || !needsApproval) && type !== "rfq";
```

- [ ] **Step 2: Default the PO `billControlPolicy` from settings at create**

In the `PurchaseOrder.create({ ... })` call, add a `billControlPolicy` line right after the `currency:` line (~line 254):

```js
    currency: currency || purchSettings.defaultCurrency || "NGN",
    billControlPolicy:
      req.body.billControlPolicy || purchSettings.defaultBillControlPolicy || "received",
```

- [ ] **Step 3: Apply the threshold in the confirm branch of `updatePurchaseOrderStatus`**

Replace the approval check block (~lines 429-445):

```js
  if (status === "confirmed" && purchaseOrder.type === "po") {
    const purchSettings = await getTenantPurchaseSettings(tenantId);
    if (
      purchSettings.requirePOApproval &&
      purchaseOrder.approvalStatus !== "approved"
    ) {
      throw new ValidationError("PO must be approved before confirmation");
    }
    if (!purchSettings.requirePOApproval) {
      purchaseOrder.approvalStatus = "approved";
    }
    if (purchSettings.lockConfirmedOrders) {
      purchaseOrder.isLocked = true;
      purchaseOrder.lockedAt = new Date();
      purchaseOrder.lockReason = "Auto-locked on confirmation";
    }
  }
```

with (threshold-aware — a PO below the threshold auto-approves):

```js
  if (status === "confirmed" && purchaseOrder.type === "po") {
    const purchSettings = await getTenantPurchaseSettings(tenantId);
    const needsApproval = requiresApproval(poTotal(purchaseOrder), purchSettings);
    if (needsApproval && purchaseOrder.approvalStatus !== "approved") {
      throw new ValidationError("PO must be approved before confirmation");
    }
    if (!needsApproval) {
      purchaseOrder.approvalStatus = "approved";
    }
    if (purchSettings.lockConfirmedOrders) {
      purchaseOrder.isLocked = true;
      purchaseOrder.lockedAt = new Date();
      purchaseOrder.lockReason = "Auto-locked on confirmation";
    }
  }
```

- [ ] **Step 4: Verify the controller loads**

Run: `cd server && node -e "require('./controllers/purchaseOrder.controller'); console.log('controller ok')"`
Expected: `controller ok`.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/purchaseOrder.controller.js
git commit -m "feat(server): threshold-gated PO approval + default bill-control at create"
```

---

## Task 5: Extract `buildBillFromPO` + auto-generate bill on validation

**Files:**
- Modify: `server/controllers/purchaseOrder.controller.js`

- [ ] **Step 1: Add a reusable bill-builder helper**

Add this function immediately above `const createBillFromPO = asyncHandler(` (~line 1338). It contains the same logic the route uses, but returns a result object instead of writing HTTP — so both the route and the auto-bill hook can call it:

```js
const VendorBill = require('../models/VendorBill');

/**
 * Build & save a draft VendorBill from a PO document.
 * Returns { bill } on success, or { skipped: true, reason } when a live bill
 * already exists or there are no billable items. Throws only for invalid input
 * (no vendor). Shared by the create-bill route and the auto-bill hook.
 */
async function buildBillFromPO(po, tenantId, userId, opts = {}) {
  if (!po.vendor) {
    throw new ValidationError("PO must have a vendor to create a bill");
  }

  const existingBill = await VendorBill.findOne({
    tenant: tenantId,
    purchaseOrder: po._id,
    status: { $ne: 'cancelled' },
  }).select('billNumber');
  if (existingBill) {
    return { skipped: true, reason: `Bill ${existingBill.billNumber} already exists` };
  }

  const tenantPurchSettings = await getTenantPurchaseSettings(tenantId);
  const policy =
    opts.billControlPolicy ||
    po.billControlPolicy ||
    tenantPurchSettings.defaultBillControlPolicy ||
    'received';

  const items = po.items
    .filter((item) => {
      const qty = policy === 'received' ? (item.receivedQty || 0) : item.quantity;
      return qty > 0;
    })
    .map((item) => {
      const qty = policy === 'received' ? (item.receivedQty || 0) : item.quantity;
      const unitPrice = item.unitCost || 0;
      const taxRate = item.taxRate || 0;
      const amount = qty * unitPrice;
      const taxAmount = amount * (taxRate / 100);
      return {
        subProductId: item.subProductId,
        subProductName: item.subProductName,
        sku: item.sku,
        sizeId: item.sizeId,
        sizeName: item.sizeName,
        quantity: qty,
        unitPrice,
        taxRate,
        amount: amount + taxAmount,
      };
    });

  if (items.length === 0) {
    return { skipped: true, reason: 'No billable items' };
  }

  const year = new Date().getFullYear();
  const lastBill = await VendorBill.findOne({
    tenant: tenantId,
    billNumber: { $regex: new RegExp(`^BIL-${year}-\\d+$`) },
  })
    .sort({ billNumber: -1 })
    .select('billNumber')
    .lean();
  const lastSeq = lastBill ? parseInt(lastBill.billNumber.split('-')[2], 10) : 0;
  const billNumber = `BIL-${year}-${String(lastSeq + 1).padStart(5, '0')}`;

  let resolvedDueDate = opts.dueDate;
  if (!resolvedDueDate && po.vendor.paymentTerms) {
    const netDays = parseInt(String(po.vendor.paymentTerms).replace('net_', ''), 10);
    if (!Number.isNaN(netDays)) {
      const base = opts.billDate ? new Date(opts.billDate) : new Date();
      base.setDate(base.getDate() + netDays);
      resolvedDueDate = base;
    }
  }

  let subtotal = 0;
  let taxAmount = 0;
  items.forEach((item) => {
    const amount = item.quantity * item.unitPrice;
    subtotal += amount;
    taxAmount += amount * (item.taxRate / 100);
  });

  const vendorBill = new VendorBill({
    tenant: tenantId,
    billNumber,
    vendor: po.vendor._id || po.vendor,
    vendorName: po.vendorName,
    purchaseOrder: po._id,
    currency: po.currency || 'NGN',
    items,
    subtotal,
    taxAmount,
    totalAmount: subtotal + taxAmount,
    billDate: opts.billDate || new Date(),
    dueDate: resolvedDueDate,
    notes: opts.notes,
    billControlPolicy: policy,
    status: 'draft',
    matchingStatus: 'pending',
    payments: [],
    paidAmount: 0,
    createdBy: userId,
  });

  await vendorBill.save();
  return { bill: vendorBill };
}
```

- [ ] **Step 2: Make `createBillFromPO` use the helper**

Inside `createBillFromPO`, replace everything from the `const VendorBill = require('../models/VendorBill');` line (~1363) through the `await vendorBill.save();` line (~1475) with:

```js
  const result = await buildBillFromPO(po, tenantId, req.user?._id, {
    billControlPolicy,
    billDate,
    dueDate,
    notes,
  });

  if (result.skipped) {
    throw new ValidationError(
      result.reason.startsWith('Bill ')
        ? `${result.reason} for this PO. Cancel it before creating a new one.`
        : "No billable items found. Receive products first, or bill on ordered quantities."
    );
  }

  const vendorBill = result.bill;
```

(Leave the response block after it — `res.status(201).json({ ... data: vendorBill ... })` — unchanged. Remove the now-duplicate top-level `const VendorBill = require(...)` if one remains inside the function; the module-level `require` added in Step 1 covers it.)

- [ ] **Step 3: Call the helper from the validation hook**

In `updatePurchaseOrderStatus`, inside the `status === "validated"` block, immediately after the existing vendor-pricelist sync `try/catch` (ends ~line 580, before `await purchaseOrder.save();`), add:

```js
    // Auto-generate a draft vendor bill if the tenant opted in. Non-blocking.
    try {
      const purchSettings = await getTenantPurchaseSettings(tenantId);
      if (purchSettings.autoGenerateBill) {
        const billPo = await PurchaseOrder.findById(purchaseOrder._id).populate('vendor');
        const billResult = await buildBillFromPO(billPo, tenantId, req.user?._id || purchaseOrder.createdBy);
        if (billResult.bill) {
          console.log(`🧾 Auto-generated vendor bill ${billResult.bill.billNumber} for ${purchaseOrder.poNumber}`);
        } else {
          console.log(`🧾 Auto-bill skipped for ${purchaseOrder.poNumber}: ${billResult.reason}`);
        }
      }
    } catch (billError) {
      console.error(`⚠️ Auto-bill failed for ${purchaseOrder.poNumber}:`, billError.message);
    }
```

- [ ] **Step 4: Verify the controller loads**

Run: `cd server && node -e "require('./controllers/purchaseOrder.controller'); console.log('controller ok')"`
Expected: `controller ok`.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/purchaseOrder.controller.js
git commit -m "feat(server): reusable buildBillFromPO + auto-generate bill on PO validation"
```

---

## Task 6: Enforce `allowPartialReceipts`

**Files:**
- Modify: `server/controllers/purchaseOrder.controller.js`

- [ ] **Step 1: Reject short receipts when partial receipts are disabled**

In `updatePurchaseOrderStatus`, replace the received-items block (~lines 467-476):

```js
  if (status === "received" && receivedItems && Array.isArray(receivedItems)) {
    for (const receivedItem of receivedItems) {
      const item = purchaseOrder.items.find(
        (i) => i._id.toString() === receivedItem.itemId,
      );
      if (item) {
        item.receivedQty = Math.max(0, receivedItem.receivedQty ?? 0);
      }
    }
  }
```

with:

```js
  if (status === "received" && receivedItems && Array.isArray(receivedItems)) {
    const receiveSettings = await getTenantPurchaseSettings(tenantId);
    for (const receivedItem of receivedItems) {
      const item = purchaseOrder.items.find(
        (i) => i._id.toString() === receivedItem.itemId,
      );
      if (item) {
        const qty = Math.max(0, receivedItem.receivedQty ?? 0);
        if (!receiveSettings.allowPartialReceipts && qty > 0 && qty < item.quantity) {
          throw new ValidationError(
            `Partial receipts are disabled — ${item.subProductName} must be received in full (${item.quantity}).`
          );
        }
        item.receivedQty = qty;
      }
    }
  }
```

- [ ] **Step 2: Verify the controller loads**

Run: `cd server && node -e "require('./controllers/purchaseOrder.controller'); console.log('controller ok')"`
Expected: `controller ok`.

- [ ] **Step 3: Commit**

```bash
git add server/controllers/purchaseOrder.controller.js
git commit -m "feat(server): enforce allowPartialReceipts on receiving"
```

---

## Task 7: Reconcile `buildTenantData` settings keys + lead-time passthrough

**Files:**
- Modify: `server/controllers/tenant.controller.js`
- Modify: `server/services/vendorPricelistSync.service.js`
- Modify: `server/utils/pricelistHistory.js`

- [ ] **Step 1: Map admin `ps*` fields to canonical keys**

In `server/controllers/tenant.controller.js`, replace the `psFields` block and its assignment block (~lines 88-110) with one that uses canonical keys (accepting both legacy `psBillControlPolicy` and new `psDefaultBillControlPolicy` for back-compat):

```js
  // Purchase settings (flat ps* fields -> nested canonical object)
  const psFields = {
    defaultBillControlPolicy: b.psDefaultBillControlPolicy ?? b.psBillControlPolicy,
    defaultCurrency: b.psDefaultCurrency,
    requirePOApproval: b.psRequirePOApproval,
    approvalThreshold: b.psApprovalThreshold,
    enable3WayMatching: b.psEnable3WayMatching,
    autoGenerateBill: b.psAutoGenerateBill,
    allowPartialReceipts: b.psAllowPartialReceipts,
    rfqValidityDays: b.psRfqValidityDays,
    defaultLeadTimeDays: b.psDefaultLeadTimeDays,
    defaultPaymentTerms: b.psDefaultPaymentTerms,
    defaultReceivingLocation: b.psDefaultReceivingLocation,
    lockConfirmedOrders: b.psLockConfirmedOrders,
  };
  const hasPsFields = Object.values(psFields).some((v) => v !== undefined);
  if (hasPsFields) {
    data.purchaseSettings = {};
    if (psFields.defaultBillControlPolicy !== undefined) data.purchaseSettings.defaultBillControlPolicy = psFields.defaultBillControlPolicy;
    if (psFields.defaultCurrency !== undefined) data.purchaseSettings.defaultCurrency = psFields.defaultCurrency;
    if (psFields.requirePOApproval !== undefined) data.purchaseSettings.requirePOApproval = toBool(psFields.requirePOApproval, true);
    if (psFields.approvalThreshold !== undefined) data.purchaseSettings.approvalThreshold = Number(psFields.approvalThreshold);
    if (psFields.enable3WayMatching !== undefined) data.purchaseSettings.enable3WayMatching = toBool(psFields.enable3WayMatching, true);
    if (psFields.autoGenerateBill !== undefined) data.purchaseSettings.autoGenerateBill = toBool(psFields.autoGenerateBill, false);
    if (psFields.allowPartialReceipts !== undefined) data.purchaseSettings.allowPartialReceipts = toBool(psFields.allowPartialReceipts, true);
    if (psFields.rfqValidityDays !== undefined) data.purchaseSettings.rfqValidityDays = Number(psFields.rfqValidityDays);
    if (psFields.defaultLeadTimeDays !== undefined) data.purchaseSettings.defaultLeadTimeDays = Number(psFields.defaultLeadTimeDays);
    if (psFields.defaultPaymentTerms !== undefined) data.purchaseSettings.defaultPaymentTerms = psFields.defaultPaymentTerms;
    if (psFields.defaultReceivingLocation !== undefined) data.purchaseSettings.defaultReceivingLocation = psFields.defaultReceivingLocation;
    if (psFields.lockConfirmedOrders !== undefined) data.purchaseSettings.lockConfirmedOrders = toBool(psFields.lockConfirmedOrders, false);
  }
```

- [ ] **Step 2: Thread `defaultLeadTimeDays` into the pricelist helper**

In `server/utils/pricelistHistory.js`, in `applyPOItemsToPricelist`, change the new-line creation to use `ctx.defaultLeadTimeDays`. Replace:

```js
        minQuantity: 1,
        leadTimeDays: 7,
        packaging: it.packaging,
```

with:

```js
        minQuantity: 1,
        leadTimeDays: Number(ctx.defaultLeadTimeDays) > 0 ? Number(ctx.defaultLeadTimeDays) : 7,
        packaging: it.packaging,
```

- [ ] **Step 3: Pass the setting through the sync service**

In `server/services/vendorPricelistSync.service.js`, change the signature and the `applyPOItemsToPricelist` ctx. Replace the function declaration line:

```js
async function syncVendorPricelistFromPO(po, tenantId, userId) {
```

with:

```js
async function syncVendorPricelistFromPO(po, tenantId, userId, opts = {}) {
```

and in the `applyPOItemsToPricelist(pl, po.items, { ... })` call, add `defaultLeadTimeDays`:

```js
  const { updated, added, changed } = applyPOItemsToPricelist(pl, po.items, {
    now,
    userId: userId || po.createdBy,
    poId: po._id,
    poNumber: po.poNumber,
    defaultLeadTimeDays: opts.defaultLeadTimeDays,
  });
```

- [ ] **Step 4: Supply the setting from the PO-validation sync call**

In `server/controllers/purchaseOrder.controller.js`, find the existing `syncVendorPricelistFromPO(purchaseOrder, tenantId, ...)` call inside the validation hook and pass the resolved lead-time as a 4th arg. Replace:

```js
      const syncResult = await syncVendorPricelistFromPO(
        purchaseOrder,
        tenantId,
        req.user?._id || purchaseOrder.createdBy
      );
```

with:

```js
      const syncSettings = await getTenantPurchaseSettings(tenantId);
      const syncResult = await syncVendorPricelistFromPO(
        purchaseOrder,
        tenantId,
        req.user?._id || purchaseOrder.createdBy,
        { defaultLeadTimeDays: syncSettings.defaultLeadTimeDays }
      );
```

- [ ] **Step 5: Verify helper tests still pass + modules load**

Run:
```bash
cd server && node scripts/test-pricelist-history.js && node -e "require('./controllers/tenant.controller'); require('./services/vendorPricelistSync.service'); console.log('ok')"
```
Expected: `8 passed` then `ok` (existing pricelist tests unaffected; `leadTimeDays` default 7 preserved when no setting passed).

- [ ] **Step 6: Commit**

```bash
git add server/controllers/tenant.controller.js server/services/vendorPricelistSync.service.js server/utils/pricelistHistory.js
git commit -m "feat(server): reconcile tenant settings keys + default lead time in pricelist sync"
```

---

## Task 8: Client service — types + getSettings/updateSettings

**Files:**
- Modify: `client/apps/isomorphic/src/services/purchaseOrder.service.ts`

- [ ] **Step 1: Add the `PurchaseSettings` interface**

Near the top of `purchaseOrder.service.ts` (after the existing imports / first interface), add:

```ts
export interface PurchaseSettings {
  requirePOApproval: boolean;
  approvalThreshold: number;
  lockConfirmedOrders: boolean;
  defaultBillControlPolicy: 'ordered' | 'received';
  enable3WayMatching: boolean;
  autoGenerateBill: boolean;
  allowPartialReceipts: boolean;
  rfqValidityDays: number;
  defaultCurrency: 'NGN' | 'USD' | 'EUR' | 'GBP';
  defaultLeadTimeDays: number;
  defaultPaymentTerms: string;
  defaultReceivingLocation: string;
}
```

- [ ] **Step 2: Add the two service methods**

Inside the purchase-order service object/class, add (match the file's existing fetch + headers pattern; if the file exposes a `getHeaders(token)` use it, otherwise mirror the inline `Authorization: Bearer` pattern already in the file):

```ts
  async getSettings(token: string): Promise<{ success: boolean; data: { purchaseSettings: PurchaseSettings } }> {
    const response = await fetch(`${API_URL}/api/purchase-orders/settings`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    return response.json();
  },

  async updateSettings(
    purchaseSettings: Partial<PurchaseSettings>,
    token: string
  ): Promise<{ success: boolean; data: { purchaseSettings: PurchaseSettings }; message?: string }> {
    const response = await fetch(`${API_URL}/api/purchase-orders/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ purchaseSettings }),
    });
    return response.json();
  },
```

> Note for the implementer: open the file first to match its exact structure (object literal vs class, `API_URL` constant name, and whether a shared header helper exists). Use the file's existing conventions — the snippet above is the behavior, not necessarily the exact syntax.

- [ ] **Step 3: Typecheck**

Run: `cd client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit 2>&1 | grep "purchaseOrder.service" ; echo "(empty = no errors in this file)"`
Expected: empty.

- [ ] **Step 4: Commit**

```bash
git add client/apps/isomorphic/src/services/purchaseOrder.service.ts
git commit -m "feat(client): purchase settings type + getSettings/updateSettings"
```

---

## Task 9: Rewrite the settings page (load + save + themed)

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/purchases/purchases-settings.tsx`

- [ ] **Step 1: Replace the whole component**

Replace the entire contents of `purchases-settings.tsx` with:

```tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { PiFloppyDisk, PiArrowsClockwise } from 'react-icons/pi';
import toast from 'react-hot-toast';
import {
  purchaseOrderService,
  type PurchaseSettings,
} from '@/services/purchaseOrder.service';
import { fraunces } from './purchases-fonts';

const CURRENCIES: PurchaseSettings['defaultCurrency'][] = ['NGN', 'USD', 'EUR', 'GBP'];

export default function PurchasesSettings() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [settings, setSettings] = useState<PurchaseSettings | null>(null);
  const [baseline, setBaseline] = useState<PurchaseSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await purchaseOrderService.getSettings(token);
      setSettings(res.data.purchaseSettings);
      setBaseline(res.data.purchaseSettings);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(baseline),
    [settings, baseline]
  );

  function patch(p: Partial<PurchaseSettings>) {
    setSettings((prev) => (prev ? { ...prev, ...p } : prev));
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await purchaseOrderService.updateSettings(settings, token);
      if (res.success) {
        setSettings(res.data.purchaseSettings);
        setBaseline(res.data.purchaseSettings);
        toast.success('Settings saved');
      } else {
        toast.error(res.message || 'Save failed');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return (
      <div className="space-y-4">
        <div className="h-20 animate-pulse rounded-2xl border border-[#ece4d6] bg-white" />
        <div className="h-64 animate-pulse rounded-2xl border border-[#ece4d6] bg-white" />
      </div>
    );
  }

  const card = 'rounded-2xl border border-[#ece4d6] bg-white p-5 shadow-sm';
  const label = 'mb-1 block text-xs font-medium text-gray-600';
  const input =
    'w-full rounded-lg border border-[#ece4d6] px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/15';

  const Toggle = ({
    checked,
    onChange,
    title,
    desc,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    title: string;
    desc: string;
  }) => (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium text-gray-800">{title}</span>
        <span className="block text-xs text-gray-500">{desc}</span>
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <span className={`block h-5 w-9 rounded-full transition-colors ${checked ? 'bg-[#b20202]' : 'bg-gray-200'}`} />
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
    </label>
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ece4d6] bg-white px-6 py-5 shadow-sm">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#b20202]/70">
            Configuration
          </p>
          <h1 className={`${fraunces.className} mt-1 text-[26px] font-semibold text-[#2a2420]`}>
            Purchase Settings
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-[#ece4d6] px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-[#FAF8F3]"
          >
            <PiArrowsClockwise className="h-3.5 w-3.5" /> Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
          >
            <PiFloppyDisk className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Order Policy */}
        <div className={card}>
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Order Policy</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Default Currency</label>
              <select className={input} value={settings.defaultCurrency} onChange={(e) => patch({ defaultCurrency: e.target.value as PurchaseSettings['defaultCurrency'] })}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Default Bill Control</label>
              <select className={input} value={settings.defaultBillControlPolicy} onChange={(e) => patch({ defaultBillControlPolicy: e.target.value as PurchaseSettings['defaultBillControlPolicy'] })}>
                <option value="received">On received quantities</option>
                <option value="ordered">On ordered quantities</option>
              </select>
            </div>
            <div>
              <label className={label}>Default Payment Terms</label>
              <input className={input} value={settings.defaultPaymentTerms} onChange={(e) => patch({ defaultPaymentTerms: e.target.value })} />
            </div>
            <div>
              <label className={label}>Default Lead Time (days)</label>
              <input type="number" min={0} max={365} className={input} value={settings.defaultLeadTimeDays} onChange={(e) => patch({ defaultLeadTimeDays: Number(e.target.value) })} />
            </div>
          </div>
        </div>

        {/* Approval */}
        <div className={card}>
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Approval</h2>
          <div className="space-y-4">
            <Toggle
              checked={settings.requirePOApproval}
              onChange={(v) => patch({ requirePOApproval: v })}
              title="Require approval for purchase orders"
              desc="POs must be approved before they can be confirmed."
            />
            <div>
              <label className={label}>Approval Threshold (0 = all POs)</label>
              <input
                type="number"
                min={0}
                disabled={!settings.requirePOApproval}
                className={`${input} disabled:bg-gray-50 disabled:text-gray-400`}
                value={settings.approvalThreshold}
                onChange={(e) => patch({ approvalThreshold: Number(e.target.value) })}
              />
              <p className="mt-1 text-xs text-gray-400">Only POs at or above this total need approval.</p>
            </div>
          </div>
        </div>

        {/* Billing */}
        <div className={card}>
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Billing</h2>
          <div className="space-y-4">
            <Toggle
              checked={settings.autoGenerateBill}
              onChange={(v) => patch({ autoGenerateBill: v })}
              title="Auto-generate vendor bill"
              desc="Create a draft bill automatically when a PO is validated."
            />
            <Toggle
              checked={settings.enable3WayMatching}
              onChange={(v) => patch({ enable3WayMatching: v })}
              title="Enable 3-way matching"
              desc="Match PO, receipt, and bill before payment."
            />
          </div>
        </div>

        {/* Receiving */}
        <div className={card}>
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Receiving</h2>
          <div className="space-y-4">
            <Toggle
              checked={settings.allowPartialReceipts}
              onChange={(v) => patch({ allowPartialReceipts: v })}
              title="Allow partial receipts"
              desc="Permit receiving less than the ordered quantity."
            />
            <Toggle
              checked={settings.lockConfirmedOrders}
              onChange={(v) => patch({ lockConfirmedOrders: v })}
              title="Lock confirmed orders"
              desc="Block edits once a PO is confirmed."
            />
            <div>
              <label className={label}>Default Receiving Location</label>
              <input className={input} value={settings.defaultReceivingLocation} onChange={(e) => patch({ defaultReceivingLocation: e.target.value })} placeholder="e.g. Main Warehouse" />
            </div>
          </div>
        </div>

        {/* RFQ */}
        <div className={card}>
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Requests for Quotation</h2>
          <div>
            <label className={label}>Default RFQ Validity (days)</label>
            <input type="number" min={0} max={365} className={input} value={settings.rfqValidityDays} onChange={(e) => patch({ rfqValidityDays: Number(e.target.value) })} />
            <p className="mt-1 text-xs text-gray-400">New RFQs expire this many days after creation (0 = no default).</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run:
```bash
cd client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit 2>&1 | grep "purchases-settings"; ./node_modules/.bin/next lint --file src/app/shared/purchases/purchases-settings.tsx
```
Expected: no `purchases-settings` errors from tsc; `✔ No ESLint warnings or errors`.

- [ ] **Step 3: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/purchases/purchases-settings.tsx
git commit -m "feat(client): real purchase settings page — load, edit, save full set"
```

---

## Task 10: Full verification

- [ ] **Step 1: Server tests + module loads**

Run:
```bash
cd server && node scripts/test-purchase-settings.js && node scripts/test-pricelist-history.js && node -e "require('./controllers/purchaseOrder.controller'); require('./controllers/tenant.controller'); require('./models/Tenant'); console.log('all server modules ok')"
```
Expected: `5 passed`, `8 passed`, `all server modules ok`.

- [ ] **Step 2: Client typecheck + lint (changed files only)**

Run:
```bash
cd client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -E "purchases-settings|purchaseOrder.service"; echo "(empty = none)"
./node_modules/.bin/next lint --file src/app/shared/purchases/purchases-settings.tsx --file src/services/purchaseOrder.service.ts
```
Expected: empty grep; `✔ No ESLint warnings or errors`. (Pre-existing `TS2688` missing-`@types` errors elsewhere are unrelated environment noise.)

- [ ] **Step 3: Manual smoke test (document results)**

With server + client running and a tenant admin logged in:
1. Open `/purchases/settings` → values load (not blanks); change Default Currency + toggle Auto-generate bill → **Save** → reload page → values persist.
2. Set Require approval ON, Threshold = e.g. 100000; create a PO below the threshold → it confirms without an approval step; create one at/above → it stays pending approval.
3. With Auto-generate bill ON, validate a received PO → a draft `BIL-…` bill appears for that PO.
4. Turn Allow partial receipts OFF; try to receive less than ordered → rejected with a clear message.
5. Turn Lock confirmed orders ON, confirm a PO, try to edit it → blocked.

- [ ] **Step 4: Final commit (if any cleanup)**

```bash
git add -A && git commit -m "chore: purchases settings verification cleanup" || echo "nothing to commit"
```

---

## Self-Review Notes (resolved)

- **Spec coverage:** schema merge (Task 1), full defaults/validators (Task 3), threshold-gated approval (Tasks 2+4), default bill-control at create (Task 4), auto-bill on validation (Task 5), partial receipts (Task 6), `buildTenantData` reconcile + lead-time (Task 7), service (Task 8), page rewrite (Task 9), tests/verify (Tasks 2 & 10). RFQ-validity, default-currency, and lock-confirmed were already wired — covered by the schema merge so their values now persist. All spec sections mapped.
- **Type consistency:** `requiresApproval`/`poTotal` signatures match across tasks; `PurchaseSettings` keys match the canonical schema, validators, defaults, and `buildTenantData` mapping; `buildBillFromPO` return shape (`{ bill } | { skipped, reason }`) is consistent across its two callers.
- **No-test-framework reality:** server verified via `node scripts/...` + `node -e require(...)`; client via local `./node_modules/.bin/tsc` and `./node_modules/.bin/next lint` (plain `npx tsc` resolves to a stub in this repo).
```
