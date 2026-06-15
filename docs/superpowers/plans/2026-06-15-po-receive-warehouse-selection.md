# PO Receive → Warehouse Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When validating a PO receipt, the user picks one destination warehouse; received quantities post into that warehouse via the new multi-warehouse `warehouseService.adjustStock`, replacing the legacy `inventoryService.recordReceived` write.

**Architecture:** Extract the warehouse resolution + per-line posting logic out of the express handler into a small, dependency-injected helper module (`server/services/poReceive.helpers.js`) so it is unit-testable with a fake `adjustStock` — no Mongo required, matching the existing `node:test` style. The controller's `validated` branch then calls these helpers. Client gains an optional `warehouseId` on the status call and a required destination `<select>` in the receipt confirm panel.

**Tech Stack:** Node + Express + Mongoose (server), `node:test` (server tests), Next.js + React + TypeScript + react-hot-toast (client).

---

## File Structure

- **Create** `server/services/poReceive.helpers.js` — pure-ish helpers: `resolveTargetWarehouse(warehouseId, defaultWarehouseId)` (throws `ValidationError` when neither resolves) and `postReceivedStock({ purchaseOrder, targetWarehouseId, adjustStock, userId, tenantId, logger })` (loops items, calls injected `adjustStock`, returns `{ successCount, failCount }`). Dependency-injected so it is testable without a DB.
- **Create** `server/__tests__/poReceive.helpers.test.js` — `node:test` coverage for resolution + posting using a fake `adjustStock`.
- **Modify** `server/controllers/purchaseOrder.controller.js` — add requires; in the `status === "validated"` branch, resolve the target warehouse up-front (throw before any write), then replace the `recordReceived` loop with `postReceivedStock`.
- **Modify** `client/apps/isomorphic/src/services/purchaseOrder.service.ts` — add optional `warehouseId` param to `updatePurchaseOrderStatus`, include in PATCH body when provided.
- **Modify** `client/apps/isomorphic/src/app/shared/purchases/purchases-receipt-detail.tsx` — load active warehouses, render required destination select, disable Validate when none exist, pass `warehouseId` on the `validated` call, name destination in the success toast.

### Note on the "subproduct rollup" server test (deliberate deviation)

The spec lists a server test asserting the subproduct rollup reflects the received quantity. Rollup recomputation lives entirely inside `warehouseService.adjustStock` (`recalcSubProductStock`), which is already covered by the helper tests and was E2E-verified on 2026-06-15. There is no in-memory Mongo in this repo (`mongodb-memory-server` is absent; `npm test` is a placeholder; existing `__tests__` are pure unit tests). Rather than introduce a DB-coupled test, the helper unit tests assert `adjustStock` is invoked **once per qualifying line with the correct args**, and rollup correctness is confirmed by the manual browser check in Task 5. This is a conscious trade chosen for deterministic, dependency-free tests.

---

## Task 1: Server helper module (TDD)

**Files:**
- Create: `server/services/poReceive.helpers.js`
- Test: `server/__tests__/poReceive.helpers.test.js`

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/poReceive.helpers.test.js`:

```js
// server/__tests__/poReceive.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  resolveTargetWarehouse,
  postReceivedStock,
} = require('../services/poReceive.helpers');
const { ValidationError } = require('../utils/errors');

const silentLogger = { log() {}, error() {} };

test('resolveTargetWarehouse prefers the explicit warehouseId', () => {
  assert.strictEqual(resolveTargetWarehouse('wh-explicit', 'wh-default'), 'wh-explicit');
});

test('resolveTargetWarehouse falls back to the default when none given', () => {
  assert.strictEqual(resolveTargetWarehouse(undefined, 'wh-default'), 'wh-default');
  assert.strictEqual(resolveTargetWarehouse('', 'wh-default'), 'wh-default');
});

test('resolveTargetWarehouse throws ValidationError when neither resolves', () => {
  assert.throws(
    () => resolveTargetWarehouse(undefined, null),
    (err) => err instanceof ValidationError && /destination warehouse/i.test(err.message)
  );
});

test('postReceivedStock posts each qualifying line to the chosen warehouse', async () => {
  const calls = [];
  const adjustStock = async (payload, userId, tenantId) => {
    calls.push({ payload, userId, tenantId });
  };
  const purchaseOrder = {
    poNumber: 'PO-1001',
    items: [
      { subProductId: 'sp1', sizeId: 'sz1', quantity: 10, receivedQty: 6, subProductName: 'A' },
      { subProductId: 'sp2', sizeId: 'sz2', quantity: 4, receivedQty: 0, subProductName: 'B' },
    ],
  };

  const result = await postReceivedStock({
    purchaseOrder,
    targetWarehouseId: 'wh-A',
    adjustStock,
    userId: 'u1',
    tenantId: 't1',
    logger: silentLogger,
  });

  assert.deepStrictEqual(result, { successCount: 2, failCount: 0 });
  assert.strictEqual(calls.length, 2);
  // Line 1 uses receivedQty (6); line 2 falls back to quantity (4).
  assert.deepStrictEqual(calls[0].payload, {
    warehouseId: 'wh-A',
    subProduct: 'sp1',
    size: 'sz1',
    quantity: 6,
    type: 'received',
    notes: 'PO Receipt: PO-1001',
  });
  assert.strictEqual(calls[1].payload.quantity, 4);
  assert.strictEqual(calls[0].userId, 'u1');
  assert.strictEqual(calls[0].tenantId, 't1');
});

test('postReceivedStock skips a line missing sizeId but posts the others', async () => {
  const calls = [];
  const adjustStock = async (payload) => { calls.push(payload); };
  const purchaseOrder = {
    poNumber: 'PO-1002',
    items: [
      { subProductId: 'sp1', sizeId: null, quantity: 5, receivedQty: 5, subProductName: 'NoSize' },
      { subProductId: 'sp2', sizeId: 'sz2', quantity: 3, receivedQty: 3, subProductName: 'Ok' },
    ],
  };

  const result = await postReceivedStock({
    purchaseOrder,
    targetWarehouseId: 'wh-A',
    adjustStock,
    userId: 'u1',
    tenantId: 't1',
    logger: silentLogger,
  });

  assert.deepStrictEqual(result, { successCount: 1, failCount: 1 });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].subProduct, 'sp2');
});

test('postReceivedStock skips a line missing subProductId', async () => {
  const calls = [];
  const adjustStock = async (payload) => { calls.push(payload); };
  const purchaseOrder = {
    poNumber: 'PO-1003',
    items: [{ subProductId: null, sizeId: 'sz1', quantity: 5, receivedQty: 5 }],
  };

  const result = await postReceivedStock({
    purchaseOrder,
    targetWarehouseId: 'wh-A',
    adjustStock,
    userId: 'u1',
    tenantId: 't1',
    logger: silentLogger,
  });

  assert.deepStrictEqual(result, { successCount: 0, failCount: 1 });
  assert.strictEqual(calls.length, 0);
});

test('postReceivedStock ignores zero-quantity lines without counting them', async () => {
  const calls = [];
  const adjustStock = async (payload) => { calls.push(payload); };
  const purchaseOrder = {
    poNumber: 'PO-1004',
    items: [{ subProductId: 'sp1', sizeId: 'sz1', quantity: 0, receivedQty: 0 }],
  };

  const result = await postReceivedStock({
    purchaseOrder,
    targetWarehouseId: 'wh-A',
    adjustStock,
    userId: 'u1',
    tenantId: 't1',
    logger: silentLogger,
  });

  assert.deepStrictEqual(result, { successCount: 0, failCount: 0 });
  assert.strictEqual(calls.length, 0);
});

test('postReceivedStock counts an adjustStock throw as a failed line and continues', async () => {
  const calls = [];
  const adjustStock = async (payload) => {
    if (payload.subProduct === 'sp1') throw new Error('boom');
    calls.push(payload);
  };
  const purchaseOrder = {
    poNumber: 'PO-1005',
    items: [
      { subProductId: 'sp1', sizeId: 'sz1', quantity: 5, receivedQty: 5 },
      { subProductId: 'sp2', sizeId: 'sz2', quantity: 5, receivedQty: 5 },
    ],
  };

  const result = await postReceivedStock({
    purchaseOrder,
    targetWarehouseId: 'wh-A',
    adjustStock,
    userId: 'u1',
    tenantId: 't1',
    logger: silentLogger,
  });

  assert.deepStrictEqual(result, { successCount: 1, failCount: 1 });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].subProduct, 'sp2');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && node --test __tests__/poReceive.helpers.test.js`
Expected: FAIL — `Cannot find module '../services/poReceive.helpers'`.

- [ ] **Step 3: Write the minimal implementation**

Create `server/services/poReceive.helpers.js`:

```js
// server/services/poReceive.helpers.js
const { ValidationError } = require('../utils/errors');

/**
 * Decide which warehouse received stock should land in.
 * @param {string|undefined|null} warehouseId  explicit choice from the request body
 * @param {string|undefined|null} defaultWarehouseId  the tenant's default warehouse id (may be null)
 * @returns {string} the resolved warehouse id
 * @throws {ValidationError} when neither resolves
 */
function resolveTargetWarehouse(warehouseId, defaultWarehouseId) {
  const target = warehouseId || defaultWarehouseId;
  if (!target) {
    throw new ValidationError(
      'Select a destination warehouse (or set a default) before validating.'
    );
  }
  return target;
}

/**
 * Post each received PO line into the target warehouse via the injected adjustStock.
 * Lines missing subProductId or sizeId are skipped and counted as failures.
 * @returns {Promise<{ successCount: number, failCount: number }>}
 */
async function postReceivedStock({
  purchaseOrder,
  targetWarehouseId,
  adjustStock,
  userId,
  tenantId,
  logger = console,
}) {
  let successCount = 0;
  let failCount = 0;

  for (const item of purchaseOrder.items) {
    const quantityToAdd =
      item.receivedQty !== undefined &&
      item.receivedQty !== null &&
      item.receivedQty > 0
        ? item.receivedQty
        : item.quantity;

    if (quantityToAdd <= 0) {
      continue;
    }

    if (!item.subProductId || !item.sizeId) {
      const missing = !item.subProductId ? 'subProductId' : 'sizeId';
      logger.log(
        `   ❌ Skipping line — missing ${missing} (${item.subProductName || item.sku || 'unknown item'})`
      );
      failCount++;
      continue;
    }

    try {
      await adjustStock(
        {
          warehouseId: targetWarehouseId,
          subProduct: item.subProductId,
          size: item.sizeId,
          quantity: quantityToAdd,
          type: 'received',
          notes: `PO Receipt: ${purchaseOrder.poNumber}`,
        },
        userId,
        tenantId
      );
      successCount++;
    } catch (err) {
      logger.error(`   ❌ Failed to post line to warehouse: ${err.message}`);
      failCount++;
    }
  }

  return { successCount, failCount };
}

module.exports = { resolveTargetWarehouse, postReceivedStock };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && node --test __tests__/poReceive.helpers.test.js`
Expected: PASS — all tests green (8 tests, 0 failures).

- [ ] **Step 5: Commit**

```bash
git add server/services/poReceive.helpers.js server/__tests__/poReceive.helpers.test.js
git commit -m "feat(server): PO receive warehouse-resolution + posting helpers (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Wire helpers into the validated branch of the controller

**Files:**
- Modify: `server/controllers/purchaseOrder.controller.js` (requires near top ~lines 2–16; `validated` branch ~lines 515–595)

- [ ] **Step 1: Add the requires**

After the existing `const inventoryService = require("../services/inventory.service");` line (~line 9), add:

```js
const warehouseService = require("../services/warehouse.service");
const {
  resolveTargetWarehouse,
  postReceivedStock,
} = require("../services/poReceive.helpers");
```

(Leave the `inventoryService` require in place — it is still used by other branches/handlers in this file.)

- [ ] **Step 2: Read the warehouseId from the request body**

In `updatePurchaseOrderStatus`, find (~line 447):

```js
  const { receivedItems } = req.body;
```

Replace with:

```js
  const { receivedItems, warehouseId } = req.body;
```

- [ ] **Step 3: Resolve the target warehouse up-front and replace the posting loop**

In the `if (status === "validated") {` block, replace this span — from the `purchaseOrder.fullyReceivedDate = new Date();` / default-warehouse `try/catch` (~lines 521–530) down through the end of the per-item `for (const item of purchaseOrder.items) { ... }` loop and its `🏁 PO Validation Complete` log (~line 595) — with the code below.

Current code being replaced (for reference — match the existing block between the `console.log('⚠️ PO ...')` guard at ~line 518 and the vendor-pricelist sync `try` at ~line 599):

```js
    purchaseOrder.fullyReceivedDate = new Date();

    // Get default warehouse for tenant (optional - can be null)
    let defaultWarehouseId;
    try {
      defaultWarehouseId = await getDefaultWarehouse(tenantId);
    } catch (e) {
      console.log('No default warehouse found, skipping warehouse update');
      defaultWarehouseId = null;
    }
    // ... existing logging + the entire `for (const item of purchaseOrder.items)` recordReceived loop ...
    console.log(`🏁 PO Validation Complete: ${successCount} succeeded, ${failCount} failed`);
```

New code:

```js
    // Resolve the destination warehouse BEFORE writing anything, so a missing
    // warehouse fails validation cleanly with nothing posted.
    let defaultWarehouseId = null;
    try {
      defaultWarehouseId = await getDefaultWarehouse(tenantId);
    } catch (e) {
      defaultWarehouseId = null;
    }
    const targetWarehouseId = resolveTargetWarehouse(warehouseId, defaultWarehouseId);

    purchaseOrder.fullyReceivedDate = new Date();

    console.log(
      `🔍 PO Validation Start: ${purchaseOrder.poNumber} → warehouse ${targetWarehouseId} — ${purchaseOrder.items?.length || 0} items`
    );

    const { successCount, failCount } = await postReceivedStock({
      purchaseOrder,
      targetWarehouseId,
      adjustStock: warehouseService.adjustStock,
      userId: req.user?._id || purchaseOrder.createdBy,
      tenantId,
    });

    console.log(`🏁 PO Validation Complete: ${successCount} succeeded, ${failCount} failed`);
```

Notes:
- `resolveTargetWarehouse` throws `ValidationError` when nothing resolves; because it runs before `purchaseOrder.save()` (~line 637), the throw is converted by `asyncHandler` into an error response with nothing persisted.
- The verbose per-item `console.log` item dump is intentionally dropped (the helper logs skips). Keep it lean.
- Leave untouched below this block: the vendor-pricelist auto-sync `try`, the auto-bill `try`, `await purchaseOrder.save()`, and the `received` branch.

- [ ] **Step 4: Verify the controller still loads and existing helper tests pass**

Run: `cd server && node -e "require('./controllers/purchaseOrder.controller'); console.log('controller loads OK')"`
Expected: `controller loads OK` (no missing-module / syntax errors).

Run: `cd server && node --test __tests__/`
Expected: PASS — `warehouseStock.helpers.test.js` (3) + `poReceive.helpers.test.js` (8) all green.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/purchaseOrder.controller.js
git commit -m "feat(server): post PO receipts into chosen warehouse via adjustStock

Resolve destination warehouse (body warehouseId or tenant default) before
any write; replace legacy inventoryService.recordReceived on the validated
path with warehouseService.adjustStock through postReceivedStock.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Client service — accept an optional warehouseId

**Files:**
- Modify: `client/apps/isomorphic/src/services/purchaseOrder.service.ts:128-158`

- [ ] **Step 1: Extend the method signature and body**

Replace the whole `updatePurchaseOrderStatus` method (lines 128–158) with:

```ts
  async updatePurchaseOrderStatus(
    id: string,
    status: string,
    token: string,
    receivedItems?: { itemId: string; receivedQty: number }[],
    warehouseId?: string
  ): Promise<CreatePOResponse> {
    const body = JSON.stringify({
      status,
      ...(receivedItems && { receivedItems }),
      ...(warehouseId && { warehouseId }),
    });

    const response = await fetch(
      `${API_URL}/api/purchase-orders/${id}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.message || 'Failed to update purchase order status'
      );
    }

    return response.json();
  },
```

- [ ] **Step 2: Type-check the service**

Run: `cd client/apps/isomorphic && npx tsc --noEmit`
Expected: PASS — 0 errors. (Existing call sites pass 3–4 args; the new 5th param is optional, so they still type-check.)

- [ ] **Step 3: Commit**

```bash
git add client/apps/isomorphic/src/services/purchaseOrder.service.ts
git commit -m "feat(client): updatePurchaseOrderStatus accepts optional warehouseId

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Client receipt-detail — destination warehouse picker

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/purchases/purchases-receipt-detail.tsx`

- [ ] **Step 1: Import the warehouse service and routes already present**

At the top of the file, after the `purchaseOrderService` import (line 23), add:

```ts
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
```

(`routes` is already imported on line 22 and exposes `routes` but the destination notice links to `/warehouses` via `routes` — see Step 4. `Warehouse` is the type exported from the service.)

- [ ] **Step 2: Add warehouse state and load active warehouses on mount**

After the existing state declarations (after `const [confirming, setConfirming] = useState(false);`, line 45), add:

```ts
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>('');
```

After the existing `useEffect(() => { load(); }, [load]);` (line 69), add a second effect:

```ts
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await warehouseService.getWarehouses(token, {
          isActive: true,
        });
        if (cancelled) return;
        const list: Warehouse[] = res.data ?? [];
        setWarehouses(list);
        const preferred = list.find((w) => w.isDefault) ?? list[0];
        if (preferred) setWarehouseId(preferred._id);
      } catch {
        if (!cancelled) setWarehouses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);
```

- [ ] **Step 3: Pass the chosen warehouseId on the `validated` call and name the destination in the toast**

In `handleValidate` (lines 168–195), replace the two `updatePurchaseOrderStatus` calls and the success toast:

```ts
      await purchaseOrderService.updatePurchaseOrderStatus(
        id,
        'received',
        token,
        receivedItems
      );
      await purchaseOrderService.updatePurchaseOrderStatus(
        id,
        'validated',
        token
      );
      toast.success('Receipt validated — stock updated');
```

with:

```ts
      await purchaseOrderService.updatePurchaseOrderStatus(
        id,
        'received',
        token,
        receivedItems
      );
      await purchaseOrderService.updatePurchaseOrderStatus(
        id,
        'validated',
        token,
        undefined,
        warehouseId
      );
      const destName =
        warehouses.find((w) => w._id === warehouseId)?.name ?? 'inventory';
      toast.success(`Receipt validated — stock added to ${destName}`);
```

- [ ] **Step 4: Render the destination select (or a "create a warehouse" notice) in the confirm panel**

In the confirm panel (the `{confirming && ( ... )}` block, lines 567–615), insert the following **between** the closing `</p>` of the descriptive paragraph (line 594) and the `<div className="flex gap-2">` action row (line 595):

```tsx
          {warehouses.length === 0 ? (
            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              No warehouses exist yet. You must{' '}
              <Link
                href={routes.warehouses.list}
                className="font-semibold underline hover:text-amber-900"
              >
                create a warehouse
              </Link>{' '}
              before you can receive stock.
            </div>
          ) : (
            <div className="mb-3">
              <label
                htmlFor="destination-warehouse"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Destination warehouse
              </label>
              <select
                id="destination-warehouse"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
              >
                {warehouses.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                    {w.code ? ` (${w.code})` : ''}
                    {w.isDefault ? ' — default' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
```

Then update the **"Yes, Add to Stock"** button (lines 604–612) so it is disabled when no warehouse is selected — change its `disabled` prop:

```tsx
              disabled={validating || warehouses.length === 0 || !warehouseId}
```

(Leave the rest of the button unchanged.)

- [ ] **Step 5: Type-check**

Run: `cd client/apps/isomorphic && npx tsc --noEmit`
Expected: PASS — 0 errors. (`routes.warehouses.list` is `'/warehouses'` per `config/routes.ts`; `warehouseService.getWarehouses` returns `{ data }`.)

- [ ] **Step 6: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/purchases/purchases-receipt-detail.tsx
git commit -m "feat(client): pick destination warehouse when validating a PO receipt

Load active warehouses, default to the isDefault (else first) warehouse,
require a selection to validate, link to /warehouses when none exist, and
name the destination in the success toast.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Full verification (tests + type-check + manual browser)

**Files:** none (verification only)

- [ ] **Step 1: Run all server tests**

Run: `cd server && node --test __tests__/`
Expected: PASS — 11 tests total (3 warehouseStock helpers + 8 poReceive helpers), 0 failures.

- [ ] **Step 2: Confirm the controller loads**

Run: `cd server && node -e "require('./controllers/purchaseOrder.controller'); console.log('OK')"`
Expected: `OK`.

- [ ] **Step 3: Type-check the client**

Run: `cd client/apps/isomorphic && npx tsc --noEmit`
Expected: PASS — 0 errors.

- [ ] **Step 4: Manual browser check**

Use the env from `memory/multi_warehouse_progress.md`:
- Backend: `cd server && MONGODB_URI='mongodb://localhost:27017/drinksharbour?replicaSet=rs0' node server.js` (port 5001).
- Client: `next dev` on port 3001 (warm routes with `curl` before driving; auth via injected `next-auth.session-token` cookie from a curl credentials login — `admin@drinksharbour.com` / `Admin@123!SecurePassword`).
- Reuse the puppeteer-core harness in `/tmp/dh-verify/` if present.

Verify:
1. Open the receive page for a confirmed PO whose items carry `subProductId` + `sizeId`; click **Validate & Add Stock** → confirm panel shows the **Destination warehouse** select defaulted to WH-A (Main Warehouse, the default) or first active.
2. Pick **WH-A**, click **Yes, Add to Stock** → success toast names WH-A; redirected to PO detail.
3. `/warehouses/<WH-A id>` detail shows the received quantity incremented for that SKU/size.
4. The subproduct rollup reflects the increase: `GET /api/subproducts/<id>/stock-by-warehouse` (or the subproduct total) increased by the received quantity.
5. Negative path (optional, if a tenant with no warehouses is available): with no warehouses, the confirm panel shows the "create a warehouse" notice and the Add-to-Stock button is disabled; a direct `validated` PATCH without a resolvable warehouse returns the `ValidationError` and posts nothing.

Expected: stock posts to the chosen warehouse, rollup updates, no double-counting (legacy inventory path no longer runs).

- [ ] **Step 5: Update memory and offer push/PR**

- Update `memory/multi_warehouse_progress.md`: mark "PO receive → warehouse selection" done (3 files + helper module + tests), note it replaced the legacy `recordReceived` write, and record the verification result.
- Ask the user whether to push `feat/multi-warehouse-inventory` and/or open a PR.

---

## Self-Review

**Spec coverage:**
- Server: read `warehouseId`, resolve `targetWarehouseId = warehouseId || getDefaultWarehouse(tenant)` with the default lookup wrapped so missing → null, throw `ValidationError` before any write, require `subProductId` + `sizeId` per line (skip+log+count otherwise), replace `recordReceived` with `adjustStock`, add the `warehouse.service` require, keep `fullyReceivedDate`/counting/pricelist-sync/received branch untouched → Tasks 1 + 2. ✓
- Client service: optional `warehouseId` param + conditional PATCH body → Task 3. ✓
- Client receipt-detail: load active warehouses, required destination select defaulted to isDefault-else-first, disable Validate + link to `/warehouses` when none, pass `warehouseId` on the `validated` call only, destination-named toast → Task 4. ✓
- Edge cases: no warehouse resolvable (client-disabled + server `ValidationError` before write), line missing `sizeId`/`subProductId` (skip+count), zero-qty lines ignored, adjustStock throw counted → covered in Tasks 1/2/4 and tested in Task 1. ✓
- Testing: server `node:test` for posts-to-chosen / falls-back-to-default / throws-when-none / skips-missing-size; rollup deviation documented and covered by manual check → Tasks 1 + 5. ✓

**Placeholder scan:** No TBD/TODO/"add error handling" placeholders; every code step shows full code. ✓

**Type consistency:** `resolveTargetWarehouse(warehouseId, defaultWarehouseId)` and `postReceivedStock({ purchaseOrder, targetWarehouseId, adjustStock, userId, tenantId, logger })` are used with identical names/signatures across Tasks 1 and 2. Client uses `warehouseId` state, `warehouses: Warehouse[]`, `res.data`, `routes.warehouses.list`, and the 5-arg `updatePurchaseOrderStatus(id, status, token, receivedItems, warehouseId)` consistently across Tasks 3 and 4. ✓
