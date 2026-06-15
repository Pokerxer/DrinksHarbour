# Inventory History — Warehouse Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show, on every inventory History-tab movement row, which warehouse the stock moved through (and `Source → Destination` for transfers).

**Architecture:** Additive only — no stock math changes. (1) A `resolveMovementWarehouse` helper stamps `warehouse` on every `InventoryMovement.create` path, falling back to the tenant's default warehouse. (2) The read endpoints populate the warehouse refs. (3) The client renders a warehouse chip per row and a Warehouse/Route field in the detail panel.

**Tech Stack:** Node/Express + Mongoose (server), Next.js + React + TypeScript + Tailwind + react-icons/pi (client). No test runner is configured server-side; verification is by running a focused Node script and by manual QA (see Task 9).

**Spec:** `docs/superpowers/specs/2026-06-15-inventory-history-warehouse-details-design.md`

---

## File Structure

**Server**
- `server/services/inventory.service.js` — add `Warehouse` require, add `resolveMovementWarehouse` helper, stamp `warehouse` at 6 create sites here, add 3 `.populate()` calls in two read functions, export the helper.
- `server/controllers/purchaseOrder.controller.js` — stamp `warehouse` at the vendor-return create site (`:1712`).
- `server/controllers/pos.controller.js` — stamp `warehouse` at the 3 POS audit create sites (`:151`, `:209`, `:236`) via the shared helper.

**Client**
- `client/apps/isomorphic/src/services/inventory.service.ts` — tighten `warehouse` type, add `sourceWarehouse`/`destinationWarehouse` to `InventoryMovement`.
- `client/apps/isomorphic/src/app/shared/ecommerce/sub-product/create-edit/inventory/HistoryTab/ServerMovementsList.tsx` — add `getWarehouseInfo` helper, a row chip, and a detail-panel field.

**Verification scaffold**
- `server/scripts/verify-warehouse-stamping.js` — throwaway Node script used by Task 1/2/8 to assert behaviour against a connected DB. Deleted in Task 10.

---

## Task 1: `resolveMovementWarehouse` helper + Warehouse require

**Files:**
- Modify: `server/services/inventory.service.js` (imports near line 20-23; new helper after the `audit` function ~line 90; exports ~line 777)
- Verify: `server/scripts/verify-warehouse-stamping.js` (create)

- [ ] **Step 1: Add the Warehouse model require**

In `server/services/inventory.service.js`, the imports currently end at:

```js
const mongoose          = require('mongoose');
const SubProduct        = require('../models/SubProduct');
const Size              = require('../models/Size');
const InventoryMovement = require('../models/InventoryMovement');
```

Add one line after the `InventoryMovement` require:

```js
const Warehouse         = require('../models/Warehouse');
```

- [ ] **Step 2: Add the helper**

Insert this function immediately after the `audit(...)` function (it closes around line 90, just before the `// ─── public API ───` banner):

```js
/**
 * Resolve the warehouse a movement should be attributed to.
 * @param {string|ObjectId} tenantId
 * @param {string|ObjectId|null|undefined} explicitWarehouseId
 * @returns {Promise<ObjectId|string|null>} explicit id if given, else the tenant's
 *   default warehouse id, else null. Never throws.
 */
async function resolveMovementWarehouse(tenantId, explicitWarehouseId) {
  if (explicitWarehouseId) return explicitWarehouseId;
  try {
    const def = await Warehouse.findOne({ tenant: tenantId, isDefault: true })
      .select('_id')
      .lean();
    return def?._id || null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Export the helper**

The module export block near line 777 reads:

```js
  createMovement, getMovements, getInventorySummary,
```

Add `resolveMovementWarehouse` to the exported object. Find the `module.exports = { ... }` and add the name (place it alongside the other function names):

```js
  resolveMovementWarehouse,
```

- [ ] **Step 4: Write the verification script**

Create `server/scripts/verify-warehouse-stamping.js`:

```js
// Throwaway verification for warehouse stamping. Run against a dev DB.
// Usage: node server/scripts/verify-warehouse-stamping.js
require('dotenv').config();
const mongoose = require('mongoose');
const assert = require('assert');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const Warehouse = require('../models/Warehouse');
  const svc = require('../services/inventory.service');

  const wh = await Warehouse.findOne({ isDefault: true }).select('_id tenant').lean();
  assert(wh, 'Need at least one isDefault warehouse in the DB to verify');
  const tenantId = wh.tenant;

  // explicit id is returned as-is
  const explicit = await svc.resolveMovementWarehouse(tenantId, '64b000000000000000000abc');
  assert.strictEqual(explicit, '64b000000000000000000abc', 'explicit id should pass through');

  // falls back to default
  const fallback = await svc.resolveMovementWarehouse(tenantId, undefined);
  assert.strictEqual(String(fallback), String(wh._id), 'should fall back to default warehouse');

  // unknown tenant → null
  const none = await svc.resolveMovementWarehouse(new mongoose.Types.ObjectId(), undefined);
  assert.strictEqual(none, null, 'unknown tenant should resolve to null');

  console.log('✅ resolveMovementWarehouse OK');
  await mongoose.disconnect();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
```

- [ ] **Step 5: Run the verification script**

Run: `node server/scripts/verify-warehouse-stamping.js`
Expected: prints `✅ resolveMovementWarehouse OK` and exits 0.
(If the DB has no `isDefault` warehouse, set one first: `db.warehouses.updateOne({}, { $set: { isDefault: true } })`.)

- [ ] **Step 6: Commit**

```bash
git add server/services/inventory.service.js server/scripts/verify-warehouse-stamping.js
git commit -m "feat(server): add resolveMovementWarehouse helper for movement attribution"
```

---

## Task 2: Stamp warehouse on inventory.service create sites

**Files:**
- Modify: `server/services/inventory.service.js` (sites at ~`:63`, `:281`, `:401`, `:445`, `:507`, `:527`, `:573`)

- [ ] **Step 1: Stamp the order audit loop (~line 50-84)**

In `audit(items, orderId, type, category, performedBy)`, resolve the warehouse **once** before the `for` loop and stamp it on each created movement. The function body starts:

```js
function audit(items, orderId, type, category, performedBy) {
  setImmediate(async () => {
    for (const item of items) {
```

Change to resolve once using the first item's tenant (all items in one order share a tenant):

```js
function audit(items, orderId, type, category, performedBy) {
  setImmediate(async () => {
    const tenantForWh = items[0]?.tenant;
    const auditWarehouse = tenantForWh
      ? await resolveMovementWarehouse(tenantForWh, undefined)
      : null;
    for (const item of items) {
```

Then in the `InventoryMovement.create({ ... })` call inside the loop, add the field (after the `tenant: item.tenant,` line):

```js
          warehouse:     auditWarehouse || undefined,
```

- [ ] **Step 2: Stamp `recordReceived` (~line 281)**

`recordReceived(subProductId, tenantId, data, performedBy)` destructures `data` at the top (line 257-261). Add `warehouseId` to that destructure:

```js
  const {
    quantity, unitCost, reference, supplierId, supplierName,
    batchNumber, lotNumber, expirationDate, notes, reason,
    sizeId, sizeName, warehouseId,
  } = data;
```

Just before the `const movement = await InventoryMovement.create({` (line 281), resolve:

```js
  const movementWarehouse = await resolveMovementWarehouse(tenantId || sp.tenant, warehouseId);
```

Inside the `create({ ... })`, add after `tenant: tenantId || sp.tenant,`:

```js
    warehouse:      movementWarehouse || undefined,
```

- [ ] **Step 3: Stamp `adjustInventory` (~line 401)**

`adjustInventory(subProductId, tenantId, adjustment, reason, performedBy, notes, reference)` has no `data` object — it always falls back to default. Just before `const movement = await InventoryMovement.create({` (line 401), add:

```js
  const movementWarehouse = await resolveMovementWarehouse(tenantId || sp.tenant, undefined);
```

Inside the `create({ ... })`, add after `tenant: tenantId || sp.tenant,`:

```js
    warehouse:      movementWarehouse || undefined,
```

- [ ] **Step 4: Stamp `recordReturn` (~line 445)**

`recordReturn(subProductId, tenantId, data, performedBy)` destructures `data` (line 428):

```js
  const { quantity, reason, notes, reference, relatedOrder } = data;
```

Add `warehouseId`:

```js
  const { quantity, reason, notes, reference, relatedOrder, warehouseId } = data;
```

Just before `const movement = await InventoryMovement.create({` (line 445), add:

```js
  const movementWarehouse = await resolveMovementWarehouse(tenantId || sp.tenant, warehouseId);
```

Inside the `create({ ... })`, add after `tenant: tenantId || sp.tenant,`:

```js
    warehouse:      movementWarehouse || undefined,
```

- [ ] **Step 5: Stamp transfers (~line 507 & 527)**

In `transferStock`, both create calls already set `sourceWarehouse` and `destinationWarehouse`. Add a single-warehouse attribution per side.

For `outMovement` (line 507), add after `tenant: tenantId || sp.tenant,`:

```js
    warehouse:           sourceWarehouseId,
```

For `inMovement` (line 527), add after `tenant: tenantId || sp.tenant,`:

```js
    warehouse:           destinationWarehouseId,
```

- [ ] **Step 6: Stamp generic `createMovement` (~line 573)**

`createMovement(data, performedBy, tenantId)` — just before `const movement = await InventoryMovement.create({` (line 573), add:

```js
  const movementWarehouse = await resolveMovementWarehouse(tenantId || sp.tenant, data.warehouseId);
```

Inside the `create({ ... })`, add after `tenant: tenantId || sp.tenant,`:

```js
    warehouse:      movementWarehouse || undefined,
```

- [ ] **Step 7: Smoke-check the file parses**

Run: `node -e "require('./server/services/inventory.service.js'); console.log('loads ok')"`
Expected: prints `loads ok` (no syntax errors).

- [ ] **Step 8: Commit**

```bash
git add server/services/inventory.service.js
git commit -m "feat(server): stamp warehouse on inventory.service movement create paths"
```

---

## Task 3: Stamp warehouse on PO vendor-return movement

**Files:**
- Modify: `server/controllers/purchaseOrder.controller.js` (`:1712`)

- [ ] **Step 1: Confirm the inventory service is imported**

Run: `grep -n "require.*inventory.service\|inventoryService" server/controllers/purchaseOrder.controller.js | head -3`
Expected: a line importing the service (e.g. `const inventoryService = require('../services/inventory.service');`). If absent, add it near the other requires at the top of the file.

- [ ] **Step 2: Resolve the warehouse before the create**

This create site (`:1712`) is inside a `for` loop over PO lines. The PO receive flow resolves a target warehouse elsewhere; for the return audit, resolve the tenant default once **before the loop**. Find the loop that contains the `InventoryMovement.create` at `:1712` and, immediately before that loop begins, add:

```js
  const returnWarehouse = await inventoryService.resolveMovementWarehouse(tenantId, po.warehouse || undefined);
```

(`po.warehouse` is used if the PO carries a receiving warehouse; otherwise it falls back to the tenant default. If `po.warehouse` does not exist on the model, pass `undefined` — the helper falls back to default.)

- [ ] **Step 3: Stamp the movement**

In the `InventoryMovement.create({ ... })` at `:1712`, add after `tenant: tenantId,`:

```js
        warehouse:           returnWarehouse || undefined,
```

- [ ] **Step 4: Smoke-check the file parses**

Run: `node -e "require('./server/controllers/purchaseOrder.controller.js'); console.log('loads ok')"`
Expected: prints `loads ok`.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/purchaseOrder.controller.js
git commit -m "feat(server): stamp warehouse on PO vendor-return movement"
```

---

## Task 4: Stamp warehouse on POS audit movements

**Files:**
- Modify: `server/controllers/pos.controller.js` (`deductStock` ~`:42-174`, `restoreStock` ~`:180-249`)

- [ ] **Step 1: Confirm inventory service import**

Run: `grep -n "inventory.service\|inventoryService" server/controllers/pos.controller.js | head -3`
Expected: an import line. If absent, add near the top requires:

```js
const inventoryService = require('../services/inventory.service');
```

- [ ] **Step 2: Stamp the POS sale audit (`deductStock`, ~line 151)**

`deductStock` has `tenantId` in scope. Just before the `InventoryMovement.create({` at line 151, add:

```js
  const saleWarehouse = await inventoryService.resolveMovementWarehouse(tenantId, undefined);
```

Inside the `create({ ... })`, add after `tenant: tenantId,`:

```js
    warehouse:      saleWarehouse || undefined,
```

(This is a fire-and-forget audit; one extra indexed lookup per line is acceptable.)

- [ ] **Step 3: Stamp the POS sized-return audit (`restoreStock`, ~line 209)**

In `restoreStock`, just before the first `InventoryMovement.create({` (line 209, the sized branch), add:

```js
    const restoreWarehouse = await inventoryService.resolveMovementWarehouse(tenantId, undefined);
```

Inside that `create({ ... })`, add after `tenant: tenantId,` (it is on the same line as `subProduct`: `subProduct: subProductId, tenant: tenantId, product: productId || undefined,`) — append the field on a new line within the object:

```js
      warehouse: restoreWarehouse || undefined,
```

- [ ] **Step 4: Stamp the POS no-size-return audit (`restoreStock`, ~line 236)**

In the `else` branch, just before the `InventoryMovement.create({` (line 236), add:

```js
    const restoreWarehouseNoSize = await inventoryService.resolveMovementWarehouse(tenantId, undefined);
```

Inside that `create({ ... })`, add after `tenant: tenantId,`:

```js
      warehouse: restoreWarehouseNoSize || undefined,
```

- [ ] **Step 5: Smoke-check the file parses**

Run: `node -e "require('./server/controllers/pos.controller.js'); console.log('loads ok')"`
Expected: prints `loads ok`.

- [ ] **Step 6: Commit**

```bash
git add server/controllers/pos.controller.js
git commit -m "feat(server): stamp warehouse on POS sale and return movements"
```

---

## Task 5: Populate warehouse refs on read endpoints

**Files:**
- Modify: `server/services/inventory.service.js` (`getMovements` ~`:619-626`, `getInventorySummary` recentMovements ~`:646-651`)

- [ ] **Step 1: Populate in `getMovements`**

The query at line 619-626 reads:

```js
    InventoryMovement.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('performedBy', 'firstName lastName email posName')
      .populate('size', 'displayName size')
      .populate('relatedOrder', 'orderNumber receiptNumber placedAt')
      .lean(),
```

Add three populate calls before `.lean()`:

```js
      .populate('warehouse', 'name code')
      .populate('sourceWarehouse', 'name code')
      .populate('destinationWarehouse', 'name code')
      .lean(),
```

- [ ] **Step 2: Populate in `getInventorySummary` recentMovements**

The query at line 646-651 reads:

```js
    InventoryMovement.find({ tenant: tId, subProduct: spId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('performedBy', 'firstName lastName')
      .populate('size', 'displayName size')
      .lean(),
```

Add three populate calls before `.lean()`:

```js
      .populate('warehouse', 'name code')
      .populate('sourceWarehouse', 'name code')
      .populate('destinationWarehouse', 'name code')
      .lean(),
```

- [ ] **Step 3: Verify populated output with the script**

Append a populate check to `server/scripts/verify-warehouse-stamping.js` before the final `console.log('✅ ...')` and `disconnect`:

```js
  // Populate check: most recent movements with a warehouse should expose { name, code }
  const res = await svc.getMovements(tenantId, { limit: 20 });
  const withWh = res.data.movements.find(m => m.warehouse);
  if (withWh) {
    assert(typeof withWh.warehouse === 'object', 'warehouse should be populated to an object');
    assert('name' in withWh.warehouse || 'code' in withWh.warehouse, 'warehouse should have name/code');
    console.log('✅ getMovements populates warehouse:', withWh.warehouse.name || withWh.warehouse.code);
  } else {
    console.log('ℹ️  no movements with a warehouse yet (create one to fully verify)');
  }
```

- [ ] **Step 4: Run the verification script**

Run: `node server/scripts/verify-warehouse-stamping.js`
Expected: prints `✅ resolveMovementWarehouse OK` and either `✅ getMovements populates warehouse: ...` or the `ℹ️ no movements with a warehouse yet` notice.

- [ ] **Step 5: Commit**

```bash
git add server/services/inventory.service.js server/scripts/verify-warehouse-stamping.js
git commit -m "feat(server): populate warehouse refs in getMovements and summary"
```

---

## Task 6: Client type updates

**Files:**
- Modify: `client/apps/isomorphic/src/services/inventory.service.ts` (`InventoryMovement`, ~line 21)

- [ ] **Step 1: Replace the `warehouse?: any;` line**

The interface currently has (line 21):

```ts
  warehouse?: any;
```

Replace with three typed fields:

```ts
  warehouse?: { _id: string; name?: string; code?: string } | string | null;
  sourceWarehouse?: { _id: string; name?: string; code?: string } | string | null;
  destinationWarehouse?: { _id: string; name?: string; code?: string } | string | null;
```

- [ ] **Step 2: Type-check the client**

Run: `cd client/apps/isomorphic && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: no new errors referencing `inventory.service.ts` or `ServerMovementsList`. (The file uses `// @ts-nocheck`, so pre-existing files won't error; confirm no new errors are introduced.)

- [ ] **Step 3: Commit**

```bash
git add client/apps/isomorphic/src/services/inventory.service.ts
git commit -m "feat(client): type warehouse refs on InventoryMovement"
```

---

## Task 7: `getWarehouseInfo` helper + row chip

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/ecommerce/sub-product/create-edit/inventory/HistoryTab/ServerMovementsList.tsx` (helpers block near `getSourceBadge` ~line 68; row render ~line 2473)

- [ ] **Step 1: Add the helper**

Immediately after the `getSourceBadge` function (ends ~line 75), add:

```tsx
function whLabel(w: any): string | null {
  if (!w) return null;
  if (typeof w === 'object') return w.name || w.code || null;
  return null; // bare id (unpopulated) → nothing to show
}

type WarehouseInfo =
  | { kind: 'single'; label: string }
  | { kind: 'route'; from: string; to: string }
  | null;

function getWarehouseInfo(m: InventoryMovement): WarehouseInfo {
  const from = whLabel((m as any).sourceWarehouse);
  const to   = whLabel((m as any).destinationWarehouse);
  if (from && to) return { kind: 'route', from, to };
  const single = whLabel(m.warehouse) || from || to;
  return single ? { kind: 'single', label: single } : null;
}
```

- [ ] **Step 2: Render the chip in the row**

In the row badge strip (the `<div className="flex flex-wrap items-center gap-1.5">` block, ~line 2468-2479), the size chip is:

```tsx
                      {sizeName && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{sizeName}</span>}
```

Immediately after that line, add a warehouse chip. First compute `wh` at the top of the `paginated.map(m => { ... })` callback, next to the existing `const sizeName = ...` (line 2446):

```tsx
              const wh = getWarehouseInfo(m);
```

Then add the chip JSX right after the size chip:

```tsx
                      {wh && (
                        <span className="flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                          <PiWarehouse className="h-3 w-3" />
                          {wh.kind === 'route' ? `${wh.from} → ${wh.to}` : wh.label}
                        </span>
                      )}
```

(`PiWarehouse` is already imported at the top of the file — confirm it appears in the `react-icons/pi` import on line 13.)

- [ ] **Step 3: Visual verify (manual)**

Run the client dev server and open a sub-product edit page → Inventory → History. (See Task 9 for the launch command.)
Expected: rows for transfers show `🏭 A → B`; rows with a single warehouse show `🏭 Name`; rows with no warehouse show no chip.

- [ ] **Step 4: Commit**

```bash
git add "client/apps/isomorphic/src/app/shared/ecommerce/sub-product/create-edit/inventory/HistoryTab/ServerMovementsList.tsx"
git commit -m "feat(client): show warehouse chip on history movement rows"
```

---

## Task 8: Warehouse field in the detail panel

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/ecommerce/sub-product/create-edit/inventory/HistoryTab/ServerMovementsList.tsx` (`MovementDetailPanel` fields list ~line 2285-2294)

- [ ] **Step 1: Compute the info in the panel**

`MovementDetailPanel` already computes `cat`, `style`, `source` near line 2110-2112. Add after `const source = getSourceBadge(movement);`:

```tsx
  const wh = getWarehouseInfo(movement);
```

- [ ] **Step 2: Add the field**

The fields array (line 2285-2294) starts:

```tsx
              {[
                { label: 'Status',    value: <StatusBadge status={movement.status} /> },
                { label: 'Source',    value: <span className={`flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${source.cls}`}>{source.icon}{source.label}</span> },
```

Insert a warehouse entry right after the `Source` entry (the `.filter(Boolean)` already drops falsy entries, so a `null` is safe):

```tsx
                wh && (wh.kind === 'route'
                  ? { label: 'Route',     value: `${wh.from} → ${wh.to}` }
                  : { label: 'Warehouse', value: wh.label }),
```

- [ ] **Step 3: Visual verify (manual)**

In the running client, click a movement row to open the detail panel → Movement tab.
Expected: a `Warehouse` row (single) or `Route` row (transfer) appears under `Source`; movements without a warehouse show neither. `MovesTab` (which imports `MovementDetailPanel`) shows the same.

- [ ] **Step 4: Commit**

```bash
git add "client/apps/isomorphic/src/app/shared/ecommerce/sub-product/create-edit/inventory/HistoryTab/ServerMovementsList.tsx"
git commit -m "feat(client): show warehouse/route in movement detail panel"
```

---

## Task 9: End-to-end manual QA

**Files:** none (verification only)

- [ ] **Step 1: Start the stack**

Start the server and client per the repo's usual dev commands (e.g. `npm run dev` in `server/`, and in `client/apps/isomorphic/`). Ensure the tenant has at least one warehouse with `isDefault: true`.

- [ ] **Step 2: Exercise each path and check the History tab**

For a chosen sub-product, perform and then confirm the History row shows the expected warehouse:

1. Manual **receive** stock → row shows default warehouse chip.
2. Manual **adjust** → chip shows default warehouse.
3. **Transfer** between warehouse A and B (Locations tab) → if the transfer writes an `InventoryMovement` (legacy path), it shows `A → B`. (Note: warehouse-service transfers write `WarehouseMovement`, which is out of scope and not shown here.)
4. **POS sale** of the product → row shows default warehouse chip.
5. An **old** pre-existing movement → shows no chip (expected; no backfill).

- [ ] **Step 3: Confirm no regressions**

- Filters (All/Sales/Returns/Stock In/…) still work.
- Pagination still works.
- Receipt printing (POS/online/PO/return) still opens and renders.
- Cancelling a movement still works.

- [ ] **Step 4: Commit (if any QA-driven fixes were needed)**

```bash
git add -A
git commit -m "fix(history): warehouse-detail QA adjustments"
```

(Skip if no changes.)

---

## Task 10: Remove verification scaffold

**Files:**
- Delete: `server/scripts/verify-warehouse-stamping.js`

- [ ] **Step 1: Delete the script**

```bash
git rm server/scripts/verify-warehouse-stamping.js
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore(server): remove warehouse-stamping verification scaffold"
```

---

## Self-Review Notes

- **Spec coverage:** Layer 1 (helper + 8 create sites: 6 in inventory.service Task 2, 1 PO Task 3, 3 POS Task 4 — note POS has 3 sites so total create-site edits = 6+1+3=10 across 8 logical "paths") ✓; Layer 2 (two read populates, Task 5) ✓; Layer 3 (type Task 6, chip Task 7, detail field Task 8) ✓; Warehouse require note (Task 1) ✓; testing/QA (Tasks 1,5,9) ✓; no-backfill acknowledged (Task 9 step 2.5) ✓.
- **No test runner server-side:** verification uses a connected-DB Node script + smoke `require()` parse checks + manual QA, since the repo has no configured server test harness. If one is added later, the script's asserts translate directly to unit tests.
- **Type consistency:** `resolveMovementWarehouse(tenantId, explicitWarehouseId)`, `getWarehouseInfo(m)`, `whLabel(w)`, and the `{ kind: 'single' | 'route' }` shape are used identically in Tasks 7 and 8.
