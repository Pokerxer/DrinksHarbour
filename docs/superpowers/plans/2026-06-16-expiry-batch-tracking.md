# Expiry-Date & Batch Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture batch numbers + expiry dates when receiving purchase orders, track each batch's quantity per warehouse as a sub-ledger under `WarehouseStock`, deplete batches first-expiry-first-out (FEFO) on sales/transfers with full traceability, and send recurring deduped expiry notifications via a daily cron job.

**Architecture:** A new `WarehouseBatch` model is a reconcilable sub-ledger beneath the authoritative `WarehouseStock.currentQuantity` (invariant: `Σ open-batch qty ≤ currentQuantity`; the slack is untracked/legacy stock). All ordering/formatting/expiry math lives in pure, dependency-free helpers (`batch.helpers.js`) unit-tested with `node:test`. DB operations live in `batch.service.js`, tested with `t.mock.method` stubs (no live Mongo), mirroring the existing `warehouse.service.sellReturn.test.js` pattern. Sale lines (`Order.orderItemSchema`) store `batchAllocations` for exact refund restore. A `node-cron` daily scan materializes deduped notifications.

**Tech Stack:** Node.js, Mongoose 9, `node:test` + `node:assert`, `node-cron`, Next.js/React + TypeScript client (`client/apps/isomorphic`).

---

## Conventions for every task

- Server tests run with: `cd server && node --test __tests__/`
- Run a single test file with: `cd server && node --test __tests__/<file>.test.js`
- Client type-check: `cd client/apps/isomorphic && npx tsc --noEmit` (ignore pre-existing `TS2688` errors only).
- Commit after each task with the message shown in its final step.
- Errors use `../utils/errors` (`ValidationError`, `NotFoundError`).

---

## File Structure

**New files:**
- `server/services/batch.helpers.js` — pure functions: FEFO ordering/allocation, batch-number formatting + sequencing, expiry-window detection, alert priority, `defaultTracksBatch`.
- `server/services/batch.service.js` — DB operations: `generateBatchNumber`, `receiveBatch`, `depleteBatchesFefo`, `restoreBatches`, `transferBatchesFefo`.
- `server/models/WarehouseBatch.js` — the batch sub-ledger model.
- `server/jobs/expiryScan.job.js` — `scanExpiringBatches` core + `startExpiryCron` scheduler glue.
- `server/scripts/backfillTracksBatch.js` — one-time idempotent backfill.
- `server/__tests__/batch.helpers.test.js`
- `server/__tests__/batch.service.test.js`
- `server/__tests__/expiryScan.job.test.js`

**Modified files:**
- `server/models/Product.js` — add `tracksBatch` + pre-validate default.
- `server/models/Order.js` — add `batchAllocations` to `orderItemSchema`.
- `server/models/Tenant.js` — add `inventorySettings` block.
- `server/models/Notification.js` — add `batch_expiry_alert` enum value.
- `server/services/warehouse.service.js` — opt-in batch paths in `sellStock`/`returnStock`/`transferStock`/`adjustStock`.
- `server/services/poReceive.helpers.js` — batch-aware `postReceivedStock`.
- `server/controllers/purchaseOrder.controller.js` — capture batch fields from `receivedItems`.
- `server/controllers/pos.controller.js` — persist/restore `batchAllocations`.
- `server/server.js` — start the cron behind an env guard.
- `server/package.json` — add `node-cron` + a `test` script.
- `client/apps/isomorphic/src/app/shared/purchases/purchases-receipt-detail.tsx` — per-line batch/expiry inputs.
- `client/apps/isomorphic/src/app/shared/purchases/types.ts` — batch fields on receive types.
- `client/apps/isomorphic/src/services/purchaseOrder.service.ts` — send batch fields.
- Product editor + warehouse-stock detail components (Tasks 21–22; exact paths discovered in those tasks).

---

## Phase 1 — Pure helpers (no DB)

### Task 1: `defaultTracksBatch` helper + `node-cron`/test script setup

**Files:**
- Create: `server/services/batch.helpers.js`
- Test: `server/__tests__/batch.helpers.test.js`
- Modify: `server/package.json`

- [ ] **Step 1: Add `node-cron` and a test script to package.json**

In `server/package.json`, change the `test` script and add the dependency:

```json
"scripts": {
  "test": "node --test __tests__/",
  "start": "node server.js",
```

Then install:

```bash
cd server && npm install node-cron@3
```

Expected: `node-cron` appears under `dependencies`.

- [ ] **Step 2: Write the failing test**

Create `server/__tests__/batch.helpers.test.js`:

```javascript
// server/__tests__/batch.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const { defaultTracksBatch } = require('../services/batch.helpers');

test('defaultTracksBatch defaults to true for non-alcoholic when unset', () => {
  assert.strictEqual(defaultTracksBatch(false, undefined), true);
});

test('defaultTracksBatch defaults to false for alcoholic when unset', () => {
  assert.strictEqual(defaultTracksBatch(true, undefined), false);
});

test('defaultTracksBatch respects an explicit override either way', () => {
  assert.strictEqual(defaultTracksBatch(true, true), true);
  assert.strictEqual(defaultTracksBatch(false, false), false);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && node --test __tests__/batch.helpers.test.js`
Expected: FAIL — `Cannot find module '../services/batch.helpers'`.

- [ ] **Step 4: Write minimal implementation**

Create `server/services/batch.helpers.js`:

```javascript
// server/services/batch.helpers.js
// Pure, dependency-free helpers for batch/expiry tracking. No DB or Mongoose here.

/**
 * Resolve a product's effective tracksBatch value.
 * @param {boolean} isAlcoholic
 * @param {boolean|undefined|null} current  explicit per-product override
 * @returns {boolean}
 */
function defaultTracksBatch(isAlcoholic, current) {
  if (current === true || current === false) return current;
  return !isAlcoholic;
}

module.exports = { defaultTracksBatch };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && node --test __tests__/batch.helpers.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add server/services/batch.helpers.js server/__tests__/batch.helpers.test.js server/package.json server/package-lock.json
git commit -m "feat(inventory): batch.helpers defaultTracksBatch + node-cron dep"
```

---

### Task 2: FEFO ordering + allocation helpers

**Files:**
- Modify: `server/services/batch.helpers.js`
- Test: `server/__tests__/batch.helpers.test.js`

- [ ] **Step 1: Append the failing tests**

Add to `server/__tests__/batch.helpers.test.js`:

```javascript
const { orderBatchesFefo, allocateFefo } = require('../services/batch.helpers');

test('orderBatchesFefo sorts by expiry ascending, no-expiry last, then receivedDate', () => {
  const batches = [
    { batchNumber: 'C', expiryDate: null, receivedDate: new Date('2026-01-01') },
    { batchNumber: 'A', expiryDate: new Date('2026-03-01'), receivedDate: new Date('2026-02-01') },
    { batchNumber: 'B', expiryDate: new Date('2026-02-01'), receivedDate: new Date('2026-02-01') },
    { batchNumber: 'D', expiryDate: null, receivedDate: new Date('2026-01-15') },
  ];
  const ordered = orderBatchesFefo(batches).map((b) => b.batchNumber);
  assert.deepStrictEqual(ordered, ['B', 'A', 'C', 'D']);
});

test('allocateFefo draws from earliest-expiry batches and reports the slack remainder', () => {
  const batches = [
    { _id: 'b1', batchNumber: 'B', expiryDate: new Date('2026-02-01'), quantity: 30 },
    { _id: 'b2', batchNumber: 'A', expiryDate: new Date('2026-03-01'), quantity: 50 },
  ];
  const { allocations, remainder } = allocateFefo(batches, 40);
  assert.deepStrictEqual(allocations, [
    { batch: 'b1', batchNumber: 'B', quantity: 30, expiryDate: batches[0].expiryDate },
    { batch: 'b2', batchNumber: 'A', quantity: 10, expiryDate: batches[1].expiryDate },
  ]);
  assert.strictEqual(remainder, 0);
});

test('allocateFefo returns positive remainder when batches cannot cover the quantity', () => {
  const batches = [{ _id: 'b1', batchNumber: 'B', expiryDate: null, quantity: 5 }];
  const { allocations, remainder } = allocateFefo(batches, 12);
  assert.deepStrictEqual(allocations, [
    { batch: 'b1', batchNumber: 'B', quantity: 5, expiryDate: null },
  ]);
  assert.strictEqual(remainder, 7);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test __tests__/batch.helpers.test.js`
Expected: FAIL — `orderBatchesFefo is not a function`.

- [ ] **Step 3: Implement**

Add to `server/services/batch.helpers.js` (before `module.exports`):

```javascript
/**
 * Order batches FEFO: soonest expiry first; null-expiry batches go last,
 * tie-broken by receivedDate ascending (oldest received first).
 * Does not mutate the input.
 */
function orderBatchesFefo(batches) {
  const time = (d) => (d ? new Date(d).getTime() : null);
  return [...batches].sort((a, b) => {
    const ea = time(a.expiryDate);
    const eb = time(b.expiryDate);
    if (ea !== null && eb !== null && ea !== eb) return ea - eb;
    if (ea === null && eb !== null) return 1;
    if (ea !== null && eb === null) return -1;
    return (time(a.receivedDate) || 0) - (time(b.receivedDate) || 0);
  });
}

/**
 * Allocate `quantity` across batches FEFO without mutating them.
 * @returns {{ allocations: Array<{batch, batchNumber, quantity, expiryDate}>, remainder: number }}
 *   remainder > 0 means batches could not fully cover the quantity (drawn from
 *   untracked slack by the caller).
 */
function allocateFefo(batches, quantity) {
  let need = quantity;
  const allocations = [];
  for (const b of orderBatchesFefo(batches)) {
    if (need <= 0) break;
    const take = Math.min(need, b.quantity || 0);
    if (take <= 0) continue;
    allocations.push({
      batch: b._id,
      batchNumber: b.batchNumber,
      quantity: take,
      expiryDate: b.expiryDate || null,
    });
    need -= take;
  }
  return { allocations, remainder: Math.max(0, need) };
}
```

Update the exports line:

```javascript
module.exports = { defaultTracksBatch, orderBatchesFefo, allocateFefo };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test __tests__/batch.helpers.test.js`
Expected: PASS (all tests so far).

- [ ] **Step 5: Commit**

```bash
git add server/services/batch.helpers.js server/__tests__/batch.helpers.test.js
git commit -m "feat(inventory): FEFO ordering + allocation helpers"
```

---

### Task 3: Batch-number formatting + sequence

**Files:**
- Modify: `server/services/batch.helpers.js`
- Test: `server/__tests__/batch.helpers.test.js`

- [ ] **Step 1: Append the failing tests**

```javascript
const { formatBatchDate, buildBatchNumber, nextBatchSeq } = require('../services/batch.helpers');

test('formatBatchDate renders YYYYMMDD in UTC', () => {
  assert.strictEqual(formatBatchDate(new Date('2026-06-16T23:30:00Z')), '20260616');
});

test('nextBatchSeq returns 1 when no batches share the prefix', () => {
  assert.strictEqual(nextBatchSeq([], 'JUICE500-20260616'), 1);
  assert.strictEqual(nextBatchSeq(['OTHER-20260616-001'], 'JUICE500-20260616'), 1);
});

test('nextBatchSeq returns one past the max existing sequence for the prefix', () => {
  const existing = ['JUICE500-20260616-001', 'JUICE500-20260616-003', 'JUICE500-20260615-009'];
  assert.strictEqual(nextBatchSeq(existing, 'JUICE500-20260616'), 4);
});

test('buildBatchNumber composes SKU-YYYYMMDD-seq zero padded', () => {
  assert.strictEqual(
    buildBatchNumber('JUICE500', new Date('2026-06-16T00:00:00Z'), 4),
    'JUICE500-20260616-004'
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test __tests__/batch.helpers.test.js`
Expected: FAIL — `formatBatchDate is not a function`.

- [ ] **Step 3: Implement**

Add to `server/services/batch.helpers.js`:

```javascript
/** YYYYMMDD in UTC. */
function formatBatchDate(date) {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * Given existing batch numbers and a `${SKU}-${YYYYMMDD}` prefix, return the next
 * sequence integer (max existing for that prefix + 1, else 1).
 */
function nextBatchSeq(existingNumbers, prefix) {
  let max = 0;
  for (const n of existingNumbers) {
    if (typeof n !== 'string' || !n.startsWith(`${prefix}-`)) continue;
    const seq = parseInt(n.slice(prefix.length + 1), 10);
    if (Number.isFinite(seq) && seq > max) max = seq;
  }
  return max + 1;
}

/** Compose `${SKU}-${YYYYMMDD}-${seq}` with a 3-digit zero-padded sequence. */
function buildBatchNumber(sku, date, seq) {
  return `${sku}-${formatBatchDate(date)}-${String(seq).padStart(3, '0')}`;
}
```

Update exports:

```javascript
module.exports = {
  defaultTracksBatch, orderBatchesFefo, allocateFefo,
  formatBatchDate, nextBatchSeq, buildBatchNumber,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test __tests__/batch.helpers.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/batch.helpers.js server/__tests__/batch.helpers.test.js
git commit -m "feat(inventory): batch-number formatting + sequencing helpers"
```

---

### Task 4: Expiry-window detection + alert priority

**Files:**
- Modify: `server/services/batch.helpers.js`
- Test: `server/__tests__/batch.helpers.test.js`

- [ ] **Step 1: Append the failing tests**

```javascript
const { daysUntil, isWithinExpiryWindow, expiryAlertPriority } = require('../services/batch.helpers');

test('daysUntil counts whole days from now to expiry (floored)', () => {
  const now = new Date('2026-06-16T00:00:00Z');
  assert.strictEqual(daysUntil(new Date('2026-06-26T00:00:00Z'), now), 10);
  assert.strictEqual(daysUntil(new Date('2026-06-15T00:00:00Z'), now), -1);
});

test('isWithinExpiryWindow is true at/under the window, false beyond, false for null', () => {
  const now = new Date('2026-06-16T00:00:00Z');
  assert.strictEqual(isWithinExpiryWindow(new Date('2026-09-01T00:00:00Z'), now, 90), true);
  assert.strictEqual(isWithinExpiryWindow(new Date('2026-12-01T00:00:00Z'), now, 90), false);
  assert.strictEqual(isWithinExpiryWindow(null, now, 90), false);
});

test('expiryAlertPriority escalates as expiry approaches', () => {
  const now = new Date('2026-06-16T00:00:00Z');
  assert.strictEqual(expiryAlertPriority(new Date('2026-06-10T00:00:00Z'), now), 'urgent'); // past
  assert.strictEqual(expiryAlertPriority(new Date('2026-07-01T00:00:00Z'), now), 'urgent'); // <30
  assert.strictEqual(expiryAlertPriority(new Date('2026-08-01T00:00:00Z'), now), 'high');   // <60
  assert.strictEqual(expiryAlertPriority(new Date('2026-09-10T00:00:00Z'), now), 'normal'); // >=60
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test __tests__/batch.helpers.test.js`
Expected: FAIL — `daysUntil is not a function`.

- [ ] **Step 3: Implement**

Add to `server/services/batch.helpers.js`:

```javascript
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days from `now` to `expiryDate` (floored; negative if already past). */
function daysUntil(expiryDate, now = new Date()) {
  return Math.floor((new Date(expiryDate).getTime() - new Date(now).getTime()) / MS_PER_DAY);
}

/** True when expiryDate is set and within `windowDays` from now (past counts as within). */
function isWithinExpiryWindow(expiryDate, now, windowDays) {
  if (!expiryDate) return false;
  return daysUntil(expiryDate, now) <= windowDays;
}

/** Map days-to-expiry to a Notification priority. */
function expiryAlertPriority(expiryDate, now = new Date()) {
  const d = daysUntil(expiryDate, now);
  if (d < 30) return 'urgent';
  if (d < 60) return 'high';
  return 'normal';
}
```

Update exports:

```javascript
module.exports = {
  defaultTracksBatch, orderBatchesFefo, allocateFefo,
  formatBatchDate, nextBatchSeq, buildBatchNumber,
  daysUntil, isWithinExpiryWindow, expiryAlertPriority,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test __tests__/batch.helpers.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/batch.helpers.js server/__tests__/batch.helpers.test.js
git commit -m "feat(inventory): expiry-window detection + alert priority helpers"
```

---

## Phase 2 — Models & settings

### Task 5: `WarehouseBatch` model

**Files:**
- Create: `server/models/WarehouseBatch.js`

- [ ] **Step 1: Create the model**

```javascript
// models/WarehouseBatch.js — one batch (lot) of one size of one subproduct in one warehouse
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const warehouseBatchSchema = new Schema(
  {
    tenant:     { type: ObjectId, ref: 'Tenant', required: true, index: true },
    warehouse:  { type: ObjectId, ref: 'Warehouse', required: true, index: true },
    subProduct: { type: ObjectId, ref: 'SubProduct', required: true, index: true },
    size:       { type: ObjectId, ref: 'Size', required: true, index: true },
    product:    { type: ObjectId, ref: 'Product' }, // denormalized for recall/lookup
    batchNumber: { type: String, required: true, trim: true, maxlength: 100 },
    quantity:        { type: Number, min: 0, default: 0 },
    initialQuantity: { type: Number, min: 0, default: 0 },
    expiryDate:   { type: Date, default: null },
    receivedDate: { type: Date, default: Date.now },
    sourcePO:     { type: ObjectId, ref: 'PurchaseOrder' },
    poNumber:     { type: String, maxlength: 50 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

warehouseBatchSchema.virtual('isDepleted').get(function () {
  return (this.quantity || 0) <= 0;
});

// One batch number per (warehouse, subProduct, size).
warehouseBatchSchema.index(
  { tenant: 1, warehouse: 1, subProduct: 1, size: 1, batchNumber: 1 },
  { unique: true }
);
// FEFO depletion lookups.
warehouseBatchSchema.index({ tenant: 1, warehouse: 1, subProduct: 1, size: 1, expiryDate: 1 });
// Cron expiry scan.
warehouseBatchSchema.index({ tenant: 1, expiryDate: 1, quantity: 1 });

const WarehouseBatch =
  mongoose.models.WarehouseBatch || mongoose.model('WarehouseBatch', warehouseBatchSchema);
module.exports = WarehouseBatch;
```

- [ ] **Step 2: Sanity-check the module loads**

Run: `cd server && node -e "require('./models/WarehouseBatch'); console.log('ok')"`
Expected: prints `ok` (no schema errors).

- [ ] **Step 3: Commit**

```bash
git add server/models/WarehouseBatch.js
git commit -m "feat(inventory): WarehouseBatch sub-ledger model"
```

---

### Task 6: `Product.tracksBatch` field + pre-validate default

**Files:**
- Modify: `server/models/Product.js` (add field near `isAlcoholic` at line ~245; add hook before model compile)

- [ ] **Step 1: Add the field**

In `server/models/Product.js`, immediately after the `isAlcoholic` field block (ends at line ~250), add:

```javascript
    // When true, receiving this product captures a batch number (+ expiry for
    // perishables) and stock is depleted FEFO. Defaults from !isAlcoholic via a
    // pre-validate hook; override per product.
    tracksBatch: {
      type: Boolean,
      index: true,
    },
```

- [ ] **Step 2: Add the pre-validate default hook**

Find where the Product schema is defined and the model is compiled (search for `mongoose.model('Product'`). Immediately BEFORE that `mongoose.model(...)` call, add:

```javascript
const { defaultTracksBatch } = require('../services/batch.helpers');

productSchema.pre('validate', function applyTracksBatchDefault(next) {
  this.tracksBatch = defaultTracksBatch(this.isAlcoholic, this.tracksBatch);
  next();
});
```

(If the schema variable is not named `productSchema`, use the actual schema variable name used in the file.)

- [ ] **Step 3: Verify the module loads and the default applies in-memory**

Run:
```bash
cd server && node -e "
const P = require('./models/Product');
const a = new P({ name:'x', slug:'x', type:'other', isAlcoholic:false });
a.validate().catch(()=>{}).finally(()=>console.log('non-alc tracksBatch =', a.tracksBatch));
const b = new P({ name:'y', slug:'y', type:'whiskey', isAlcoholic:true });
b.validate().catch(()=>{}).finally(()=>console.log('alc tracksBatch =', b.tracksBatch));
"
```
Expected: `non-alc tracksBatch = true` and `alc tracksBatch = false` (validation may reject other required fields — that's fine; the hook runs during `validate`).

- [ ] **Step 4: Commit**

```bash
git add server/models/Product.js
git commit -m "feat(inventory): Product.tracksBatch field defaulting from isAlcoholic"
```

---

### Task 7: `Tenant.inventorySettings` + `Notification` enum

**Files:**
- Modify: `server/models/Tenant.js` (add block after `posSettings`)
- Modify: `server/models/Notification.js:18` (enum)

- [ ] **Step 1: Add inventorySettings to Tenant**

In `server/models/Tenant.js`, immediately after the `posSettings: { ... }` block closes, add a sibling block:

```javascript
    // ────────────────────────────────────────────────
    // Inventory Settings
    // ────────────────────────────────────────────────
    inventorySettings: {
      // Days before expiry at which batches start raising expiry notifications.
      expiryWarningDays: { type: Number, min: 1, max: 365, default: 90 },
    },
```

- [ ] **Step 2: Add the notification type**

In `server/models/Notification.js`, add `'batch_expiry_alert',` to the `type` enum (after `'low_stock_alert',` at line ~18).

- [ ] **Step 3: Verify both modules load**

Run: `cd server && node -e "require('./models/Tenant'); require('./models/Notification'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add server/models/Tenant.js server/models/Notification.js
git commit -m "feat(inventory): tenant expiryWarningDays setting + batch_expiry_alert type"
```

---

### Task 8: `Order` line `batchAllocations`

**Files:**
- Modify: `server/models/Order.js` (inside `orderItemSchema`, before its closing `});` ~line 100)

- [ ] **Step 1: Add the subfield**

In `server/models/Order.js`, inside `orderItemSchema`, add:

```javascript
  // Which warehouse batches this line drew from (FEFO), for traceability and
  // exact refund restoration. Empty for non-tracked products / untracked stock.
  batchAllocations: [
    new Schema(
      {
        batch:       { type: ObjectId, ref: 'WarehouseBatch' },
        batchNumber: { type: String },
        quantity:    { type: Number, min: 0 },
        expiryDate:  { type: Date, default: null },
      },
      { _id: false }
    ),
  ],
```

- [ ] **Step 2: Verify the module loads**

Run: `cd server && node -e "require('./models/Order'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add server/models/Order.js
git commit -m "feat(inventory): batchAllocations on order line items"
```

---

## Phase 3 — Batch DB service

> All tests in this phase use `node:test` with `t.mock.method(...)` to stub Mongoose statics (no live Mongo), mirroring `server/__tests__/warehouse.service.sellReturn.test.js`.

### Task 9: `generateBatchNumber` (DB)

**Files:**
- Create: `server/services/batch.service.js`
- Test: `server/__tests__/batch.service.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/batch.service.test.js`:

```javascript
// server/__tests__/batch.service.test.js
const test = require('node:test');
const assert = require('node:assert');
const WarehouseBatch = require('../models/WarehouseBatch');
const batchService = require('../services/batch.service');

test('generateBatchNumber builds SKU-YYYYMMDD-seq from existing batches', async (t) => {
  t.mock.method(WarehouseBatch, 'find', () => ({
    select: () => ({ lean: async () => [
      { batchNumber: 'JUICE500-20260616-001' },
      { batchNumber: 'JUICE500-20260616-002' },
    ] }),
  }));
  const number = await batchService.generateBatchNumber({
    tenantId: 't1', warehouseId: 'w1', subProduct: 'sp1', size: 'sz1',
    sku: 'JUICE500', date: new Date('2026-06-16T00:00:00Z'),
  });
  assert.strictEqual(number, 'JUICE500-20260616-003');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test __tests__/batch.service.test.js`
Expected: FAIL — `Cannot find module '../services/batch.service'`.

- [ ] **Step 3: Implement**

Create `server/services/batch.service.js`:

```javascript
// server/services/batch.service.js — DB operations for the WarehouseBatch sub-ledger.
const WarehouseBatch = require('../models/WarehouseBatch');
const { buildBatchNumber, nextBatchSeq, formatBatchDate, allocateFefo } = require('./batch.helpers');
const { ValidationError } = require('../utils/errors');

/**
 * Build the next auto batch number for a (warehouse, subProduct, size) on a date:
 * `${SKU}-${YYYYMMDD}-${seq}`.
 */
async function generateBatchNumber({ tenantId, warehouseId, subProduct, size, sku, date = new Date() }) {
  const prefix = `${sku}-${formatBatchDate(date)}`;
  const existing = await WarehouseBatch.find({
    tenant: tenantId, warehouse: warehouseId, subProduct, size,
  }).select('batchNumber').lean();
  const seq = nextBatchSeq(existing.map((b) => b.batchNumber), prefix);
  return buildBatchNumber(sku, date, seq);
}

module.exports = { generateBatchNumber };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test __tests__/batch.service.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/batch.service.js server/__tests__/batch.service.test.js
git commit -m "feat(inventory): generateBatchNumber service"
```

---

### Task 10: `receiveBatch` (create / merge)

**Files:**
- Modify: `server/services/batch.service.js`
- Test: `server/__tests__/batch.service.test.js`

`receiveBatch` creates a new batch or, when a manual `batchNumber` already exists for the same `(wh, sub, size)`, tops it up if the expiry matches (else rejects). It returns the saved batch doc. It does NOT touch `WarehouseStock` (the caller — `postReceivedStock` — increments stock via `adjustStock`, keeping the invariant `Σ batches ≤ currentQuantity`).

- [ ] **Step 1: Append failing tests**

```javascript
function sameDay(a, b) {
  return a && b && new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
}

test('receiveBatch creates a new batch when the number is free', async (t) => {
  t.mock.method(WarehouseBatch, 'findOne', async () => null);
  let saved = null;
  t.mock.method(WarehouseBatch, 'create', async (doc) => { saved = doc; return { ...doc, _id: 'b-new' }; });

  const res = await batchService.receiveBatch({
    tenantId: 't1', warehouseId: 'w1', subProduct: 'sp1', size: 'sz1', product: 'p1',
    batchNumber: 'LOT-A', quantity: 12, expiryDate: new Date('2026-12-01'), poNumber: 'PO-1',
  });
  assert.strictEqual(saved.quantity, 12);
  assert.strictEqual(saved.initialQuantity, 12);
  assert.strictEqual(saved.batchNumber, 'LOT-A');
  assert.strictEqual(res._id, 'b-new');
});

test('receiveBatch tops up an existing batch with the same expiry', async (t) => {
  const existing = {
    _id: 'b1', batchNumber: 'LOT-A', quantity: 5, initialQuantity: 5,
    expiryDate: new Date('2026-12-01'),
    save: async function () { return this; },
  };
  t.mock.method(WarehouseBatch, 'findOne', async () => existing);

  const res = await batchService.receiveBatch({
    tenantId: 't1', warehouseId: 'w1', subProduct: 'sp1', size: 'sz1',
    batchNumber: 'LOT-A', quantity: 7, expiryDate: new Date('2026-12-01'),
  });
  assert.strictEqual(res.quantity, 12);
  assert.strictEqual(res.initialQuantity, 12);
});

test('receiveBatch rejects a top-up when the expiry differs', async (t) => {
  const existing = { _id: 'b1', batchNumber: 'LOT-A', quantity: 5, expiryDate: new Date('2026-12-01') };
  t.mock.method(WarehouseBatch, 'findOne', async () => existing);

  await assert.rejects(
    () => batchService.receiveBatch({
      tenantId: 't1', warehouseId: 'w1', subProduct: 'sp1', size: 'sz1',
      batchNumber: 'LOT-A', quantity: 7, expiryDate: new Date('2027-01-01'),
    }),
    (err) => err instanceof Error && /expiry/i.test(err.message)
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test __tests__/batch.service.test.js`
Expected: FAIL — `receiveBatch is not a function`.

- [ ] **Step 3: Implement**

Add to `server/services/batch.service.js` (before `module.exports`):

```javascript
function sameExpiry(a, b) {
  const ta = a ? new Date(a).getTime() : null;
  const tb = b ? new Date(b).getTime() : null;
  return ta === tb;
}

/**
 * Create a batch, or merge into an existing one with the same batchNumber for the
 * (wh, sub, size) when the expiry matches. Different expiry on an existing number
 * is a conflict. Pass an optional Mongoose session for transactional writes.
 * Does not modify WarehouseStock (the caller increments stock separately).
 */
async function receiveBatch(
  { tenantId, warehouseId, subProduct, size, product, batchNumber, quantity, expiryDate = null, sourcePO, poNumber },
  session = null
) {
  if (!(quantity > 0)) throw new ValidationError('Received quantity must be positive');

  const q = WarehouseBatch.findOne({
    tenant: tenantId, warehouse: warehouseId, subProduct, size, batchNumber,
  });
  if (session) q.session(session);
  const existing = await q;

  if (existing) {
    if (!sameExpiry(existing.expiryDate, expiryDate)) {
      throw new ValidationError(
        `Batch "${batchNumber}" already exists with a different expiry date; use a different batch number.`
      );
    }
    existing.quantity = (existing.quantity || 0) + quantity;
    existing.initialQuantity = (existing.initialQuantity || 0) + quantity;
    await existing.save(session ? { session } : undefined);
    return existing;
  }

  const doc = {
    tenant: tenantId, warehouse: warehouseId, subProduct, size, product,
    batchNumber, quantity, initialQuantity: quantity,
    expiryDate, receivedDate: new Date(), sourcePO, poNumber,
  };
  const [created] = await WarehouseBatch.create(session ? [doc] : [doc], session ? { session } : {});
  return created;
}
```

Update exports:

```javascript
module.exports = { generateBatchNumber, receiveBatch };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test __tests__/batch.service.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/batch.service.js server/__tests__/batch.service.test.js
git commit -m "feat(inventory): receiveBatch create/merge"
```

---

### Task 11: `depleteBatchesFefo` + `restoreBatches`

**Files:**
- Modify: `server/services/batch.service.js`
- Test: `server/__tests__/batch.service.test.js`

`depleteBatchesFefo` loads open batches for a `(wh, sub, size)`, allocates `quantity` FEFO via the pure helper, decrements each batch, and returns the allocations array (for the caller to persist on the order line). `restoreBatches` increments specific batches by id (for refunds).

- [ ] **Step 1: Append failing tests**

```javascript
test('depleteBatchesFefo decrements earliest-expiry batches and returns allocations', async (t) => {
  const b1 = { _id: 'b1', batchNumber: 'B', expiryDate: new Date('2026-02-01'), quantity: 30, save: async function(){return this;} };
  const b2 = { _id: 'b2', batchNumber: 'A', expiryDate: new Date('2026-03-01'), quantity: 50, save: async function(){return this;} };
  t.mock.method(WarehouseBatch, 'find', () => ({ session: () => ({ lean: async () => [b1, b2] }), lean: async () => [b1, b2] }));
  const saved = {};
  t.mock.method(WarehouseBatch, 'updateOne', async (filter, update) => { saved[filter._id] = update.$inc.quantity; return {}; });

  const allocations = await batchService.depleteBatchesFefo({
    tenantId: 't1', warehouseId: 'w1', subProduct: 'sp1', size: 'sz1', quantity: 40,
  });
  assert.deepStrictEqual(allocations.map(a => [a.batchNumber, a.quantity]), [['B', 30], ['A', 10]]);
  assert.strictEqual(saved['b1'], -30);
  assert.strictEqual(saved['b2'], -10);
});

test('restoreBatches increments each allocation batch', async (t) => {
  const incs = {};
  t.mock.method(WarehouseBatch, 'updateOne', async (filter, update) => { incs[filter._id] = update.$inc.quantity; return {}; });
  await batchService.restoreBatches(
    [{ batch: 'b1', quantity: 7 }, { batch: 'b2', quantity: 3 }]
  );
  assert.deepStrictEqual(incs, { b1: 7, b2: 3 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test __tests__/batch.service.test.js`
Expected: FAIL — `depleteBatchesFefo is not a function`.

- [ ] **Step 3: Implement**

Add to `server/services/batch.service.js`:

```javascript
/**
 * Deplete `quantity` from a (wh, sub, size)'s open batches FEFO. Returns the
 * allocations actually drawn from batches (caller persists them on the order
 * line). Any remainder is silently left to untracked slack — WarehouseStock is
 * the authoritative guard and is decremented by the caller.
 */
async function depleteBatchesFefo({ tenantId, warehouseId, subProduct, size, quantity }, session = null) {
  let query = WarehouseBatch.find({
    tenant: tenantId, warehouse: warehouseId, subProduct, size, quantity: { $gt: 0 },
  });
  if (session) query = query.session(session);
  const batches = await query.lean();

  const { allocations } = allocateFefo(batches, quantity);
  for (const a of allocations) {
    const update = WarehouseBatch.updateOne({ _id: a.batch }, { $inc: { quantity: -a.quantity } });
    if (session) update.session(session);
    await update;
  }
  return allocations;
}

/** Increment specific batches (refund restore). allocations: [{batch, quantity}]. */
async function restoreBatches(allocations, session = null) {
  for (const a of allocations || []) {
    if (!a.batch || !(a.quantity > 0)) continue;
    const update = WarehouseBatch.updateOne({ _id: a.batch }, { $inc: { quantity: a.quantity } });
    if (session) update.session(session);
    await update;
  }
}
```

Update exports:

```javascript
module.exports = { generateBatchNumber, receiveBatch, depleteBatchesFefo, restoreBatches };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test __tests__/batch.service.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/batch.service.js server/__tests__/batch.service.test.js
git commit -m "feat(inventory): FEFO batch depletion + restore (DB)"
```

---

### Task 12: `transferBatchesFefo`

**Files:**
- Modify: `server/services/batch.service.js`
- Test: `server/__tests__/batch.service.test.js`

Moves `quantity` of a `(sub, size)` from one warehouse's batches to another FEFO, recreating twin batches (same number + expiry) at the destination. Used inside `transferStock`'s existing transaction.

- [ ] **Step 1: Append failing test**

```javascript
test('transferBatchesFefo decrements source batches and upserts twins at destination', async (t) => {
  const src = [
    { _id: 's1', batchNumber: 'B', expiryDate: new Date('2026-02-01'), quantity: 4, product: 'p1' },
    { _id: 's2', batchNumber: 'A', expiryDate: new Date('2026-03-01'), quantity: 10, product: 'p1' },
  ];
  t.mock.method(WarehouseBatch, 'find', () => ({ session: () => ({ lean: async () => src }), lean: async () => src }));
  const decs = {};
  t.mock.method(WarehouseBatch, 'updateOne', async (filter, update) => { decs[filter._id] = update.$inc.quantity; return {}; });
  const upserts = [];
  t.mock.method(WarehouseBatch, 'findOneAndUpdate', async (filter, update, opts) => {
    upserts.push({ filter, update, opts }); return { ...filter, ...update.$setOnInsert };
  });

  await batchService.transferBatchesFefo({
    tenantId: 't1', subProduct: 'sp1', size: 'sz1',
    fromWarehouse: 'w1', toWarehouse: 'w2', quantity: 6,
  });
  // FEFO: take 4 from B then 2 from A at source
  assert.strictEqual(decs['s1'], -4);
  assert.strictEqual(decs['s2'], -2);
  // Two twins created at destination warehouse w2
  assert.strictEqual(upserts.length, 2);
  assert.strictEqual(upserts[0].filter.warehouse, 'w2');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test __tests__/batch.service.test.js`
Expected: FAIL — `transferBatchesFefo is not a function`.

- [ ] **Step 3: Implement**

Add to `server/services/batch.service.js`:

```javascript
/**
 * Move `quantity` of a (sub, size) between warehouses FEFO: decrement source
 * batches and upsert matching (number + expiry) batches at the destination,
 * preserving expiry. Caller wraps this in a transaction and updates WarehouseStock.
 */
async function transferBatchesFefo(
  { tenantId, subProduct, size, fromWarehouse, toWarehouse, quantity }, session = null
) {
  let query = WarehouseBatch.find({
    tenant: tenantId, warehouse: fromWarehouse, subProduct, size, quantity: { $gt: 0 },
  });
  if (session) query = query.session(session);
  const srcBatches = await query.lean();

  const { allocations } = allocateFefo(srcBatches, quantity);
  const byId = new Map(srcBatches.map((b) => [String(b._id), b]));

  for (const a of allocations) {
    const dec = WarehouseBatch.updateOne({ _id: a.batch }, { $inc: { quantity: -a.quantity } });
    if (session) dec.session(session);
    await dec;

    const src = byId.get(String(a.batch));
    const filter = {
      tenant: tenantId, warehouse: toWarehouse, subProduct, size, batchNumber: a.batchNumber,
    };
    const update = {
      $inc: { quantity: a.quantity, initialQuantity: a.quantity },
      $setOnInsert: {
        ...filter, product: src && src.product, expiryDate: a.expiryDate || null, receivedDate: new Date(),
      },
    };
    const up = WarehouseBatch.findOneAndUpdate(filter, update, {
      new: true, upsert: true, setDefaultsOnInsert: true,
    });
    if (session) up.session(session);
    await up;
  }
  return allocations;
}
```

Update exports:

```javascript
module.exports = {
  generateBatchNumber, receiveBatch, depleteBatchesFefo, restoreBatches, transferBatchesFefo,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test __tests__/batch.service.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/batch.service.js server/__tests__/batch.service.test.js
git commit -m "feat(inventory): transferBatchesFefo across warehouses"
```

---

## Phase 4 — Wire into existing stock flows

### Task 13: Batch-aware receiving (`postReceivedStock`)

**Files:**
- Modify: `server/services/poReceive.helpers.js`
- Modify: `server/__tests__/poReceive.helpers.test.js`
- Modify: `server/controllers/purchaseOrder.controller.js` (capture batch fields ~line 501–516; pass deps ~line 542)

`postReceivedStock` gains injected `receiveBatch` + `generateBatchNumber`. For each line: if the line is batch-tracked (`item.tracksBatch`), call `receiveBatch` (auto-generating the number when blank) AND `adjustStock({type:'received'})`; otherwise call `adjustStock` only (unchanged). Dependencies are injected so the test needs no DB.

- [ ] **Step 1: Add the failing tests**

Append to `server/__tests__/poReceive.helpers.test.js`:

```javascript
test('postReceivedStock creates a batch for tracked lines and always adjusts stock', async () => {
  const adjustCalls = [];
  const batchCalls = [];
  const adjustStock = async (p) => { adjustCalls.push(p); };
  const receiveBatch = async (p) => { batchCalls.push(p); return { _id: 'b1' }; };
  const generateBatchNumber = async () => 'JUICE500-20260616-001';

  const purchaseOrder = {
    poNumber: 'PO-1',
    items: [
      { subProductId: 'sp1', sizeId: 'sz1', quantity: 10, receivedQty: 10, tracksBatch: true,
        sku: 'JUICE500', productId: 'p1', receivedExpiryDate: '2026-12-01' },
      { subProductId: 'sp2', sizeId: 'sz2', quantity: 4, receivedQty: 4, tracksBatch: false },
    ],
  };
  const res = await postReceivedStock({
    purchaseOrder, targetWarehouseId: 'w1', adjustStock, receiveBatch, generateBatchNumber,
    userId: 'u1', tenantId: 't1', logger: silentLogger,
  });
  assert.strictEqual(res.successCount, 2);
  assert.strictEqual(batchCalls.length, 1);
  assert.strictEqual(batchCalls[0].batchNumber, 'JUICE500-20260616-001');
  assert.strictEqual(adjustCalls.length, 2);
});

test('postReceivedStock uses a manual batch number when provided', async () => {
  const batchCalls = [];
  const purchaseOrder = {
    poNumber: 'PO-2',
    items: [{ subProductId: 'sp1', sizeId: 'sz1', quantity: 5, receivedQty: 5, tracksBatch: true,
      sku: 'JUICE500', receivedBatchNumber: 'LOT-MANUAL', receivedExpiryDate: '2026-12-01' }],
  };
  await postReceivedStock({
    purchaseOrder, targetWarehouseId: 'w1',
    adjustStock: async () => {}, receiveBatch: async (p) => { batchCalls.push(p); return {}; },
    generateBatchNumber: async () => 'SHOULD-NOT-BE-USED',
    userId: 'u1', tenantId: 't1', logger: silentLogger,
  });
  assert.strictEqual(batchCalls[0].batchNumber, 'LOT-MANUAL');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test __tests__/poReceive.helpers.test.js`
Expected: FAIL — tracked path not implemented (`batchCalls.length` is 0).

- [ ] **Step 3: Implement in `poReceive.helpers.js`**

Replace the body of `postReceivedStock` so its loop, after computing `quantityToAdd` and validating `subProductId`/`sizeId`, does:

```javascript
    try {
      if (item.tracksBatch) {
        const batchNumber =
          (item.receivedBatchNumber && String(item.receivedBatchNumber).trim()) ||
          (await generateBatchNumber({
            tenantId, warehouseId: targetWarehouseId,
            subProduct: item.subProductId, size: item.sizeId,
            sku: item.sku || 'BATCH', date: new Date(),
          }));
        await receiveBatch(
          {
            tenantId, warehouseId: targetWarehouseId,
            subProduct: item.subProductId, size: item.sizeId, product: item.productId,
            batchNumber, quantity: quantityToAdd,
            expiryDate: item.receivedExpiryDate || null, poNumber: purchaseOrder.poNumber,
          }
        );
      }
      await adjustStock(
        {
          warehouseId: targetWarehouseId, subProduct: item.subProductId, size: item.sizeId,
          quantity: quantityToAdd, type: 'received', notes: `PO Receipt: ${purchaseOrder.poNumber}`,
        },
        userId, tenantId
      );
      successCount++;
    } catch (err) {
      logger.error(`   ❌ Failed to post line to warehouse: ${err.message}`);
      failCount++;
    }
```

Update the `postReceivedStock` signature to accept the new deps:

```javascript
async function postReceivedStock({
  purchaseOrder, targetWarehouseId, adjustStock, receiveBatch, generateBatchNumber,
  userId, tenantId, logger = console,
}) {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test __tests__/poReceive.helpers.test.js`
Expected: PASS (old + new tests).

- [ ] **Step 5: Wire the controller**

In `server/controllers/purchaseOrder.controller.js`:

(a) At the top, add the import alongside the existing requires:
```javascript
const batchService = require('../services/batch.service');
```

(b) In the receive block (~line 501–516) where `receivedItems` are applied to PO items, also capture batch fields and the parent product's `tracksBatch`. After `item.receivedQty = qty;`, add:
```javascript
        item.receivedBatchNumber = receivedItem.batchNumber || null;
        item.receivedExpiryDate = receivedItem.expiryDate || null;
```
The PO line already carries `subProductId`, `sizeId`, `sku`, `productId` (verify field names on the PO item; if `tracksBatch`/`sku`/`productId` are absent, load them: `const sp = await SubProduct.findById(item.subProductId).select('sku product').populate('product','tracksBatch'); item.tracksBatch = sp?.product?.tracksBatch; item.sku = sp?.sku; item.productId = sp?.product?._id;`). Use a `require('../models/SubProduct')` import if needed.

(c) In the `postReceivedStock({ ... })` call (~line 542) add the two injected deps:
```javascript
      receiveBatch: batchService.receiveBatch,
      generateBatchNumber: batchService.generateBatchNumber,
```

- [ ] **Step 6: Verify controller loads and full server suite passes**

Run: `cd server && node -e "require('./controllers/purchaseOrder.controller'); console.log('ok')" && node --test __tests__/`
Expected: `ok` then all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add server/services/poReceive.helpers.js server/__tests__/poReceive.helpers.test.js server/controllers/purchaseOrder.controller.js
git commit -m "feat(inventory): batch-aware PO receiving"
```

---

### Task 14: Batch depletion in `sellStock` (opt-in)

**Files:**
- Modify: `server/services/warehouse.service.js`
- Modify: `server/__tests__/warehouse.service.sellReturn.test.js`
- Modify: `server/controllers/pos.controller.js` (`deductStock`, ~line 46–70)

`sellStock` gains an optional `tracksBatch` flag. When false (default), behavior is byte-for-byte unchanged (existing tests stay green). When true, after the guarded decrement succeeds it calls `depleteBatchesFefo` and returns `batchAllocations` alongside `{ before, after }`.

- [ ] **Step 1: Add a failing test**

Append to `server/__tests__/warehouse.service.sellReturn.test.js`:

```javascript
const batchService = require('../services/batch.service');

test('sellStock returns FEFO batchAllocations when tracksBatch is true', async (t) => {
  mockRecalc(t);
  t.mock.method(WarehouseMovement, 'create', async (d) => d);
  t.mock.method(WarehouseStock, 'findOneAndUpdate', async () => ({ currentQuantity: 8 }));
  t.mock.method(batchService, 'depleteBatchesFefo', async () => ([
    { batch: 'b1', batchNumber: 'B', quantity: 2, expiryDate: null },
  ]));

  const result = await sellStock(
    { warehouseId: WAREHOUSE_ID, subProduct: SUBPRODUCT_ID, size: SIZE_ID, quantity: 2, tracksBatch: true },
    USER_ID, TENANT_ID
  );
  assert.strictEqual(result.after, 8);
  assert.deepStrictEqual(result.batchAllocations, [
    { batch: 'b1', batchNumber: 'B', quantity: 2, expiryDate: null },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test __tests__/warehouse.service.sellReturn.test.js`
Expected: FAIL — `result.batchAllocations` is undefined.

- [ ] **Step 3: Implement**

In `server/services/warehouse.service.js`, add at the top:
```javascript
const batchService = require('./batch.service');
```
Change the `sellStock` signature to accept `tracksBatch = false` and, after the existing `await recalcSubProductStock(subProduct);` and before `return { before: after + quantity, after };`, insert:

```javascript
  let batchAllocations = [];
  if (tracksBatch) {
    batchAllocations = await batchService.depleteBatchesFefo({
      tenantId, warehouseId, subProduct, size, quantity,
    });
  }
```
and change the return to:
```javascript
  return { before: after + quantity, after, batchAllocations };
```

(The existing two `sellStock` tests don't pass `tracksBatch`, so `batchAllocations` defaults to `[]` and their `assert.deepStrictEqual(result, { before, after })` assertions must be updated to include `batchAllocations: []`.)

- [ ] **Step 4: Update the two existing sellStock assertions**

In the two pre-existing `sellStock` success tests, change `assert.deepStrictEqual(result, { before: 20, after: 15 });` (and the overselling one) to include `, batchAllocations: [] }`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && node --test __tests__/warehouse.service.sellReturn.test.js`
Expected: PASS.

- [ ] **Step 6: Wire `pos.controller.deductStock`**

In `server/controllers/pos.controller.js` `deductStock`, the caller must pass `tracksBatch` and capture allocations. Resolve `tracksBatch` from the product (the controller already has `productId`); fetch it once: `const prod = await Product.findById(productId).select('tracksBatch').lean();` (add `const Product = require('../models/Product');` if not imported). Pass `tracksBatch: !!prod?.tracksBatch` into the `sellStock({...})` call, and return `result.batchAllocations` from `deductStock` so the order-line builder can attach it (handled in Task 16).

- [ ] **Step 7: Commit**

```bash
git add server/services/warehouse.service.js server/__tests__/warehouse.service.sellReturn.test.js server/controllers/pos.controller.js
git commit -m "feat(inventory): FEFO batch depletion in sellStock"
```

---

### Task 15: Batch restore in `returnStock` (opt-in)

**Files:**
- Modify: `server/services/warehouse.service.js`
- Modify: `server/__tests__/warehouse.service.sellReturn.test.js`

`returnStock` gains an optional `batchAllocations` arg. When present, it restores those exact batches; when absent, behavior is unchanged.

- [ ] **Step 1: Add a failing test**

```javascript
test('returnStock restores exact batches when allocations are supplied', async (t) => {
  mockRecalc(t);
  t.mock.method(WarehouseMovement, 'create', async (d) => d);
  t.mock.method(WarehouseStock, 'findOneAndUpdate', async () => ({ currentQuantity: 12 }));
  let restored = null;
  t.mock.method(batchService, 'restoreBatches', async (allocs) => { restored = allocs; });

  await returnStock(
    { warehouseId: WAREHOUSE_ID, subProduct: SUBPRODUCT_ID, size: SIZE_ID, quantity: 2,
      batchAllocations: [{ batch: 'b1', quantity: 2 }] },
    USER_ID, TENANT_ID
  );
  assert.deepStrictEqual(restored, [{ batch: 'b1', quantity: 2 }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test __tests__/warehouse.service.sellReturn.test.js`
Expected: FAIL — `restoreBatches` not called.

- [ ] **Step 3: Implement**

In `returnStock`, add `batchAllocations = null` to the destructured first arg, and after `await recalcSubProductStock(subProduct);` add:

```javascript
  if (batchAllocations && batchAllocations.length) {
    await batchService.restoreBatches(batchAllocations);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test __tests__/warehouse.service.sellReturn.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/warehouse.service.js server/__tests__/warehouse.service.sellReturn.test.js
git commit -m "feat(inventory): exact batch restore in returnStock"
```

---

### Task 16: Persist/restore `batchAllocations` in POS controller

**Files:**
- Modify: `server/controllers/pos.controller.js` (sell path ~line 52; refund path ~line 227 & ~2218)

- [ ] **Step 1: Persist allocations on the order line (sell)**

Where `deductStock` is called and the order line object is assembled, capture the returned `batchAllocations` and set it on the line, e.g.:
```javascript
    const ded = await deductStock({ ... });
    // ...when building the order item:
    batchAllocations: ded?.batchAllocations || [],
```
Ensure `deductStock` returns the allocations (Task 14, Step 6). If `deductStock` currently returns a Size/SubProduct doc, change it to return `{ doc, batchAllocations }` and update its call sites accordingly.

- [ ] **Step 2: Restore allocations on refund/void**

In the refund path that calls `returnStock` (~line 227 and ~2218), pass the stored allocations from the order line being refunded:
```javascript
      await returnStock(
        { warehouseId, subProduct, size, quantity, batchAllocations: orderItem.batchAllocations },
        staffId, tenantId
      );
```
`orderItem` is the `order.items[orderItemIndex]` being returned (refunds already reference `orderItemIndex`).

- [ ] **Step 3: Verify the controller loads and the suite passes**

Run: `cd server && node -e "require('./controllers/pos.controller'); console.log('ok')" && node --test __tests__/`
Expected: `ok` then all PASS.

- [ ] **Step 4: Commit**

```bash
git add server/controllers/pos.controller.js
git commit -m "feat(inventory): store + restore batchAllocations on POS orders"
```

---

### Task 17: Batch-carrying `transferStock` + FEFO `adjustStock`

**Files:**
- Modify: `server/services/warehouse.service.js`
- Test: `server/__tests__/warehouse.service.sellReturn.test.js` (add transfer/adjust cases)

- [ ] **Step 1: Add failing tests**

```javascript
test('transferStock moves batches with the stock when tracksBatch is true', async (t) => {
  mockRecalc(t);
  // Minimal session stub mirroring transferStock's withTransaction usage.
  const fakeSession = { withTransaction: async (fn) => fn(), endSession() {} };
  t.mock.method(require('mongoose'), 'startSession', async () => fakeSession);
  const src = { currentQuantity: 10, save: async () => {} };
  const dest = { currentQuantity: 0, save: async () => {} };
  let call = 0;
  t.mock.method(WarehouseStock, 'findOne', () => ({ session: () => (call++ === 0 ? src : dest) }));
  t.mock.method(WarehouseMovement, 'create', async () => {});
  let transferred = null;
  t.mock.method(batchService, 'transferBatchesFefo', async (p) => { transferred = p; return []; });

  await transferStock(
    { subProduct: SUBPRODUCT_ID, size: SIZE_ID, fromWarehouse: 'w1', toWarehouse: 'w2', quantity: 6, tracksBatch: true },
    USER_ID, TENANT_ID
  );
  assert.strictEqual(transferred.quantity, 6);
  assert.strictEqual(transferred.toWarehouse, 'w2');
});
```

Add `const { transferStock } = require('../services/warehouse.service');` to the test imports if not present.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test __tests__/warehouse.service.sellReturn.test.js`
Expected: FAIL — `transferBatchesFefo` not invoked.

- [ ] **Step 3: Implement**

In `transferStock`, add `tracksBatch = false` to the destructured arg. Inside the `withTransaction` callback, after the destination `dest.save({ session })` and before creating movements, add:
```javascript
      if (tracksBatch) {
        await batchService.transferBatchesFefo(
          { tenantId, subProduct, size, fromWarehouse, toWarehouse, quantity }, session
        );
      }
```

For `adjustStock`, add batch reconciliation: when `type === 'adjusted'` and the new absolute quantity is LOWER than the current, deplete the difference FEFO; when 'received' or higher 'adjusted', leave batches (delta becomes untracked slack). Add after the existing `await row.save();` for the `adjusted`/`shipped` branches:
```javascript
  if (tracksBatch && type === 'adjusted' && quantity < before) {
    await batchService.depleteBatchesFefo(
      { tenantId, warehouseId, subProduct, size, quantity: before - quantity }
    );
  }
```
where `before` is captured as `row.currentQuantity` BEFORE the mutation, and `tracksBatch` is added to `adjustStock`'s destructured arg (default false). Non-tracked callers are unaffected.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test __tests__/warehouse.service.sellReturn.test.js`
Expected: PASS.

- [ ] **Step 5: Wire callers**

`transferStock` is called from the stock-transfer controller/service — pass `tracksBatch` (resolve from the product). `adjustStock` is called from `postReceivedStock` (Task 13, tracked lines already create batches via `receiveBatch`, so leave `tracksBatch` false there to avoid double-counting) and from manual stock adjustment endpoints — pass `tracksBatch` there if the product is tracked. (Grep `adjustStock(` and `transferStock(` to find call sites.)

- [ ] **Step 6: Commit**

```bash
git add server/services/warehouse.service.js server/__tests__/warehouse.service.sellReturn.test.js
git commit -m "feat(inventory): batch-carrying transferStock + FEFO adjustStock"
```

---

## Phase 5 — Expiry notifications

### Task 18: `scanExpiringBatches` core

**Files:**
- Create: `server/jobs/expiryScan.job.js`
- Test: `server/__tests__/expiryScan.job.test.js`

The core takes injected dependencies (so it's testable without DB): a list of expiring batches, the tenant window, the recipients, and an `upsertNotification`/`archiveNotification` pair. The scheduler glue (Task 19) supplies the real DB-backed versions.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/expiryScan.job.test.js`:

```javascript
// server/__tests__/expiryScan.job.test.js
const test = require('node:test');
const assert = require('node:assert');
const { buildExpiryNotification } = require('../jobs/expiryScan.job');

test('buildExpiryNotification targets recipients with batch metadata and escalating priority', () => {
  const now = new Date('2026-06-16T00:00:00Z');
  const batch = {
    _id: 'b1', batchNumber: 'JUICE500-20260616-001', quantity: 12,
    expiryDate: new Date('2026-07-01T00:00:00Z'),
    subProduct: 'sp1', product: 'p1',
  };
  const n = buildExpiryNotification(batch, ['u1', 'u2'], now);
  assert.strictEqual(n.type, 'batch_expiry_alert');
  assert.strictEqual(n.priority, 'urgent'); // 15 days out
  assert.deepStrictEqual(n.recipients, ['u1', 'u2']);
  assert.strictEqual(n.metadata.batchId, 'b1');
  assert.match(n.message, /JUICE500-20260616-001/);
  assert.match(n.message, /12/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test __tests__/expiryScan.job.test.js`
Expected: FAIL — `Cannot find module '../jobs/expiryScan.job'`.

- [ ] **Step 3: Implement the core**

Create `server/jobs/expiryScan.job.js`:

```javascript
// server/jobs/expiryScan.job.js
const cron = require('node-cron');
const WarehouseBatch = require('../models/WarehouseBatch');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { createNotification } = require('../services/notification.service');
const { expiryAlertPriority, daysUntil } = require('../services/batch.helpers');

const RECIPIENT_ROLES = ['tenant_owner', 'tenant_admin', 'tenant_staff'];

/** Build the notification payload for one expiring batch (pure). */
function buildExpiryNotification(batch, recipients, now = new Date()) {
  const d = daysUntil(batch.expiryDate, now);
  const when = d < 0 ? `expired ${-d} day(s) ago` : `expires in ${d} day(s)`;
  return {
    type: 'batch_expiry_alert',
    title: 'Batch nearing expiry',
    message: `Batch ${batch.batchNumber} (${batch.quantity} left) ${when}. Deplete it before it expires.`,
    priority: expiryAlertPriority(batch.expiryDate, now),
    subProduct: batch.subProduct,
    product: batch.product,
    recipients,
    metadata: { batchId: String(batch._id), expiryDate: batch.expiryDate, quantity: batch.quantity },
  };
}

/**
 * Scan one tenant's batches and upsert/refresh deduped notifications.
 * Deps injected for testing: { findExpiringBatches, getRecipients, upsert, archiveStale }.
 */
async function scanTenant(tenant, now, deps) {
  const windowDays = tenant?.inventorySettings?.expiryWarningDays ?? 90;
  const cutoff = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);
  const batches = await deps.findExpiringBatches(tenant._id, cutoff);
  const recipients = await deps.getRecipients(tenant._id);
  if (!recipients.length) return { created: 0 };
  let created = 0;
  for (const batch of batches) {
    await deps.upsert(buildExpiryNotification(batch, recipients, now), batch);
    created += 1;
  }
  await deps.archiveStale(tenant._id, batches.map((b) => String(b._id)));
  return { created };
}

// ── DB-backed default deps ───────────────────────────────────────────
async function findExpiringBatches(tenantId, cutoff) {
  return WarehouseBatch.find({
    tenant: tenantId, quantity: { $gt: 0 }, expiryDate: { $ne: null, $lte: cutoff },
  }).lean();
}

async function getRecipients(tenantId) {
  const users = await User.find({ tenant: tenantId, role: { $in: RECIPIENT_ROLES }, status: 'active' })
    .select('_id').lean();
  return users.map((u) => u._id);
}

// Dedup: one active (unread, non-archived) notification per batchId. Refresh if present.
async function upsertNotification(payload, batch) {
  const existing = await Notification.findOne({
    type: 'batch_expiry_alert', 'metadata.batchId': String(batch._id),
    isArchived: false,
  });
  if (existing) {
    existing.message = payload.message;
    existing.priority = payload.priority;
    existing.metadata = payload.metadata;
    existing.isRead = false;
    await existing.save();
    return existing;
  }
  return createNotification(payload);
}

// Archive notifications whose batch is no longer in the expiring set (depleted/expired-out).
async function archiveStale(tenantId, activeBatchIds) {
  await Notification.updateMany(
    {
      type: 'batch_expiry_alert', isArchived: false,
      'metadata.batchId': { $nin: activeBatchIds },
      // scope by recipients' tenant indirectly via tenant field if set
    },
    { isArchived: true, archivedAt: new Date() }
  );
}

async function scanExpiringBatches(now = new Date()) {
  const tenants = await Tenant.find({}).select('_id inventorySettings').lean();
  const deps = { findExpiringBatches, getRecipients, upsert: upsertNotification, archiveStale };
  for (const tenant of tenants) {
    try {
      await scanTenant(tenant, now, deps);
    } catch (err) {
      console.error(`expiry scan failed for tenant ${tenant._id}: ${err.message}`);
    }
  }
}

/** Start the daily cron (guarded by the caller). */
function startExpiryCron() {
  cron.schedule('0 2 * * *', () => {
    scanExpiringBatches().catch((e) => console.error('expiry cron error:', e.message));
  });
  console.log('🕑 Expiry-batch scan scheduled (daily 02:00)');
}

module.exports = { buildExpiryNotification, scanTenant, scanExpiringBatches, startExpiryCron };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test __tests__/expiryScan.job.test.js`
Expected: PASS.

- [ ] **Step 5: Add a `scanTenant` dedup/refresh test**

Append:

```javascript
const { scanTenant } = require('../jobs/expiryScan.job');

test('scanTenant upserts one notification per batch and archives stale ones', async () => {
  const now = new Date('2026-06-16T00:00:00Z');
  const tenant = { _id: 't1', inventorySettings: { expiryWarningDays: 90 } };
  const batches = [
    { _id: 'b1', batchNumber: 'A', quantity: 5, expiryDate: new Date('2026-07-01'), subProduct: 'sp1' },
  ];
  const upserts = [];
  let archivedWith = null;
  const res = await scanTenant(tenant, now, {
    findExpiringBatches: async () => batches,
    getRecipients: async () => ['u1'],
    upsert: async (payload) => upserts.push(payload),
    archiveStale: async (_t, ids) => { archivedWith = ids; },
  });
  assert.strictEqual(res.created, 1);
  assert.strictEqual(upserts[0].metadata.batchId, 'b1');
  assert.deepStrictEqual(archivedWith, ['b1']);
});
```

Run: `cd server && node --test __tests__/expiryScan.job.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/jobs/expiryScan.job.js server/__tests__/expiryScan.job.test.js
git commit -m "feat(inventory): expiry-batch scan core + deduped notifications"
```

---

### Task 19: Wire the cron into `server.js`

**Files:**
- Modify: `server/server.js` (in the startup path, after DB connect ~line 280–308)

- [ ] **Step 1: Start the cron behind an env guard**

In `server/server.js`, after a successful `await connectDB();` in the startup function, add:

```javascript
    if (process.env.ENABLE_CRON === 'true' || process.env.NODE_ENV === 'production') {
      const { startExpiryCron } = require('./jobs/expiryScan.job');
      startExpiryCron();
    }
```

This keeps the scan off during `node --test` runs (which never set `ENABLE_CRON`).

- [ ] **Step 2: Verify the server module loads**

Run: `cd server && node -e "require('./jobs/expiryScan.job'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add server/server.js
git commit -m "feat(inventory): schedule daily expiry scan (env-guarded)"
```

---

### Task 20: Backfill script for `tracksBatch`

**Files:**
- Create: `server/scripts/backfillTracksBatch.js`

- [ ] **Step 1: Create the idempotent backfill**

```javascript
// server/scripts/backfillTracksBatch.js
// One-time: set Product.tracksBatch = !isAlcoholic where currently unset.
// Usage: node scripts/backfillTracksBatch.js
require('dotenv').config();
const { connectDB, disconnectDB } = require('../config/db');
const Product = require('../models/Product');

(async () => {
  await connectDB();
  const resTrue = await Product.updateMany(
    { tracksBatch: { $exists: false }, isAlcoholic: false },
    { $set: { tracksBatch: true } }
  );
  const resFalse = await Product.updateMany(
    { tracksBatch: { $exists: false }, isAlcoholic: true },
    { $set: { tracksBatch: false } }
  );
  console.log(`tracksBatch backfill: ${resTrue.modifiedCount} non-alcoholic → true, ${resFalse.modifiedCount} alcoholic → false`);
  await disconnectDB();
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Verify it parses (do not run against prod here)**

Run: `cd server && node --check scripts/backfillTracksBatch.js`
Expected: no output (syntax OK). The maintainer runs it against the target DB during deploy.

- [ ] **Step 3: Commit**

```bash
git add server/scripts/backfillTracksBatch.js
git commit -m "chore(inventory): idempotent tracksBatch backfill script"
```

---

## Phase 6 — Client

### Task 21: Receiving UI — batch number + expiry inputs

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/purchases/purchases-receipt-detail.tsx`
- Modify: `client/apps/isomorphic/src/app/shared/purchases/types.ts`
- Modify: `client/apps/isomorphic/src/services/purchaseOrder.service.ts`

- [ ] **Step 1: Extend the receive types**

In `client/apps/isomorphic/src/app/shared/purchases/types.ts`, find the PO line item type and add (the parent product's flags + per-line capture):
```typescript
  tracksBatch?: boolean;
  isAlcoholic?: boolean;
```
Find the type used for `receivedItems` payload (or define inline in the service) and add `batchNumber?: string; expiryDate?: string;`.

- [ ] **Step 2: Render conditional inputs**

In `purchases-receipt-detail.tsx`, add two state maps next to `receivedQtys` (~line 43):
```typescript
  const [batchNumbers, setBatchNumbers] = useState<Record<string, string>>({});
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
```
In the per-item row render (where `receiving`/`remaining` are computed, ~line 437), for items where `item.tracksBatch`, render below the quantity input:
```tsx
{item.tracksBatch && (
  <div className="mt-2 flex gap-2">
    <input
      type="text"
      placeholder="Batch # (auto if blank)"
      value={batchNumbers[key] ?? ''}
      onChange={(e) => setBatchNumbers((m) => ({ ...m, [key]: e.target.value }))}
      className="w-40 rounded border px-2 py-1 text-sm"
    />
    <input
      type="date"
      value={expiryDates[key] ?? ''}
      onChange={(e) => setExpiryDates((m) => ({ ...m, [key]: e.target.value }))}
      required={!item.isAlcoholic}
      className="w-40 rounded border px-2 py-1 text-sm"
    />
  </div>
)}
```

- [ ] **Step 3: Block submit when a non-alcoholic tracked line is missing expiry**

In the submit handler (where `receivedItems` is built, ~line 202), add a guard before sending:
```typescript
    const missingExpiry = po.items.some((item, idx) => {
      const key = item._id ?? String(idx);
      const receiving = receivedQtys[key] ?? 0;
      return item.tracksBatch && !item.isAlcoholic && receiving > 0 && !expiryDates[key];
    });
    if (missingExpiry) {
      toast.error('Enter an expiry date for each perishable (non-alcoholic) item being received.');
      return;
    }
```
(Use the file's existing toast/notification utility — match how other errors are surfaced in this component.)

- [ ] **Step 4: Include batch fields in the payload**

Change the `receivedItems` map (~line 202) to:
```typescript
      const receivedItems = po.items.map((item, idx) => {
        const key = item._id ?? String(idx);
        return {
          itemId: key,
          receivedQty: receivedQtys[key] ?? 0,
          batchNumber: batchNumbers[key] || undefined,
          expiryDate: expiryDates[key] || undefined,
        };
      });
```
In `purchaseOrder.service.ts`, ensure the receive/validate call's request type allows `batchNumber`/`expiryDate` on each received item (extend the existing type so TS passes them through).

- [ ] **Step 5: Type-check**

Run: `cd client/apps/isomorphic && npx tsc --noEmit`
Expected: no new errors (pre-existing `TS2688` only).

- [ ] **Step 6: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/purchases/purchases-receipt-detail.tsx client/apps/isomorphic/src/app/shared/purchases/types.ts client/apps/isomorphic/src/services/purchaseOrder.service.ts
git commit -m "feat(client): batch number + expiry inputs at PO receiving"
```

---

### Task 22: Product editor `tracksBatch` toggle + read-only batch list

**Files:**
- Modify: the product create/edit form (discover: `cd client/apps/isomorphic && grep -rl "isAlcoholic" src/app/shared/ecommerce` — add the toggle beside the `isAlcoholic` control).
- Modify: the warehouse-stock detail view (discover: `grep -rl "WarehouseStock\|getWarehouseStock\|warehouseService" src/app/shared` then the component that lists stock rows) — show batches with expiry badges. Add a server endpoint + service method if none returns batches.

- [ ] **Step 1: Add the `tracksBatch` toggle to the product form**

Locate the `isAlcoholic` form control and add a sibling boolean control bound to `tracksBatch` (default the form value from the loaded product; for new products leave undefined so the server defaults it). Match the form library already in use (react-hook-form / controlled input) in that file.

- [ ] **Step 2: Add a batches read endpoint (server)**

In `server/services/warehouse.service.js`, add and export:
```javascript
async function getBatches({ warehouseId, subProduct, size }, tenantId) {
  const WarehouseBatch = require('../models/WarehouseBatch');
  const q = { tenant: tenantId };
  if (warehouseId) q.warehouse = warehouseId;
  if (subProduct) q.subProduct = subProduct;
  if (size) q.size = size;
  return WarehouseBatch.find(q).sort({ expiryDate: 1 }).lean();
}
```
Wire a GET route (mirror the existing warehouse stock route) and a client `warehouseService.getBatches(...)` method.

- [ ] **Step 3: Render batches with expiry badges**

In the warehouse-stock detail row, when expanded, list each batch: `batchNumber · qty · expiry` with a colored badge (red if past/`<30d`, amber if `<60d`, neutral otherwise) — compute client-side from `expiryDate`.

- [ ] **Step 4: Type-check**

Run: `cd client/apps/isomorphic && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add -A client/apps/isomorphic/src server/services/warehouse.service.js server/routes
git commit -m "feat(client): tracksBatch product toggle + batch list with expiry badges"
```

---

## Phase 7 — Final verification

### Task 23: Full verification gate

- [ ] **Step 1: Run the entire server test suite**

Run: `cd server && node --test __tests__/`
Expected: all tests PASS, exit code 0.

- [ ] **Step 2: Client type-check**

Run: `cd client/apps/isomorphic && npx tsc --noEmit`
Expected: only pre-existing `TS2688` errors (note them in the PR description).

- [ ] **Step 3: Smoke-load every changed/created server module**

Run:
```bash
cd server && node -e "
['./models/WarehouseBatch','./models/Order','./models/Product','./models/Tenant','./models/Notification','./services/batch.helpers','./services/batch.service','./services/warehouse.service','./services/poReceive.helpers','./jobs/expiryScan.job','./controllers/purchaseOrder.controller','./controllers/pos.controller'].forEach(m=>require(m));
console.log('all modules load OK');
"
```
Expected: prints `all modules load OK`.

- [ ] **Step 4: Confirm no stray commits of the unrelated stock-transfer work**

Run: `git log --oneline main..HEAD` and `git status --short`
Expected: commits are only the batch/expiry tasks; the stock-transfer files remain uncommitted in the working tree.

---

## Self-Review (completed during authoring)

- **Spec coverage:** tracksBatch gate (T6), batch grain/model (T5), batch-vs-expiry one-flag with optional expiry (T6/T13/T21), source-of-truth invariant (T5 + adjustStock/receive leaving slack), batch numbering auto+merge/reject (T3/T9/T10), FEFO + full traceability sell/refund/transfer/adjust (T2/T11/T12/T14–T17), node-cron trigger (T1/T19), one-live-deduped-refreshed alert + archive (T18), recipients owner/admin/staff (T18), tenant expiryWarningDays default 90 (T7) — all mapped.
- **Placeholder scan:** UI tasks (T21–T22) reference discover-by-grep for exact component paths because those files weren't read during planning; all server tasks use exact paths + complete code.
- **Type consistency:** allocation shape `{ batch, batchNumber, quantity, expiryDate }` is identical across `allocateFefo`, `depleteBatchesFefo`, `sellStock` return, `Order.batchAllocations`, and `restoreBatches` (which reads `{ batch, quantity }`). `tracksBatch` flag name is consistent across model, services, and helpers.
