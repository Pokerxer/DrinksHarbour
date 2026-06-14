# Vendor Pricelists — Auto-Sync, Price History & Sourcing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give vendor pricelists a full price-change audit trail, protect manual lists from auto-sync, surface sync state in the UI, and add a cheapest-vendor-per-product sourcing matrix.

**Architecture:** A new pure helper module (`server/utils/pricelistHistory.js`) owns history-append + change-percent logic, reused by both the PO sync service and the manual-update controller. The sync service is reworked to target only a vendor's auto-managed list (creating one when needed). Two new REST endpoints add on-demand sync and a sourcing matrix. The Next.js client (red/cream design system already in place) gains source/sync badges, per-line history, and a rewritten Price Compare tab.

**Tech Stack:** Node/Express + Mongoose (server), Next.js + React + Tailwind + react-icons/pi + react-hot-toast (client). No test framework is configured, so server logic is verified with plain `node:assert` scripts under `server/scripts/`; client is verified with `npx tsc --noEmit` and `npm run lint`.

**Conventions to follow:**
- Server controllers return `{ success, data, message }` and use `req.tenant._id` / `req.user._id`.
- Client design tokens: brand red `#b20202`, cream `#FAF8F3`, border `#ece4d6`, green `#3d6b5c`, gold `#c8932c`, `fraunces` font for headings.
- Currency formatting via `fmtCur` / `fmtNaira` from `purchases-analytics-helpers`; ₦ conversion via `useExchangeRates()`.

---

## File Structure

**Server**
- Create `server/utils/pricelistHistory.js` — pure helpers: `HISTORY_CAP`, `changePercent`, `pushHistory`, `findLine`, `applyPOItemsToPricelist`.
- Create `server/scripts/test-pricelist-history.js` — `node:assert` test runner for the helpers.
- Modify `server/models/VendorPricelist.js` — new top-level + per-line fields, history sub-schema.
- Modify `server/services/vendorPricelistSync.service.js` — rework target selection + delegate item-apply to the helper.
- Modify `server/controllers/vendorPricelist.controller.js` — `syncNow`, `getPriceMatrix`, history-on-manual-edit in `updateVendorPricelist`.
- Modify `server/routes/vendorPricelist.routes.js` — register the two new routes.

**Client**
- Modify `client/apps/isomorphic/src/services/vendorPricelist.service.ts` — new types + `syncNow` + `getMatrix`.
- Modify `client/apps/isomorphic/src/app/shared/purchases/purchases-pricelist-shared.tsx` — history helpers + UI bits.
- Modify `client/apps/isomorphic/src/app/shared/purchases/purchases-pricelists.tsx` — list redesign.
- Modify `client/apps/isomorphic/src/app/shared/purchases/purchases-pricelist-detail.tsx` — detail additions.
- Modify `client/apps/isomorphic/src/app/shared/purchases/purchases-price-compare.tsx` — matrix rewrite.

---

## Task 1: Pure history helpers + tests

**Files:**
- Create: `server/utils/pricelistHistory.js`
- Test: `server/scripts/test-pricelist-history.js`

- [ ] **Step 1: Write the failing test**

Create `server/scripts/test-pricelist-history.js`:

```js
// Run: node scripts/test-pricelist-history.js   (from server/)
const assert = require('node:assert');
const {
  HISTORY_CAP,
  changePercent,
  pushHistory,
  applyPOItemsToPricelist,
} = require('../utils/pricelistHistory');

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
}

// changePercent
test('changePercent: normal increase', () => {
  assert.strictEqual(changePercent(100, 125), 25);
});
test('changePercent: decrease is signed', () => {
  assert.strictEqual(changePercent(200, 150), -25);
});
test('changePercent: from zero/undefined prev is 0', () => {
  assert.strictEqual(changePercent(0, 100), 0);
  assert.strictEqual(changePercent(undefined, 100), 0);
});

// pushHistory caps at HISTORY_CAP and stamps previousPrice
test('pushHistory caps and records previousPrice', () => {
  const line = { unitPrice: 10, priceHistory: [] };
  for (let i = 1; i <= HISTORY_CAP + 5; i++) {
    pushHistory(line, { unitPrice: i, basePrice: i, source: 'po', changePercent: 0 });
  }
  assert.strictEqual(line.priceHistory.length, HISTORY_CAP);
  // oldest dropped: first remaining entry is unitPrice 6 (5 dropped)
  assert.strictEqual(line.priceHistory[0].unitPrice, 6);
  // newest is last
  assert.strictEqual(line.priceHistory[line.priceHistory.length - 1].unitPrice, HISTORY_CAP + 5);
});

// applyPOItemsToPricelist: new line added with initial history
test('applyPOItemsToPricelist adds new line with history', () => {
  const pl = { items: [] };
  const res = applyPOItemsToPricelist(
    pl,
    [{ subProductId: 'A', subProductName: 'Beer', unitCost: 100 }],
    { now: new Date(), userId: 'u1', poId: 'po1', poNumber: 'PO-1' }
  );
  assert.strictEqual(res.added, 1);
  assert.strictEqual(res.changed, 1);
  assert.strictEqual(pl.items.length, 1);
  assert.strictEqual(pl.items[0].unitPrice, 100);
  assert.strictEqual(pl.items[0].priceHistory.length, 1);
  assert.strictEqual(pl.items[0].priceHistory[0].source, 'po');
});

// applyPOItemsToPricelist: existing line price change logs history + previousPrice
test('applyPOItemsToPricelist updates changed line', () => {
  const pl = {
    items: [{ subProductId: 'A', sizeId: null, unitPrice: 100, basePrice: 100, priceHistory: [] }],
  };
  const res = applyPOItemsToPricelist(
    pl,
    [{ subProductId: 'A', unitCost: 120 }],
    { now: new Date(), userId: 'u1', poId: 'po1', poNumber: 'PO-2' }
  );
  assert.strictEqual(res.updated, 1);
  assert.strictEqual(res.changed, 1);
  assert.strictEqual(pl.items[0].unitPrice, 120);
  assert.strictEqual(pl.items[0].previousPrice, 100);
  assert.strictEqual(pl.items[0].priceHistory.at(-1).changePercent, 20);
});

// applyPOItemsToPricelist: unchanged price logs nothing
test('applyPOItemsToPricelist skips unchanged price', () => {
  const pl = { items: [{ subProductId: 'A', sizeId: null, unitPrice: 100, basePrice: 100, priceHistory: [] }] };
  const res = applyPOItemsToPricelist(pl, [{ subProductId: 'A', unitCost: 100 }], { now: new Date() });
  assert.strictEqual(res.changed, 0);
  assert.strictEqual(pl.items[0].priceHistory.length, 0);
});

// applyPOItemsToPricelist: zero/blank cost never overwrites
test('applyPOItemsToPricelist ignores zero cost', () => {
  const pl = { items: [{ subProductId: 'A', sizeId: null, unitPrice: 100, basePrice: 100, priceHistory: [] }] };
  const res = applyPOItemsToPricelist(pl, [{ subProductId: 'A', unitCost: 0 }], { now: new Date() });
  assert.strictEqual(res.changed, 0);
  assert.strictEqual(pl.items[0].unitPrice, 100);
});

console.log(`\n${passed} passed`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node scripts/test-pricelist-history.js`
Expected: FAIL — `Cannot find module '../utils/pricelistHistory'`.

- [ ] **Step 3: Write the helper implementation**

Create `server/utils/pricelistHistory.js`:

```js
// utils/pricelistHistory.js
//
// Pure, DB-free helpers for vendor-pricelist price history. Shared by the PO
// sync service and the manual-update controller so both log changes identically.

const HISTORY_CAP = 24;

/** Signed % change from prev -> next. Returns 0 when prev is missing/zero. */
function changePercent(prev, next) {
  const p = Number(prev) || 0;
  const n = Number(next) || 0;
  if (p <= 0) return 0;
  return Math.round(((n - p) / p) * 1000) / 10; // 1 decimal place
}

/**
 * Append a history entry to a line, capping at HISTORY_CAP (drop oldest) and
 * recording previousPrice/previousPriceDate from the line's pre-change value.
 * `entry` must include unitPrice, basePrice, source, changePercent and may
 * include date, poId, poNumber, userId.
 */
function pushHistory(line, entry) {
  if (!Array.isArray(line.priceHistory)) line.priceHistory = [];
  const prevEntry = line.priceHistory[line.priceHistory.length - 1];
  if (prevEntry) {
    line.previousPrice = prevEntry.unitPrice;
    line.previousPriceDate = prevEntry.date;
  }
  line.priceHistory.push({ date: new Date(), ...entry });
  if (line.priceHistory.length > HISTORY_CAP) {
    line.priceHistory.splice(0, line.priceHistory.length - HISTORY_CAP);
  }
}

/** Match an existing line to a PO/edit item by subProductId (+ sizeId rules). */
function findLine(items, target) {
  return items.find((p) => {
    const sameProduct =
      p.subProductId && target.subProductId &&
      p.subProductId.toString() === target.subProductId.toString();
    const sameSize = target.sizeId
      ? p.sizeId && p.sizeId.toString() === target.sizeId.toString()
      : !p.sizeId;
    return sameProduct && sameSize;
  });
}

/**
 * Apply validated-PO items onto a pricelist's items array (mutates in place).
 * Returns counts: { updated, added, changed }.
 * ctx: { now, userId, poId, poNumber }
 */
function applyPOItemsToPricelist(pricelist, poItems, ctx = {}) {
  const now = ctx.now || new Date();
  let updated = 0;
  let added = 0;
  let changed = 0;

  for (const it of poItems || []) {
    if (!it.subProductId) continue;
    const unit = Number(it.unitCost) || 0;
    if (unit <= 0) continue; // never overwrite with a zero/blank cost

    const existing = findLine(pricelist.items, it);

    if (existing) {
      updated++;
      if (unit !== existing.unitPrice) {
        const pct = changePercent(existing.unitPrice, unit);
        // Capture the pre-change price for the fast list-level delta. (pushHistory
        // only back-fills previousPrice from an existing history entry, which is
        // absent the first time a pre-existing line changes.)
        existing.previousPrice = existing.unitPrice;
        existing.previousPriceDate = existing.lastPriceUpdate;
        existing.unitPrice = unit;
        existing.basePrice = unit;
        if (it.sku) existing.sku = it.sku;
        if (it.packaging) existing.packaging = it.packaging;
        if (it.packagingQty) existing.packagingQty = it.packagingQty;
        existing.lastPriceUpdate = now;
        pushHistory(existing, {
          unitPrice: unit, basePrice: unit, date: now, source: 'po',
          poId: ctx.poId, poNumber: ctx.poNumber, userId: ctx.userId,
          changePercent: pct,
        });
        changed++;
      }
    } else {
      const line = {
        subProductId: it.subProductId,
        subProductName: it.subProductName || it.productName || 'Item',
        sku: it.sku,
        productName: it.subProductName,
        sizeId: it.sizeId,
        sizeName: it.sizeName,
        basePrice: unit,
        unitPrice: unit,
        discountPercent: 0,
        minQuantity: 1,
        leadTimeDays: 7,
        packaging: it.packaging,
        packagingQty: it.packagingQty || 1,
        isPreferred: false,
        lastPriceUpdate: now,
        priceHistory: [],
      };
      pushHistory(line, {
        unitPrice: unit, basePrice: unit, date: now, source: 'po',
        poId: ctx.poId, poNumber: ctx.poNumber, userId: ctx.userId,
        changePercent: 0,
      });
      pricelist.items.push(line);
      added++;
      changed++;
    }
  }

  return { updated, added, changed };
}

module.exports = { HISTORY_CAP, changePercent, pushHistory, findLine, applyPOItemsToPricelist };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node scripts/test-pricelist-history.js`
Expected: PASS — `8 passed`.

- [ ] **Step 5: Commit**

```bash
git add server/utils/pricelistHistory.js server/scripts/test-pricelist-history.js
git commit -m "feat(server): pure pricelist price-history helpers + tests"
```

---

## Task 2: Extend the VendorPricelist model

**Files:**
- Modify: `server/models/VendorPricelist.js`

- [ ] **Step 1: Add the per-line history sub-schema fields**

In `server/models/VendorPricelist.js`, inside the `items` array sub-document, after the existing `lastPriceUpdate` field (around line 111-114) and before `notes`, add:

```js
        previousPrice: {
          type: Number,
        },
        previousPriceDate: {
          type: Date,
        },
        priceHistory: [
          {
            unitPrice: Number,
            basePrice: Number,
            date: { type: Date, default: Date.now },
            source: { type: String, enum: ['po', 'manual'], default: 'po' },
            poId: { type: ObjectId, ref: 'PurchaseOrder' },
            poNumber: String,
            userId: { type: ObjectId, ref: 'User' },
            changePercent: { type: Number, default: 0 },
          },
        ],
```

- [ ] **Step 2: Add the top-level source/sync fields**

In the same file, after the `discountPercent` top-level field (around line 44-49) and before `notes`, add:

```js
    source: {
      type: String,
      enum: ['manual', 'auto'],
      default: 'manual',
    },
    autoManaged: {
      type: Boolean,
      default: false,
    },
    lastSyncedAt: {
      type: Date,
    },
    lastSyncedPO: {
      id: { type: ObjectId, ref: 'PurchaseOrder' },
      poNumber: String,
    },
```

- [ ] **Step 3: Verify the model loads**

Run: `cd server && node -e "require('./models/VendorPricelist'); console.log('model ok')"`
Expected: `model ok` (no schema errors).

- [ ] **Step 4: Commit**

```bash
git add server/models/VendorPricelist.js
git commit -m "feat(server): add source/sync + price-history fields to VendorPricelist"
```

---

## Task 3: Rework the sync service to use helpers + auto-managed targeting

**Files:**
- Modify: `server/services/vendorPricelistSync.service.js`

- [ ] **Step 1: Replace the service body**

Replace the entire contents of `server/services/vendorPricelistSync.service.js` with:

```js
// services/vendorPricelistSync.service.js
//
// Keeps a vendor's AUTO-MANAGED pricelist in sync with the most recent purchase
// from that vendor. Called when a Purchase Order is validated. "Last purchase
// wins": the validated PO's unit costs overwrite matching auto-list lines and
// new products are appended, with a full price-history entry per change. Manual
// (negotiated) lists are never touched — a separate auto list is created instead.

const VendorPricelist = require('../models/VendorPricelist');
const { applyPOItemsToPricelist } = require('../utils/pricelistHistory');

/**
 * Find or create the vendor's auto-managed pricelist.
 * Targeting order:
 *  1. an existing autoManaged list
 *  2. a single legacy "… Auto Pricelist" (adopt it as auto-managed)
 *  3. only manual lists exist -> create a new auto list
 *  4. no lists -> create a new auto list
 */
async function resolveAutoPricelist(po, tenantId, userId) {
  const lists = await VendorPricelist.find({
    tenant: tenantId,
    vendor: po.vendor,
  }).sort({ updatedAt: -1 });

  let pl = lists.find((l) => l.autoManaged);
  if (pl) return { pl, created: false };

  // Adopt a legacy auto list (named "… Auto Pricelist") if one exists.
  const legacy = lists.find((l) => /Auto Pricelist$/i.test(l.name || ''));
  if (legacy) {
    legacy.source = 'auto';
    legacy.autoManaged = true;
    return { pl: legacy, created: false };
  }

  // Otherwise create a fresh auto list (manual lists, if any, are left alone).
  pl = new VendorPricelist({
    tenant: tenantId,
    name: `${po.vendorName || 'Vendor'} — Auto Pricelist`,
    vendor: po.vendor,
    vendorName: po.vendorName || 'Vendor',
    currency: po.currency || 'NGN',
    isActive: true,
    source: 'auto',
    autoManaged: true,
    items: [],
    createdBy: userId || po.createdBy,
  });
  return { pl, created: true };
}

/**
 * Upsert a vendor's auto-managed pricelist from a validated purchase order.
 * @returns {Promise<{pricelistId, created, updated, added, changed}|null>}
 */
async function syncVendorPricelistFromPO(po, tenantId, userId) {
  if (!po || !po.vendor || !Array.isArray(po.items) || po.items.length === 0) {
    return null;
  }

  const { pl, created } = await resolveAutoPricelist(po, tenantId, userId);

  if (po.currency) pl.currency = po.currency;

  const now = new Date();
  const { updated, added, changed } = applyPOItemsToPricelist(pl, po.items, {
    now,
    userId: userId || po.createdBy,
    poId: po._id,
    poNumber: po.poNumber,
  });

  // Nothing to persist on an existing, unchanged list.
  if (!created && updated === 0 && added === 0) {
    return { pricelistId: pl._id, created, updated, added, changed };
  }

  pl.lastSyncedAt = now;
  pl.lastSyncedPO = { id: po._id, poNumber: po.poNumber };
  pl.updatedBy = userId || po.createdBy;
  pl.markModified('items'); // history mutations on sub-docs
  await pl.save();

  return { pricelistId: pl._id, created, updated, added, changed };
}

module.exports = { syncVendorPricelistFromPO, resolveAutoPricelist };
```

- [ ] **Step 2: Verify the service loads**

Run: `cd server && node -e "const s=require('./services/vendorPricelistSync.service'); console.log(typeof s.syncVendorPricelistFromPO)"`
Expected: `function`.

(No change needed in `purchaseOrder.controller.js` — it already imports `syncVendorPricelistFromPO` and logs the result; the extra `changed` field is ignored harmlessly.)

- [ ] **Step 3: Commit**

```bash
git add server/services/vendorPricelistSync.service.js
git commit -m "feat(server): auto-managed sync targeting + history-aware PO sync"
```

---

## Task 4: Backend — sync-now, matrix, manual-edit history

**Files:**
- Modify: `server/controllers/vendorPricelist.controller.js`
- Modify: `server/routes/vendorPricelist.routes.js`

- [ ] **Step 1: Add imports to the controller**

At the top of `server/controllers/vendorPricelist.controller.js`, after line 2 (`const VendorPricelist = require('../models/VendorPricelist');`), add:

```js
const PurchaseOrder = require('../models/PurchaseOrder');
const { syncVendorPricelistFromPO } = require('../services/vendorPricelistSync.service');
const { pushHistory, changePercent, findLine } = require('../utils/pricelistHistory');
```

- [ ] **Step 2: Add manual-edit history to `updateVendorPricelist`**

In `server/controllers/vendorPricelist.controller.js`, replace this existing block in `updateVendorPricelist` (around lines 102-107):

```js
    Object.keys(updates).forEach(key => {
      if (key !== 'tenant' && key !== 'createdBy') {
        pricelist[key] = updates[key];
      }
    });
    pricelist.updatedBy = userId;
```

with:

```js
    // Log manual price changes into per-line history before applying item edits.
    if (Array.isArray(updates.items)) {
      const now = new Date();
      updates.items.forEach((incoming, idx) => {
        if (!incoming) return;
        const prevLine = findLine(pricelist.items, incoming) || pricelist.items[idx];
        const oldPrice = prevLine ? prevLine.unitPrice : undefined;
        const newPrice = Number(incoming.unitPrice) || 0;
        if (prevLine && oldPrice != null && newPrice > 0 && newPrice !== oldPrice) {
          if (!Array.isArray(incoming.priceHistory)) {
            incoming.priceHistory = Array.isArray(prevLine.priceHistory)
              ? [...prevLine.priceHistory]
              : [];
          }
          pushHistory(incoming, {
            unitPrice: newPrice,
            basePrice: Number(incoming.basePrice) || newPrice,
            date: now,
            source: 'manual',
            userId,
            changePercent: changePercent(oldPrice, newPrice),
          });
        }
      });
    }

    Object.keys(updates).forEach((key) => {
      if (key !== 'tenant' && key !== 'createdBy') {
        pricelist[key] = updates[key];
      }
    });
    pricelist.updatedBy = userId;
```

- [ ] **Step 3: Add `syncNow` and `getPriceMatrix` controllers**

In `server/controllers/vendorPricelist.controller.js`, immediately before the `module.exports = {` block (around line 225), add:

```js
const syncNow = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant._id;
    const userId = req.user._id;

    const pricelist = await VendorPricelist.findOne({ _id: id, tenant: tenantId });
    if (!pricelist) {
      return res.status(404).json({ success: false, message: 'Vendor pricelist not found' });
    }

    const lastPO = await PurchaseOrder.findOne({
      tenant: tenantId,
      vendor: pricelist.vendor,
      status: 'validated',
    }).sort({ updatedAt: -1 });

    if (!lastPO) {
      return res.json({
        success: false,
        message: 'No validated purchase order found for this vendor yet',
      });
    }

    const result = await syncVendorPricelistFromPO(lastPO, tenantId, userId);
    const updated = await VendorPricelist.findById(result.pricelistId)
      .populate('vendor', 'name email');

    res.json({
      success: true,
      data: updated,
      result: { ...result, poNumber: lastPO.poNumber },
    });
  } catch (error) {
    console.error('Error syncing vendor pricelist now:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPriceMatrix = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const { search } = req.query;
    const now = new Date();

    const pricelists = await VendorPricelist.find({
      tenant: tenantId,
      isActive: true,
      $or: [
        { startDate: { $lte: now }, endDate: { $gte: now } },
        { startDate: { $exists: false }, endDate: { $exists: false } },
        { startDate: { $lte: now }, endDate: { $exists: false } },
      ],
    }).populate('vendor', 'name email');

    const q = (search || '').trim().toLowerCase();
    const groups = new Map();

    for (const pl of pricelists) {
      for (const it of pl.items) {
        if (!it.subProductId || !(Number(it.unitPrice) > 0)) continue;
        const name = it.subProductName || it.productName || '';
        const sku = it.sku || '';
        if (q && !name.toLowerCase().includes(q) && !sku.toLowerCase().includes(q)) continue;

        const key = `${it.subProductId}::${it.sizeId || ''}`;
        if (!groups.has(key)) {
          groups.set(key, {
            subProductId: it.subProductId,
            sizeId: it.sizeId || null,
            subProductName: name,
            sizeName: it.sizeName || null,
            sku,
            vendors: [],
          });
        }
        groups.get(key).vendors.push({
          vendorId: pl.vendor?._id || pl.vendor,
          vendorName: pl.vendor?.name || pl.vendorName,
          pricelistId: pl._id,
          pricelistName: pl.name,
          currency: pl.currency,
          unitPrice: it.unitPrice,
          discountPercent: it.discountPercent || 0,
          leadTimeDays: it.leadTimeDays,
          vendorProductCode: it.vendorProductCode,
        });
      }
    }

    res.json({ success: true, data: Array.from(groups.values()) });
  } catch (error) {
    console.error('Error building price matrix:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
```

- [ ] **Step 4: Export the new controllers**

In the `module.exports = {` block of `server/controllers/vendorPricelist.controller.js`, add `syncNow,` and `getPriceMatrix,` to the list.

- [ ] **Step 5: Register routes**

In `server/routes/vendorPricelist.routes.js`:

1. Add `syncNow` and `getPriceMatrix` to the destructured import from the controller.
2. Add the matrix route **above** the `router.route('/:id')` block (so the literal `/matrix` GET is matched before the `/:id` GET param route). Place it right after the `router.route('/')...` block:

```js
router.get('/matrix', tenantAdminOrSuperAdmin, getPriceMatrix);
```

3. Add the sync-now route after the `/:id` block (POST on a sub-path, no collision):

```js
router.post('/:id/sync-now', tenantAdminOrSuperAdmin, syncNow);
```

- [ ] **Step 6: Verify controller + routes load**

Run: `cd server && node -e "require('./routes/vendorPricelist.routes'); console.log('routes ok')"`
Expected: `routes ok`.

- [ ] **Step 7: Commit**

```bash
git add server/controllers/vendorPricelist.controller.js server/routes/vendorPricelist.routes.js
git commit -m "feat(server): sync-now + price matrix endpoints, manual-edit history"
```

---

## Task 5: Client service types + methods

**Files:**
- Modify: `client/apps/isomorphic/src/services/vendorPricelist.service.ts`

- [ ] **Step 1: Extend the interfaces**

In `vendorPricelist.service.ts`, add to the `VendorPricelist` interface (after `createdAt?: string;`):

```ts
  source?: 'manual' | 'auto';
  autoManaged?: boolean;
  lastSyncedAt?: string;
  lastSyncedPO?: { id?: string; poNumber?: string };
  updatedAt?: string;
```

Add a `HistoryEntry` interface above `PricelistItem`:

```ts
export interface HistoryEntry {
  unitPrice: number;
  basePrice?: number;
  date?: string;
  source: 'po' | 'manual';
  poId?: string;
  poNumber?: string;
  userId?: string;
  changePercent?: number;
}
```

Add to the `PricelistItem` interface (after `lastPriceUpdate?: string;`):

```ts
  previousPrice?: number;
  previousPriceDate?: string;
  priceHistory?: HistoryEntry[];
```

- [ ] **Step 2: Add Matrix types + `syncNow` + `getMatrix` methods**

Add these exported types after the `PricelistItem` interface:

```ts
export interface MatrixVendorPrice {
  vendorId: string;
  vendorName: string;
  pricelistId: string;
  pricelistName: string;
  currency: string;
  unitPrice: number;
  discountPercent: number;
  leadTimeDays?: number;
  vendorProductCode?: string;
}

export interface MatrixGroup {
  subProductId: string;
  sizeId: string | null;
  subProductName: string;
  sizeName: string | null;
  sku: string;
  vendors: MatrixVendorPrice[];
}
```

Inside the `VendorPricelistService` class, add these methods:

```ts
  async syncNow(id: string, token: string): Promise<{
    success: boolean;
    data?: VendorPricelist;
    result?: { created: boolean; updated: number; added: number; changed: number; poNumber: string };
    message?: string;
  }> {
    const response = await fetch(`${API_URL}/api/vendor-pricelists/${id}/sync-now`, {
      method: 'POST',
      headers: this.getHeaders(token),
    });
    return response.json();
  }

  async getMatrix(token: string, search?: string): Promise<{ success: boolean; data: MatrixGroup[] }> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const response = await fetch(
      `${API_URL}/api/vendor-pricelists/matrix?${params}`,
      { headers: this.getHeaders(token) }
    );
    return response.json();
  }
```

- [ ] **Step 3: Typecheck**

Run: `cd client/apps/isomorphic && npx tsc --noEmit`
Expected: no errors referencing `vendorPricelist.service.ts`.

- [ ] **Step 4: Commit**

```bash
git add client/apps/isomorphic/src/services/vendorPricelist.service.ts
git commit -m "feat(client): pricelist service types for history, sync-now, matrix"
```

---

## Task 6: Shared helpers + per-line history UI

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/purchases/purchases-pricelist-shared.tsx`

- [ ] **Step 1: Update imports + add constants/helpers**

Change the `react` import to include `Fragment`:

```ts
import { Fragment, useEffect, useRef, useState } from 'react';
```

Add `PiCaretUp, PiCaretDown, PiClockCounterClockwise` to the existing `react-icons/pi` import.

Change the pricelist types import to include `HistoryEntry`:

```ts
import type { PricelistItem, HistoryEntry } from '@/services/vendorPricelist.service';
```

In `emptyLine()`, add `priceHistory: []` to the returned object.

After the existing `netPrice` function, add:

```ts
/** Lines whose latest change magnitude meets/exceeds this are "alerts". */
export const BIG_JUMP_THRESHOLD = 25;

/** Latest signed % change for a line (from history, else previousPrice). */
export function lineDelta(line: PricelistItem): number | null {
  const hist = line.priceHistory;
  if (hist && hist.length > 0) {
    const pct = hist[hist.length - 1].changePercent;
    return typeof pct === 'number' ? pct : null;
  }
  if (line.previousPrice && line.previousPrice > 0) {
    return Math.round(((line.unitPrice - line.previousPrice) / line.previousPrice) * 1000) / 10;
  }
  return null;
}

export function isBigJump(line: PricelistItem): boolean {
  const d = lineDelta(line);
  return d !== null && Math.abs(d) >= BIG_JUMP_THRESHOLD;
}
```

- [ ] **Step 2: Add `<DeltaBadge>` and `<PriceHistoryPanel>`**

Add these exported components at the end of `purchases-pricelist-shared.tsx`:

```tsx
export function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) return null;
  const up = delta > 0;
  const big = Math.abs(delta) >= BIG_JUMP_THRESHOLD;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
        up
          ? big
            ? 'bg-red-100 text-red-600'
            : 'bg-red-50 text-red-500'
          : 'bg-[#3d6b5c]/12 text-[#3d6b5c]'
      }`}
      title={`${up ? 'Up' : 'Down'} ${Math.abs(delta)}% vs previous`}
    >
      {up ? <PiCaretUp className="h-2.5 w-2.5" /> : <PiCaretDown className="h-2.5 w-2.5" />}
      {Math.abs(delta)}%
    </span>
  );
}

export function PriceHistoryPanel({
  history,
  currency,
}: {
  history?: HistoryEntry[];
  currency: string;
}) {
  if (!history || history.length === 0) {
    return <p className="px-4 py-3 text-xs text-gray-400">No price history yet.</p>;
  }
  const rows = [...history].reverse();
  return (
    <div className="px-4 py-3">
      <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        <PiClockCounterClockwise className="h-3.5 w-3.5" /> Price history
      </p>
      <div className="space-y-1">
        {rows.map((h, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-gray-500">
              {h.date ? new Date(h.date).toLocaleDateString() : '—'}
              <span className="ml-2 rounded bg-[#FAF8F3] px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                {h.source === 'po' ? `PO ${h.poNumber || ''}`.trim() : 'Manual'}
              </span>
            </span>
            <span className="flex items-center gap-2 tabular-nums">
              <span className="font-medium text-[#2a2420]">{fmtCur(h.unitPrice, currency)}</span>
              <DeltaBadge delta={typeof h.changePercent === 'number' ? h.changePercent : null} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Show delta + expandable history in `LineItemsEditor`**

At the top of the `LineItemsEditor` component body (before `function update`), add:

```tsx
  const [openHistory, setOpenHistory] = useState<number | null>(null);
```

Inside the product cell, in the `line.subProductId` branch, after the size/sku `<p>` element, add:

```tsx
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <DeltaBadge delta={lineDelta(line)} />
                          {line.priceHistory && line.priceHistory.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setOpenHistory(openHistory === i ? null : i)}
                              className="text-[10px] font-medium text-gray-400 underline-offset-2 hover:text-[#b20202] hover:underline"
                            >
                              {openHistory === i ? 'Hide history' : `History (${line.priceHistory.length})`}
                            </button>
                          )}
                        </div>
```

Wrap each mapped line in a `<Fragment>` and append a history row. Replace the existing
`{lines.map((line, i) => (` … `<tr key={i} className="hover:bg-[#FAF8F3]/60">` … `</tr>` … `))}`
structure so it reads:

```tsx
                {lines.map((line, i) => (
                  <Fragment key={i}>
                    <tr className="hover:bg-[#FAF8F3]/60">
                      {/* …all existing cells unchanged… */}
                    </tr>
                    {openHistory === i && (
                      <tr>
                        <td colSpan={8} className="bg-[#FAF8F3]/40">
                          <PriceHistoryPanel history={line.priceHistory} currency={currency} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
```

(Remove the `key={i}` from the inner `<tr>` since the key now lives on `<Fragment>`.)

- [ ] **Step 4: Typecheck + lint**

Run: `cd client/apps/isomorphic && npx tsc --noEmit && npm run lint`
Expected: no new errors in `purchases-pricelist-shared.tsx`.

- [ ] **Step 5: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/purchases/purchases-pricelist-shared.tsx
git commit -m "feat(client): price delta badges + expandable per-line history"
```

---

## Task 7: List page redesign

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/purchases/purchases-pricelists.tsx`

- [ ] **Step 1: Add imports + source filter + sync handler + KPIs**

Add `PiCloudArrowDown, PiBell, PiRobot` to the `react-icons/pi` import. Add the helpers import:

```ts
import { lineDelta, isBigJump } from './purchases-pricelist-shared';
```

(`lineDelta` may be unused — if lint flags it, import only `isBigJump`.)

Add a `SourceFilter` type next to the other types:

```ts
type SourceFilter = 'all' | 'auto' | 'manual';
```

Add state next to the other `useState` hooks:

```ts
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
```

Replace the `kpis` memo with:

```ts
  const kpis = useMemo(() => {
    const active = lists.filter((l) => l.isActive).length;
    const vendors = new Set(
      lists.map((l) => l.vendorName?.trim()).filter(Boolean)
    ).size;
    const lines = lists.reduce((s, l) => s + (l.items?.length ?? 0), 0);
    const auto = lists.filter((l) => l.autoManaged || l.source === 'auto').length;
    const alerts = lists.reduce(
      (s, l) => s + (l.items?.filter((it) => isBigJump(it)).length ?? 0),
      0
    );
    return { total: lists.length, active, vendors, lines, auto, alerts };
  }, [lists]);
```

Add a sync handler next to the other row actions:

```ts
  async function syncNow(pl: VendorPricelist) {
    setBusyId(pl._id);
    try {
      const res = await vendorPricelistService.syncNow(pl._id, token);
      if (!res.success) {
        toast.error(res.message || 'Nothing to sync');
      } else {
        toast.success(
          `Synced from ${res.result?.poNumber ?? 'last PO'} — ${res.result?.changed ?? 0} price change(s)`
        );
        load();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setBusyId(null);
    }
  }
```

- [ ] **Step 2: Apply the source filter in `visible`**

In the `visible` memo, after the existing `status` filter block, add:

```ts
    if (sourceFilter !== 'all') {
      out = out.filter((l) =>
        sourceFilter === 'auto'
          ? l.autoManaged || l.source === 'auto'
          : !(l.autoManaged || l.source === 'auto')
      );
    }
```

Add `sourceFilter` to the memo's dependency array.

- [ ] **Step 3: Update the KPI cards**

Replace the `kpiCards` array with:

```ts
  const kpiCards = [
    { label: 'Pricelists', value: kpis.total, icon: <PiListChecks /> },
    { label: 'Auto-managed', value: kpis.auto, icon: <PiRobot /> },
    { label: 'Price Lines', value: kpis.lines, icon: <PiStack /> },
    { label: 'Price Alerts', value: kpis.alerts, icon: <PiBell /> },
  ];
```

(`PiStorefront`, `PiToggleRight` may now be unused in `kpiCards` — leave their imports if still referenced elsewhere; remove from import only if lint flags them as unused.)

- [ ] **Step 4: Add the source filter control**

In the controls row, after the status-filter segmented `<div className="flex overflow-hidden rounded-lg border …">…</div>`, add:

```tsx
            <div className="flex overflow-hidden rounded-lg border border-[#ece4d6]">
              {(['all', 'auto', 'manual'] as SourceFilter[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSourceFilter(s)}
                  className={`px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                    sourceFilter === s
                      ? 'bg-[#b20202] text-white'
                      : 'bg-white text-gray-500 hover:bg-[#FAF8F3]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
```

- [ ] **Step 5: Add Source + Last-synced columns and a Sync-now action**

In the `<thead>` row, after the `Vendor` `<th>`, add:

```tsx
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Last Synced</th>
```

In each `<tr>`, after the vendor `<td>`, add:

```tsx
                      <td className="px-4 py-3">
                        {pl.autoManaged || pl.source === 'auto' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#b20202]/8 px-2 py-0.5 text-[11px] font-semibold text-[#b20202]">
                            <PiRobot className="h-3 w-3" /> Auto
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                            Manual
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {pl.lastSyncedAt
                          ? new Date(pl.lastSyncedAt).toLocaleDateString()
                          : '—'}
                      </td>
```

In the actions `<td>`, add a Sync-now button as the first action (before the View link):

```tsx
                          <button
                            type="button"
                            onClick={() => syncNow(pl)}
                            disabled={busyId === pl._id}
                            title="Sync now from last PO"
                            className="rounded p-1.5 hover:bg-[#b20202]/10 hover:text-[#b20202]"
                          >
                            <PiCloudArrowDown className="h-4 w-4" />
                          </button>
```

- [ ] **Step 6: Typecheck + lint**

Run: `cd client/apps/isomorphic && npx tsc --noEmit && npm run lint`
Expected: no new errors in `purchases-pricelists.tsx`.

- [ ] **Step 7: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/purchases/purchases-pricelists.tsx
git commit -m "feat(client): pricelist list — source/sync columns, alerts KPI, sync-now"
```

---

## Task 8: Detail page — autoManaged toggle, sync-now, last-synced

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/purchases/purchases-pricelist-detail.tsx`

- [ ] **Step 1: Add icons + imports + sync state**

Add `PiCloudArrowDown, PiRobot` to the `react-icons/pi` import. Add `isBigJump` to the shared import:

```ts
import { LineItemsEditor, netPrice, isBigJump } from './purchases-pricelist-shared';
```

Add sync state next to `saving`/`deleting`:

```ts
  const [syncing, setSyncing] = useState(false);
```

- [ ] **Step 2: Add a sync-now handler**

After the `save()` function, add:

```ts
  async function syncFromLastPO() {
    if (!pl) return;
    setSyncing(true);
    try {
      const res = await vendorPricelistService.syncNow(id, token);
      if (!res.success) {
        toast.error(res.message || 'Nothing to sync');
      } else {
        toast.success(
          `Synced from ${res.result?.poNumber ?? 'last PO'} — ${res.result?.changed ?? 0} price change(s)`
        );
        if (res.data) setPl(res.data);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }
```

- [ ] **Step 3: Extend the totals memo with alerts**

Replace the `totals` memo with:

```ts
  const totals = useMemo(() => {
    const items = pl?.items ?? [];
    const value = items.reduce((s, l) => s + netPrice(l), 0);
    const preferred = items.filter((l) => l.isPreferred).length;
    const alerts = items.filter((l) => isBigJump(l)).length;
    return { lines: items.length, value, preferred, alerts };
  }, [pl]);
```

- [ ] **Step 4: Add source badge + last-synced line + Sync button in the header**

In the header action cluster (`<div className="flex items-center gap-2">` with the active toggle / delete / save), add a Sync button before the Delete button:

```tsx
            <button
              type="button"
              onClick={syncFromLastPO}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-lg border border-[#ece4d6] px-3 py-2 text-xs font-semibold text-gray-600 hover:border-[#b20202]/30 hover:bg-[#b20202]/5 hover:text-[#b20202] disabled:opacity-50"
            >
              <PiCloudArrowDown className="h-3.5 w-3.5" />
              {syncing ? 'Syncing…' : 'Sync from last PO'}
            </button>
```

After the `<h1>` title (inside the `<div>` that holds the eyebrow + title), add:

```tsx
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              {pl.autoManaged || pl.source === 'auto' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#b20202]/8 px-2 py-0.5 font-semibold text-[#b20202]">
                  <PiRobot className="h-3 w-3" /> Auto-managed
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-500">
                  Manual
                </span>
              )}
              {pl.lastSyncedPO?.poNumber && (
                <span className="text-gray-400">
                  Last synced from{' '}
                  <span className="font-medium text-gray-600">{pl.lastSyncedPO.poNumber}</span>
                  {pl.lastSyncedAt ? ` · ${new Date(pl.lastSyncedAt).toLocaleDateString()}` : ''}
                </span>
              )}
            </div>
```

- [ ] **Step 5: Add an Auto-managed toggle in the metadata grid + save it**

In the metadata grid (`grid … sm:grid-cols-2 lg:grid-cols-4`), add a cell after the "Global Discount %" cell:

```tsx
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Auto-managed
            </label>
            <button
              type="button"
              onClick={() => {
                const turningOn = !(pl.autoManaged || pl.source === 'auto');
                patch({ autoManaged: turningOn, source: turningOn ? 'auto' : 'manual' });
              }}
              className={`w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                pl.autoManaged || pl.source === 'auto'
                  ? 'border-[#b20202]/30 bg-[#b20202]/5 text-[#b20202]'
                  : 'border-[#ece4d6] text-gray-500 hover:bg-[#FAF8F3]'
              }`}
            >
              {pl.autoManaged || pl.source === 'auto'
                ? 'Auto-syncs from POs'
                : 'Manual (locked)'}
            </button>
          </div>
```

In the `save()` payload passed to `updatePricelist`, after `notes: pl.notes,`, add:

```ts
          autoManaged: pl.autoManaged,
          source: pl.source,
```

- [ ] **Step 6: Add the Price Alerts quick-stat**

Change the quick-stats wrapper `<div className="mt-4 grid grid-cols-3 gap-3 …">` to `grid-cols-2 sm:grid-cols-4`, and add a fourth entry to the stats array after "Preferred":

```tsx
            { label: 'Price Alerts', value: String(totals.alerts) },
```

- [ ] **Step 7: Typecheck + lint**

Run: `cd client/apps/isomorphic && npx tsc --noEmit && npm run lint`
Expected: no new errors in `purchases-pricelist-detail.tsx`.

- [ ] **Step 8: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/purchases/purchases-pricelist-detail.tsx
git commit -m "feat(client): pricelist detail — auto-managed toggle, sync-now, alerts"
```

---

## Task 9: Price Compare → cheapest-vendor-per-product matrix

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/purchases/purchases-price-compare.tsx`

- [ ] **Step 1: Replace the component with the matrix view**

Replace the entire contents of `purchases-price-compare.tsx` with:

```tsx
'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  PiScales,
  PiTrophyFill,
  PiClock,
  PiMagnifyingGlass,
  PiCaretRight,
  PiCaretDown,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import {
  vendorPricelistService,
  type MatrixGroup,
} from '@/services/vendorPricelist.service';
import { fmtNaira } from './purchases-analytics-helpers';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import { fraunces } from './purchases-fonts';
import { netPrice } from './purchases-pricelist-shared';

export function PriceCompare() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const { convert } = useExchangeRates();

  const [groups, setGroups] = useState<MatrixGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await vendorPricelistService.getMatrix(token);
      setGroups(res.data ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load matrix');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Normalise every vendor price to ₦ and compute best/spread per product.
  const rows = groups
    .map((g) => {
      const priced = g.vendors
        .map((v) => {
          const net = netPrice({
            unitPrice: v.unitPrice,
            discountPercent: v.discountPercent,
          } as never);
          const naira =
            v.currency === 'NGN' ? net : convert(net, v.currency, 'NGN');
          return { ...v, net, naira };
        })
        .sort((a, b) => {
          if (a.naira === null) return 1;
          if (b.naira === null) return -1;
          return a.naira - b.naira;
        });
      const rated = priced.filter((v) => v.naira !== null) as Array<
        (typeof priced)[number] & { naira: number }
      >;
      const best = rated[0] ?? null;
      const worst = rated[rated.length - 1] ?? null;
      const spread =
        best && worst && best.naira > 0
          ? Math.round(((worst.naira - best.naira) / best.naira) * 1000) / 10
          : 0;
      return { ...g, priced, best, spread, vendorCount: priced.length };
    })
    .filter((r) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        r.subProductName.toLowerCase().includes(q) ||
        (r.sku || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.spread - a.spread);

  const key = (g: MatrixGroup) => `${g.subProductId}::${g.sizeId || ''}`;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#ece4d6] bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b20202]/70">
              Sourcing
            </p>
            <h2 className={`${fraunces.className} text-lg font-semibold text-[#2a2420]`}>
              Cheapest Vendor by Product
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Every product priced by more than one vendor, ranked by savings
              opportunity (spread), normalised to ₦.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[#ece4d6] bg-white px-3 py-2">
            <PiMagnifyingGlass className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product or SKU…"
              className="w-56 text-sm outline-none placeholder:text-gray-400"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#ece4d6] bg-white py-16 text-center text-sm text-gray-400">
          Loading price matrix…
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#ece4d6] bg-white/60 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#b20202]/5">
            <PiScales className="h-5 w-5 text-[#b20202]/40" />
          </span>
          <p className="text-sm text-gray-500">
            No products are priced across vendor pricelists yet
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#ece4d6] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#ece4d6] bg-[#FAF8F3] text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                <th className="px-4 py-2.5">Product</th>
                <th className="px-4 py-2.5">Best Vendor</th>
                <th className="px-4 py-2.5 text-right">Best ₦</th>
                <th className="px-4 py-2.5 text-right">Vendors</th>
                <th className="px-4 py-2.5 text-right">Spread</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1ece2]">
              {rows.map((r) => {
                const k = key(r);
                const isOpen = open === k;
                return (
                  <Fragment key={k}>
                    <tr
                      className="cursor-pointer hover:bg-[#FAF8F3]/60"
                      onClick={() => setOpen(isOpen ? null : k)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#2a2420]">{r.subProductName}</p>
                        <p className="text-[11px] text-gray-400">
                          {[r.sizeName, r.sku].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {r.best ? (
                          <span className="inline-flex items-center gap-1.5">
                            <PiTrophyFill className="h-3.5 w-3.5 text-[#3d6b5c]" />
                            {r.best.vendorName}
                          </span>
                        ) : (
                          <span className="text-gray-400">no rate</span>
                        )}
                      </td>
                      <td className={`${fraunces.className} px-4 py-3 text-right font-semibold tabular-nums text-[#3d6b5c]`}>
                        {r.best ? fmtNaira(r.best.naira as number) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                        {r.vendorCount}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.spread > 0 ? (
                          <span className={r.spread >= 15 ? 'font-semibold text-[#b20202]' : 'text-gray-500'}>
                            {r.spread}%
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">
                        {isOpen ? <PiCaretDown className="h-4 w-4" /> : <PiCaretRight className="h-4 w-4" />}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={6} className="bg-[#FAF8F3]/40 px-4 py-3">
                          <table className="w-full text-xs">
                            <tbody>
                              {r.priced.map((v) => {
                                const isBest = r.best && v.pricelistId === r.best.pricelistId;
                                return (
                                  <tr
                                    key={v.pricelistId + v.vendorId}
                                    className={isBest ? 'text-[#3d6b5c]' : 'text-gray-600'}
                                  >
                                    <td className="py-1.5">
                                      <span className="font-medium">{v.vendorName}</span>
                                      <span className="ml-2 text-gray-400">{v.pricelistName}</span>
                                    </td>
                                    <td className="py-1.5 text-right tabular-nums">
                                      {v.leadTimeDays != null && (
                                        <span className="inline-flex items-center gap-1 text-gray-400">
                                          <PiClock className="h-3 w-3" /> {v.leadTimeDays}d
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-1.5 text-right font-semibold tabular-nums">
                                      {v.naira === null ? (
                                        <span className="font-normal text-gray-400">no rate</span>
                                      ) : (
                                        fmtNaira(v.naira)
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `cd client/apps/isomorphic && npx tsc --noEmit && npm run lint`
Expected: no new errors in `purchases-price-compare.tsx`.

- [ ] **Step 3: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/purchases/purchases-price-compare.tsx
git commit -m "feat(client): cheapest-vendor-per-product matrix in Price Compare"
```

---

## Task 10: Full verification

- [ ] **Step 1: Server helper tests pass**

Run: `cd server && node scripts/test-pricelist-history.js`
Expected: `8 passed`.

- [ ] **Step 2: Server modules load**

Run: `cd server && node -e "require('./routes/vendorPricelist.routes'); require('./services/vendorPricelistSync.service'); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 3: Client typecheck + lint clean**

Run: `cd client/apps/isomorphic && npx tsc --noEmit && npm run lint`
Expected: no errors in the five modified client files.

- [ ] **Step 4: Manual smoke test (document results)**

With server + client running and a tenant admin logged in:
1. Validate a purchase order for a vendor → its `… — Auto Pricelist` shows the new costs; each changed line shows a ▲/▼ delta and a `History (n)` toggle with a `PO …` entry.
2. On `/purchases/pricelists`: the row shows an **Auto** badge, a **Last Synced** date; the **Price Alerts** KPI counts lines over 25%. Click **Sync now** → toast reports change count.
3. Mark a list **Manual (locked)** in detail, save, validate another PO for that vendor → a *separate* Auto Pricelist is created/updated, the manual one is untouched.
4. Edit a price manually in detail, save → a `Manual` history entry appears for that line.
5. Open the **Price Compare** tab → products ranked by spread; expand a row to see all vendors with the cheapest highlighted.

- [ ] **Step 5: Final commit (if any cleanup)**

```bash
git add -A
git commit -m "chore: vendor pricelist auto-sync verification cleanup" || echo "nothing to commit"
```

---

## Self-Review Notes (resolved)

- **Spec coverage:** model fields (Task 2), capped history + helpers (Task 1), auto-managed targeting incl. legacy adoption (Task 3), sync-now + matrix + manual-edit history (Task 4), service types (Task 5), per-line history UI (Task 6), list redesign (Task 7), detail additions (Task 8), matrix rewrite (Task 9), testing (Tasks 1 & 10). All spec sections mapped.
- **Type consistency:** `applyPOItemsToPricelist`, `pushHistory`, `changePercent`, `findLine` names match across server tasks; `MatrixGroup`/`MatrixVendorPrice`, `HistoryEntry`, `syncNow`, `getMatrix`, `lineDelta`, `isBigJump`, `BIG_JUMP_THRESHOLD`, `DeltaBadge`, `PriceHistoryPanel` consistent across client tasks.
- **No-test-framework reality:** server verification uses `node scripts/...` + `node -e require(...)`; client uses `npx tsc --noEmit` + `npm run lint` (no `typecheck` script exists). Mongoose sub-doc history mutations are persisted via `markModified('items')`.
```
