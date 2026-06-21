# Sales Module — Backend Implementation Plan (Phases 1–4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the server-side `/sales` module — a `SalesOrder` model, pure fulfillment helpers, and the full quotation→order→confirm→fulfill→invoice→return API — as the sell-side mirror of the purchases module.

**Architecture:** Single `SalesOrder` model with two `docType`s (`quotation`|`order`), mirroring `PurchaseOrder`. Pure DB-less helpers (`salesFulfill.helpers.js`) carry the partial-fulfillment math with `postedQty` unposted-delta idempotency, exactly like `poReceive.helpers.js`. A controller + service + routes expose the lifecycle. Payment (tender + wallet + loyalty) is captured once at `confirm`; fulfillment moves stock via `adjustStock(type:'shipped')` and writes `Sales` rows.

**Tech Stack:** Express + Mongoose, `node:test` for unit tests, `mongodb-memory-server` for e2e (already used in repo).

## Global Constraints

- Money is **NGN integer** convention (no float cents). Copy from existing line-total math.
- **Tenant isolation** on every query and index — every find/update filters by `tenant: tenantId`.
- Stock moves **only** through `warehouseService.adjustStock({ warehouseId, subProduct, size, quantity, type, notes }, userId, tenantId)`; `type` ∈ `'received'|'shipped'|'adjusted'`. Outbound = `'shipped'` (decrements, clamped ≥0).
- `InventoryMovement.referenceType` enum = `['order','purchase_order','transfer','return','adjustment','audit','manual','']`. Sale movements use `'order'`; **returns use `'return'`** (never `'sales_order_return'` — not in enum).
- `Sales` rows for fulfillment use `channel: 'tenant_manual'`. Required Sales fields: `product, subproduct, size, quantity, priceAtSale, itemSubtotal, channel, tenant`.
- Wallet via `mutateWallet` (services/wallet.service.js), loyalty via `mutateLoyalty` (services/loyalty.service.js) — both with compensating reversal on downstream failure (the `createPOSOrder` discipline, pos.controller.js ~L1987).
- Tests run with: `NODE_PATH=server/node_modules node --test server/__tests__/`.
- Pricelist resolution bounded to tenant via `pricelist.service.resolveShopPricelist`.
- Pricing snapshot at line creation; re-price only on explicit `PUT` edit.

---

### Task 1: Pure fulfillment helpers (`salesFulfill.helpers.js`)

**Files:**
- Create: `server/services/salesFulfill.helpers.js`
- Test: `server/__tests__/salesFulfill.helpers.test.js`

**Interfaces:**
- Consumes: nothing (pure, DB-less).
- Produces:
  - `lineId(item) -> string|null`
  - `outstanding(line) -> number` (`max(0, quantity − fulfilledQty − returnedQty)`)
  - `applyFulfillment(soItems, fulfillLines, { allowOver=false }) -> { lines: [{ lineId, previousFulfilledQty, newFulfilledQty, delta }] }`
  - `fulfillStatus(soItems) -> 'fulfilled' | 'partially_fulfilled' | null`
  - `buildPostingLines(soItems) -> Array<{...item, qty: number}>` (qty = `fulfilledQty − postedQty`, only > 0)

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/salesFulfill.helpers.test.js`:

```js
// server/__tests__/salesFulfill.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  outstanding,
  applyFulfillment,
  fulfillStatus,
  buildPostingLines,
} = require('../services/salesFulfill.helpers');

const line = (over = {}) => ({
  _id: 'L1', quantity: 100, fulfilledQty: 0, postedQty: 0, returnedQty: 0, ...over,
});

test('outstanding subtracts fulfilled and returned, never below zero', () => {
  assert.strictEqual(outstanding(line()), 100);
  assert.strictEqual(outstanding(line({ fulfilledQty: 60 })), 40);
  assert.strictEqual(outstanding(line({ fulfilledQty: 100, returnedQty: 0 })), 0);
  assert.strictEqual(outstanding(line({ fulfilledQty: 60, returnedQty: 50 })), 0);
});

test('applyFulfillment accumulates and clamps to ordered quantity', () => {
  const items = [line({ fulfilledQty: 60 })];
  const { lines } = applyFulfillment(items, [{ lineId: 'L1', qty: 80 }]);
  assert.strictEqual(lines.length, 1);
  assert.deepStrictEqual(lines[0], {
    lineId: 'L1', previousFulfilledQty: 60, newFulfilledQty: 100, delta: 40,
  });
});

test('applyFulfillment allowOver permits exceeding ordered quantity', () => {
  const { lines } = applyFulfillment([line()], [{ lineId: 'L1', qty: 120 }], { allowOver: true });
  assert.strictEqual(lines[0].newFulfilledQty, 120);
  assert.strictEqual(lines[0].delta, 120);
});

test('applyFulfillment skips zero/negative and unknown lines', () => {
  const { lines } = applyFulfillment([line()], [
    { lineId: 'L1', qty: 0 }, { lineId: 'NOPE', qty: 5 },
  ]);
  assert.strictEqual(lines.length, 0);
});

test('fulfillStatus reflects partial vs full vs none', () => {
  assert.strictEqual(fulfillStatus([line()]), null);
  assert.strictEqual(fulfillStatus([line({ fulfilledQty: 50 })]), 'partially_fulfilled');
  assert.strictEqual(fulfillStatus([line({ fulfilledQty: 100 })]), 'fulfilled');
  assert.strictEqual(
    fulfillStatus([line({ fulfilledQty: 100 }), line({ _id: 'L2', fulfilledQty: 10 })]),
    'partially_fulfilled'
  );
});

test('buildPostingLines projects the unposted delta only', () => {
  const out = buildPostingLines([
    line({ fulfilledQty: 60, postedQty: 40 }),   // delta 20
    line({ _id: 'L2', fulfilledQty: 10, postedQty: 10 }), // delta 0 -> skipped
  ]);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].qty, 20);
  assert.strictEqual(out[0]._id, 'L1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/salesFulfill.helpers.test.js`
Expected: FAIL — `Cannot find module '../services/salesFulfill.helpers'`.

- [ ] **Step 3: Write the implementation**

Create `server/services/salesFulfill.helpers.js`:

```js
// server/services/salesFulfill.helpers.js
// Pure, DB-less fulfillment math — the sell-side analogue of poReceive.helpers.js.

/** Stable id for a SO line, whether a plain test object or a Mongoose subdoc. */
function lineId(item) {
  if (item.lineId != null) return String(item.lineId);
  if (item._id != null) return String(item._id);
  return null;
}

/**
 * Units still expected on a line: ordered minus shipped (fulfilledQty) minus
 * sent-back (returnedQty). Never below zero.
 */
function outstanding(line) {
  const ordered = line.quantity || 0;
  const fulfilled = line.fulfilledQty || 0;
  const returned = line.returnedQty || 0;
  return Math.max(0, ordered - fulfilled - returned);
}

/**
 * Accumulate one fulfillment onto the SO lines WITHOUT mutating them.
 * For each fulfill line, fulfilledQty accumulates (previous + this fulfillment),
 * clamped to the ordered quantity unless allowOver. `delta` is the accepted
 * increment for THIS fulfillment (what should post to stock).
 *
 * @param {Array} soItems    each with quantity, fulfilledQty, _id/lineId
 * @param {Array} fulfillLines  [{ lineId, qty }]
 * @param {{ allowOver?: boolean }} [opts]
 * @returns {{ lines: Array<{ lineId, previousFulfilledQty, newFulfilledQty, delta }> }}
 */
function applyFulfillment(soItems, fulfillLines, { allowOver = false } = {}) {
  const byId = new Map((soItems || []).map((it) => [lineId(it), it]));
  const lines = [];

  for (const fl of fulfillLines || []) {
    const add = Math.max(0, Number(fl.qty) || 0);
    if (add <= 0) continue;

    const item = byId.get(String(fl.lineId));
    if (!item) continue;

    const previousFulfilledQty = item.fulfilledQty || 0;
    let newFulfilledQty = previousFulfilledQty + add;
    if (!allowOver) {
      newFulfilledQty = Math.min(newFulfilledQty, item.quantity || 0);
    }
    const delta = newFulfilledQty - previousFulfilledQty;
    if (delta <= 0) continue;

    lines.push({ lineId: String(fl.lineId), previousFulfilledQty, newFulfilledQty, delta });
  }

  return { lines };
}

/**
 * Derived order status from its lines:
 *  - 'fulfilled'            every line fulfilledQty >= ordered quantity
 *  - 'partially_fulfilled' some (but not all) units shipped
 *  - null                  nothing shipped (caller keeps current status)
 */
function fulfillStatus(soItems) {
  const items = soItems || [];
  if (items.length === 0) return null;
  const allFull = items.every((it) => (it.fulfilledQty || 0) >= (it.quantity || 0));
  if (allFull) return 'fulfilled';
  const anyShipped = items.some((it) => (it.fulfilledQty || 0) > 0);
  if (anyShipped) return 'partially_fulfilled';
  return null;
}

/**
 * Project SO lines into those still needing to post to inventory, with qty set
 * to the UNPOSTED delta (fulfilledQty - postedQty). Makes repeated fulfill
 * posts idempotent.
 * @returns {Array} shallow clones with `qty` = delta; empty when nothing pending
 */
function buildPostingLines(soItems) {
  const out = [];
  for (const it of soItems || []) {
    const delta = (it.fulfilledQty || 0) - (it.postedQty || 0);
    if (delta <= 0) continue;
    out.push({ ...it, qty: delta });
  }
  return out;
}

module.exports = { lineId, outstanding, applyFulfillment, fulfillStatus, buildPostingLines };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/salesFulfill.helpers.test.js`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add server/services/salesFulfill.helpers.js server/__tests__/salesFulfill.helpers.test.js
git commit -m "feat(sales): pure fulfillment helpers (applyFulfillment/outstanding/buildPostingLines)"
```

---

### Task 2: `SalesOrder` model

**Files:**
- Create: `server/models/SalesOrder.js`
- Test: `server/__tests__/salesOrder.model.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: Mongoose model `SalesOrder` with the schema in the spec. Line subdocs expose `_id`, `quantity`, `unitPrice`, `discount`, `lineTotal`, `fulfilledQty`, `postedQty`, `returnedQty`. Top-level: `docType`, `quoteStatus`, `orderStatus`, `paymentStatus`, `amountPaid`, `fulfillments[]`, `relatedSales[]`, `convertedFrom`, `convertedTo`.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/salesOrder.model.test.js`:

```js
// server/__tests__/salesOrder.model.test.js
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const SalesOrder = require('../models/SalesOrder');

const oid = () => new mongoose.Types.ObjectId();

test('SalesOrder defaults: quote/order statuses undefined, qty trackers zero', () => {
  const so = new SalesOrder({
    tenant: oid(), soNumber: 'SO-1', docType: 'order',
    items: [{ product: oid(), subproduct: oid(), size: oid(), quantity: 5, unitPrice: 1000, lineTotal: 5000 }],
    subtotal: 5000, total: 5000,
  });
  assert.strictEqual(so.items[0].fulfilledQty, 0);
  assert.strictEqual(so.items[0].postedQty, 0);
  assert.strictEqual(so.items[0].returnedQty, 0);
  assert.strictEqual(so.paymentStatus, 'unpaid');
  assert.strictEqual(so.currency, 'NGN');
});

test('SalesOrder requires tenant, soNumber, docType', () => {
  const so = new SalesOrder({});
  const err = so.validateSync();
  assert.ok(err.errors.tenant);
  assert.ok(err.errors.soNumber);
  assert.ok(err.errors.docType);
});

test('SalesOrder rejects an out-of-enum docType', () => {
  const so = new SalesOrder({ tenant: oid(), soNumber: 'SO-2', docType: 'invoice' });
  const err = so.validateSync();
  assert.ok(err.errors.docType);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/salesOrder.model.test.js`
Expected: FAIL — `Cannot find module '../models/SalesOrder'`.

- [ ] **Step 3: Write the implementation**

Create `server/models/SalesOrder.js`:

```js
// models/SalesOrder.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const lineSchema = new Schema({
  product:    { type: ObjectId, ref: 'Product' },
  subproduct: { type: ObjectId, ref: 'SubProduct' },
  size:       { type: ObjectId, ref: 'Size' },
  sku:        { type: String, trim: true },
  name:       { type: String, trim: true },
  quantity:    { type: Number, required: true, min: 1 },
  unitPrice:   { type: Number, required: true, min: 0 }, // snapshot at line creation
  discount:    { type: Number, default: 0, min: 0 },
  lineTotal:   { type: Number, required: true, min: 0 },
  fulfilledQty: { type: Number, default: 0, min: 0 },
  postedQty:    { type: Number, default: 0, min: 0 },
  returnedQty:  { type: Number, default: 0, min: 0 },
});

const fulfillmentSchema = new Schema({
  warehouseId: { type: ObjectId, ref: 'Warehouse' },
  items: [{
    lineId:      { type: String },
    qty:         { type: Number },
    batchNumber: { type: String },
    expiryDate:  { type: Date },
  }],
  status: { type: String, default: 'posted' },
  at:     { type: Date, default: Date.now },
  by:     { type: ObjectId },
}, { _id: true });

const SalesOrderSchema = new Schema(
  {
    tenant:   { type: ObjectId, ref: 'Tenant', required: true, index: true },
    soNumber: { type: String, required: true, trim: true },
    docType:  { type: String, enum: ['quotation', 'order'], required: true },

    customer: { type: ObjectId, ref: 'POSCustomer', sparse: true },
    customerSnapshot: {
      name: String, phone: String, email: String,
      customerId: { type: ObjectId, ref: 'POSCustomer' },
    },
    pricelist: { type: ObjectId, ref: 'Pricelist', default: null },
    appliedPricelist: { pricelistId: { type: ObjectId, ref: 'Pricelist' }, pricelistName: String },
    currency: { type: String, default: 'NGN', enum: ['NGN', 'USD', 'EUR', 'GBP'] },

    items: [lineSchema],
    subtotal:      { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    total:         { type: Number, default: 0 },

    // Quotation lifecycle (only when docType === 'quotation')
    quoteStatus: {
      type: String,
      enum: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'],
      default: undefined,
    },
    validUntil: { type: Date },

    // Order lifecycle (only when docType === 'order')
    orderStatus: {
      type: String,
      enum: ['draft', 'confirmed', 'partially_fulfilled', 'fulfilled', 'cancelled'],
      default: undefined,
    },

    // Payment — captured once at confirm, full total
    paymentMethod: { type: String },
    paymentStatus: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
    amountPaid:    { type: Number, default: 0 },
    walletTxRef:   { type: ObjectId, ref: 'WalletTransaction', sparse: true },
    loyaltyEarned: { type: Number, default: 0 },

    fulfillments: [fulfillmentSchema],

    convertedFrom:  { type: ObjectId, ref: 'SalesOrder' },
    convertedTo:    { type: ObjectId, ref: 'SalesOrder' },
    relatedInvoice: { type: ObjectId, sparse: true },
    relatedSales:   [{ type: ObjectId, ref: 'Sales' }],

    notes: { type: String, maxlength: 2000 },
    terms: { type: String, maxlength: 2000 },
  },
  { timestamps: true }
);

SalesOrderSchema.index({ tenant: 1, docType: 1, quoteStatus: 1 });
SalesOrderSchema.index({ tenant: 1, orderStatus: 1 });
SalesOrderSchema.index({ tenant: 1, createdAt: -1 });
SalesOrderSchema.index({ tenant: 1, soNumber: 1 }, { unique: true });

module.exports = mongoose.models.SalesOrder || mongoose.model('SalesOrder', SalesOrderSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/salesOrder.model.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/models/SalesOrder.js server/__tests__/salesOrder.model.test.js
git commit -m "feat(sales): SalesOrder model (two-docType, fulfilledQty/postedQty/returnedQty)"
```

---

### Task 3: Number generator + service scaffold + routes mount

**Files:**
- Modify: `server/utils/orderUtils.js` (add `generateSalesOrderNumber`)
- Create: `server/services/salesOrder.service.js`
- Create: `server/controllers/salesOrder.controller.js` (stub `getSalesOrders`, `getSalesOrder`, `createSalesOrder`)
- Create: `server/routes/salesOrder.routes.js`
- Modify: `server/server.js` (mount `/api/sales-orders`)
- Test: `server/__tests__/salesOrder.api.test.js` (e2e harness scaffold — list returns empty)

**Interfaces:**
- Consumes: `SalesOrder` model (Task 2).
- Produces:
  - `generateSalesOrderNumber() -> Promise<string>` (e.g. `SO-000001`)
  - `salesOrder.service.createSalesOrderDoc({ tenantId, body }) -> Promise<SalesOrder>`
  - Controller exports: `createSalesOrder, getSalesOrders, getSalesOrder, updateSalesOrder, deleteSalesOrder` (later tasks add lifecycle handlers)
  - Route base `/api/sales-orders` behind `protect, attachTenant`.

- [ ] **Step 1: Write the failing test (e2e scaffold)**

Look at `server/__tests__/salesOrder.api.test.js` model in an existing e2e test that boots an in-memory app. Search for one: `grep -rl "mongodb-memory-server" server/__tests__`. Mirror its bootstrap (app import, supertest, tenant seed). Create:

```js
// server/__tests__/salesOrder.api.test.js
const test = require('node:test');
const assert = require('node:assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;
test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});
test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test('generateSalesOrderNumber produces an SO- prefixed unique string', async () => {
  const { generateSalesOrderNumber } = require('../utils/orderUtils');
  const a = await generateSalesOrderNumber();
  const b = await generateSalesOrderNumber();
  assert.match(a, /^SO-/);
  assert.notStrictEqual(a, b);
});

test('createSalesOrderDoc persists a tenant-scoped order with snapshot totals', async () => {
  const svc = require('../services/salesOrder.service');
  const oid = () => new mongoose.Types.ObjectId();
  const tenantId = oid();
  const so = await svc.createSalesOrderDoc({
    tenantId,
    body: {
      docType: 'order',
      items: [{ product: oid(), subproduct: oid(), size: oid(), quantity: 4, unitPrice: 2500, discount: 0 }],
    },
  });
  assert.strictEqual(String(so.tenant), String(tenantId));
  assert.strictEqual(so.items[0].lineTotal, 10000);
  assert.strictEqual(so.total, 10000);
  assert.strictEqual(so.orderStatus, 'draft');
  assert.match(so.soNumber, /^SO-/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/salesOrder.api.test.js`
Expected: FAIL — `generateSalesOrderNumber` / service not found.

- [ ] **Step 3a: Add the number generator**

In `server/utils/orderUtils.js`, follow the existing `generateOrderNumber` pattern (read it first to copy the counter mechanism — it likely uses a Counter collection or count+pad). Add a parallel `generateSalesOrderNumber` with prefix `SO-` and zero-padded sequence, and export it.

```js
// in server/utils/orderUtils.js — mirror generateOrderNumber's counter approach
async function generateSalesOrderNumber() {
  // Replace the body with the SAME mechanism generateOrderNumber uses,
  // swapping the prefix to 'SO-'. Example with a simple count fallback:
  const SalesOrder = require('../models/SalesOrder');
  const n = await SalesOrder.estimatedDocumentCount();
  return `SO-${String(n + 1).padStart(6, '0')}`;
}
// add generateSalesOrderNumber to module.exports
```

- [ ] **Step 3b: Write the service**

Create `server/services/salesOrder.service.js`:

```js
// server/services/salesOrder.service.js
const SalesOrder = require('../models/SalesOrder');
const { generateSalesOrderNumber } = require('../utils/orderUtils');

/** Compute a single line's total: (unitPrice - discount) * quantity, floored at 0. */
function lineTotalOf(item) {
  const unit = Math.max(0, (Number(item.unitPrice) || 0) - (Number(item.discount) || 0));
  return unit * (Number(item.quantity) || 0);
}

/** Roll item lineTotals into subtotal/discountTotal/total (NGN integer). */
function computeTotals(items) {
  let subtotal = 0, discountTotal = 0;
  for (const it of items) {
    subtotal += (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0);
    discountTotal += (Number(it.discount) || 0) * (Number(it.quantity) || 0);
  }
  return { subtotal, discountTotal, total: Math.max(0, subtotal - discountTotal) };
}

/**
 * Build + persist a SalesOrder. Snapshots line totals and order totals.
 * docType 'quotation' starts quoteStatus='draft'; 'order' starts orderStatus='draft'.
 */
async function createSalesOrderDoc({ tenantId, body }) {
  const docType = body.docType === 'quotation' ? 'quotation' : 'order';
  const items = (body.items || []).map((it) => ({
    product: it.product, subproduct: it.subproduct, size: it.size,
    sku: it.sku, name: it.name,
    quantity: Number(it.quantity) || 0,
    unitPrice: Number(it.unitPrice) || 0,
    discount: Number(it.discount) || 0,
    lineTotal: lineTotalOf(it),
  }));
  const totals = computeTotals(items);
  const soNumber = await generateSalesOrderNumber();

  return SalesOrder.create({
    tenant: tenantId,
    soNumber,
    docType,
    customer: body.customer || undefined,
    customerSnapshot: body.customerSnapshot || undefined,
    pricelist: body.pricelist || null,
    appliedPricelist: body.appliedPricelist || undefined,
    currency: body.currency || 'NGN',
    items,
    ...totals,
    validUntil: body.validUntil || undefined,
    notes: body.notes, terms: body.terms,
    ...(docType === 'quotation' ? { quoteStatus: 'draft' } : { orderStatus: 'draft' }),
  });
}

module.exports = { lineTotalOf, computeTotals, createSalesOrderDoc };
```

- [ ] **Step 3c: Write the controller stubs**

Create `server/controllers/salesOrder.controller.js`:

```js
// server/controllers/salesOrder.controller.js
const asyncHandler = require('express-async-handler'); // confirm the repo's asyncHandler import path from purchaseOrder.controller.js
const SalesOrder = require('../models/SalesOrder');
const svc = require('../services/salesOrder.service');

exports.createSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const so = await svc.createSalesOrderDoc({ tenantId, body: req.body });
  res.status(201).json({ success: true, data: so });
});

exports.getSalesOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const { docType, status, customer } = req.query;
  const q = { tenant: tenantId };
  if (docType) q.docType = docType;
  if (customer) q.customer = customer;
  if (status && docType === 'quotation') q.quoteStatus = status;
  if (status && docType === 'order') q.orderStatus = status;
  const data = await SalesOrder.find(q).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data });
});

exports.getSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId });
  if (!so) return res.status(404).json({ success: false, message: 'Sales order not found' });
  res.json({ success: true, data: so });
});

exports.updateSalesOrder = asyncHandler(async (req, res) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' }); // Task 4
});

exports.deleteSalesOrder = asyncHandler(async (req, res) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' }); // Task 4
});
```

> Before writing, open `server/controllers/purchaseOrder.controller.js` head and copy its exact `asyncHandler` import line (the repo may use a local util rather than `express-async-handler`). Use whatever it uses.

- [ ] **Step 3d: Write the routes + mount**

Create `server/routes/salesOrder.routes.js`:

```js
// routes/salesOrder.routes.js
const express = require('express');
const router = express.Router();
const {
  createSalesOrder, getSalesOrders, getSalesOrder, updateSalesOrder, deleteSalesOrder,
} = require('../controllers/salesOrder.controller');
const { protect, attachTenant } = require('../middleware/auth.middleware');

router.use(protect, attachTenant);

router.route('/').get(getSalesOrders).post(createSalesOrder);
router.route('/:id').get(getSalesOrder).put(updateSalesOrder).delete(deleteSalesOrder);

module.exports = router;
```

In `server/server.js`: add `const salesOrderRoutes = require('./routes/salesOrder.routes');` near the other route requires (~L35) and `app.use('/api/sales-orders', salesOrderRoutes);` near the other `app.use('/api/...')` mounts (~L171).

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/salesOrder.api.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/utils/orderUtils.js server/services/salesOrder.service.js \
        server/controllers/salesOrder.controller.js server/routes/salesOrder.routes.js \
        server/server.js server/__tests__/salesOrder.api.test.js
git commit -m "feat(sales): SO number generator, create/list/get service + routes mounted at /api/sales-orders"
```

---

### Task 4: Edit + cancel with status guards

**Files:**
- Modify: `server/controllers/salesOrder.controller.js` (`updateSalesOrder`, `deleteSalesOrder`)
- Modify: `server/services/salesOrder.service.js` (add `repriceLines`, `canEdit`, `canCancel`)
- Test: `server/__tests__/salesOrder.guards.test.js`

**Interfaces:**
- Consumes: `createSalesOrderDoc`, `computeTotals`, `lineTotalOf` (Task 3).
- Produces:
  - `canEdit(so) -> boolean` (quotation: `quoteStatus ∈ {draft,sent}`; order: `orderStatus === 'draft'`)
  - `canCancel(so) -> boolean` (not `fulfilled`, not `converted`, not already `cancelled`)
  - `applyEdit(so, body) -> void` (mutates items + recomputes totals; only when `canEdit`)

- [ ] **Step 1: Write the failing test**

```js
// server/__tests__/salesOrder.guards.test.js
const test = require('node:test');
const assert = require('node:assert');
const { canEdit, canCancel, applyEdit } = require('../services/salesOrder.service');

test('canEdit: quotation editable in draft/sent only', () => {
  assert.strictEqual(canEdit({ docType: 'quotation', quoteStatus: 'draft' }), true);
  assert.strictEqual(canEdit({ docType: 'quotation', quoteStatus: 'sent' }), true);
  assert.strictEqual(canEdit({ docType: 'quotation', quoteStatus: 'accepted' }), false);
  assert.strictEqual(canEdit({ docType: 'quotation', quoteStatus: 'converted' }), false);
});

test('canEdit: order editable in draft only', () => {
  assert.strictEqual(canEdit({ docType: 'order', orderStatus: 'draft' }), true);
  assert.strictEqual(canEdit({ docType: 'order', orderStatus: 'confirmed' }), false);
});

test('canCancel blocks fulfilled/converted/cancelled', () => {
  assert.strictEqual(canCancel({ docType: 'order', orderStatus: 'confirmed' }), true);
  assert.strictEqual(canCancel({ docType: 'order', orderStatus: 'fulfilled' }), false);
  assert.strictEqual(canCancel({ docType: 'quotation', quoteStatus: 'converted' }), false);
  assert.strictEqual(canCancel({ docType: 'order', orderStatus: 'cancelled' }), false);
});

test('applyEdit replaces lines and recomputes totals', () => {
  const so = { items: [], subtotal: 0, total: 0 };
  applyEdit(so, { items: [{ product: 'p', subproduct: 's', size: 'z', quantity: 2, unitPrice: 1500, discount: 100 }] });
  assert.strictEqual(so.items[0].lineTotal, 2800); // (1500-100)*2
  assert.strictEqual(so.total, 2800);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/salesOrder.guards.test.js`
Expected: FAIL — `canEdit` not exported.

- [ ] **Step 3: Add guards + applyEdit to the service**

Append to `server/services/salesOrder.service.js` (before `module.exports`, then add names to exports):

```js
function canEdit(so) {
  if (so.docType === 'quotation') return ['draft', 'sent'].includes(so.quoteStatus);
  return so.orderStatus === 'draft';
}

function canCancel(so) {
  if (so.docType === 'quotation') return !['converted', 'rejected'].includes(so.quoteStatus);
  return !['fulfilled', 'cancelled'].includes(so.orderStatus);
}

/** Re-snapshot line prices + totals from an edit body. Mutates `so` in place. */
function applyEdit(so, body) {
  if (Array.isArray(body.items)) {
    so.items = body.items.map((it) => ({
      product: it.product, subproduct: it.subproduct, size: it.size,
      sku: it.sku, name: it.name,
      quantity: Number(it.quantity) || 0,
      unitPrice: Number(it.unitPrice) || 0,
      discount: Number(it.discount) || 0,
      lineTotal: lineTotalOf(it),
    }));
    const totals = computeTotals(so.items);
    so.subtotal = totals.subtotal;
    so.discountTotal = totals.discountTotal;
    so.total = totals.total;
  }
  if (body.notes !== undefined) so.notes = body.notes;
  if (body.terms !== undefined) so.terms = body.terms;
  if (body.validUntil !== undefined) so.validUntil = body.validUntil;
}
```

Update exports: `module.exports = { lineTotalOf, computeTotals, createSalesOrderDoc, canEdit, canCancel, applyEdit };`

- [ ] **Step 4a: Wire the controller handlers**

Replace the `updateSalesOrder` and `deleteSalesOrder` stubs:

```js
exports.updateSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId });
  if (!so) return res.status(404).json({ success: false, message: 'Sales order not found' });
  if (!svc.canEdit(so)) {
    return res.status(409).json({ success: false, message: 'This document can no longer be edited' });
  }
  svc.applyEdit(so, req.body);
  await so.save();
  res.json({ success: true, data: so });
});

exports.deleteSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId });
  if (!so) return res.status(404).json({ success: false, message: 'Sales order not found' });
  if (!svc.canCancel(so)) {
    return res.status(409).json({ success: false, message: 'This document cannot be cancelled' });
  }
  if (so.docType === 'order') so.orderStatus = 'cancelled';
  else so.quoteStatus = 'rejected';
  await so.save();
  res.json({ success: true, data: so });
});
```

- [ ] **Step 4b: Run tests to verify they pass**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/salesOrder.guards.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/salesOrder.service.js server/controllers/salesOrder.controller.js server/__tests__/salesOrder.guards.test.js
git commit -m "feat(sales): edit re-pricing + cancel with status guards (canEdit/canCancel)"
```

---

### Task 5: Quotation lifecycle — send / accept / reject / expire / convert

**Files:**
- Modify: `server/controllers/salesOrder.controller.js` (add `sendQuotation`, `acceptQuotation`, `rejectQuotation`, `convertQuotation`)
- Modify: `server/services/salesOrder.service.js` (add `convertQuotationToOrder`)
- Modify: `server/routes/salesOrder.routes.js` (add lifecycle routes)
- Test: `server/__tests__/salesOrder.quotation.test.js`

**Interfaces:**
- Consumes: `SalesOrder` model, `generateSalesOrderNumber`.
- Produces:
  - `convertQuotationToOrder(quotation) -> Promise<SalesOrder>` — creates a new `docType:'order'` doc copying items (resetting `fulfilledQty/postedQty/returnedQty` to 0) + totals + pricing snapshot, sets `convertedFrom`, and stamps the quotation `quoteStatus='converted'` + `convertedTo`.
  - Routes: `POST /:id/send`, `/:id/accept`, `/:id/reject`, `/:id/convert`.

- [ ] **Step 1: Write the failing test**

```js
// server/__tests__/salesOrder.quotation.test.js
const test = require('node:test');
const assert = require('node:assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const SalesOrder = require('../models/SalesOrder');
const svc = require('../services/salesOrder.service');

let mongod;
test.before(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
test.after(async () => { await mongoose.disconnect(); await mongod.stop(); });

const oid = () => new mongoose.Types.ObjectId();

test('convertQuotationToOrder copies lines, links both ways, marks quote converted', async () => {
  const tenantId = oid();
  const quote = await svc.createSalesOrderDoc({
    tenantId,
    body: { docType: 'quotation', items: [
      { product: oid(), subproduct: oid(), size: oid(), quantity: 10, unitPrice: 500, discount: 0 },
    ] },
  });
  const order = await svc.convertQuotationToOrder(quote);

  assert.strictEqual(order.docType, 'order');
  assert.strictEqual(order.orderStatus, 'draft');
  assert.strictEqual(order.items[0].quantity, 10);
  assert.strictEqual(order.items[0].fulfilledQty, 0);
  assert.strictEqual(order.total, 5000);
  assert.strictEqual(String(order.convertedFrom), String(quote._id));

  const refreshed = await SalesOrder.findById(quote._id);
  assert.strictEqual(refreshed.quoteStatus, 'converted');
  assert.strictEqual(String(refreshed.convertedTo), String(order._id));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/salesOrder.quotation.test.js`
Expected: FAIL — `convertQuotationToOrder` not exported.

- [ ] **Step 3a: Add `convertQuotationToOrder` to the service**

```js
async function convertQuotationToOrder(quotation) {
  const soNumber = await generateSalesOrderNumber();
  const order = await SalesOrder.create({
    tenant: quotation.tenant,
    soNumber,
    docType: 'order',
    customer: quotation.customer,
    customerSnapshot: quotation.customerSnapshot,
    pricelist: quotation.pricelist,
    appliedPricelist: quotation.appliedPricelist,
    currency: quotation.currency,
    items: quotation.items.map((it) => ({
      product: it.product, subproduct: it.subproduct, size: it.size,
      sku: it.sku, name: it.name,
      quantity: it.quantity, unitPrice: it.unitPrice, discount: it.discount,
      lineTotal: it.lineTotal,
      fulfilledQty: 0, postedQty: 0, returnedQty: 0,
    })),
    subtotal: quotation.subtotal, discountTotal: quotation.discountTotal, total: quotation.total,
    notes: quotation.notes, terms: quotation.terms,
    orderStatus: 'draft',
    convertedFrom: quotation._id,
  });
  quotation.quoteStatus = 'converted';
  quotation.convertedTo = order._id;
  await quotation.save();
  return order;
}
```

Add `convertQuotationToOrder` to `module.exports`.

- [ ] **Step 3b: Add the controller lifecycle handlers**

```js
// Helper: load a quotation scoped to tenant, 404 if missing/not a quotation
async function loadQuotation(req, res) {
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: req.tenant?._id });
  if (!so || so.docType !== 'quotation') {
    res.status(404).json({ success: false, message: 'Quotation not found' });
    return null;
  }
  return so;
}

exports.sendQuotation = asyncHandler(async (req, res) => {
  const so = await loadQuotation(req, res); if (!so) return;
  if (so.quoteStatus !== 'draft') return res.status(409).json({ success: false, message: 'Only a draft quotation can be sent' });
  so.quoteStatus = 'sent'; await so.save();
  res.json({ success: true, data: so });
});

exports.acceptQuotation = asyncHandler(async (req, res) => {
  const so = await loadQuotation(req, res); if (!so) return;
  if (so.quoteStatus !== 'sent') return res.status(409).json({ success: false, message: 'Only a sent quotation can be accepted' });
  so.quoteStatus = 'accepted'; await so.save();
  res.json({ success: true, data: so });
});

exports.rejectQuotation = asyncHandler(async (req, res) => {
  const so = await loadQuotation(req, res); if (!so) return;
  if (!['sent', 'draft'].includes(so.quoteStatus)) return res.status(409).json({ success: false, message: 'Quotation cannot be rejected' });
  so.quoteStatus = 'rejected'; await so.save();
  res.json({ success: true, data: so });
});

exports.convertQuotation = asyncHandler(async (req, res) => {
  const so = await loadQuotation(req, res); if (!so) return;
  if (['converted', 'rejected', 'expired'].includes(so.quoteStatus)) {
    return res.status(409).json({ success: false, message: 'Quotation cannot be converted' });
  }
  const order = await svc.convertQuotationToOrder(so);
  res.status(201).json({ success: true, data: order });
});
```

- [ ] **Step 3c: Add routes**

In `server/routes/salesOrder.routes.js`, after the `/:id` route, add (and import the new handlers):

```js
const {
  sendQuotation, acceptQuotation, rejectQuotation, convertQuotation,
} = require('../controllers/salesOrder.controller');

router.post('/:id/send', sendQuotation);
router.post('/:id/accept', acceptQuotation);
router.post('/:id/reject', rejectQuotation);
router.post('/:id/convert', convertQuotation);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/salesOrder.quotation.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/salesOrder.service.js server/controllers/salesOrder.controller.js \
        server/routes/salesOrder.routes.js server/__tests__/salesOrder.quotation.test.js
git commit -m "feat(sales): quotation lifecycle (send/accept/reject) + convert-to-order"
```

---

### Task 6: Order confirm — capture payment (tender + wallet + loyalty)

**Files:**
- Create: `server/services/salesPayment.service.js` (capture orchestration with rollback)
- Modify: `server/controllers/salesOrder.controller.js` (`confirmSalesOrder`)
- Modify: `server/routes/salesOrder.routes.js` (`POST /:id/confirm`)
- Test: `server/__tests__/salesPayment.service.test.js`

**Interfaces:**
- Consumes: `mutateWallet` (services/wallet.service.js), `mutateLoyalty` (services/loyalty.service.js), `loyaltyDelta` (services/contact.helpers.js), `SalesOrder`, `POSCustomer`.
- Produces:
  - `capturePayment({ salesOrder, tenantId, paymentMethod, amountTendered, splitPayments, userId, posSettings, deps }) -> Promise<{ ok, status?, message?, walletTx?, loyaltyEarned }>` where `deps = { mutateWallet, mutateLoyalty }` (injected so the unit test can stub them). Charges wallet for `salesOrder.total` when `paymentMethod==='wallet'`; computes + applies loyalty earn on the paid amount. Returns `ok:false` with an HTTP-ish `status` (404/409) on wallet failure WITHOUT mutating the order.

> First read `createPOSOrder` in `server/controllers/pos.controller.js` (~L1987–L2500) to copy the exact `mutateWallet` owner shape (`{ Model: POSCustomer, ownerType, ownerId, filter }`) and the loyalty-earn computation. Reuse those verbatim.

- [ ] **Step 1: Write the failing test**

```js
// server/__tests__/salesPayment.service.test.js
const test = require('node:test');
const assert = require('node:assert');
const { capturePayment } = require('../services/salesPayment.service');

const baseOrder = () => ({ _id: 'so1', tenant: 't1', total: 10000, customer: 'c1', customerSnapshot: { customerId: 'c1' } });

test('wallet failure returns ok:false and does not mark paid', async () => {
  const deps = {
    mutateWallet: async () => ({ ok: false, status: 409, message: 'Insufficient balance' }),
    mutateLoyalty: async () => ({ ok: true }),
  };
  const result = await capturePayment({
    salesOrder: baseOrder(), tenantId: 't1', paymentMethod: 'wallet', userId: 'u1',
    posSettings: {}, deps,
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, 409);
});

test('cash payment succeeds and computes loyalty earn on paid amount', async () => {
  let loyaltyArgs = null;
  const deps = {
    mutateWallet: async () => ({ ok: true, tx: { _id: 'wtx' } }),
    mutateLoyalty: async (a) => { loyaltyArgs = a; return { ok: true }; },
  };
  const result = await capturePayment({
    salesOrder: baseOrder(), tenantId: 't1', paymentMethod: 'cash', amountTendered: 10000,
    userId: 'u1', posSettings: { loyaltyEnabled: true, loyaltyPointsPerNaira: 0.01 }, deps,
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.loyaltyEarned, 100); // 10000 * 0.01
  assert.ok(loyaltyArgs, 'loyalty was credited');
});

test('cash payment with loyalty disabled earns zero and skips mutateLoyalty', async () => {
  let called = false;
  const deps = {
    mutateWallet: async () => ({ ok: true }),
    mutateLoyalty: async () => { called = true; return { ok: true }; },
  };
  const result = await capturePayment({
    salesOrder: baseOrder(), tenantId: 't1', paymentMethod: 'cash', amountTendered: 10000,
    userId: 'u1', posSettings: { loyaltyEnabled: false }, deps,
  });
  assert.strictEqual(result.loyaltyEarned, 0);
  assert.strictEqual(called, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/salesPayment.service.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3a: Write the payment service**

Create `server/services/salesPayment.service.js`:

```js
// server/services/salesPayment.service.js
const POSCustomer = require('../models/POSCustomer');

/** Loyalty points earned for a paid amount, per tenant POS settings. */
function computeLoyaltyEarned(amount, posSettings) {
  if (!posSettings?.loyaltyEnabled) return 0;
  const rate = Number(posSettings.loyaltyPointsPerNaira) || 0;
  if (rate <= 0) return 0;
  return Math.floor(amount * rate);
}

/**
 * Capture payment for the FULL order total at confirm. Wallet tender is charged
 * via mutateWallet (atomic, guarded); on failure returns ok:false WITHOUT
 * mutating the order. Loyalty is earned on the paid amount. Wallet/loyalty deps
 * are injected for testability.
 */
async function capturePayment({
  salesOrder, tenantId, paymentMethod, amountTendered = 0, splitPayments = [],
  userId, posSettings = {},
  deps = {},
}) {
  const mutateWallet = deps.mutateWallet || require('./wallet.service').mutateWallet;
  const mutateLoyalty = deps.mutateLoyalty || require('./loyalty.service').mutateLoyalty;
  const total = Number(salesOrder.total) || 0;
  const customerId = salesOrder.customer || salesOrder.customerSnapshot?.customerId || null;

  let walletTx = null;
  if (paymentMethod === 'wallet' && total > 0) {
    if (!customerId) return { ok: false, status: 400, message: 'Wallet payment requires a saved customer' };
    const walletResult = await mutateWallet({
      owner: { Model: POSCustomer, ownerType: 'POSCustomer', ownerId: customerId, filter: { _id: customerId, tenant: tenantId } },
      tenantId,
      value: { type: 'debit', amount: total, reason: `Sales order — ${salesOrder.soNumber || salesOrder._id}` },
      reference: String(salesOrder.soNumber || salesOrder._id),
      createdBy: userId,
    });
    if (!walletResult.ok) {
      return { ok: false, status: walletResult.status === 404 ? 404 : 409, message: walletResult.message };
    }
    walletTx = walletResult.tx || null;
  }

  // Loyalty earn on the paid amount (best-effort; a loyalty failure does not
  // reverse the payment — points can be reconciled, money has changed hands).
  let loyaltyEarned = 0;
  if (customerId) {
    loyaltyEarned = computeLoyaltyEarned(total, posSettings);
    if (loyaltyEarned > 0) {
      try {
        await mutateLoyalty({
          owner: { Model: POSCustomer, ownerType: 'POSCustomer', ownerId: customerId, filter: { _id: customerId, tenant: tenantId } },
          tenantId,
          value: { type: 'earn', points: loyaltyEarned, reason: `Sales order — ${salesOrder.soNumber || salesOrder._id}` },
          reference: String(salesOrder.soNumber || salesOrder._id),
          createdBy: userId,
        });
      } catch (_) { /* non-fatal */ }
    }
  }

  return { ok: true, walletTx, loyaltyEarned };
}

module.exports = { computeLoyaltyEarned, capturePayment };
```

> The `mutateLoyalty` `value` shape (`{ type:'earn', points }`) and `mutateWallet` shape MUST match the real signatures. Open both services and `createPOSOrder`'s loyalty call to confirm field names before finalizing; adjust if they differ.

- [ ] **Step 3b: Wire `confirmSalesOrder` controller**

```js
const salesPayment = require('../services/salesPayment.service');

exports.confirmSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId, docType: 'order' });
  if (!so) return res.status(404).json({ success: false, message: 'Order not found' });
  if (so.orderStatus !== 'draft') return res.status(409).json({ success: false, message: 'Only a draft order can be confirmed' });

  const { paymentMethod, amountTendered, splitPayments } = req.body;
  if (!paymentMethod) return res.status(400).json({ success: false, message: 'Payment method required' });

  const result = await salesPayment.capturePayment({
    salesOrder: so, tenantId, paymentMethod, amountTendered, splitPayments,
    userId: req.user?._id || req.posUser?._id,
    posSettings: req.tenant?.posSettings || {},
  });
  if (!result.ok) return res.status(result.status || 409).json({ success: false, message: result.message });

  so.orderStatus = 'confirmed';
  so.paymentMethod = paymentMethod;
  so.paymentStatus = 'paid';
  so.amountPaid = so.total;
  so.walletTxRef = result.walletTx?._id || undefined;
  so.loyaltyEarned = result.loyaltyEarned || 0;
  await so.save();
  res.json({ success: true, data: so });
});
```

Add route: `router.post('/:id/confirm', confirmSalesOrder);` (and import it).

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/salesPayment.service.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/salesPayment.service.js server/controllers/salesOrder.controller.js \
        server/routes/salesOrder.routes.js server/__tests__/salesPayment.service.test.js
git commit -m "feat(sales): confirm order captures payment (wallet tender + loyalty earn, rollback-safe)"
```

---

### Task 7: Order fulfill — post shipped stock + write Sales rows

**Files:**
- Modify: `server/services/salesFulfill.helpers.js` (add impure `postShippedStock`)
- Create: `server/services/salesFulfill.service.js` (orchestrate fulfill: apply → post → Sales rows → status)
- Modify: `server/controllers/salesOrder.controller.js` (`fulfillSalesOrder`)
- Modify: `server/routes/salesOrder.routes.js` (`POST /:id/fulfill`)
- Test: `server/__tests__/salesFulfill.post.test.js`

**Interfaces:**
- Consumes: `applyFulfillment`, `buildPostingLines`, `fulfillStatus` (Task 1); `warehouseService.adjustStock`; `Sales` model.
- Produces:
  - `postShippedStock({ salesOrder, targetWarehouseId, postingLines, adjustStock, userId, tenantId, logger }) -> Promise<{ successCount, failCount, failures }>` — posts each posting line via `adjustStock(type:'shipped')`.
  - `fulfillOrder({ salesOrder, tenantId, warehouseId, fulfillLines, userId, deps }) -> Promise<{ order, salesRows, posting }>` where `deps = { adjustStock, SalesModel }`. Mutates `fulfilledQty`/`postedQty`, appends a `fulfillments[]` entry, writes `Sales` rows for the delta, sets `orderStatus`.

- [ ] **Step 1: Write the failing test**

```js
// server/__tests__/salesFulfill.post.test.js
const test = require('node:test');
const assert = require('node:assert');
const { postShippedStock } = require('../services/salesFulfill.helpers');
const { fulfillOrder } = require('../services/salesFulfill.service');

test('postShippedStock decrements each posting line once via adjustStock(shipped)', async () => {
  const calls = [];
  const adjustStock = async (args) => { calls.push(args); return { currentQuantity: 40 }; };
  const so = { soNumber: 'SO-1', _id: 'so1' };
  const postingLines = [
    { subproduct: 'sp1', size: 'sz1', product: 'p1', qty: 60 },
  ];
  const out = await postShippedStock({
    salesOrder: so, targetWarehouseId: 'wh1', postingLines, adjustStock,
    userId: 'u1', tenantId: 't1', logger: { error() {}, log() {} },
  });
  assert.strictEqual(out.successCount, 1);
  assert.strictEqual(calls[0].type, 'shipped');
  assert.strictEqual(calls[0].quantity, 60);
  assert.strictEqual(String(calls[0].warehouseId), 'wh1');
});

test('fulfillOrder posts only the unposted delta and advances postedQty/fulfilledQty', async () => {
  const adjusted = [];
  const so = {
    soNumber: 'SO-2', _id: 'so2', tenant: 't1',
    items: [{ _id: 'L1', product: 'p1', subproduct: 'sp1', size: 'sz1', quantity: 100, unitPrice: 500, discount: 0, fulfilledQty: 0, postedQty: 0, returnedQty: 0 }],
    fulfillments: [],
    save: async function () { return this; },
  };
  const SalesModel = { create: async (rows) => rows };
  const deps = {
    adjustStock: async (a) => { adjusted.push(a); return { currentQuantity: 0 }; },
    SalesModel,
  };
  // First fulfillment: 60
  await fulfillOrder({ salesOrder: so, tenantId: 't1', warehouseId: 'wh1', fulfillLines: [{ lineId: 'L1', qty: 60 }], userId: 'u1', deps });
  assert.strictEqual(so.items[0].fulfilledQty, 60);
  assert.strictEqual(so.items[0].postedQty, 60);
  assert.strictEqual(so.orderStatus, 'partially_fulfilled');
  assert.strictEqual(adjusted[0].quantity, 60);

  // Second fulfillment: 40 -> posts only 40, total stock decrement = 100
  await fulfillOrder({ salesOrder: so, tenantId: 't1', warehouseId: 'wh1', fulfillLines: [{ lineId: 'L1', qty: 40 }], userId: 'u1', deps });
  assert.strictEqual(so.items[0].fulfilledQty, 100);
  assert.strictEqual(so.items[0].postedQty, 100);
  assert.strictEqual(so.orderStatus, 'fulfilled');
  const totalShipped = adjusted.reduce((s, a) => s + a.quantity, 0);
  assert.strictEqual(totalShipped, 100);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/salesFulfill.post.test.js`
Expected: FAIL — `postShippedStock` / `fulfillOrder` not found.

- [ ] **Step 3a: Add `postShippedStock` to the helpers**

Append to `server/services/salesFulfill.helpers.js` (and add to exports):

```js
/**
 * Post each shipped posting line OUT of the target warehouse via the injected
 * adjustStock(type:'shipped'). A line missing subproduct/size is surfaced as a
 * failure, not silently dropped.
 * @returns {Promise<{ successCount, failCount, failures: Array<{name, reason}> }>}
 */
async function postShippedStock({
  salesOrder, targetWarehouseId, postingLines, adjustStock, userId, tenantId, logger = console,
}) {
  let successCount = 0, failCount = 0;
  const failures = [];
  const label = (l) => l.name || l.sku || String(l.subproduct || 'unknown item');

  for (const line of postingLines || []) {
    const qty = Number(line.qty) || 0;
    if (qty <= 0) continue;
    if (!line.subproduct || !line.size) {
      failures.push({ name: label(line), reason: 'missing subproduct/size to ship from' });
      failCount++; continue;
    }
    try {
      await adjustStock(
        { warehouseId: targetWarehouseId, subProduct: line.subproduct, size: line.size,
          quantity: qty, type: 'shipped', notes: `Sales fulfillment: ${salesOrder.soNumber}` },
        userId, tenantId
      );
      successCount++;
    } catch (err) {
      logger.error(`   ❌ ${label(line)} — ${err.message}`);
      failures.push({ name: label(line), reason: err.message });
      failCount++;
    }
  }
  return { successCount, failCount, failures };
}
```

- [ ] **Step 3b: Write the fulfill service**

Create `server/services/salesFulfill.service.js`:

```js
// server/services/salesFulfill.service.js
const { applyFulfillment, buildPostingLines, fulfillStatus, postShippedStock } = require('./salesFulfill.helpers');

/**
 * Apply one additive fulfillment to an order:
 *  1. applyFulfillment -> per-line deltas (clamped to outstanding)
 *  2. advance fulfilledQty on the lines
 *  3. post the UNPOSTED delta to stock (adjustStock type:'shipped'); advance postedQty
 *  4. write Sales rows for the shipped delta (channel: 'tenant_manual')
 *  5. append a fulfillments[] entry + recompute orderStatus
 * deps = { adjustStock, SalesModel }
 */
async function fulfillOrder({ salesOrder, tenantId, warehouseId, fulfillLines, userId, deps }) {
  const adjustStock = deps.adjustStock || require('./warehouse.service').adjustStock;
  const SalesModel = deps.SalesModel || require('../models/Sales');

  // 1 + 2: accumulate fulfilledQty
  const { lines } = applyFulfillment(salesOrder.items, fulfillLines);
  if (lines.length === 0) {
    return { order: salesOrder, salesRows: [], posting: { successCount: 0, failCount: 0, failures: [] } };
  }
  const byId = new Map(salesOrder.items.map((it) => [String(it._id), it]));
  for (const l of lines) {
    const item = byId.get(String(l.lineId));
    if (item) item.fulfilledQty = l.newFulfilledQty;
  }

  // 3: post unposted delta to stock
  const postingLines = buildPostingLines(salesOrder.items);
  const posting = await postShippedStock({
    salesOrder, targetWarehouseId: warehouseId, postingLines, adjustStock, userId, tenantId,
  });
  // advance postedQty for the lines we just posted (only the successfully-posted set)
  for (const pl of postingLines) {
    const item = byId.get(String(pl._id));
    if (item) item.postedQty = item.fulfilledQty;
  }

  // 4: write Sales rows for the shipped delta
  const salesRows = [];
  for (const pl of postingLines) {
    const item = byId.get(String(pl._id));
    if (!item) continue;
    const qty = pl.qty;
    const priceAtSale = Math.max(0, (item.unitPrice || 0) - (item.discount || 0));
    const row = await SalesModel.create({
      tenant: tenantId,
      product: item.product, subproduct: item.subproduct, size: item.size,
      quantity: qty, priceAtSale, itemSubtotal: priceAtSale * qty,
      channel: 'tenant_manual', channelDetail: `Sales order ${salesOrder.soNumber}`,
    });
    salesRows.push(row._id || row);
  }
  if (!Array.isArray(salesOrder.relatedSales)) salesOrder.relatedSales = [];
  salesOrder.relatedSales.push(...salesRows);

  // 5: fulfillment entry + status
  salesOrder.fulfillments.push({
    warehouseId,
    items: postingLines.map((pl) => ({ lineId: String(pl._id), qty: pl.qty })),
    status: 'posted', at: new Date(), by: userId,
  });
  const status = fulfillStatus(salesOrder.items);
  if (status) salesOrder.orderStatus = status;

  await salesOrder.save();
  return { order: salesOrder, salesRows, posting };
}

module.exports = { fulfillOrder };
```

- [ ] **Step 3c: Wire `fulfillSalesOrder` controller**

```js
const salesFulfillSvc = require('../services/salesFulfill.service');

exports.fulfillSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId, docType: 'order' });
  if (!so) return res.status(404).json({ success: false, message: 'Order not found' });
  if (!['confirmed', 'partially_fulfilled'].includes(so.orderStatus)) {
    return res.status(409).json({ success: false, message: 'Only a confirmed order can be fulfilled' });
  }
  const { warehouseId, items: fulfillLines } = req.body;
  if (!warehouseId) return res.status(400).json({ success: false, message: 'Destination warehouse required' });

  const { order, posting } = await salesFulfillSvc.fulfillOrder({
    salesOrder: so, tenantId, warehouseId, fulfillLines: fulfillLines || [],
    userId: req.user?._id || req.posUser?._id, deps: {},
  });
  res.json({ success: true, data: order, posting });
});
```

Add route: `router.post('/:id/fulfill', fulfillSalesOrder);` (and import).

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/salesFulfill.post.test.js`
Expected: PASS — total shipped across both fulfillments is exactly 100.

- [ ] **Step 5: Commit**

```bash
git add server/services/salesFulfill.helpers.js server/services/salesFulfill.service.js \
        server/controllers/salesOrder.controller.js server/routes/salesOrder.routes.js \
        server/__tests__/salesFulfill.post.test.js
git commit -m "feat(sales): additive order fulfillment — shipped stock posting + Sales rows + status"
```

---

### Task 8: Sales return — restock + ledger reversal

**Files:**
- Modify: `server/services/salesFulfill.service.js` (add `returnOrder`)
- Modify: `server/controllers/salesOrder.controller.js` (`returnSalesOrder`)
- Modify: `server/routes/salesOrder.routes.js` (`POST /:id/return`)
- Test: `server/__tests__/salesReturn.test.js`

**Interfaces:**
- Consumes: `warehouseService.adjustStock` (type `'received'` to restock); `InventoryMovement` (referenceType `'return'`); `outstanding` is NOT used here (returns operate on fulfilled units).
- Produces: `returnOrder({ salesOrder, tenantId, warehouseId, returnLines, userId, deps }) -> Promise<{ order, restock }>` — for each return line, restock via `adjustStock(type:'received')`, advance `returnedQty` (clamped ≤ `fulfilledQty`), record an `InventoryMovement` with `referenceType:'return'`.

- [ ] **Step 1: Write the failing test**

```js
// server/__tests__/salesReturn.test.js
const test = require('node:test');
const assert = require('node:assert');
const { returnOrder } = require('../services/salesFulfill.service');

test('returnOrder restocks via adjustStock(received) and advances returnedQty', async () => {
  const restocked = [];
  const so = {
    soNumber: 'SO-9', _id: 'so9', tenant: 't1', orderStatus: 'fulfilled',
    items: [{ _id: 'L1', product: 'p1', subproduct: 'sp1', size: 'sz1', quantity: 100, fulfilledQty: 100, postedQty: 100, returnedQty: 0 }],
    save: async function () { return this; },
  };
  const deps = {
    adjustStock: async (a) => { restocked.push(a); return { currentQuantity: 30 }; },
    recordMovement: async () => {},
  };
  await returnOrder({ salesOrder: so, tenantId: 't1', warehouseId: 'wh1', returnLines: [{ lineId: 'L1', qty: 30 }], userId: 'u1', deps });

  assert.strictEqual(so.items[0].returnedQty, 30);
  assert.strictEqual(restocked[0].type, 'received');
  assert.strictEqual(restocked[0].quantity, 30);
});

test('returnOrder clamps a return to the fulfilled quantity', async () => {
  const so = {
    soNumber: 'SO-10', _id: 'so10', tenant: 't1', orderStatus: 'fulfilled',
    items: [{ _id: 'L1', product: 'p1', subproduct: 'sp1', size: 'sz1', quantity: 100, fulfilledQty: 40, postedQty: 40, returnedQty: 0 }],
    save: async function () { return this; },
  };
  const deps = { adjustStock: async () => ({ currentQuantity: 0 }), recordMovement: async () => {} };
  await returnOrder({ salesOrder: so, tenantId: 't1', warehouseId: 'wh1', returnLines: [{ lineId: 'L1', qty: 999 }], userId: 'u1', deps });
  assert.strictEqual(so.items[0].returnedQty, 40);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/salesReturn.test.js`
Expected: FAIL — `returnOrder` not exported.

- [ ] **Step 3a: Add `returnOrder` to the fulfill service**

```js
const { fulfillStatus: _fulfillStatus } = require('./salesFulfill.helpers');

/**
 * Restock returned units and reverse the ledger. returnedQty advances (clamped to
 * fulfilledQty). Stock goes back via adjustStock(type:'received'); an
 * InventoryMovement is recorded with referenceType:'return' (valid enum member).
 * deps = { adjustStock, recordMovement }
 */
async function returnOrder({ salesOrder, tenantId, warehouseId, returnLines, userId, deps }) {
  const adjustStock = deps.adjustStock || require('./warehouse.service').adjustStock;
  const recordMovement = deps.recordMovement || null;

  const byId = new Map(salesOrder.items.map((it) => [String(it._id), it]));
  const restock = { successCount: 0, failures: [] };

  for (const rl of returnLines || []) {
    const item = byId.get(String(rl.lineId));
    if (!item) continue;
    const maxReturnable = (item.fulfilledQty || 0) - (item.returnedQty || 0);
    const qty = Math.min(Math.max(0, Number(rl.qty) || 0), maxReturnable);
    if (qty <= 0) continue;

    try {
      const row = await adjustStock(
        { warehouseId, subProduct: item.subproduct, size: item.size, quantity: qty,
          type: 'received', notes: `Sales return: ${salesOrder.soNumber}` },
        userId, tenantId
      );
      item.returnedQty = (item.returnedQty || 0) + qty;
      restock.successCount++;

      if (recordMovement) {
        try {
          await recordMovement({
            subProduct: item.subproduct, tenant: tenantId, product: item.product, size: item.size,
            warehouse: warehouseId, quantity: qty,
            balanceAfter: row && Number.isFinite(row.currentQuantity) ? row.currentQuantity : undefined,
            reference: salesOrder.soNumber, referenceType: 'return', performedBy: userId,
          });
        } catch (_) { /* history non-fatal */ }
      }
    } catch (err) {
      restock.failures.push({ lineId: String(rl.lineId), reason: err.message });
    }
  }

  // If everything fulfilled has now been returned, the order is back to confirmed
  // (no outstanding shipment); otherwise keep current status.
  await salesOrder.save();
  return { order: salesOrder, restock };
}
```

Add `returnOrder` to `module.exports` of `salesFulfill.service.js`.

- [ ] **Step 3b: Wire `returnSalesOrder` controller**

```js
exports.returnSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId, docType: 'order' });
  if (!so) return res.status(404).json({ success: false, message: 'Order not found' });
  if (!['partially_fulfilled', 'fulfilled'].includes(so.orderStatus)) {
    return res.status(409).json({ success: false, message: 'Only a fulfilled order can be returned' });
  }
  const { warehouseId, items: returnLines } = req.body;
  if (!warehouseId) return res.status(400).json({ success: false, message: 'Restock warehouse required' });

  const recordMovement = require('../services/warehouse.service').recordMovement
    || (require('../models/InventoryMovement') && (async (m) => require('../models/InventoryMovement').create(m)));
  const { order, restock } = await salesFulfillSvc.returnOrder({
    salesOrder: so, tenantId, warehouseId, returnLines: returnLines || [],
    userId: req.user?._id || req.posUser?._id, deps: { recordMovement },
  });
  res.json({ success: true, data: order, restock });
});
```

> Confirm how PO returns record their movement (`returnPurchaseOrder` in purchaseOrder.controller.js ~L1778) and reuse the same `recordMovement` helper/shape — but with `referenceType: 'return'`.

Add route: `router.post('/:id/return', returnSalesOrder);` (and import).

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/salesReturn.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/salesFulfill.service.js server/controllers/salesOrder.controller.js \
        server/routes/salesOrder.routes.js server/__tests__/salesReturn.test.js
git commit -m "feat(sales): sales return — restock + ledger reversal (referenceType:'return')"
```

---

### Task 9: End-to-end lifecycle on ephemeral mongod

**Files:**
- Test: `server/__tests__/salesOrder.e2e.test.js`

**Interfaces:**
- Consumes: all services above + `SalesOrder`, `Sales`, and a stubbed/in-memory warehouse path. Use the service layer directly (`createSalesOrderDoc`, `convertQuotationToOrder`, `capturePayment`, `fulfillOrder`, `returnOrder`) with injected `deps` so the test does not need a fully seeded warehouse — assert stock-call accounting via a recording `adjustStock` stub, and assert real `Sales` rows + status transitions against the in-memory DB.

- [ ] **Step 1: Write the e2e test**

```js
// server/__tests__/salesOrder.e2e.test.js
const test = require('node:test');
const assert = require('node:assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const SalesOrder = require('../models/SalesOrder');
const Sales = require('../models/Sales');
const svc = require('../services/salesOrder.service');
const { fulfillOrder, returnOrder } = require('../services/salesFulfill.service');
const { capturePayment } = require('../services/salesPayment.service');

let mongod;
test.before(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
test.after(async () => { await mongoose.disconnect(); await mongod.stop(); });

const oid = () => new mongoose.Types.ObjectId();

test('quotation -> convert -> confirm -> fulfill 60 -> fulfill 40 -> return 20: ledgers consistent', async () => {
  const tenantId = oid();
  const product = oid(), subproduct = oid(), size = oid();

  // 1. quotation
  const quote = await svc.createSalesOrderDoc({
    tenantId,
    body: { docType: 'quotation', items: [{ product, subproduct, size, quantity: 100, unitPrice: 500, discount: 0 }] },
  });
  assert.strictEqual(quote.total, 50000);

  // 2. convert -> order
  const order = await svc.convertQuotationToOrder(quote);
  assert.strictEqual(order.orderStatus, 'draft');

  // 3. confirm (cash; no wallet/loyalty customer)
  const pay = await capturePayment({
    salesOrder: order, tenantId, paymentMethod: 'cash', amountTendered: 50000, userId: oid(),
    posSettings: {}, deps: { mutateWallet: async () => ({ ok: true }), mutateLoyalty: async () => ({ ok: true }) },
  });
  assert.strictEqual(pay.ok, true);
  order.orderStatus = 'confirmed'; order.paymentStatus = 'paid'; order.amountPaid = order.total;
  await order.save();

  // 4 + 5. fulfill 60 then 40 with a recording adjustStock
  const shipped = [];
  const deps = { adjustStock: async (a) => { shipped.push(a.quantity * (a.type === 'shipped' ? 1 : -1)); return { currentQuantity: 0 }; }, SalesModel: Sales };

  await fulfillOrder({ salesOrder: order, tenantId, warehouseId: oid(), fulfillLines: [{ lineId: String(order.items[0]._id), qty: 60 }], userId: oid(), deps });
  assert.strictEqual(order.orderStatus, 'partially_fulfilled');

  await fulfillOrder({ salesOrder: order, tenantId, warehouseId: oid(), fulfillLines: [{ lineId: String(order.items[0]._id), qty: 40 }], userId: oid(), deps });
  assert.strictEqual(order.orderStatus, 'fulfilled');

  // exactly 100 units shipped, never double-posted
  assert.strictEqual(shipped.reduce((s, n) => s + n, 0), 100);

  // Sales rows: two rows (60 + 40), summing to 100 units of revenue
  const rows = await Sales.find({ tenant: tenantId, channel: 'tenant_manual' }).lean();
  assert.strictEqual(rows.reduce((s, r) => s + r.quantity, 0), 100);
  assert.strictEqual(order.relatedSales.length, 2);

  // 6. return 20 -> restock; net shipped = 80
  await returnOrder({
    salesOrder: order, tenantId, warehouseId: oid(), returnLines: [{ lineId: String(order.items[0]._id), qty: 20 }], userId: oid(),
    deps: { adjustStock: async (a) => { shipped.push(a.quantity * (a.type === 'shipped' ? 1 : -1)); return { currentQuantity: 0 }; }, recordMovement: async () => {} },
  });
  assert.strictEqual(order.items[0].returnedQty, 20);
  assert.strictEqual(shipped.reduce((s, n) => s + n, 0), 80); // 100 shipped - 20 restocked
});
```

- [ ] **Step 2: Run test to verify it fails (then passes)**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/salesOrder.e2e.test.js`
Expected: PASS (all services already implemented in Tasks 1–8). If it fails, the failure pinpoints the integration gap to fix.

- [ ] **Step 3: Run the FULL server suite — no regressions**

Run: `NODE_PATH=server/node_modules node --test server/__tests__/`
Expected: all suites green, including the pre-existing ones.

- [ ] **Step 4: Commit**

```bash
git add server/__tests__/salesOrder.e2e.test.js
git commit -m "test(sales): e2e quotation->convert->confirm->partial fulfill x2->return on ephemeral mongod"
```

---

## Deferred to a later plan

- **Invoice endpoint** (`POST /:id/invoice`): the spec calls for reusing the
  invoice module. Before implementing, read `shared/invoice/*` and the existing
  invoice render/data path to decide whether sales orders generate an `Invoice`
  document or render a PDF on the fly. Folded into the client plan (phase 5),
  where the invoice UI is wired up.
- **Phase 5 client UI** (`shared/sales/*` + `(hydrogen)/sales/*`): its own plan.
- **Split-payment detail capture** at confirm: v1 records `paymentMethod` and
  marks `paid`; itemized split tender persistence can follow if needed.

## Self-review notes (verify during execution)

- `asyncHandler` import: copy the exact line from `purchaseOrder.controller.js`
  (may be a local util, not `express-async-handler`).
- `mutateWallet` / `mutateLoyalty` `value` shapes: confirm against
  `createPOSOrder` and the service signatures before finalizing Task 6.
- `generateSalesOrderNumber`: mirror `generateOrderNumber`'s real counter
  mechanism in `orderUtils.js` (don't rely on `estimatedDocumentCount` if the
  repo uses an atomic Counter — copy the existing approach for uniqueness).
- Auth middleware names (`protect`, `attachTenant`): confirm against
  `purchaseOrder.routes.js` (it imports `protect, attachTenant,
  tenantAdminOrSuperAdmin` from `../middleware/auth.middleware`).
