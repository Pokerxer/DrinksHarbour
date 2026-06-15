# POS Shop ↔ Warehouse Binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin bind each `posSettings.shops` entry to a `Warehouse`, so that when a cashier selects that shop the POS product list and stock deduction/restoration are scoped to that warehouse's `WarehouseStock` rows — while shops with no bound warehouse (including the built-in RETAIL/WHOLESALE) keep today's tenant-wide aggregate behavior unchanged.

**Architecture:**
- **Data model** — two small additive schema fields (`Tenant.posSettings.shops[].warehouse`, `Order.items[].warehouse`) plus a new `'returned'` value in `WarehouseMovement.type`'s enum.
- **New atomic stock helpers** — `sellStock`/`returnStock` in `server/services/warehouse.service.js`, doing guarded `findOneAndUpdate` on `WarehouseStock`, writing a `WarehouseMovement`, and calling the existing `recalcSubProductStock`.
- **Server warehouse branches** — `deductStock`, `restoreStock`, `getPOSProducts`, `createPOSOrder`, `refundPOSOrder`, and `voidPOSOrder` in `pos.controller.js` each gain a `warehouseId`-gated branch. When `warehouseId` is falsy, every existing code path is untouched byte-for-byte.
- **Client** — a new persisted `usePOSActiveShop()` atom drives a functional `ShopSelector`; `shopId` is threaded into `getProducts`/`createOrder`; admin settings UI gets a warehouse `<select>` per shop.

**Tech Stack:** Node/Express + Mongoose (server), Next.js App Router + React + Jotai (client). Server logic is verified with Node's built-in `node:test` runner (using `t.mock.method()` on Mongoose model statics) plus `require()` parse smoke-checks. Client correctness is verified with `npx tsc --noEmit` (baseline: pre-existing `TS2688` global-typedef errors — every task must add **zero** new errors). Run all server commands from the repo root (`/Users/mac/Documents/drinksharbour`); run all client commands from `client/apps/isomorphic`.

---

## Task 1: Data model — warehouse fields on Tenant shops, Order items, WarehouseMovement enum

**Files:**
- Modify: `server/models/Tenant.js` (~line 395, `posSettings.shops` subschema)
- Modify: `server/models/Order.js` (~line 96, end of `orderItemSchema`)
- Modify: `server/models/WarehouseMovement.js` (~line 9, `type` enum)

- [ ] **Step 1: Add `warehouse` to the `posSettings.shops` subschema**

In `server/models/Tenant.js`, change:

```js
  shops: [{
    name:        { type: String, required: true, trim: true },
    mode:        { type: String, enum: ['retail', 'wholesale'], default: 'retail' },
    color:       { type: String, default: '#b20202' },
    description: { type: String, default: '' },
    active:      { type: Boolean, default: true },
    createdAt:   { type: Date, default: Date.now },
  }],
```

to:

```js
  shops: [{
    name:        { type: String, required: true, trim: true },
    mode:        { type: String, enum: ['retail', 'wholesale'], default: 'retail' },
    color:       { type: String, default: '#b20202' },
    description: { type: String, default: '' },
    active:      { type: Boolean, default: true },
    createdAt:   { type: Date, default: Date.now },
    warehouse:   { type: ObjectId, ref: 'Warehouse', default: null },
  }],
```

(`Tenant.js` already has `const { ObjectId } = Schema;` at line 4 — no new import needed.)

- [ ] **Step 2: Add `warehouse` to `orderItemSchema`**

In `server/models/Order.js`, change the end of `orderItemSchema`:

```js
  revenueRateAtPurchase: {
    type: Number,
    default: 0,
  },
}, { _id: false });
```

to:

```js
  revenueRateAtPurchase: {
    type: Number,
    default: 0,
  },
  warehouse: { type: ObjectId, ref: 'Warehouse', required: false },
}, { _id: false });
```

(`Order.js` already has `const { ObjectId } = Schema;` at line 4 — no new import needed.)

- [ ] **Step 3: Add `'returned'` to `WarehouseMovement.type` enum**

In `server/models/WarehouseMovement.js`, change:

```js
    type: {
      type: String,
      enum: ['received', 'adjusted', 'shipped', 'transfer_in', 'transfer_out'],
```

to:

```js
    type: {
      type: String,
      enum: ['received', 'adjusted', 'shipped', 'transfer_in', 'transfer_out', 'returned'],
```

- [ ] **Step 4: Smoke-check all three models parse and register cleanly**

Run:
```bash
cd server && node -e "require('./models/Tenant'); require('./models/Order'); require('./models/WarehouseMovement'); console.log('OK')"
```
Expected: `OK` printed, no errors.

- [ ] **Step 5: Commit**

```bash
git add server/models/Tenant.js server/models/Order.js server/models/WarehouseMovement.js
git commit -m "feat(server): add warehouse fields to shop/order-item schemas, returned movement type"
```

---

## Task 2: Atomic `sellStock`/`returnStock` helpers in `warehouse.service.js`

**Files:**
- Create: `server/__tests__/warehouse.service.sellReturn.test.js`
- Modify: `server/services/warehouse.service.js`

- [ ] **Step 1: Write the failing test file**

Create `server/__tests__/warehouse.service.sellReturn.test.js`:

```js
// server/__tests__/warehouse.service.sellReturn.test.js
const test = require('node:test');
const assert = require('node:assert');
const WarehouseStock = require('../models/WarehouseStock');
const WarehouseMovement = require('../models/WarehouseMovement');
const SubProduct = require('../models/SubProduct');
const { sellStock, returnStock } = require('../services/warehouse.service');

const TENANT_ID     = 'tenant1';
const USER_ID       = 'user1';
const WAREHOUSE_ID  = 'wh1';
const SUBPRODUCT_ID = 'sp1';
const SIZE_ID       = 'size1';

// recalcSubProductStock(subProduct) calls WarehouseStock.find(...).select(...).lean()
// and SubProduct.updateOne(...) — stub both so it no-ops during these tests.
function mockRecalc(t) {
  t.mock.method(WarehouseStock, 'find', () => ({
    select: () => ({ lean: async () => [] }),
  }));
  t.mock.method(SubProduct, 'updateOne', () => Promise.resolve({}));
}

test('sellStock decrements stock and records a shipped movement', async (t) => {
  mockRecalc(t);
  const movements = [];
  t.mock.method(WarehouseMovement, 'create', async (doc) => { movements.push(doc); return doc; });
  t.mock.method(WarehouseStock, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepStrictEqual(filter, {
      tenant: TENANT_ID, warehouse: WAREHOUSE_ID, subProduct: SUBPRODUCT_ID, size: SIZE_ID,
      currentQuantity: { $gte: 5 },
    });
    assert.deepStrictEqual(update, { $inc: { currentQuantity: -5 } });
    assert.strictEqual(options.new, true);
    return { currentQuantity: 15 };
  });

  const result = await sellStock(
    { warehouseId: WAREHOUSE_ID, subProduct: SUBPRODUCT_ID, size: SIZE_ID, quantity: 5 },
    USER_ID, TENANT_ID
  );

  assert.deepStrictEqual(result, { before: 20, after: 15 });
  assert.strictEqual(movements.length, 1);
  assert.strictEqual(movements[0].type, 'shipped');
  assert.strictEqual(movements[0].quantity, 5);
  assert.strictEqual(movements[0].balanceAfter, 15);
});

test('sellStock throws when stock is insufficient and overselling is disallowed', async (t) => {
  mockRecalc(t);
  const movements = [];
  t.mock.method(WarehouseMovement, 'create', async (doc) => { movements.push(doc); return doc; });
  t.mock.method(WarehouseStock, 'findOneAndUpdate', async () => null);

  await assert.rejects(
    () => sellStock(
      { warehouseId: WAREHOUSE_ID, subProduct: SUBPRODUCT_ID, size: SIZE_ID, quantity: 5 },
      USER_ID, TENANT_ID
    ),
    /insufficient/i
  );
  assert.strictEqual(movements.length, 0);
});

test('sellStock allows negative stock when allowOverselling is true', async (t) => {
  mockRecalc(t);
  const movements = [];
  t.mock.method(WarehouseMovement, 'create', async (doc) => { movements.push(doc); return doc; });
  t.mock.method(WarehouseStock, 'findOneAndUpdate', async (filter, update, options) => {
    assert.strictEqual(filter.currentQuantity, undefined);
    assert.strictEqual(options.upsert, true);
    assert.strictEqual(options.setDefaultsOnInsert, true);
    return { currentQuantity: -2 };
  });

  const result = await sellStock(
    { warehouseId: WAREHOUSE_ID, subProduct: SUBPRODUCT_ID, size: SIZE_ID, quantity: 5, allowOverselling: true },
    USER_ID, TENANT_ID
  );

  assert.deepStrictEqual(result, { before: 3, after: -2 });
  assert.strictEqual(movements.length, 1);
});

test('returnStock upserts a missing row and records a returned movement', async (t) => {
  mockRecalc(t);
  const movements = [];
  t.mock.method(WarehouseMovement, 'create', async (doc) => { movements.push(doc); return doc; });
  t.mock.method(WarehouseStock, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepStrictEqual(filter, {
      tenant: TENANT_ID, warehouse: WAREHOUSE_ID, subProduct: SUBPRODUCT_ID, size: SIZE_ID,
    });
    assert.deepStrictEqual(update, { $inc: { currentQuantity: 5 } });
    assert.strictEqual(options.upsert, true);
    assert.strictEqual(options.setDefaultsOnInsert, true);
    return { currentQuantity: 5 };
  });

  const result = await returnStock(
    { warehouseId: WAREHOUSE_ID, subProduct: SUBPRODUCT_ID, size: SIZE_ID, quantity: 5 },
    USER_ID, TENANT_ID
  );

  assert.deepStrictEqual(result, { before: 0, after: 5 });
  assert.strictEqual(movements.length, 1);
  assert.strictEqual(movements[0].type, 'returned');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
node --test server/__tests__/warehouse.service.sellReturn.test.js
```
Expected: FAIL — `sellStock`/`returnStock` are `undefined` (not yet exported), e.g. `TypeError: sellStock is not a function`.

- [ ] **Step 3: Implement `sellStock` and `returnStock`**

In `server/services/warehouse.service.js`, add these two functions after `getStockByWarehouse` (after line 196, before `module.exports`):

```js
/**
 * Atomically decrement a (warehouse, subProduct, size) row for a POS/online sale.
 * Guarded by currentQuantity >= quantity unless allowOverselling is true.
 * Returns { before, after } currentQuantity values for InventoryMovement audit.
 */
async function sellStock({ warehouseId, subProduct, size, quantity, allowOverselling = false }, userId, tenantId) {
  if (!(quantity > 0)) throw new ValidationError('Quantity must be positive');

  const filter = { tenant: tenantId, warehouse: warehouseId, subProduct, size };
  const update = { $inc: { currentQuantity: -quantity } };

  let row;
  if (allowOverselling) {
    row = await WarehouseStock.findOneAndUpdate(filter, update, {
      new: true, upsert: true, setDefaultsOnInsert: true,
    });
  } else {
    row = await WarehouseStock.findOneAndUpdate(
      { ...filter, currentQuantity: { $gte: quantity } },
      update,
      { new: true }
    );
    if (!row) throw new ValidationError('Insufficient stock in this warehouse');
  }

  const after  = row.currentQuantity;
  const before = after + quantity;

  await WarehouseMovement.create({
    tenant: tenantId, warehouse: warehouseId, subProduct, size,
    type: 'shipped', quantity, balanceAfter: after, performedBy: userId,
  });
  await recalcSubProductStock(subProduct);

  return { before, after };
}

/**
 * Atomically increment a (warehouse, subProduct, size) row for a POS refund/void.
 * Upserts the row if it doesn't exist (e.g. first-ever return for that line).
 * Returns { before, after } currentQuantity values for InventoryMovement audit.
 */
async function returnStock({ warehouseId, subProduct, size, quantity }, userId, tenantId) {
  if (!(quantity > 0)) throw new ValidationError('Quantity must be positive');

  const row = await WarehouseStock.findOneAndUpdate(
    { tenant: tenantId, warehouse: warehouseId, subProduct, size },
    { $inc: { currentQuantity: quantity } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const after  = row.currentQuantity;
  const before = after - quantity;

  await WarehouseMovement.create({
    tenant: tenantId, warehouse: warehouseId, subProduct, size,
    type: 'returned', quantity, balanceAfter: after, performedBy: userId,
  });
  await recalcSubProductStock(subProduct);

  return { before, after };
}
```

Then update `module.exports` (currently):

```js
module.exports = {
  createWarehouse, getWarehouses, getWarehouseById, updateWarehouse, deleteWarehouse,
  getWarehouseStock, adjustStock, transferStock, getStockByWarehouse,
};
```

to:

```js
module.exports = {
  createWarehouse, getWarehouses, getWarehouseById, updateWarehouse, deleteWarehouse,
  getWarehouseStock, adjustStock, transferStock, getStockByWarehouse,
  sellStock, returnStock,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
node --test server/__tests__/warehouse.service.sellReturn.test.js
```
Expected: PASS — `tests 4`, `pass 4`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add server/services/warehouse.service.js server/__tests__/warehouse.service.sellReturn.test.js
git commit -m "feat(server): add atomic sellStock/returnStock warehouse helpers"
```

---

## Task 3: Server shop CRUD — imports, warehouse validation, populate

**Files:**
- Modify: `server/controllers/pos.controller.js` (imports ~line 9-13, `getPOSSettings` ~1077, `listPOSShops` ~1451, `createPOSShop` ~1458, `updatePOSShop` ~1478)

- [ ] **Step 1: Add new imports**

In `server/controllers/pos.controller.js`, change:

```js
const Tenant = require('../models/Tenant');
const Size            = require('../models/Size');
const SubProduct      = require('../models/SubProduct');
const InventoryMovement = require('../models/InventoryMovement');
const inventoryService = require('../services/inventory.service');
```

to:

```js
const Tenant = require('../models/Tenant');
const Size            = require('../models/Size');
const SubProduct      = require('../models/SubProduct');
const Warehouse       = require('../models/Warehouse');
const WarehouseStock  = require('../models/WarehouseStock');
const { sellStock, returnStock } = require('../services/warehouse.service');
const InventoryMovement = require('../models/InventoryMovement');
const inventoryService = require('../services/inventory.service');
```

- [ ] **Step 2: Populate `warehouse` in `getPOSSettings`**

Change:

```js
exports.getPOSSettings = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.tenant?._id).select('posSettings');
  res.json({ success: true, data: { posSettings: tenant?.posSettings || {} } });
});
```

to:

```js
exports.getPOSSettings = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.tenant?._id)
    .select('posSettings')
    .populate('posSettings.shops.warehouse', 'name code');
  res.json({ success: true, data: { posSettings: tenant?.posSettings || {} } });
});
```

- [ ] **Step 3: Populate `warehouse` in `listPOSShops`**

Change:

```js
exports.listPOSShops = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant;
  const tenant = await Tenant.findById(tenantId).select('posSettings.shops');
  const shops = (tenant?.posSettings?.shops || []).filter(s => s.active !== false);
  res.json({ success: true, data: { shops } });
});
```

to:

```js
exports.listPOSShops = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant;
  const tenant = await Tenant.findById(tenantId)
    .select('posSettings.shops')
    .populate('posSettings.shops.warehouse', 'name code');
  const shops = (tenant?.posSettings?.shops || []).filter(s => s.active !== false);
  res.json({ success: true, data: { shops } });
});
```

- [ ] **Step 4: Accept and validate `warehouse` in `createPOSShop`**

Change:

```js
exports.createPOSShop = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant;
  const { name, mode = 'retail', color = '#b20202', description = '' } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Shop name is required' });
  }
  if (!['retail', 'wholesale'].includes(mode)) {
    return res.status(400).json({ success: false, message: 'mode must be retail or wholesale' });
  }
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

  tenant.posSettings.shops = tenant.posSettings.shops || [];
  tenant.posSettings.shops.push({ name: name.trim(), mode, color, description, active: true, createdAt: new Date() });
  await tenant.save();

  const created = tenant.posSettings.shops[tenant.posSettings.shops.length - 1];
  res.status(201).json({ success: true, data: { shop: created } });
});
```

to:

```js
exports.createPOSShop = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant;
  const { name, mode = 'retail', color = '#b20202', description = '', warehouse } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Shop name is required' });
  }
  if (!['retail', 'wholesale'].includes(mode)) {
    return res.status(400).json({ success: false, message: 'mode must be retail or wholesale' });
  }

  let warehouseId = null;
  if (warehouse) {
    const wh = await Warehouse.findOne({ _id: warehouse, tenant: tenantId, isActive: true });
    if (!wh) return res.status(400).json({ success: false, message: 'Warehouse not found or inactive' });
    warehouseId = wh._id;
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

  tenant.posSettings.shops = tenant.posSettings.shops || [];
  tenant.posSettings.shops.push({ name: name.trim(), mode, color, description, warehouse: warehouseId, active: true, createdAt: new Date() });
  await tenant.save();
  await tenant.populate('posSettings.shops.warehouse', 'name code');

  const created = tenant.posSettings.shops[tenant.posSettings.shops.length - 1];
  res.status(201).json({ success: true, data: { shop: created } });
});
```

(`tenant.populate(...)` after `save()` ensures the response's `shop.warehouse` is `{_id, name, code}`, matching the client's `POSShop.warehouse` type from Task 8 — not a raw ObjectId.)

- [ ] **Step 5: Accept and validate `warehouse` in `updatePOSShop`**

Change:

```js
exports.updatePOSShop = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant;
  const { shopId } = req.params;
  const { name, mode, color, description, active } = req.body;

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

  const shop = (tenant.posSettings.shops || []).id(shopId);
  if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

  if (name !== undefined) shop.name = name.trim();
  if (mode !== undefined && ['retail', 'wholesale'].includes(mode)) shop.mode = mode;
  if (color !== undefined) shop.color = color;
  if (description !== undefined) shop.description = description;
  if (active !== undefined) shop.active = !!active;

  await tenant.save();
  res.json({ success: true, data: { shop } });
});
```

to:

```js
exports.updatePOSShop = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant;
  const { shopId } = req.params;
  const { name, mode, color, description, active, warehouse } = req.body;

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

  const shop = (tenant.posSettings.shops || []).id(shopId);
  if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

  if (name !== undefined) shop.name = name.trim();
  if (mode !== undefined && ['retail', 'wholesale'].includes(mode)) shop.mode = mode;
  if (color !== undefined) shop.color = color;
  if (description !== undefined) shop.description = description;
  if (active !== undefined) shop.active = !!active;

  if (warehouse !== undefined) {
    if (!warehouse) {
      shop.warehouse = null;
    } else {
      const wh = await Warehouse.findOne({ _id: warehouse, tenant: tenantId, isActive: true });
      if (!wh) return res.status(400).json({ success: false, message: 'Warehouse not found or inactive' });
      shop.warehouse = wh._id;
    }
  }

  await tenant.save();
  await tenant.populate('posSettings.shops.warehouse', 'name code');
  const updatedShop = tenant.posSettings.shops.id(shopId);
  res.json({ success: true, data: { shop: updatedShop } });
});
```

(Re-reading `updatedShop` from `tenant.posSettings.shops.id(shopId)` after `populate(...)` avoids relying on whether `populate` mutates the earlier `shop` reference in place.)

- [ ] **Step 6: Smoke-check the controller and service still parse**

Run:
```bash
cd server && node -e "require('./controllers/pos.controller'); require('./services/warehouse.service'); console.log('OK')"
```
Expected: `OK` printed, no errors.

- [ ] **Step 7: Commit**

```bash
git add server/controllers/pos.controller.js
git commit -m "feat(server): validate and expose warehouse binding on POS shop CRUD"
```

---

## Task 4: `deductStock` — warehouse-scoped sale branch

**Files:**
- Modify: `server/controllers/pos.controller.js` (~line 43, `deductStock` function)

- [ ] **Step 1: Add `warehouseId`/`defaultSizeId` params and the warehouse branch**

Change the start of `deductStock`:

```js
async function deductStock({ subProductId, sizeId, quantity, tenantId, staffId, receiptNumber, productId, finalPrice, costPrice, allowOverselling = false }) {
  let deductedDoc = null;

  if (sizeId) {
```

to:

```js
async function deductStock({ subProductId, sizeId, quantity, tenantId, staffId, receiptNumber, productId, finalPrice, costPrice, allowOverselling = false, warehouseId = null, defaultSizeId = null }) {
  if (warehouseId) {
    // ── Warehouse-scoped deduction ────────────────────────────────────────
    // Decrement WarehouseStock directly; recalcSubProductStock refreshes the
    // SubProduct rollup, so the legacy $inc path below must NOT also run.
    const whSizeId = sizeId || defaultSizeId;
    const { before, after } = await sellStock(
      { warehouseId, subProduct: subProductId, size: whSizeId, quantity, allowOverselling },
      staffId, tenantId
    );

    InventoryMovement.create({
      subProduct:     subProductId,
      tenant:         tenantId,
      warehouse:      warehouseId,
      product:        productId || undefined,
      size:           whSizeId || undefined,
      type:           'sold',
      category:       'out',
      quantity,
      quantityBefore: before,
      quantityAfter:  after,
      reference:      receiptNumber,
      referenceType:  'order',
      sellingPrice:   finalPrice,
      unitCost:       costPrice || 0,
      totalCost:      (costPrice || 0) * quantity,
      performedBy:    staffId || tenantId,
      performedAt:    new Date(),
      source:         'order',
      status:         'confirmed',
      notes:          `POS sale — receipt ${receiptNumber}`,
    }).catch(err => console.error('[Inventory] POS deductStock audit failed:', err.message));

    return { _id: subProductId, availableStock: after };
  }

  let deductedDoc = null;

  if (sizeId) {
```

The rest of `deductStock` (the existing size-level branch, subproduct-level branch, and `InventoryMovement` audit for the legacy path) is unchanged.

- [ ] **Step 2: Smoke-check the controller still parses**

Run:
```bash
cd server && node -e "require('./controllers/pos.controller'); console.log('OK')"
```
Expected: `OK` printed, no errors.

- [ ] **Step 3: Commit**

```bash
git add server/controllers/pos.controller.js
git commit -m "feat(server): deduct warehouse-scoped stock via sellStock in deductStock"
```

---

## Task 5: `restoreStock` — warehouse-scoped restore branch, refund/void call sites

**Files:**
- Modify: `server/controllers/pos.controller.js` (~line 184 `restoreStock`, ~2306 `refundPOSOrder`, ~2402 `voidPOSOrder`)

- [ ] **Step 1: Add `warehouseId`/`defaultSizeId` params and the warehouse branch**

Change the start of `restoreStock`:

```js
async function restoreStock({ subProductId, sizeId, quantity, tenantId, staffId, returnNumber, productId, unitPrice }) {
  if (sizeId) {
```

to:

```js
async function restoreStock({ subProductId, sizeId, quantity, tenantId, staffId, returnNumber, productId, unitPrice, warehouseId = null, defaultSizeId = null }) {
  if (warehouseId) {
    // ── Warehouse-scoped restore ──────────────────────────────────────────
    const whSizeId = sizeId || defaultSizeId;
    const { before, after } = await returnStock(
      { warehouseId, subProduct: subProductId, size: whSizeId, quantity },
      staffId, tenantId
    );

    await InventoryMovement.create({
      subProduct: subProductId, tenant: tenantId, warehouse: warehouseId, product: productId || undefined,
      size: whSizeId || undefined, type: 'return', category: 'in',
      quantity,
      quantityBefore: before,
      quantityAfter:  after,
      reference: returnNumber, referenceType: 'return',
      sellingPrice: unitPrice || 0,
      performedBy: staffId || tenantId,
      performedAt: new Date(),
      source: 'return', status: 'confirmed',
      notes: `POS return — ${returnNumber}`,
    }).catch(err => console.error('[Inventory] POS restoreStock audit failed:', err.message));
    return;
  }

  if (sizeId) {
```

The rest of `restoreStock` (the existing `sizeId` and no-`sizeId` legacy branches) is unchanged.

- [ ] **Step 2: Pass `warehouseId`/`defaultSizeId` from `refundPOSOrder`**

Change:

```js
    // Restore stock only if restock flag is true (Odoo-style: cashier controls this)
    if (restock !== false) {
      await restoreStock({
        subProductId: orderItem.subproduct?.toString() || orderItem.subproduct,
        sizeId:       orderItem.size ? orderItem.size.toString() : null,
        quantity,
        tenantId:     req.tenant?._id,
        staffId:      performer._id,
        returnNumber,
        productId:    orderItem.product || undefined,
        unitPrice:    refundUnitPrice,
      });
    }
```

to:

```js
    // Restore stock only if restock flag is true (Odoo-style: cashier controls this)
    if (restock !== false) {
      const lineWarehouseId = orderItem.warehouse ? orderItem.warehouse.toString() : null;
      let lineDefaultSizeId = null;
      if (lineWarehouseId && !orderItem.size) {
        const spDoc = await SubProduct.findById(orderItem.subproduct).select('defaultSize').lean();
        lineDefaultSizeId = spDoc?.defaultSize || null;
      }
      await restoreStock({
        subProductId: orderItem.subproduct?.toString() || orderItem.subproduct,
        sizeId:       orderItem.size ? orderItem.size.toString() : null,
        quantity,
        tenantId:     req.tenant?._id,
        staffId:      performer._id,
        returnNumber,
        productId:    orderItem.product || undefined,
        unitPrice:    refundUnitPrice,
        warehouseId:    lineWarehouseId,
        defaultSizeId:  lineDefaultSizeId,
      });
    }
```

- [ ] **Step 3: Pass `warehouseId`/`defaultSizeId` from `voidPOSOrder`**

Change:

```js
  for (const item of order.items) {
    if (!item.subproduct && !item.size) continue;
    await restoreStock({
      subProductId: item.subproduct?.toString() || item.subproduct,
      sizeId:       item.size ? item.size.toString() : null,
      quantity:     item.quantity,
      tenantId:     req.tenant?._id,
      staffId:      req.posUser._id,
      returnNumber: voidNumber,
      productId:    item.product || undefined,
      unitPrice:    item.priceAtPurchase || 0,
    });
  }
```

to:

```js
  for (const item of order.items) {
    if (!item.subproduct && !item.size) continue;
    const lineWarehouseId = item.warehouse ? item.warehouse.toString() : null;
    let lineDefaultSizeId = null;
    if (lineWarehouseId && !item.size) {
      const spDoc = await SubProduct.findById(item.subproduct).select('defaultSize').lean();
      lineDefaultSizeId = spDoc?.defaultSize || null;
    }
    await restoreStock({
      subProductId: item.subproduct?.toString() || item.subproduct,
      sizeId:       item.size ? item.size.toString() : null,
      quantity:     item.quantity,
      tenantId:     req.tenant?._id,
      staffId:      req.posUser._id,
      returnNumber: voidNumber,
      productId:    item.product || undefined,
      unitPrice:    item.priceAtPurchase || 0,
      warehouseId:    lineWarehouseId,
      defaultSizeId:  lineDefaultSizeId,
    });
  }
```

- [ ] **Step 4: Smoke-check the controller still parses**

Run:
```bash
cd server && node -e "require('./controllers/pos.controller'); console.log('OK')"
```
Expected: `OK` printed, no errors.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/pos.controller.js
git commit -m "feat(server): restore warehouse-scoped stock on refund/void via returnStock"
```

---

## Task 6: `createPOSOrder` — resolve `shopId` → `warehouseId`, thread through the sale

**Files:**
- Modify: `server/controllers/pos.controller.js` (~line 1784-2082, `createPOSOrder`)

- [ ] **Step 1: Destructure `shopId` from the request body**

Change:

```js
  const {
    items,            // [{ subProductId, sizeId?, quantity, price, discount? }]
    customer = {},
    paymentMethod,    // 'cash' | 'card' | 'bank_transfer' | 'mobile_money' | 'split'
    amountTendered = 0,
    splitPayments = [],
    discountType,     // 'percent' | 'fixed'
    discountValue = 0,
    note = '',
    sessionId,
    priceOverrides = {}, // { subProductId+sizeId key: newPrice } — requires pos:price_override
    pricelistId,         // selected pricelist _id — applied to prices at order time
  } = req.body;
```

to:

```js
  const {
    items,            // [{ subProductId, sizeId?, quantity, price, discount? }]
    customer = {},
    paymentMethod,    // 'cash' | 'card' | 'bank_transfer' | 'mobile_money' | 'split'
    amountTendered = 0,
    splitPayments = [],
    discountType,     // 'percent' | 'fixed'
    discountValue = 0,
    note = '',
    sessionId,
    priceOverrides = {}, // { subProductId+sizeId key: newPrice } — requires pos:price_override
    pricelistId,         // selected pricelist _id — applied to prices at order time
    shopId,              // posSettings.shops._id — resolves a bound warehouse, if any
  } = req.body;
```

- [ ] **Step 2: Resolve `warehouseId` from the shop before the deduction loop**

Change:

```js
  // Read tenant POS settings for stock enforcement
  const allowOverselling = req.tenant?.posSettings?.allowOverselling === true;

  // Atomic stock deduction with full audit trail
  const deductedItems = [];  // for rollback on failure
  const orderItems    = [];
```

to:

```js
  // Read tenant POS settings for stock enforcement
  const allowOverselling = req.tenant?.posSettings?.allowOverselling === true;

  // Resolve the active shop's bound warehouse, if any. When set, stock is
  // sourced from and decremented in WarehouseStock for that warehouse only.
  let warehouseId = null;
  if (shopId) {
    const shop = req.tenant?.posSettings?.shops?.id?.(shopId);
    warehouseId = shop?.warehouse || null;
  }

  // Atomic stock deduction with full audit trail
  const deductedItems = [];  // for rollback on failure
  const orderItems    = [];
```

- [ ] **Step 3: Add `defaultSize` to the `SubProduct` select**

Change:

```js
      const sp = await SubProduct.findById(subProductId)
        .select('product sku baseSellingPrice costPrice isOnSale saleType saleStartDate saleEndDate saleDiscountValue flashSale bundleDeals')
        .populate('product', 'name images platformMarkup platformDiscount')
        .lean();
```

to:

```js
      const sp = await SubProduct.findById(subProductId)
        .select('product sku baseSellingPrice costPrice isOnSale saleType saleStartDate saleEndDate saleDiscountValue flashSale bundleDeals defaultSize')
        .populate('product', 'name images platformMarkup platformDiscount')
        .lean();
```

- [ ] **Step 4: Pass `warehouseId`/`defaultSizeId` into `deductStock` and `deductedItems`**

Change:

```js
      // Deduct stock (throws on insufficient stock unless overselling is allowed)
      const deductedDoc = await deductStock({
        subProductId,
        sizeId:          sizeId || null,
        quantity,
        tenantId,
        staffId,
        receiptNumber,
        productId:       sp?.product?._id,
        finalPrice,
        costPrice:       sizePricing.costPrice,
        allowOverselling,
      });

      deductedItems.push({
        type:          sizeId ? 'size' : 'subproduct',
        sizeId:        sizeId || null,
        subProductId,
        quantity,
      });
```

to:

```js
      // Deduct stock (throws on insufficient stock unless overselling is allowed)
      const deductedDoc = await deductStock({
        subProductId,
        sizeId:          sizeId || null,
        quantity,
        tenantId,
        staffId,
        receiptNumber,
        productId:       sp?.product?._id,
        finalPrice,
        costPrice:       sizePricing.costPrice,
        allowOverselling,
        warehouseId,
        defaultSizeId:   sp?.defaultSize || null,
      });

      deductedItems.push({
        type:          sizeId ? 'size' : 'subproduct',
        sizeId:        sizeId || null,
        subProductId,
        quantity,
        defaultSizeId: sp?.defaultSize || null,
      });
```

- [ ] **Step 5: Stamp `orderItems.push` with `warehouse` and a resolved `size`**

Change:

```js
      orderItems.push({
        product:               sp?.product?._id || subProductId,
        subproduct:            subProductId,
        size:                  sizeId || undefined,
        quantity,
```

to:

```js
      orderItems.push({
        product:               sp?.product?._id || subProductId,
        subproduct:            subProductId,
        size:                  (warehouseId ? (sizeId || sp?.defaultSize) : sizeId) || undefined,
        warehouse:             warehouseId || undefined,
        quantity,
```

(For warehouse-scoped sales, `size` is always stamped — using `sp.defaultSize` when no `sizeId` was given — so `restoreStock` on refund/void never needs to re-derive it. For non-warehouse sales, `size` is unchanged: `sizeId || undefined`.)

- [ ] **Step 6: Roll back via `returnStock` (not the legacy `$inc`) when `warehouseId` is set**

Change:

```js
  } catch (stockErr) {
    // Rollback already-deducted stock on failure
    for (const d of deductedItems) {
      if (d.sizeId) {
        await Size.findByIdAndUpdate(d.sizeId, { $inc: { availableStock: d.quantity, stock: d.quantity } });
        await SubProduct.findByIdAndUpdate(d.subProductId, { $inc: { availableStock: d.quantity, totalStock: d.quantity } });
      } else {
        await SubProduct.findByIdAndUpdate(d.subProductId, { $inc: { availableStock: d.quantity, totalStock: d.quantity } });
      }
    }
    return res.status(409).json({ success: false, message: stockErr.message });
  }
```

to:

```js
  } catch (stockErr) {
    // Rollback already-deducted stock on failure
    for (const d of deductedItems) {
      if (warehouseId) {
        await returnStock(
          { warehouseId, subProduct: d.subProductId, size: d.sizeId || d.defaultSizeId, quantity: d.quantity },
          staffId,
          tenantId
        ).catch(() => {});
      } else if (d.sizeId) {
        await Size.findByIdAndUpdate(d.sizeId, { $inc: { availableStock: d.quantity, stock: d.quantity } });
        await SubProduct.findByIdAndUpdate(d.subProductId, { $inc: { availableStock: d.quantity, totalStock: d.quantity } });
      } else {
        await SubProduct.findByIdAndUpdate(d.subProductId, { $inc: { availableStock: d.quantity, totalStock: d.quantity } });
      }
    }
    return res.status(409).json({ success: false, message: stockErr.message });
  }
```

- [ ] **Step 7: Smoke-check the controller still parses**

Run:
```bash
cd server && node -e "require('./controllers/pos.controller'); console.log('OK')"
```
Expected: `OK` printed, no errors.

- [ ] **Step 8: Commit**

```bash
git add server/controllers/pos.controller.js
git commit -m "feat(server): thread shopId/warehouse through createPOSOrder"
```

---

## Task 7: `getPOSProducts` — warehouse-scoped stock with hard zero-stock filter

**Files:**
- Modify: `server/controllers/pos.controller.js` (~line 1648-1772, `getPOSProducts`)

- [ ] **Step 1: Resolve `shopId` → `warehouseId`**

Change:

```js
exports.getPOSProducts = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const tenant   = req.tenant;
  const { search, category, limit = 200 } = req.query;
```

to:

```js
exports.getPOSProducts = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const tenant   = req.tenant;
  const { search, category, limit = 200, shopId } = req.query;

  // Resolve the active shop's bound warehouse, if any.
  let warehouseId = null;
  if (shopId) {
    try {
      const shop = tenant?.posSettings?.shops?.id?.(shopId);
      warehouseId = shop?.warehouse || null;
    } catch (_) {
      warehouseId = null;
    }
  }
```

- [ ] **Step 2: Fetch `WarehouseStock` rows and build a lookup map after the `subProducts` query**

Change:

```js
    .populate({ path: 'vendor', select: 'firstName lastName email posName', strictPopulate: false })
    .sort({ isFeaturedByTenant: -1, totalSold: -1, availableStock: -1 })
    .limit(Number(limit))
    .lean();

  // Inject computed platform selling prices so the client never sees raw 0-values
  const enriched = subProducts.map((sp) => {
```

to:

```js
    .populate({ path: 'vendor', select: 'firstName lastName email posName', strictPopulate: false })
    .sort({ isFeaturedByTenant: -1, totalSold: -1, availableStock: -1 })
    .limit(Number(limit))
    .lean();

  // When the shop is bound to a warehouse, look up per-(subProduct,size) stock
  // so warehouse numbers can override the aggregate below.
  let stockMap = null;
  if (warehouseId) {
    const stockRows = await WarehouseStock.find({
      tenant: tenantId,
      warehouse: warehouseId,
      subProduct: { $in: subProducts.map((sp) => sp._id) },
    }).select('subProduct size currentQuantity').lean();

    stockMap = new Map();
    for (const row of stockRows) {
      const spKey = String(row.subProduct);
      if (!stockMap.has(spKey)) stockMap.set(spKey, new Map());
      stockMap.get(spKey).set(String(row.size), row.currentQuantity);
    }
  }

  // Inject computed platform selling prices so the client never sees raw 0-values
  const enriched = subProducts.map((sp) => {
```

- [ ] **Step 3: Branch on `warehouseId` for stock numbers, hard-filter zero-stock items**

Change:

```js
    // Normalise size-level availableStock to match the SubProduct aggregate.
    // Mismatches arise when inventory adjustments are made without specifying a
    // size (the service updates SubProduct only, leaving Size docs stale).
    const sizeStockSum = enrichedSizes.reduce((sum, s) => sum + (s.availableStock || 0), 0);
    if (enrichedSizes.length > 0 && !sp.sellWithoutSizeVariants && sizeStockSum !== sp.availableStock) {
      const target = Math.max(0, sp.availableStock);
      if (sizeStockSum === 0) {
        // All sizes at zero — distribute evenly
        const perSize   = Math.floor(target / enrichedSizes.length);
        const remainder = target % enrichedSizes.length;
        enrichedSizes = enrichedSizes.map((s, i) => ({
          ...s,
          availableStock: perSize + (i === 0 ? remainder : 0),
        }));
      } else {
        // Sizes have stock but their sum differs — scale proportionally so the
        // POS sum matches SubProduct.availableStock (source of truth).
        let remaining = target;
        enrichedSizes = enrichedSizes.map((s, i) => {
          const isLast  = i === enrichedSizes.length - 1;
          const share   = (s.availableStock || 0) / sizeStockSum;
          const newStock = isLast
            ? Math.max(0, remaining)
            : Math.max(0, Math.min(remaining, Math.round(share * target)));
          remaining -= newStock;
          return { ...s, availableStock: newStock };
        });
      }
    }

    // Active bundle deals (not expired, sorted best discount first)
    const now = new Date();
    const activeBundles = (sp.bundleDeals || [])
      .filter(bd => bd.active !== false && (!bd.validUntil || new Date(bd.validUntil) >= now))
      .sort((a, b) => (b.discount || 0) - (a.discount || 0));

    return {
      ...sp,
      baseSellingPrice: basePrice,
      originalPrice:    basePricing.isOnSale ? originalPrice : null,
      isOnSale:         basePricing.isOnSale,
      isFlashSale:      basePricing.isFlashSale,
      activeBundles,
      sizes: enrichedSizes,
    };
  });
```

to:

```js
    let warehouseAvailableStock = null;

    if (warehouseId) {
      // Warehouse-scoped: stock comes from WarehouseStock, hard-filter zeros.
      const spStock = stockMap.get(String(sp._id)) || new Map();

      if (sp.sellWithoutSizeVariants) {
        const qty = spStock.get(String(sp.defaultSize)) ?? 0;
        if (qty <= 0) return null;
        warehouseAvailableStock = qty;
        enrichedSizes = enrichedSizes.map((s) => ({ ...s, availableStock: qty }));
      } else {
        enrichedSizes = enrichedSizes
          .map((s) => ({ ...s, availableStock: spStock.get(String(s._id)) ?? 0 }))
          .filter((s) => s.availableStock > 0);
        if (enrichedSizes.length === 0) return null;
        warehouseAvailableStock = enrichedSizes.reduce((sum, s) => sum + s.availableStock, 0);
      }
    } else {
      // Normalise size-level availableStock to match the SubProduct aggregate.
      // Mismatches arise when inventory adjustments are made without specifying a
      // size (the service updates SubProduct only, leaving Size docs stale).
      const sizeStockSum = enrichedSizes.reduce((sum, s) => sum + (s.availableStock || 0), 0);
      if (enrichedSizes.length > 0 && !sp.sellWithoutSizeVariants && sizeStockSum !== sp.availableStock) {
        const target = Math.max(0, sp.availableStock);
        if (sizeStockSum === 0) {
          // All sizes at zero — distribute evenly
          const perSize   = Math.floor(target / enrichedSizes.length);
          const remainder = target % enrichedSizes.length;
          enrichedSizes = enrichedSizes.map((s, i) => ({
            ...s,
            availableStock: perSize + (i === 0 ? remainder : 0),
          }));
        } else {
          // Sizes have stock but their sum differs — scale proportionally so the
          // POS sum matches SubProduct.availableStock (source of truth).
          let remaining = target;
          enrichedSizes = enrichedSizes.map((s, i) => {
            const isLast  = i === enrichedSizes.length - 1;
            const share   = (s.availableStock || 0) / sizeStockSum;
            const newStock = isLast
              ? Math.max(0, remaining)
              : Math.max(0, Math.min(remaining, Math.round(share * target)));
            remaining -= newStock;
            return { ...s, availableStock: newStock };
          });
        }
      }
    }

    // Active bundle deals (not expired, sorted best discount first)
    const now = new Date();
    const activeBundles = (sp.bundleDeals || [])
      .filter(bd => bd.active !== false && (!bd.validUntil || new Date(bd.validUntil) >= now))
      .sort((a, b) => (b.discount || 0) - (a.discount || 0));

    return {
      ...sp,
      baseSellingPrice: basePrice,
      originalPrice:    basePricing.isOnSale ? originalPrice : null,
      isOnSale:         basePricing.isOnSale,
      isFlashSale:      basePricing.isFlashSale,
      ...(warehouseId ? { availableStock: warehouseAvailableStock } : {}),
      activeBundles,
      sizes: enrichedSizes,
    };
  }).filter(Boolean);
```

(The post-populate `filtered = enriched.filter(...)` block below is unchanged — `enriched` no longer contains `null` entries, since they were dropped by `.filter(Boolean)`.)

- [ ] **Step 4: Smoke-check the controller still parses**

Run:
```bash
cd server && node -e "require('./controllers/pos.controller'); console.log('OK')"
```
Expected: `OK` printed, no errors.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/pos.controller.js
git commit -m "feat(server): scope getPOSProducts stock to the shop's bound warehouse"
```

---

## Task 8: Client data layer — `POSShop.warehouse`, `usePOSActiveShop`, `getProducts`/`createShop`/`updateShop` params

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/types.ts` (~line 709, `POSShop`)
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/store/index.ts` (~line 71, after `usePOSShops`)
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/api.ts` (`getProducts` ~79, `createShop` ~536, `updateShop` ~552)

- [ ] **Step 1: Add `warehouse` to `POSShop`**

In `types.ts`, change:

```typescript
export interface POSShop {
  _id: string;
  name: string;
  mode: 'retail' | 'wholesale';
  color: string;
  description: string;
  active: boolean;
  createdAt: string;
}
```

to:

```typescript
export interface POSShop {
  _id: string;
  name: string;
  mode: 'retail' | 'wholesale';
  color: string;
  description: string;
  active: boolean;
  createdAt: string;
  warehouse?: { _id: string; name: string; code: string } | null;
}
```

- [ ] **Step 2: Add `usePOSActiveShop()` to `store/index.ts`**

In `store/index.ts`, change:

```typescript
const posShopsAtom = atomWithStorage<POSShop[]>('dh-pos-shops', []);

export const usePOSShops = () => {
  const [shops, setShops] = useAtom(posShopsAtom);
  return { shops, setShops };
};
```

to:

```typescript
const posShopsAtom = atomWithStorage<POSShop[]>('dh-pos-shops', []);

export const usePOSShops = () => {
  const [shops, setShops] = useAtom(posShopsAtom);
  return { shops, setShops };
};

const posActiveShopIdAtom = atomWithStorage<string | null>('dh-pos-shop', null);

export const usePOSActiveShop = () => {
  const [activeShopId, setActiveShopId] = useAtom(posActiveShopIdAtom);
  const { shops } = usePOSShops();
  const activeShop = useMemo(
    () => shops.find((s) => s._id === activeShopId) ?? null,
    [shops, activeShopId]
  );
  return { activeShopId, setActiveShopId, activeShop };
};
```

(`useMemo` is already imported from `'react'` at the top of this file — no new import needed. `activeShop` is `null` for the built-in `'retail'`/`'wholesale'` ids since those aren't in `usePOSShops().shops`, which is exactly the "don't send shopId for built-ins" behavior the spec requires.)

- [ ] **Step 3: Add `shopId` to `getProducts`**

In `api.ts`, change:

```typescript
  async getProducts(
    token: string,
    params?: { search?: string; category?: string; limit?: number }
  ) {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.category) qs.set('category', params.category);
    if (params?.limit) qs.set('limit', String(params.limit));
    return request<{ products: POSProduct[]; total: number }>(
      `${API_URL}/api/pos/products?${qs}`,
      { headers: authHeaders(token) }
    );
  },
```

to:

```typescript
  async getProducts(
    token: string,
    params?: { search?: string; category?: string; limit?: number; shopId?: string }
  ) {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.category) qs.set('category', params.category);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.shopId) qs.set('shopId', params.shopId);
    return request<{ products: POSProduct[]; total: number }>(
      `${API_URL}/api/pos/products?${qs}`,
      { headers: authHeaders(token) }
    );
  },
```

- [ ] **Step 4: Add `warehouse` to `createShop`'s data type**

In `api.ts`, change:

```typescript
  async createShop(
    token: string,
    data: {
      name: string;
      mode: 'retail' | 'wholesale';
      color?: string;
      description?: string;
    }
  ) {
    return request<{ shop: POSShop }>(`${API_URL}/api/pos/shops`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
  },
```

to:

```typescript
  async createShop(
    token: string,
    data: {
      name: string;
      mode: 'retail' | 'wholesale';
      color?: string;
      description?: string;
      warehouse?: string | null;
    }
  ) {
    return request<{ shop: POSShop }>(`${API_URL}/api/pos/shops`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
  },
```

- [ ] **Step 5: Add `warehouse` to `updateShop`'s data type**

In `api.ts`, change:

```typescript
  async updateShop(
    token: string,
    shopId: string,
    data: Partial<{
      name: string;
      mode: 'retail' | 'wholesale';
      color: string;
      description: string;
      active: boolean;
    }>
  ) {
    return request<{ shop: POSShop }>(`${API_URL}/api/pos/shops/${shopId}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
  }
```

to:

```typescript
  async updateShop(
    token: string,
    shopId: string,
    data: Partial<{
      name: string;
      mode: 'retail' | 'wholesale';
      color: string;
      description: string;
      active: boolean;
      warehouse: string | null;
    }>
  ) {
    return request<{ shop: POSShop }>(`${API_URL}/api/pos/shops/${shopId}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
  }
```

- [ ] **Step 6: Type-check**

Run:
```bash
cd client/apps/isomorphic && npx tsc --noEmit 2>&1 | grep -v TS2688 | grep -E "point-of-sale/(types|store/index|api)\.ts" || echo "OK: no new errors"
```
Expected: `OK: no new errors`.

- [ ] **Step 7: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/point-of-sale/types.ts client/apps/isomorphic/src/app/shared/point-of-sale/store/index.ts client/apps/isomorphic/src/app/shared/point-of-sale/api.ts
git commit -m "feat(client): add POSShop.warehouse, usePOSActiveShop, shopId/warehouse params"
```

---

## Task 9: Offline product fetch — thread `shopId` through

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/offline/api.ts` (~line 41, `getProducts`)

- [ ] **Step 1: Add a `shopId` parameter**

Change:

```typescript
export async function getProducts(token: string): Promise<any[]> {
  if (isOnline()) {
    const data = await posApi.getProducts(token);
    const products: any[] = data?.products ?? [];
```

to:

```typescript
export async function getProducts(token: string, shopId?: string): Promise<any[]> {
  if (isOnline()) {
    const data = await posApi.getProducts(token, shopId ? { shopId } : undefined);
    const products: any[] = data?.products ?? [];
```

The rest of `getProducts` (record mapping, image caching, offline fallback via `posDb.products`) is unchanged.

- [ ] **Step 2: Type-check**

Run:
```bash
cd client/apps/isomorphic && npx tsc --noEmit 2>&1 | grep -v TS2688 | grep -E "point-of-sale/offline/api\.ts" || echo "OK: no new errors"
```
Expected: `OK: no new errors`.

- [ ] **Step 3: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/point-of-sale/offline/api.ts
git commit -m "feat(client): thread shopId into offline getProducts"
```

---

## Task 10: Functional `ShopSelector` — wire to `usePOSActiveShop`

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/pos-nav-header.tsx` (imports ~line 14, `ShopSelector` ~line 269)

- [ ] **Step 1: Import `usePOSActiveShop`**

Change:

```typescript
import { usePOSShops, usePOSAuth } from '@/app/shared/point-of-sale/store';
```

to:

```typescript
import { usePOSShops, usePOSAuth, usePOSActiveShop } from '@/app/shared/point-of-sale/store';
```

- [ ] **Step 2: Replace local `activeId` state with the persisted atom**

Change:

```typescript
function ShopSelector({ token }: { token: string }) {
  const { shops, setShops } = usePOSShops();
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [activeId, setActiveId] = useState<string>('retail');
  const ref = useRef<HTMLDivElement>(null);

  const allShops = [...BUILT_IN, ...shops];
  const active = allShops.find((s) => s._id === activeId) ?? BUILT_IN[0];
```

to:

```typescript
function ShopSelector({ token }: { token: string }) {
  const { shops, setShops } = usePOSShops();
  const { activeShopId, setActiveShopId } = usePOSActiveShop();
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeId = activeShopId ?? 'retail';
  const allShops = [...BUILT_IN, ...shops];
  const active = allShops.find((s) => s._id === activeId) ?? BUILT_IN[0];
```

- [ ] **Step 3: Write shop selection to the persisted atom**

Change:

```typescript
                <button
                  key={shop._id}
                  type="button"
                  onClick={() => {
                    setActiveId(shop._id);
                    setOpen(false);
                  }}
```

to:

```typescript
                <button
                  key={shop._id}
                  type="button"
                  onClick={() => {
                    setActiveShopId(shop._id);
                    setOpen(false);
                  }}
```

- [ ] **Step 4: Type-check**

Run:
```bash
cd client/apps/isomorphic && npx tsc --noEmit 2>&1 | grep -v TS2688 | grep -E "pos-nav-header\.tsx" || echo "OK: no new errors"
```
Expected: `OK: no new errors`.

- [ ] **Step 5: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/point-of-sale/pos-nav-header.tsx
git commit -m "feat(client): make ShopSelector persist the active shop"
```

---

## Task 11: Product grid — fetch products for the active shop's warehouse

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/components/pos-product-grid.tsx` (imports ~line 28, `fetchProducts` ~line 250)

- [ ] **Step 1: Import `usePOSActiveShop`**

Change:

```typescript
import {
  usePOSAuth,
  usePOSUI,
  usePOSSaleSignal,
  usePOSCart,
  usePOSPricelist,
  usePOSCombos,
  usePOSProducts,
} from '@/app/shared/point-of-sale/store';
```

to:

```typescript
import {
  usePOSAuth,
  usePOSUI,
  usePOSSaleSignal,
  usePOSCart,
  usePOSPricelist,
  usePOSCombos,
  usePOSProducts,
  usePOSActiveShop,
} from '@/app/shared/point-of-sale/store';
```

- [ ] **Step 2: Pass the active shop's id to `getProductsOffline` and refetch when it changes**

Change:

```typescript
  const fetchProducts = useCallback(
    async (silent = false) => {
      if (!token) {
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      setError('');
      try {
        const products = isOnline
          ? await getProductsOffline(token)
          : await getProductsWithLocalStock();
        setAllProducts((products || []) as unknown as POSProduct[]);
        setGlobalProducts((products || []) as unknown as POSProduct[]);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : 'Failed to load products'
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token]
  );

  // Initial load
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);
```

to:

```typescript
  const { activeShop } = usePOSActiveShop();

  const fetchProducts = useCallback(
    async (silent = false) => {
      if (!token) {
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      setError('');
      try {
        const products = isOnline
          ? await getProductsOffline(token, activeShop?._id)
          : await getProductsWithLocalStock();
        setAllProducts((products || []) as unknown as POSProduct[]);
        setGlobalProducts((products || []) as unknown as POSProduct[]);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : 'Failed to load products'
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token, isOnline, activeShop?._id]
  );

  // Initial load, and refetch whenever the active shop (and thus its bound
  // warehouse) changes.
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);
```

(`isOnline` was already in scope via `useOnlineStatus()` — it's now added to the dependency array alongside `activeShop?._id` since both are read inside the callback.)

- [ ] **Step 3: Type-check**

Run:
```bash
cd client/apps/isomorphic && npx tsc --noEmit 2>&1 | grep -v TS2688 | grep -E "pos-product-grid\.tsx" || echo "OK: no new errors"
```
Expected: `OK: no new errors`.

- [ ] **Step 4: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/point-of-sale/components/pos-product-grid.tsx
git commit -m "feat(client): scope product grid to the active shop's warehouse"
```

---

## Task 12: Checkout — send `shopId` with the order

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/components/pos-payment-modal.tsx` (imports ~line 25, `createOrderOffline` call ~line 1301)

- [ ] **Step 1: Import `usePOSActiveShop`**

Change:

```typescript
import {
  usePOSCart,
  usePOSAuth,
  usePOSUI,
  usePOSSaleSignal,
  usePOSPricelist,
  computeRewardDiscount,
  getEffectiveBundlePrice,
  usePOSSettings,
} from '@/app/shared/point-of-sale/store';
```

to:

```typescript
import {
  usePOSCart,
  usePOSAuth,
  usePOSUI,
  usePOSSaleSignal,
  usePOSPricelist,
  computeRewardDiscount,
  getEffectiveBundlePrice,
  usePOSSettings,
  usePOSActiveShop,
} from '@/app/shared/point-of-sale/store';
```

- [ ] **Step 2: Add `shopId` to the order payload**

Change:

```typescript
      const result = await createOrderOffline(token, terminal ?? 'retail', {
        items: orderItems,
        customer,
        paymentMethod,
        total: effectiveTotal,
        amountTendered,
        splitPayments,
        discountType: effDiscType,
        discountValue: effDiscValue,
        note: note || undefined,
        terminalType: terminal ?? 'retail',
        pricelistId: selectedPricelist?._id ?? undefined,
      });
```

to:

```typescript
      const result = await createOrderOffline(token, terminal ?? 'retail', {
        items: orderItems,
        customer,
        paymentMethod,
        total: effectiveTotal,
        amountTendered,
        splitPayments,
        discountType: effDiscType,
        discountValue: effDiscValue,
        note: note || undefined,
        terminalType: terminal ?? 'retail',
        pricelistId: selectedPricelist?._id ?? undefined,
        shopId: activeShop?._id,
      });
```

Add the hook call near the top of the component (alongside the other `usePOS*` hooks already destructured there):

```typescript
  const { activeShop } = usePOSActiveShop();
```

- [ ] **Step 3: Type-check**

Run:
```bash
cd client/apps/isomorphic && npx tsc --noEmit 2>&1 | grep -v TS2688 | grep -E "pos-payment-modal\.tsx" || echo "OK: no new errors"
```
Expected: `OK: no new errors`.

- [ ] **Step 4: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/point-of-sale/components/pos-payment-modal.tsx
git commit -m "feat(client): send shopId with POS orders"
```

---

## Task 13: Admin settings UI — bind a warehouse to each shop

**Files:**
- Modify: `client/apps/isomorphic/src/app/(hydrogen)/settings/page.tsx` (imports ~line 7, state ~line 892, `handleCreateShop` ~line 1144, `pos_shops` SectionCard ~line 1562)

- [ ] **Step 1: Import `warehouseService` and the `Warehouse` type**

Change:

```typescript
import { posApi } from '@/app/shared/point-of-sale/api';
import type { POSSettings, POSShop } from '@/app/shared/point-of-sale/types';
```

to:

```typescript
import { posApi } from '@/app/shared/point-of-sale/api';
import type { POSSettings, POSShop } from '@/app/shared/point-of-sale/types';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
```

- [ ] **Step 2: Add `warehouses` state and `warehouse` to `shopForm`, fetch active warehouses**

Change:

```typescript
  const [shops, setShops] = useState<POSShop[]>([]);
  const [shopForm, setShopForm] = useState({
    name: '',
    mode: 'retail' as 'retail' | 'wholesale',
    color: '#b20202',
    description: '',
  });
  const [shopFormOpen, setShopFormOpen] = useState(false);
  const [shopSaving, setShopSaving] = useState(false);
  const [shopError, setShopError] = useState('');
```

to:

```typescript
  const [shops, setShops] = useState<POSShop[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [shopForm, setShopForm] = useState({
    name: '',
    mode: 'retail' as 'retail' | 'wholesale',
    color: '#b20202',
    description: '',
    warehouse: '',
  });
  const [shopFormOpen, setShopFormOpen] = useState(false);
  const [shopSaving, setShopSaving] = useState(false);
  const [shopError, setShopError] = useState('');

  useEffect(() => {
    if (!token) return;
    warehouseService
      .getWarehouses(token, { isActive: true })
      .then((res) => setWarehouses(res.data ?? []))
      .catch(() => {});
  }, [token]);
```

- [ ] **Step 3: Reset `shopForm.warehouse` after a successful create, and add a per-shop warehouse-change handler**

Change:

```typescript
  async function handleCreateShop(e: React.FormEvent) {
    e.preventDefault();
    if (!shopForm.name.trim()) {
      setShopError('Name is required');
      return;
    }
    setShopSaving(true);
    setShopError('');
    try {
      const { shop } = await posApi.createShop(token, shopForm);
      setShops((prev) => [...prev, shop]);
      setShopForm({
        name: '',
        mode: 'retail',
        color: '#b20202',
        description: '',
      });
      setShopFormOpen(false);
      toast.success('Shop created');
    } catch (err: unknown) {
      setShopError(
        err instanceof Error ? err.message : 'Failed to create shop'
      );
    } finally {
      setShopSaving(false);
    }
  }

  async function handleDeleteShop(shopId: string) {
    try {
      await posApi.deleteShop(token, shopId);
      setShops((prev) => prev.filter((s) => s._id !== shopId));
      toast.success('Shop removed');
    } catch {
      toast.error('Failed to remove shop');
    }
  }
```

to:

```typescript
  async function handleCreateShop(e: React.FormEvent) {
    e.preventDefault();
    if (!shopForm.name.trim()) {
      setShopError('Name is required');
      return;
    }
    setShopSaving(true);
    setShopError('');
    try {
      const { shop } = await posApi.createShop(token, {
        ...shopForm,
        warehouse: shopForm.warehouse || null,
      });
      setShops((prev) => [...prev, shop]);
      setShopForm({
        name: '',
        mode: 'retail',
        color: '#b20202',
        description: '',
        warehouse: '',
      });
      setShopFormOpen(false);
      toast.success('Shop created');
    } catch (err: unknown) {
      setShopError(
        err instanceof Error ? err.message : 'Failed to create shop'
      );
    } finally {
      setShopSaving(false);
    }
  }

  async function handleDeleteShop(shopId: string) {
    try {
      await posApi.deleteShop(token, shopId);
      setShops((prev) => prev.filter((s) => s._id !== shopId));
      toast.success('Shop removed');
    } catch {
      toast.error('Failed to remove shop');
    }
  }

  async function handleShopWarehouseChange(shopId: string, warehouseId: string) {
    try {
      const { shop } = await posApi.updateShop(token, shopId, {
        warehouse: warehouseId || null,
      });
      setShops((prev) => prev.map((s) => (s._id === shopId ? shop : s)));
      toast.success('Warehouse updated');
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update warehouse'
      );
    }
  }
```

- [ ] **Step 4: Add an inline warehouse `<select>` to each custom shop row**

Change:

```typescript
                            <div
                              key={shop._id}
                              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3"
                            >
                              <span
                                className="h-3 w-3 shrink-0 rounded-full"
                                style={{ background: shop.color }}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold uppercase text-gray-700">
                                  {shop.name}
                                </p>
                                <p className="text-[11px] capitalize text-gray-400">
                                  {shop.mode} ·{' '}
                                  {shop.description || 'No description'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteShop(shop._id)}
                                className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                              >
                                <PiTrash className="h-4 w-4" />
                              </button>
                            </div>
```

to:

```typescript
                            <div
                              key={shop._id}
                              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3"
                            >
                              <span
                                className="h-3 w-3 shrink-0 rounded-full"
                                style={{ background: shop.color }}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold uppercase text-gray-700">
                                  {shop.name}
                                </p>
                                <p className="text-[11px] capitalize text-gray-400">
                                  {shop.mode} ·{' '}
                                  {shop.description || 'No description'}
                                </p>
                              </div>
                              <select
                                value={shop.warehouse?._id || ''}
                                onChange={(e) =>
                                  handleShopWarehouseChange(shop._id, e.target.value)
                                }
                                className="shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
                              >
                                <option value="">No warehouse</option>
                                {warehouses.map((w) => (
                                  <option key={w._id} value={w._id}>
                                    {w.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleDeleteShop(shop._id)}
                                className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                              >
                                <PiTrash className="h-4 w-4" />
                              </button>
                            </div>
```

- [ ] **Step 5: Add a warehouse `<select>` to the create-shop form**

Change:

```typescript
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">
                                Color
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={shopForm.color}
                                  onChange={(e) =>
                                    setShopForm((f) => ({
                                      ...f,
                                      color: e.target.value,
                                    }))
                                  }
                                  className="h-9 w-12 cursor-pointer rounded border border-gray-200 bg-white p-0.5"
                                />
                                <span className="font-mono text-xs text-gray-500">
                                  {shopForm.color}
                                </span>
                              </div>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">
                                Description{' '}
                                <span className="font-normal text-gray-400">
                                  (optional)
                                </span>
                              </label>
                              <input
                                value={shopForm.description}
                                onChange={(e) =>
                                  setShopForm((f) => ({
                                    ...f,
                                    description: e.target.value,
                                  }))
                                }
                                placeholder="Short description"
                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
                              />
                            </div>
                          </div>

                          {shopError && (
```

to:

```typescript
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">
                                Color
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={shopForm.color}
                                  onChange={(e) =>
                                    setShopForm((f) => ({
                                      ...f,
                                      color: e.target.value,
                                    }))
                                  }
                                  className="h-9 w-12 cursor-pointer rounded border border-gray-200 bg-white p-0.5"
                                />
                                <span className="font-mono text-xs text-gray-500">
                                  {shopForm.color}
                                </span>
                              </div>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">
                                Description{' '}
                                <span className="font-normal text-gray-400">
                                  (optional)
                                </span>
                              </label>
                              <input
                                value={shopForm.description}
                                onChange={(e) =>
                                  setShopForm((f) => ({
                                    ...f,
                                    description: e.target.value,
                                  }))
                                }
                                placeholder="Short description"
                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Warehouse{' '}
                              <span className="font-normal text-gray-400">
                                (optional)
                              </span>
                            </label>
                            <select
                              value={shopForm.warehouse}
                              onChange={(e) =>
                                setShopForm((f) => ({
                                  ...f,
                                  warehouse: e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
                            >
                              <option value="">
                                — No warehouse (aggregate stock) —
                              </option>
                              {warehouses.map((w) => (
                                <option key={w._id} value={w._id}>
                                  {w.name} ({w.code})
                                </option>
                              ))}
                            </select>
                          </div>

                          {shopError && (
```

- [ ] **Step 6: Type-check**

Run:
```bash
cd client/apps/isomorphic && npx tsc --noEmit 2>&1 | grep -v TS2688 | grep -E "\(hydrogen\)/settings/page\.tsx" || echo "OK: no new errors"
```
Expected: `OK: no new errors`.

- [ ] **Step 7: Commit**

```bash
git add "client/apps/isomorphic/src/app/(hydrogen)/settings/page.tsx"
git commit -m "feat(client): admin UI to bind a warehouse to each POS shop"
```

---

## Manual QA (after all tasks)

1. In Admin Settings → POS → Shops, create a shop and bind it to a warehouse that has some `WarehouseStock` rows with `currentQuantity > 0` for a subset of products/sizes.
2. In the POS, open the `ShopSelector` and pick that shop. Confirm the product grid only shows products/sizes with stock in that warehouse, and the displayed `availableStock` matches `WarehouseStock.currentQuantity`.
3. Make a sale of one of those items. Confirm:
   - `WarehouseStock.currentQuantity` for that (warehouse, subProduct, size) decreased by the sold quantity.
   - A `WarehouseMovement` with `type: 'shipped'` was created.
   - An `InventoryMovement` with `type: 'sold'`, `warehouse: <that warehouse>` was created.
   - `SubProduct.totalStock/availableStock` rollup updated (via `recalcSubProductStock`).
4. Refund the sale (with `restock: true`). Confirm `WarehouseStock.currentQuantity` returns to its prior value, a `WarehouseMovement` with `type: 'returned'` was created, and an `InventoryMovement` with `type: 'return'`, `warehouse: <that warehouse>` was created.
5. Switch the `ShopSelector` to RETAIL/WHOLESALE (built-in, no warehouse). Confirm the product grid reverts to the tenant-wide aggregate view and a sale there behaves exactly as it did before this feature (legacy `Size`/`SubProduct` `$inc` path, no `WarehouseStock`/`WarehouseMovement` writes).
