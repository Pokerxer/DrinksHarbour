# Multi-Warehouse Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a tenant store subproducts across multiple warehouses and track stock per warehouse, per size.

**Architecture:** Replace the single per-subproduct `Warehouse` model with two entities — a `Warehouse` *place* and a `WarehouseStock` row per `(warehouse, subProduct, size)` — plus a `WarehouseMovement` audit log. `SubProduct.totalStock/availableStock/reservedStock` become rollups summed from `WarehouseStock`. Client adds a warehouses feature (list/CRUD, per-warehouse stock view, transfer, per-subproduct breakdown) mirroring the existing `purchases/` page→shared-component→service pattern.

**Tech Stack:** Node/Express + Mongoose (server), Next.js App Router + React + next-auth + react-hot-toast (client). Server tests use Node's built-in `node:test` runner (no extra deps).

**Spec:** `docs/superpowers/specs/2026-06-14-multi-warehouse-inventory-design.md`

---

## File Structure

**Server (create):**
- `server/models/Warehouse.js` — rewritten: the physical place
- `server/models/WarehouseStock.js` — stock per (warehouse, subProduct, size)
- `server/models/WarehouseMovement.js` — audit log
- `server/services/warehouseStock.helpers.js` — pure rollup math (`computeRollup`)
- `server/services/warehouse.service.js` — rewritten: place CRUD + stock ops + transfer
- `server/__tests__/warehouseStock.helpers.test.js` — node:test unit tests

**Server (modify):**
- `server/controllers/warehouse.controller.js` — rewrite to new endpoints
- `server/routes/warehouse.routes.js` — new route surface
- `server/controllers/subproduct.controller.js` + `server/routes/subproduct.routes.js` — add `stock-by-warehouse`

**Client (create):**
- `client/apps/isomorphic/src/services/warehouseStock.service.ts`
- `client/apps/isomorphic/src/app/(hydrogen)/warehouses/page.tsx`
- `client/apps/isomorphic/src/app/(hydrogen)/warehouses/[id]/page.tsx`
- `client/apps/isomorphic/src/app/shared/warehouses/warehouses-list.tsx`
- `client/apps/isomorphic/src/app/shared/warehouses/warehouse-detail.tsx`
- `client/apps/isomorphic/src/app/shared/warehouses/warehouse-transfer-drawer.tsx`
- `client/apps/isomorphic/src/app/shared/warehouses/subproduct-warehouse-breakdown.tsx`

**Client (modify):**
- `client/apps/isomorphic/src/services/warehouse.service.ts` — rewrite to place model
- `client/apps/isomorphic/src/config/routes.ts` — add warehouses routes

---

## Task 1: Warehouse model (the place)

**Files:**
- Create (overwrite): `server/models/Warehouse.js`

- [ ] **Step 1: Overwrite the model file**

```js
// models/Warehouse.js — the physical place
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const warehouseSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
    type: {
      type: String,
      enum: ['warehouse', 'store', 'distribution_center'],
      default: 'warehouse',
    },
    address: {
      line1: { type: String, maxlength: 200 },
      city: { type: String, maxlength: 100 },
      state: { type: String, maxlength: 100 },
      country: { type: String, maxlength: 100 },
    },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

warehouseSchema.index({ tenant: 1, code: 1 }, { unique: true });
warehouseSchema.index({ tenant: 1, isActive: 1 });

const Warehouse = mongoose.models.Warehouse || mongoose.model('Warehouse', warehouseSchema);
module.exports = Warehouse;
```

> Note: `mongoose.models.Warehouse` is cached per-process. Restart the dev server (`nodemon` restarts on save) so the new schema replaces the old one.

- [ ] **Step 2: Commit**

```bash
git add server/models/Warehouse.js
git commit -m "feat(server): rewrite Warehouse model as physical place"
```

---

## Task 2: WarehouseStock model

**Files:**
- Create: `server/models/WarehouseStock.js`

- [ ] **Step 1: Write the model**

```js
// models/WarehouseStock.js — stock of one size of one subproduct in one warehouse
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const warehouseStockSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    warehouse: { type: ObjectId, ref: 'Warehouse', required: true, index: true },
    subProduct: { type: ObjectId, ref: 'SubProduct', required: true, index: true },
    size: { type: ObjectId, ref: 'Size', required: true, index: true },
    currentQuantity: { type: Number, min: 0, default: 0 },
    reservedQuantity: { type: Number, min: 0, default: 0 },
    zone: { type: String, maxlength: 20 },
    aisle: { type: String, maxlength: 20 },
    shelf: { type: String, maxlength: 20 },
    bin: { type: String, maxlength: 20 },
    minStockLevel: { type: Number, min: 0, default: 0 },
    maxStockLevel: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

warehouseStockSchema.virtual('availableQuantity').get(function () {
  return Math.max(0, (this.currentQuantity || 0) - (this.reservedQuantity || 0));
});

warehouseStockSchema.index(
  { tenant: 1, warehouse: 1, subProduct: 1, size: 1 },
  { unique: true }
);
warehouseStockSchema.index({ tenant: 1, subProduct: 1 });

const WarehouseStock =
  mongoose.models.WarehouseStock || mongoose.model('WarehouseStock', warehouseStockSchema);
module.exports = WarehouseStock;
```

- [ ] **Step 2: Commit**

```bash
git add server/models/WarehouseStock.js
git commit -m "feat(server): add WarehouseStock model (per warehouse/subproduct/size)"
```

---

## Task 3: WarehouseMovement model

**Files:**
- Create: `server/models/WarehouseMovement.js`

- [ ] **Step 1: Write the model**

```js
// models/WarehouseMovement.js — audit trail of warehouse stock changes
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const warehouseMovementSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    warehouse: { type: ObjectId, ref: 'Warehouse', required: true, index: true },
    subProduct: { type: ObjectId, ref: 'SubProduct', required: true, index: true },
    size: { type: ObjectId, ref: 'Size', required: true },
    type: {
      type: String,
      enum: ['received', 'adjusted', 'shipped', 'transfer_in', 'transfer_out'],
      required: true,
    },
    quantity: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reference: { type: String, maxlength: 200 },
    transferGroupId: { type: ObjectId },
    performedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

warehouseMovementSchema.index({ tenant: 1, warehouse: 1, createdAt: -1 });
warehouseMovementSchema.index({ transferGroupId: 1 });

const WarehouseMovement =
  mongoose.models.WarehouseMovement ||
  mongoose.model('WarehouseMovement', warehouseMovementSchema);
module.exports = WarehouseMovement;
```

- [ ] **Step 2: Commit**

```bash
git add server/models/WarehouseMovement.js
git commit -m "feat(server): add WarehouseMovement audit model"
```

---

## Task 4: Rollup helper (pure function + TDD)

**Files:**
- Create: `server/services/warehouseStock.helpers.js`
- Test: `server/__tests__/warehouseStock.helpers.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/__tests__/warehouseStock.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const { computeRollup } = require('../services/warehouseStock.helpers');

test('computeRollup sums quantities across warehouse rows', () => {
  const rows = [
    { currentQuantity: 40, reservedQuantity: 5 },
    { currentQuantity: 12, reservedQuantity: 0 },
  ];
  assert.deepStrictEqual(computeRollup(rows), {
    totalStock: 52,
    reservedStock: 5,
    availableStock: 47,
  });
});

test('computeRollup handles empty list', () => {
  assert.deepStrictEqual(computeRollup([]), {
    totalStock: 0,
    reservedStock: 0,
    availableStock: 0,
  });
});

test('computeRollup treats missing fields as zero', () => {
  const rows = [{ currentQuantity: 10 }, {}];
  assert.deepStrictEqual(computeRollup(rows), {
    totalStock: 10,
    reservedStock: 0,
    availableStock: 10,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/__tests__/warehouseStock.helpers.test.js`
Expected: FAIL — `Cannot find module '../services/warehouseStock.helpers'`

- [ ] **Step 3: Write minimal implementation**

```js
// server/services/warehouseStock.helpers.js
const WarehouseStock = require('../models/WarehouseStock');
const SubProduct = require('../models/SubProduct');

/**
 * Pure: roll a list of warehouse-stock rows into subproduct totals.
 * @param {Array<{currentQuantity?:number, reservedQuantity?:number}>} rows
 */
function computeRollup(rows) {
  const totalStock = rows.reduce((s, r) => s + (r.currentQuantity || 0), 0);
  const reservedStock = rows.reduce((s, r) => s + (r.reservedQuantity || 0), 0);
  return { totalStock, reservedStock, availableStock: Math.max(0, totalStock - reservedStock) };
}

/**
 * DB wrapper: recompute and persist SubProduct rollups from its WarehouseStock rows.
 * Pass an optional Mongoose session for transactional writes.
 */
async function recalcSubProductStock(subProductId, session = null) {
  const q = WarehouseStock.find({ subProduct: subProductId }).select(
    'currentQuantity reservedQuantity'
  );
  if (session) q.session(session);
  const rows = await q.lean();
  const rollup = computeRollup(rows);
  const update = SubProduct.updateOne({ _id: subProductId }, { $set: rollup });
  if (session) update.session(session);
  await update;
  return rollup;
}

module.exports = { computeRollup, recalcSubProductStock };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/__tests__/warehouseStock.helpers.test.js`
Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/services/warehouseStock.helpers.js server/__tests__/warehouseStock.helpers.test.js
git commit -m "feat(server): rollup helper for subproduct stock from warehouses"
```

---

## Task 5: Warehouse service (place CRUD + stock ops + transfer)

**Files:**
- Create (overwrite): `server/services/warehouse.service.js`

This rewrites the service to the new model. The transfer uses a Mongo session so a partial move can't occur.

- [ ] **Step 1: Write the service**

```js
// services/warehouse.service.js
const mongoose = require('mongoose');
const Warehouse = require('../models/Warehouse');
const WarehouseStock = require('../models/WarehouseStock');
const WarehouseMovement = require('../models/WarehouseMovement');
const { recalcSubProductStock } = require('./warehouseStock.helpers');
const { NotFoundError, ValidationError } = require('../utils/errors');

// ── Place CRUD ──────────────────────────────────────────────
async function createWarehouse(data, userId, tenantId) {
  if (data.isDefault) {
    await Warehouse.updateMany({ tenant: tenantId }, { $set: { isDefault: false } });
  }
  return Warehouse.create({ ...data, tenant: tenantId, createdBy: userId });
}

async function getWarehouses(tenantId, filters = {}) {
  const query = { tenant: tenantId };
  if (filters.isActive !== undefined) query.isActive = filters.isActive;
  if (filters.type) query.type = filters.type;
  return Warehouse.find(query).sort({ isDefault: -1, name: 1 }).lean();
}

async function getWarehouseById(id, tenantId) {
  const wh = await Warehouse.findOne({ _id: id, tenant: tenantId }).lean();
  if (!wh) throw new NotFoundError('Warehouse not found');
  return wh;
}

async function updateWarehouse(id, data, tenantId) {
  if (data.isDefault) {
    await Warehouse.updateMany({ tenant: tenantId }, { $set: { isDefault: false } });
  }
  const wh = await Warehouse.findOneAndUpdate(
    { _id: id, tenant: tenantId },
    { $set: data },
    { new: true }
  );
  if (!wh) throw new NotFoundError('Warehouse not found');
  return wh;
}

async function deleteWarehouse(id, tenantId) {
  const hasStock = await WarehouseStock.exists({
    tenant: tenantId,
    warehouse: id,
    currentQuantity: { $gt: 0 },
  });
  if (hasStock) {
    throw new ValidationError(
      'Cannot delete a warehouse that still holds stock. Transfer or zero it out first.'
    );
  }
  const wh = await Warehouse.findOneAndDelete({ _id: id, tenant: tenantId });
  if (!wh) throw new NotFoundError('Warehouse not found');
  await WarehouseStock.deleteMany({ tenant: tenantId, warehouse: id });
  return wh;
}

// ── Stock ───────────────────────────────────────────────────
async function getWarehouseStock(warehouseId, tenantId) {
  return WarehouseStock.find({ tenant: tenantId, warehouse: warehouseId })
    .populate('subProduct', 'sku')
    .populate('size', 'size')
    .sort({ updatedAt: -1 })
    .lean();
}

/**
 * Adjust stock for one (warehouse, subProduct, size) line.
 * type: 'received' | 'shipped' | 'adjusted'
 *   received → +quantity, shipped → -quantity, adjusted → set to quantity (absolute)
 */
async function adjustStock({ warehouseId, subProduct, size, quantity, type, notes }, userId, tenantId) {
  if (!['received', 'shipped', 'adjusted'].includes(type)) {
    throw new ValidationError('Invalid adjustment type');
  }
  let row = await WarehouseStock.findOne({
    tenant: tenantId, warehouse: warehouseId, subProduct, size,
  });
  if (!row) {
    row = new WarehouseStock({ tenant: tenantId, warehouse: warehouseId, subProduct, size });
  }
  if (type === 'received') row.currentQuantity += quantity;
  else if (type === 'shipped') row.currentQuantity = Math.max(0, row.currentQuantity - quantity);
  else if (type === 'adjusted') row.currentQuantity = Math.max(0, quantity);
  await row.save();

  await WarehouseMovement.create({
    tenant: tenantId, warehouse: warehouseId, subProduct, size,
    type, quantity, balanceAfter: row.currentQuantity, reference: notes, performedBy: userId,
  });
  await recalcSubProductStock(subProduct);
  return row;
}

/**
 * Move quantity of one (subProduct, size) from one warehouse to another, atomically.
 */
async function transferStock(
  { subProduct, size, fromWarehouse, toWarehouse, quantity, notes },
  userId,
  tenantId
) {
  if (String(fromWarehouse) === String(toWarehouse)) {
    throw new ValidationError('Source and destination warehouses must differ');
  }
  if (!(quantity > 0)) throw new ValidationError('Quantity must be positive');

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const src = await WarehouseStock.findOne(
        { tenant: tenantId, warehouse: fromWarehouse, subProduct, size }
      ).session(session);
      if (!src || src.currentQuantity < quantity) {
        throw new ValidationError('Insufficient stock in source warehouse');
      }
      src.currentQuantity -= quantity;
      await src.save({ session });

      let dest = await WarehouseStock.findOne(
        { tenant: tenantId, warehouse: toWarehouse, subProduct, size }
      ).session(session);
      if (!dest) {
        dest = new WarehouseStock({
          tenant: tenantId, warehouse: toWarehouse, subProduct, size,
        });
      }
      dest.currentQuantity += quantity;
      await dest.save({ session });

      const transferGroupId = new mongoose.Types.ObjectId();
      await WarehouseMovement.create(
        [
          { tenant: tenantId, warehouse: fromWarehouse, subProduct, size, type: 'transfer_out',
            quantity, balanceAfter: src.currentQuantity, reference: notes, transferGroupId, performedBy: userId },
          { tenant: tenantId, warehouse: toWarehouse, subProduct, size, type: 'transfer_in',
            quantity, balanceAfter: dest.currentQuantity, reference: notes, transferGroupId, performedBy: userId },
        ],
        { session }
      );
      // Total across warehouses is unchanged; recompute as a safety no-op.
      await recalcSubProductStock(subProduct, session);
      result = { from: src, to: dest, transferGroupId };
    });
    return result;
  } finally {
    session.endSession();
  }
}

async function getStockByWarehouse(subProductId, tenantId) {
  return WarehouseStock.find({ tenant: tenantId, subProduct: subProductId })
    .populate('warehouse', 'name code type')
    .populate('size', 'size')
    .lean();
}

module.exports = {
  createWarehouse, getWarehouses, getWarehouseById, updateWarehouse, deleteWarehouse,
  getWarehouseStock, adjustStock, transferStock, getStockByWarehouse,
};
```

- [ ] **Step 2: Sanity-check it loads (no DB needed)**

Run: `node -e "require('./server/services/warehouse.service.js'); console.log('ok')"`
Expected: prints `ok` (module + its model requires resolve without error).

- [ ] **Step 3: Commit**

```bash
git add server/services/warehouse.service.js
git commit -m "feat(server): warehouse service — place CRUD, stock adjust, atomic transfer"
```

---

## Task 6: Warehouse controller (rewrite)

**Files:**
- Modify (overwrite): `server/controllers/warehouse.controller.js`

- [ ] **Step 1: Overwrite the controller**

```js
// controllers/warehouse.controller.js
const warehouseService = require('../services/warehouse.service');
const asyncHandler = require('../utils/asyncHandler');
const { ValidationError } = require('../utils/errors');

const resolveTenantId = (req) => {
  if (req.tenant?._id) return req.tenant._id;
  if (req.user?.role === 'super_admin') {
    const tenantId = req.query.tenantId || req.body.tenantId;
    if (tenantId) return tenantId;
    return null;
  }
  throw new ValidationError('Tenant context required');
};

const requireTenant = (req) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) throw new ValidationError('Tenant ID is required');
  return tenantId;
};

const createWarehouse = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const data = await warehouseService.createWarehouse(req.body, req.user._id, tenantId);
  res.status(201).json({ success: true, message: 'Warehouse created', data });
});

const getWarehouses = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  const filters = {};
  if (req.query.isActive !== undefined) filters.isActive = req.query.isActive === 'true';
  if (req.query.type) filters.type = req.query.type;
  const data = await warehouseService.getWarehouses(tenantId, filters);
  res.json({ success: true, data });
});

const getWarehouseById = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const data = await warehouseService.getWarehouseById(req.params.id, tenantId);
  res.json({ success: true, data });
});

const updateWarehouse = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const data = await warehouseService.updateWarehouse(req.params.id, req.body, tenantId);
  res.json({ success: true, message: 'Warehouse updated', data });
});

const deleteWarehouse = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  await warehouseService.deleteWarehouse(req.params.id, tenantId);
  res.json({ success: true, message: 'Warehouse deleted' });
});

const getWarehouseStock = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const data = await warehouseService.getWarehouseStock(req.params.id, tenantId);
  res.json({ success: true, data });
});

const adjustWarehouseStock = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const { subProduct, size, quantity, type, notes } = req.body;
  const data = await warehouseService.adjustStock(
    { warehouseId: req.params.id, subProduct, size, quantity: Number(quantity), type, notes },
    req.user._id,
    tenantId
  );
  res.json({ success: true, message: 'Stock adjusted', data });
});

const transferStock = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const { subProduct, size, fromWarehouse, toWarehouse, quantity, notes } = req.body;
  const data = await warehouseService.transferStock(
    { subProduct, size, fromWarehouse, toWarehouse, quantity: Number(quantity), notes },
    req.user._id,
    tenantId
  );
  res.json({ success: true, message: 'Stock transferred', data });
});

module.exports = {
  createWarehouse, getWarehouses, getWarehouseById, updateWarehouse, deleteWarehouse,
  getWarehouseStock, adjustWarehouseStock, transferStock,
};
```

- [ ] **Step 2: Commit**

```bash
git add server/controllers/warehouse.controller.js
git commit -m "feat(server): rewrite warehouse controller for place + stock endpoints"
```

---

## Task 7: Warehouse routes (rewrite)

**Files:**
- Modify (overwrite): `server/routes/warehouse.routes.js`

- [ ] **Step 1: Overwrite the routes**

```js
// routes/warehouse.routes.js
const express = require('express');
const router = express.Router();
const c = require('../controllers/warehouse.controller');
const { protect, attachTenant, tenantAdminOrSuperAdmin } = require('../middleware/auth.middleware');

router.use(protect);
router.use(attachTenant);

router.post('/transfer', tenantAdminOrSuperAdmin, c.transferStock);

router.route('/')
  .get(tenantAdminOrSuperAdmin, c.getWarehouses)
  .post(tenantAdminOrSuperAdmin, c.createWarehouse);

router.route('/:id')
  .get(tenantAdminOrSuperAdmin, c.getWarehouseById)
  .patch(tenantAdminOrSuperAdmin, c.updateWarehouse)
  .delete(tenantAdminOrSuperAdmin, c.deleteWarehouse);

router.get('/:id/stock', tenantAdminOrSuperAdmin, c.getWarehouseStock);
router.post('/:id/stock/adjust', tenantAdminOrSuperAdmin, c.adjustWarehouseStock);

module.exports = router;
```

> `/transfer` is declared before `/:id` so Express does not treat "transfer" as an id.

- [ ] **Step 2: Verify the routes load**

Run: `cd server && node -e "require('./routes/warehouse.routes.js'); console.log('routes ok')"`
Expected: prints `routes ok`.

- [ ] **Step 3: Commit**

```bash
git add server/routes/warehouse.routes.js
git commit -m "feat(server): warehouse routes for CRUD, stock, transfer"
```

---

## Task 8: Subproduct stock-by-warehouse endpoint

**Files:**
- Modify: `server/controllers/subproduct.controller.js` (add one handler + export)
- Modify: `server/routes/subproduct.routes.js` (add one route)

- [ ] **Step 1: Add the controller handler**

At the top of `server/controllers/subproduct.controller.js`, ensure this require exists (add if missing):

```js
const warehouseService = require('../services/warehouse.service');
```

Add this handler (follow the file's existing `asyncHandler` style; if the file does not use `asyncHandler`, wrap in try/catch like its neighbours):

```js
// GET /api/subproducts/:id/stock-by-warehouse
const getStockByWarehouse = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id || req.query.tenantId;
  const data = await warehouseService.getStockByWarehouse(req.params.id, tenantId);
  res.json({ success: true, data });
});
```

Add `getStockByWarehouse` to the file's `module.exports`.

- [ ] **Step 2: Add the route**

In `server/routes/subproduct.routes.js`, add (next to the other `:id` GET routes, after `protect`/`attachTenant` are applied):

```js
router.get('/:id/stock-by-warehouse', tenantAdminOrSuperAdmin, getStockByWarehouse);
```

Make sure `getStockByWarehouse` is included in the destructured import from the controller at the top of the routes file, and that `tenantAdminOrSuperAdmin` is imported there (mirror `warehouse.routes.js` if not).

- [ ] **Step 3: Verify it loads**

Run: `cd server && node -e "require('./routes/subproduct.routes.js'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add server/controllers/subproduct.controller.js server/routes/subproduct.routes.js
git commit -m "feat(server): subproduct stock-by-warehouse endpoint"
```

---

## Task 9: Client — rewrite warehouse.service.ts + add warehouseStock.service.ts

**Files:**
- Modify (overwrite): `client/apps/isomorphic/src/services/warehouse.service.ts`
- Create: `client/apps/isomorphic/src/services/warehouseStock.service.ts`

- [ ] **Step 1: Overwrite `warehouse.service.ts` (place CRUD)**

```ts
// services/warehouse.service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface WarehouseAddress {
  line1?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface Warehouse {
  _id: string;
  tenant: string;
  name: string;
  code: string;
  type: 'warehouse' | 'store' | 'distribution_center';
  address?: WarehouseAddress;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WarehouseInput = {
  name: string;
  code: string;
  type: Warehouse['type'];
  address?: WarehouseAddress;
  isActive?: boolean;
  isDefault?: boolean;
};

async function handle(res: Response, fallback: string) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || fallback);
  }
  return res.json();
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const jsonAuth = (token: string) => ({ 'Content-Type': 'application/json', ...auth(token) });

export const warehouseService = {
  async getWarehouses(token: string, params?: { isActive?: boolean; type?: string }) {
    const qs = new URLSearchParams();
    if (params?.isActive !== undefined) qs.set('isActive', String(params.isActive));
    if (params?.type) qs.set('type', params.type);
    const url = `${API_URL}/api/warehouses${qs.toString() ? `?${qs}` : ''}`;
    return handle(await fetch(url, { headers: auth(token) }), 'Failed to load warehouses');
  },
  async getWarehouseById(id: string, token: string) {
    return handle(
      await fetch(`${API_URL}/api/warehouses/${id}`, { headers: auth(token) }),
      'Failed to load warehouse'
    );
  },
  async createWarehouse(data: WarehouseInput, token: string) {
    return handle(
      await fetch(`${API_URL}/api/warehouses`, {
        method: 'POST', headers: jsonAuth(token), body: JSON.stringify(data),
      }),
      'Failed to create warehouse'
    );
  },
  async updateWarehouse(id: string, data: Partial<WarehouseInput>, token: string) {
    return handle(
      await fetch(`${API_URL}/api/warehouses/${id}`, {
        method: 'PATCH', headers: jsonAuth(token), body: JSON.stringify(data),
      }),
      'Failed to update warehouse'
    );
  },
  async deleteWarehouse(id: string, token: string) {
    return handle(
      await fetch(`${API_URL}/api/warehouses/${id}`, { method: 'DELETE', headers: auth(token) }),
      'Failed to delete warehouse'
    );
  },
};
```

- [ ] **Step 2: Create `warehouseStock.service.ts`**

```ts
// services/warehouseStock.service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface WarehouseStockRow {
  _id: string;
  warehouse: string | { _id: string; name?: string; code?: string; type?: string };
  subProduct: string | { _id: string; sku?: string };
  size: string | { _id: string; size?: string };
  currentQuantity: number;
  reservedQuantity: number;
  zone?: string;
  aisle?: string;
  shelf?: string;
  bin?: string;
}

export type AdjustType = 'received' | 'shipped' | 'adjusted';

async function handle(res: Response, fallback: string) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || fallback);
  }
  return res.json();
}
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const jsonAuth = (token: string) => ({ 'Content-Type': 'application/json', ...auth(token) });

export const warehouseStockService = {
  async getWarehouseStock(warehouseId: string, token: string) {
    return handle(
      await fetch(`${API_URL}/api/warehouses/${warehouseId}/stock`, { headers: auth(token) }),
      'Failed to load warehouse stock'
    );
  },
  async adjustStock(
    warehouseId: string,
    body: { subProduct: string; size: string; quantity: number; type: AdjustType; notes?: string },
    token: string
  ) {
    return handle(
      await fetch(`${API_URL}/api/warehouses/${warehouseId}/stock/adjust`, {
        method: 'POST', headers: jsonAuth(token), body: JSON.stringify(body),
      }),
      'Failed to adjust stock'
    );
  },
  async transferStock(
    body: {
      subProduct: string; size: string; fromWarehouse: string; toWarehouse: string;
      quantity: number; notes?: string;
    },
    token: string
  ) {
    return handle(
      await fetch(`${API_URL}/api/warehouses/transfer`, {
        method: 'POST', headers: jsonAuth(token), body: JSON.stringify(body),
      }),
      'Failed to transfer stock'
    );
  },
  async getStockByWarehouse(subProductId: string, token: string) {
    return handle(
      await fetch(`${API_URL}/api/subproducts/${subProductId}/stock-by-warehouse`, {
        headers: auth(token),
      }),
      'Failed to load stock breakdown'
    );
  },
};
```

- [ ] **Step 3: Type-check**

Run: `cd client/apps/isomorphic && npx tsc --noEmit`
Expected: no errors referencing `warehouse.service.ts` or `warehouseStock.service.ts`. (Pre-existing repo errors unrelated to these files are out of scope.)

- [ ] **Step 4: Commit**

```bash
git add client/apps/isomorphic/src/services/warehouse.service.ts client/apps/isomorphic/src/services/warehouseStock.service.ts
git commit -m "feat(client): warehouse + warehouseStock services"
```

---

## Task 10: Client — routes config

**Files:**
- Modify: `client/apps/isomorphic/src/config/routes.ts`

- [ ] **Step 1: Inspect the existing structure**

Run: `grep -n "purchases" client/apps/isomorphic/src/config/routes.ts | head`
Expected: shows how the `purchases` group is declared (object of path strings / functions).

- [ ] **Step 2: Add a warehouses group**

Following the same object shape used by `purchases`, add inside the exported `routes` object:

```ts
  warehouses: {
    list: '/warehouses',
    detail: (id: string) => `/warehouses/${id}`,
  },
```

(If `purchases` uses a different convention — e.g. flat keys — match that convention instead. The two entries needed are the list path `/warehouses` and a detail builder for `/warehouses/:id`.)

- [ ] **Step 3: Type-check**

Run: `cd client/apps/isomorphic && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add client/apps/isomorphic/src/config/routes.ts
git commit -m "feat(client): add warehouses routes"
```

---

## Task 11: Client — warehouses list page + component

**Files:**
- Create: `client/apps/isomorphic/src/app/(hydrogen)/warehouses/page.tsx`
- Create: `client/apps/isomorphic/src/app/shared/warehouses/warehouses-list.tsx`

- [ ] **Step 1: Create the page (thin wrapper, mirrors purchases page)**

```tsx
// app/(hydrogen)/warehouses/page.tsx
'use client';
import WarehousesList from '@/app/shared/warehouses/warehouses-list';

export default function WarehousesPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F3]">
      <main className="mx-auto max-w-7xl px-4 py-6">
        <WarehousesList />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create the list component**

```tsx
// app/shared/warehouses/warehouses-list.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { PiPlus, PiPencilSimple, PiTrash, PiEye } from 'react-icons/pi';
import {
  warehouseService,
  type Warehouse,
  type WarehouseInput,
} from '@/services/warehouse.service';
import { routes } from '@/config/routes';

const EMPTY: WarehouseInput = {
  name: '', code: '', type: 'warehouse',
  address: { line1: '', city: '', state: '', country: '' },
  isActive: true, isDefault: false,
};

export default function WarehousesList() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [items, setItems] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [form, setForm] = useState<WarehouseInput>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await warehouseService.getWarehouses(token);
      setItems(res.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (w: Warehouse) => {
    setEditing(w);
    setForm({
      name: w.name, code: w.code, type: w.type,
      address: w.address ?? {}, isActive: w.isActive, isDefault: w.isDefault,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error('Name and code are required');
      return;
    }
    setSaving(true);
    try {
      if (editing) await warehouseService.updateWarehouse(editing._id, form, token);
      else await warehouseService.createWarehouse(form, token);
      toast.success(editing ? 'Updated' : 'Created');
      setShowForm(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (w: Warehouse) => {
    if (!confirm(`Delete warehouse "${w.name}"?`)) return;
    try {
      await warehouseService.deleteWarehouse(w._id, token);
      toast.success('Deleted');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Warehouses</h1>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-[#B20202] px-4 py-2 text-white"
        >
          <PiPlus /> New warehouse
        </button>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500">No warehouses yet. Create your first one.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => (
                <tr key={w._id} className="border-t">
                  <td className="px-4 py-3">
                    {w.name} {w.isDefault && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs">Default</span>}
                  </td>
                  <td className="px-4 py-3">{w.code}</td>
                  <td className="px-4 py-3">{w.type.replace('_', ' ')}</td>
                  <td className="px-4 py-3">{w.address?.city ?? '—'}</td>
                  <td className="px-4 py-3">{w.isActive ? 'Active' : 'Inactive'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link href={routes.warehouses.detail(w._id)} className="rounded p-1.5 hover:bg-gray-100" title="View stock">
                        <PiEye />
                      </Link>
                      <button onClick={() => openEdit(w)} className="rounded p-1.5 hover:bg-gray-100" title="Edit">
                        <PiPencilSimple />
                      </button>
                      <button onClick={() => remove(w)} className="rounded p-1.5 text-red-600 hover:bg-red-50" title="Delete">
                        <PiTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">{editing ? 'Edit' : 'New'} warehouse</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-1 text-sm">Name
                <input className="mt-1 w-full rounded border px-3 py-2" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="col-span-1 text-sm">Code
                <input className="mt-1 w-full rounded border px-3 py-2" value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </label>
              <label className="col-span-1 text-sm">Type
                <select className="mt-1 w-full rounded border px-3 py-2" value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as Warehouse['type'] })}>
                  <option value="warehouse">Warehouse</option>
                  <option value="store">Store</option>
                  <option value="distribution_center">Distribution center</option>
                </select>
              </label>
              <label className="col-span-1 text-sm">City
                <input className="mt-1 w-full rounded border px-3 py-2" value={form.address?.city ?? ''}
                  onChange={(e) => setForm({ ...form, address: { ...form.address, city: e.target.value } })} />
              </label>
              <label className="col-span-2 text-sm">Address
                <input className="mt-1 w-full rounded border px-3 py-2" value={form.address?.line1 ?? ''}
                  onChange={(e) => setForm({ ...form, address: { ...form.address, line1: e.target.value } })} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /> Default
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2">Cancel</button>
              <button onClick={save} disabled={saving} className="rounded-lg bg-[#B20202] px-4 py-2 text-white disabled:opacity-60">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify it renders**

Run the client dev server (the repo's usual command for `client/apps/isomorphic`), log in as a tenant, visit `/warehouses`. Create a warehouse and confirm it appears in the table; edit and delete work; deleting one with no stock succeeds.

- [ ] **Step 4: Commit**

```bash
git add "client/apps/isomorphic/src/app/(hydrogen)/warehouses/page.tsx" client/apps/isomorphic/src/app/shared/warehouses/warehouses-list.tsx
git commit -m "feat(client): warehouses list + create/edit/delete"
```

---

## Task 12: Client — warehouse detail page (stock view + adjust)

**Files:**
- Create: `client/apps/isomorphic/src/app/(hydrogen)/warehouses/[id]/page.tsx`
- Create: `client/apps/isomorphic/src/app/shared/warehouses/warehouse-detail.tsx`

- [ ] **Step 1: Create the page**

```tsx
// app/(hydrogen)/warehouses/[id]/page.tsx
'use client';
import { useParams } from 'next/navigation';
import WarehouseDetail from '@/app/shared/warehouses/warehouse-detail';

export default function WarehouseDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="min-h-screen bg-[#FAF8F3]">
      <main className="mx-auto max-w-7xl px-4 py-6">
        <WarehouseDetail warehouseId={id} />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create the detail component**

```tsx
// app/shared/warehouses/warehouse-detail.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { PiArrowLeft, PiArrowsLeftRight } from 'react-icons/pi';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
import {
  warehouseStockService,
  type WarehouseStockRow,
  type AdjustType,
} from '@/services/warehouseStock.service';
import WarehouseTransferDrawer from './warehouse-transfer-drawer';
import { routes } from '@/config/routes';

const skuOf = (r: WarehouseStockRow) =>
  typeof r.subProduct === 'object' ? r.subProduct.sku ?? r.subProduct._id : r.subProduct;
const sizeOf = (r: WarehouseStockRow) =>
  typeof r.size === 'object' ? r.size.size ?? r.size._id : r.size;
const idOf = (v: WarehouseStockRow['subProduct'] | WarehouseStockRow['size']) =>
  typeof v === 'object' ? v._id : v;

export default function WarehouseDetail({ warehouseId }: { warehouseId: string }) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [rows, setRows] = useState<WarehouseStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferRow, setTransferRow] = useState<WarehouseStockRow | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [wh, stock] = await Promise.all([
        warehouseService.getWarehouseById(warehouseId, token),
        warehouseStockService.getWarehouseStock(warehouseId, token),
      ]);
      setWarehouse(wh.data);
      setRows(stock.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, warehouseId]);

  useEffect(() => { load(); }, [load]);

  const adjust = async (row: WarehouseStockRow, type: AdjustType) => {
    const raw = prompt(
      type === 'adjusted' ? 'Set quantity to:' : `Quantity to ${type === 'received' ? 'add' : 'remove'}:`
    );
    if (raw == null) return;
    const quantity = Number(raw);
    if (!Number.isFinite(quantity) || quantity < 0) {
      toast.error('Enter a valid number');
      return;
    }
    try {
      await warehouseStockService.adjustStock(
        warehouseId,
        { subProduct: String(idOf(row.subProduct)), size: String(idOf(row.size)), quantity, type },
        token
      );
      toast.success('Stock adjusted');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Adjust failed');
    }
  };

  return (
    <div>
      <Link href={routes.warehouses.list} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600">
        <PiArrowLeft /> Warehouses
      </Link>
      <h1 className="mb-1 text-2xl font-semibold">{warehouse?.name ?? 'Warehouse'}</h1>
      <p className="mb-6 text-sm text-gray-500">{warehouse?.code} · {warehouse?.type?.replace('_', ' ')}</p>

      {loading ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500">No stock in this warehouse yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3 text-right">On hand</th>
                <th className="px-4 py-3 text-right">Reserved</th>
                <th className="px-4 py-3 text-right">Available</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} className="border-t">
                  <td className="px-4 py-3">{skuOf(r)}</td>
                  <td className="px-4 py-3">{sizeOf(r)}</td>
                  <td className="px-4 py-3 text-right">{r.currentQuantity}</td>
                  <td className="px-4 py-3 text-right">{r.reservedQuantity}</td>
                  <td className="px-4 py-3 text-right">{Math.max(0, r.currentQuantity - r.reservedQuantity)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => adjust(r, 'received')} className="rounded border px-2 py-1 text-xs">+ Receive</button>
                      <button onClick={() => adjust(r, 'shipped')} className="rounded border px-2 py-1 text-xs">− Ship</button>
                      <button onClick={() => adjust(r, 'adjusted')} className="rounded border px-2 py-1 text-xs">Set</button>
                      <button onClick={() => setTransferRow(r)} className="rounded border px-2 py-1 text-xs inline-flex items-center gap-1">
                        <PiArrowsLeftRight /> Transfer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {transferRow && (
        <WarehouseTransferDrawer
          fromWarehouseId={warehouseId}
          subProductId={String(idOf(transferRow.subProduct))}
          sizeId={String(idOf(transferRow.size))}
          label={`${skuOf(transferRow)} · ${sizeOf(transferRow)}`}
          maxQuantity={transferRow.currentQuantity}
          onClose={() => setTransferRow(null)}
          onDone={async () => { setTransferRow(null); await load(); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Visit `/warehouses/<id>` for a warehouse that already has at least one stock row (seed via the Final Verification steps if needed). Confirm on-hand/available update after each adjust action.

> A row only appears for a (warehouse, subProduct, size) once it has been touched by an adjust or a transfer-in. Seeding the very first row is covered in Final Verification (`type: received` via the adjust endpoint). A UI "+ Add item" control is a listed follow-up, out of scope here.

- [ ] **Step 4: Commit**

```bash
git add "client/apps/isomorphic/src/app/(hydrogen)/warehouses/[id]/page.tsx" client/apps/isomorphic/src/app/shared/warehouses/warehouse-detail.tsx
git commit -m "feat(client): warehouse detail — per-warehouse stock view + adjust"
```

---

## Task 13: Client — transfer drawer

**Files:**
- Create: `client/apps/isomorphic/src/app/shared/warehouses/warehouse-transfer-drawer.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/shared/warehouses/warehouse-transfer-drawer.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
import { warehouseStockService } from '@/services/warehouseStock.service';

interface Props {
  fromWarehouseId: string;
  subProductId: string;
  sizeId: string;
  label: string;
  maxQuantity: number;
  onClose: () => void;
  onDone: () => void;
}

export default function WarehouseTransferDrawer({
  fromWarehouseId, subProductId, sizeId, label, maxQuantity, onClose, onDone,
}: Props) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [toWarehouse, setToWarehouse] = useState('');
  const [quantity, setQuantity] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    warehouseService
      .getWarehouses(token, { isActive: true })
      .then((res) => setWarehouses((res.data ?? []).filter((w: Warehouse) => w._id !== fromWarehouseId)))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load warehouses'));
  }, [token, fromWarehouseId]);

  const submit = async () => {
    const qty = Number(quantity);
    if (!toWarehouse) return toast.error('Pick a destination');
    if (!Number.isFinite(qty) || qty <= 0) return toast.error('Enter a quantity');
    if (qty > maxQuantity) return toast.error(`Only ${maxQuantity} available`);
    setBusy(true);
    try {
      await warehouseStockService.transferStock(
        { subProduct: subProductId, size: sizeId, fromWarehouse: fromWarehouseId, toWarehouse, quantity: qty },
        token
      );
      toast.success('Transferred');
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="h-full w-full max-w-md bg-white p-6">
        <h2 className="mb-1 text-lg font-semibold">Transfer stock</h2>
        <p className="mb-6 text-sm text-gray-500">{label} · {maxQuantity} on hand</p>

        <label className="mb-4 block text-sm">Destination warehouse
          <select className="mt-1 w-full rounded border px-3 py-2" value={toWarehouse}
            onChange={(e) => setToWarehouse(e.target.value)}>
            <option value="">Select…</option>
            {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name} ({w.code})</option>)}
          </select>
        </label>

        <label className="mb-6 block text-sm">Quantity
          <input type="number" min={1} max={maxQuantity} className="mt-1 w-full rounded border px-3 py-2"
            value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border px-4 py-2">Cancel</button>
          <button onClick={submit} disabled={busy} className="rounded-lg bg-[#B20202] px-4 py-2 text-white disabled:opacity-60">
            {busy ? 'Transferring…' : 'Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

With stock in warehouse A and a second warehouse B existing, open A's detail, click Transfer on a row, move N units to B. Confirm A decreases, B increases (visit B), and the subproduct's `totalStock` is unchanged.

- [ ] **Step 3: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/warehouses/warehouse-transfer-drawer.tsx
git commit -m "feat(client): warehouse stock transfer drawer"
```

---

## Task 14: Client — per-subproduct warehouse breakdown card

**Files:**
- Create: `client/apps/isomorphic/src/app/shared/warehouses/subproduct-warehouse-breakdown.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/shared/warehouses/subproduct-warehouse-breakdown.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { warehouseStockService, type WarehouseStockRow } from '@/services/warehouseStock.service';

const whName = (r: WarehouseStockRow) =>
  typeof r.warehouse === 'object' ? r.warehouse.name ?? r.warehouse._id : r.warehouse;
const sizeName = (r: WarehouseStockRow) =>
  typeof r.size === 'object' ? r.size.size ?? r.size._id : r.size;

export default function SubproductWarehouseBreakdown({ subProductId }: { subProductId: string }) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [rows, setRows] = useState<WarehouseStockRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !subProductId) return;
    setLoading(true);
    warehouseStockService
      .getStockByWarehouse(subProductId, token)
      .then((res) => setRows(res.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [token, subProductId]);

  const total = rows.reduce((s, r) => s + r.currentQuantity, 0);

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">Stock by warehouse</h3>
        <span className="text-sm text-gray-500">{total} total</span>
      </div>
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400">Not stocked in any warehouse.</p>
      ) : (
        <ul className="divide-y text-sm">
          {rows.map((r) => (
            <li key={r._id} className="flex items-center justify-between py-2">
              <span>{whName(r)} <span className="text-gray-400">· {sizeName(r)}</span></span>
              <span className="font-medium">{r.currentQuantity}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Render `<SubproductWarehouseBreakdown subProductId={...} />` on a subproduct page (or a scratch route) for a subproduct that has stock in two warehouses. Confirm it lists each warehouse/size with quantities and a correct total.

- [ ] **Step 3: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/warehouses/subproduct-warehouse-breakdown.tsx
git commit -m "feat(client): per-subproduct warehouse breakdown card"
```

---

## Final verification (manual end-to-end)

- [ ] Restart the server so the new `Warehouse` schema replaces the cached old one.
- [ ] Create two warehouses (one marked default).
- [ ] Seed the first stock row into warehouse A via the adjust endpoint with a known `subProduct`+`size` id, e.g.:
  ```bash
  curl -X POST "$API/api/warehouses/<A_ID>/stock/adjust" \
    -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
    -d '{"subProduct":"<SP_ID>","size":"<SIZE_ID>","quantity":50,"type":"received"}'
  ```
  Confirm the row appears on `/warehouses/<A_ID>` and the subproduct's `totalStock` increased by 50.
- [ ] Transfer some units A → B; confirm A↓, B↑, subproduct `totalStock` unchanged.
- [ ] Ship some from B; confirm subproduct `totalStock` decreases by that amount.
- [ ] Attempt to delete a warehouse holding stock; confirm it is blocked with the guard message.
- [ ] Open a subproduct breakdown; confirm per-warehouse quantities and total are correct.
- [ ] Run `node --test server/__tests__/warehouseStock.helpers.test.js` — all green.

---

## Notes / known follow-ups (out of scope here)

- Receiving directly into a warehouse from a Purchase Order (wire PO receive → `stock/adjust` with `type: 'received'`).
- A "+ Add item to warehouse" control to seed a brand-new (warehouse, subProduct, size) row from the UI instead of via transfer/curl.
- `reservedQuantity` is tracked but not yet driven by live orders.
- Replace `prompt()`/`confirm()` placeholders in the detail/list components with the app's modal components if the team prefers consistency with `purchases/`.
