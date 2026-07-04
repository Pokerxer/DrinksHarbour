# SubProduct & Size Bulk Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CSV/Excel bulk import on the Inventory › Stock page that creates SubProducts + Sizes in the DB and optionally seeds opening stock into a chosen warehouse, with a validation preview before commit.

**Architecture:** A thin server orchestration service groups uploaded rows into SubProducts, resolves each parent Product by name (match-or-create), then reuses the existing `subproduct.service.createSubProduct` (SubProduct + Sizes in one call) and `warehouse.service.adjustStock` (opening stock via movement ledger). The client parses `.csv`/`.xlsx` into JSON with `xlsx`, previews via a dry-run endpoint, then commits.

**Tech Stack:** Node/Express + Mongoose (server, `node:test`), Next.js + React + TypeScript (admin app), `xlsx` ^0.18.5, `react-dropzone` ^14.3.8 (both already installed), `react-hot-toast`.

## Global Constraints

- Server tests use `node:test` + `node:assert` (NOT jest). Run with `node --test`.
- All new subproduct routes are tenant-scoped via `authenticate` + `attachTenant` + `tenantAdminOrSuperAdmin` (already applied at router level in `subproduct.routes.js`).
- Opening stock is applied ONLY through `warehouse.service.adjustStock` (type `'received'`) — never by writing `WarehouseStock` directly.
- Money/qty fields coerce to Number; SKUs/barcodes stored uppercase-trimmed to match schema (`uppercase: true`).
- Brand red used in admin UI is `#b20202` (match existing Stock browser styling).
- Client API base: `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'`.

---

## File Structure

- Create `server/services/subProductImport.service.js` — parse/normalize, group, validate (dry run), commit.
- Create `server/controllers/subProductImport.controller.js` — `previewImport`, `commitImport`.
- Modify `server/routes/subproduct.routes.js` — register `POST /import/preview`, `POST /import/commit`.
- Create `server/test/subProductImport.service.test.js` — unit tests for parse/group/validate.
- Create `server/test/subProductImport.commit.test.js` — commit orchestration tests (dependency-injected).
- Create `client/apps/admin/src/services/subProductImport.service.ts` — `preview`, `commit`, `IMPORT_COLUMNS`, `buildTemplateCsv`.
- Create `client/apps/admin/src/app/shared/inventory/inventory-stock-import.tsx` — import drawer.
- Modify `client/apps/admin/src/app/shared/inventory/inventory-stock-browser.tsx` — add Import button (mode `stock` only) + mount drawer.

**Design note for testability:** the import service takes its dependencies (`createSubProduct`, `adjustStock`, `SubProduct`, `Size`, `Product`) as an injectable `deps` object defaulting to the real modules. This lets commit tests run without a live DB.

---

### Task 1: Import service — parse, size-enum, grouping

**Files:**
- Create: `server/services/subProductImport.service.js`
- Test: `server/test/subProductImport.service.test.js`

**Interfaces:**
- Produces:
  - `normalizeRows(rawRows: object[]): Row[]` where `Row = { productName, productType, brand, category, subCategory, subProductSku, costPrice, sellingPrice, size, sizeSku, barcode, sizePrice, sizeCostPrice, openingQty, _rowNum }`. Strings trimmed; SKUs/barcode uppercased; `costPrice/sellingPrice/sizePrice/sizeCostPrice/openingQty` are `number | null` (null when blank/invalid).
  - `isValidSize(size: string): boolean` — true iff in `Size` enum.
  - `groupRows(rows: Row[]): Group[]` where `Group = { key, productName, brand, rows: Row[] }`; key = `subProductSku` (uppercased) if present else `productName|brand` lowercased.

- [ ] **Step 1: Write the failing test**

```js
// server/test/subProductImport.service.test.js
const test = require('node:test');
const assert = require('node:assert');
const svc = require('../services/subProductImport.service');

test('normalizeRows trims, uppercases SKUs, coerces numbers', () => {
  const [r] = svc.normalizeRows([{
    productName: '  Jack Daniels ', subProductSku: 'jd-01', size: '75cl',
    costPrice: '1200', openingQty: '10', barcode: 'abc123', sizePrice: '',
  }]);
  assert.equal(r.productName, 'Jack Daniels');
  assert.equal(r.subProductSku, 'JD-01');
  assert.equal(r.barcode, 'ABC123');
  assert.equal(r.costPrice, 1200);
  assert.equal(r.openingQty, 10);
  assert.equal(r.sizePrice, null);
  assert.equal(r._rowNum, 1);
});

test('isValidSize checks the Size enum', () => {
  assert.equal(svc.isValidSize('75cl'), true);
  assert.equal(svc.isValidSize('can-330ml'), true);
  assert.equal(svc.isValidSize('banana'), false);
});

test('groupRows groups by subProductSku else name+brand', () => {
  const rows = svc.normalizeRows([
    { productName: 'A', subProductSku: 'S1', size: '75cl' },
    { productName: 'A', subProductSku: 'S1', size: '50cl' },
    { productName: 'B', brand: 'X', size: '1L' },
  ]);
  const groups = svc.groupRows(rows);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].rows.length, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test test/subProductImport.service.test.js`
Expected: FAIL — `Cannot find module '../services/subProductImport.service'`.

- [ ] **Step 3: Write minimal implementation**

```js
// server/services/subProductImport.service.js
const Size = require('../models/Size');

const SIZE_ENUM = new Set(Size.schema.path('size').enumValues);

function toNum(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}
function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function normalizeRows(rawRows) {
  return (rawRows || []).map((r, i) => ({
    productName: str(r.productName),
    productType: str(r.productType).toLowerCase(),
    brand: str(r.brand),
    category: str(r.category),
    subCategory: str(r.subCategory),
    subProductSku: str(r.subProductSku).toUpperCase(),
    costPrice: toNum(r.costPrice),
    sellingPrice: toNum(r.sellingPrice),
    size: str(r.size),
    sizeSku: str(r.sizeSku).toUpperCase(),
    barcode: str(r.barcode).toUpperCase(),
    sizePrice: toNum(r.sizePrice),
    sizeCostPrice: toNum(r.sizeCostPrice),
    openingQty: toNum(r.openingQty),
    _rowNum: i + 1,
  }));
}

function isValidSize(size) {
  return SIZE_ENUM.has(size);
}

function groupRows(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.subProductSku || `${r.productName}|${r.brand}`.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { key, productName: r.productName, brand: r.brand, rows: [] });
    }
    map.get(key).rows.push(r);
  }
  return Array.from(map.values());
}

module.exports = { normalizeRows, isValidSize, groupRows, SIZE_ENUM };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test test/subProductImport.service.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/services/subProductImport.service.js server/test/subProductImport.service.test.js
git commit -m "feat(import): row normalize, size-enum check, grouping for subproduct import"
```

---

### Task 2: Import service — validateImport (dry run)

**Files:**
- Modify: `server/services/subProductImport.service.js`
- Test: `server/test/subProductImport.service.test.js`

**Interfaces:**
- Consumes: `normalizeRows`, `isValidSize`, `groupRows` (Task 1).
- Produces:
  - `async validateImport(rawRows, { warehouseId }, tenantId, deps?)` →
    `{ ok: boolean, groups: GroupReport[], totals: { groups, sizes, willCreateProduct, willLinkProduct, willUpdateSubProduct, errorRows }, blocking: string[] }`.
  - `GroupReport = { key, productName, action: 'createProduct'|'linkProduct'|'updateSubProduct', sizeCount, rowErrors: { rowNum, field, message }[], sizeNotes: { rowNum, size, note: 'exists'|'duplicate-in-file' }[] }`.
  - `deps` is `{ Product, SubProduct, Size }` defaulting to the real models. Injected for tests.

- [ ] **Step 1: Write the failing test**

```js
// append to server/test/subProductImport.service.test.js
test('validateImport flags bad size, missing name, and missing type for new product', async () => {
  const deps = {
    Product: { findOne: async () => null },          // no product matches -> create
    SubProduct: { findOne: async () => null },
    Size: { find: async () => [] },
  };
  const rows = [
    { productName: '', size: '75cl' },               // missing name
    { productName: 'New Gin', size: 'banana' },       // bad size + missing type
  ];
  const res = await svc.validateImport(rows, { warehouseId: null }, 'T1', deps);
  assert.equal(res.ok, false);
  const errs = res.groups.flatMap((g) => g.rowErrors.map((e) => e.field));
  assert.ok(errs.includes('productName'));
  assert.ok(errs.includes('size'));
  assert.ok(errs.includes('productType'));
});

test('validateImport blocks when openingQty>0 but no warehouse', async () => {
  const deps = {
    Product: { findOne: async () => ({ _id: 'p1' }) }, // matches existing product
    SubProduct: { findOne: async () => null },
    Size: { find: async () => [] },
  };
  const rows = [{ productName: 'Old Rum', size: '75cl', costPrice: '900', openingQty: '5' }];
  const res = await svc.validateImport(rows, { warehouseId: null }, 'T1', deps);
  assert.equal(res.ok, false);
  assert.ok(res.blocking.some((m) => /warehouse/i.test(m)));
  assert.equal(res.groups[0].action, 'linkProduct');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test test/subProductImport.service.test.js`
Expected: FAIL — `svc.validateImport is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `server/services/subProductImport.service.js` (above `module.exports`, and add `validateImport` to exports):

```js
const RealProduct = require('../models/Product');
const RealSubProduct = require('../models/SubProduct');
const RealSize = require('../models/Size');

const PRODUCT_TYPES = new Set(RealProduct.schema.path('type').enumValues);

function defaultDeps(deps = {}) {
  return {
    Product: deps.Product || RealProduct,
    SubProduct: deps.SubProduct || RealSubProduct,
    Size: deps.Size || RealSize,
  };
}

// Resolve an existing central Product by exact (case-insensitive) name.
async function findProductByName(name, Product) {
  if (!name) return null;
  return Product.findOne({ name: { $regex: new RegExp(`^${escapeRe(name)}$`, 'i') } })
    .select('_id')
    .lean();
}
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function validateImport(rawRows, opts, tenantId, deps) {
  const { Product, SubProduct, Size } = defaultDeps(deps);
  const warehouseId = opts?.warehouseId || null;
  const rows = normalizeRows(rawRows);
  const groups = groupRows(rows);
  const blocking = [];
  const totals = {
    groups: groups.length, sizes: 0,
    willCreateProduct: 0, willLinkProduct: 0, willUpdateSubProduct: 0, errorRows: 0,
  };
  let anyQty = false;

  const groupReports = [];
  for (const g of groups) {
    const existingProduct = await findProductByName(g.productName, Product);
    let existingSub = null;
    if (existingProduct) {
      const firstSku = g.rows.find((r) => r.subProductSku)?.subProductSku;
      existingSub = await SubProduct.findOne({
        tenant: tenantId,
        ...(firstSku ? { sku: firstSku } : { product: existingProduct._id }),
      }).select('_id').lean();
    }
    const action = existingSub ? 'updateSubProduct'
      : existingProduct ? 'linkProduct' : 'createProduct';

    const existingSizes = existingSub
      ? new Set((await Size.find({ subproduct: existingSub._id }).select('size').lean()).map((s) => s.size))
      : new Set();

    const seen = new Set();
    const rowErrors = [];
    const sizeNotes = [];
    for (const r of g.rows) {
      if (r.openingQty && r.openingQty > 0) anyQty = true;
      if (!r.productName) rowErrors.push({ rowNum: r._rowNum, field: 'productName', message: 'productName is required' });
      if (!r.size) {
        rowErrors.push({ rowNum: r._rowNum, field: 'size', message: 'size is required' });
      } else if (!isValidSize(r.size)) {
        rowErrors.push({ rowNum: r._rowNum, field: 'size', message: `"${r.size}" is not a valid size` });
      }
      if (action === 'createProduct' && (!r.productType || !PRODUCT_TYPES.has(r.productType))) {
        rowErrors.push({ rowNum: r._rowNum, field: 'productType', message: 'valid productType required to create a new product' });
      }
      if (action === 'linkProduct' && (r.costPrice == null || r.costPrice <= 0)) {
        rowErrors.push({ rowNum: r._rowNum, field: 'costPrice', message: 'costPrice required when linking an existing product' });
      }
      for (const f of ['costPrice', 'sizePrice', 'sizeCostPrice', 'openingQty']) {
        if (r[`_bad_${f}`]) rowErrors.push({ rowNum: r._rowNum, field: f, message: `${f} must be a number` });
      }
      if (r.size && isValidSize(r.size)) {
        if (seen.has(r.size)) sizeNotes.push({ rowNum: r._rowNum, size: r.size, note: 'duplicate-in-file' });
        else if (existingSizes.has(r.size)) sizeNotes.push({ rowNum: r._rowNum, size: r.size, note: 'exists' });
        seen.add(r.size);
      }
    }

    const sizeCount = seen.size;
    totals.sizes += sizeCount;
    totals.errorRows += rowErrors.length;
    if (action === 'createProduct') totals.willCreateProduct += 1;
    else if (action === 'linkProduct') totals.willLinkProduct += 1;
    else totals.willUpdateSubProduct += 1;

    groupReports.push({ key: g.key, productName: g.productName, action, sizeCount, rowErrors, sizeNotes });
  }

  if (anyQty && !warehouseId) {
    blocking.push('Select a target warehouse — some rows have an opening quantity.');
  }
  const ok = blocking.length === 0 && totals.errorRows === 0;
  return { ok, groups: groupReports, totals, blocking };
}
```

Also update `normalizeRows` to flag non-numeric values: after computing each numeric field, if the raw cell was non-blank but coerced to `null`, set `_bad_<field> = true`. Replace the numeric assignments in `normalizeRows` with a helper:

```js
function numField(row, raw) {
  const has = raw !== undefined && raw !== null && String(raw).trim() !== '';
  const n = toNum(raw);
  return { value: n, bad: has && n === null };
}
```

and in the `.map`:

```js
    const cp = numField(r, r.costPrice);
    const sp = numField(r, r.sellingPrice);
    const szp = numField(r, r.sizePrice);
    const szc = numField(r, r.sizeCostPrice);
    const oq = numField(r, r.openingQty);
    return {
      productName: str(r.productName),
      productType: str(r.productType).toLowerCase(),
      brand: str(r.brand),
      category: str(r.category),
      subCategory: str(r.subCategory),
      subProductSku: str(r.subProductSku).toUpperCase(),
      costPrice: cp.value, _bad_costPrice: cp.bad,
      sellingPrice: sp.value,
      size: str(r.size),
      sizeSku: str(r.sizeSku).toUpperCase(),
      barcode: str(r.barcode).toUpperCase(),
      sizePrice: szp.value, _bad_sizePrice: szp.bad,
      sizeCostPrice: szc.value, _bad_sizeCostPrice: szc.bad,
      openingQty: oq.value, _bad_openingQty: oq.bad,
      _rowNum: i + 1,
    };
```

Add `validateImport` and `findProductByName` to `module.exports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test test/subProductImport.service.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/services/subProductImport.service.js server/test/subProductImport.service.test.js
git commit -m "feat(import): validateImport dry-run with per-group report + warehouse guard"
```

---

### Task 3: Import service — commitImport (orchestration)

**Files:**
- Modify: `server/services/subProductImport.service.js`
- Test: `server/test/subProductImport.commit.test.js`

**Interfaces:**
- Consumes: `normalizeRows`, `groupRows`, `findProductByName`, `isValidSize` (Tasks 1-2).
- Produces:
  - `async commitImport(rawRows, { warehouseId }, tenantId, user, deps?)` →
    `{ createdProducts, createdSubProducts, createdSizes, stockApplied, skipped, errors: { group, message }[] }`.
  - `deps` adds `{ createSubProduct, adjustStock }` to the Task-2 deps, defaulting to
    `require('./subproduct.service').createSubProduct` and `require('./warehouse.service').adjustStock`.
- Behaviour: valid groups only (rows with per-row errors within a group are skipped, but a group with some good sizes still imports the good ones). Existing sizes are skipped. Opening stock applied per created size via `adjustStock('received')`.

- [ ] **Step 1: Write the failing test**

```js
// server/test/subProductImport.commit.test.js
const test = require('node:test');
const assert = require('node:assert');
const svc = require('../services/subProductImport.service');

function makeDeps(overrides = {}) {
  const calls = { createSubProduct: [], adjustStock: [] };
  const deps = {
    Product: { findOne: () => ({ select: () => ({ lean: async () => overrides.product ?? null }) }) },
    SubProduct: { findOne: () => ({ select: () => ({ lean: async () => overrides.sub ?? null }) }) },
    Size: { find: () => ({ select: () => ({ lean: async () => overrides.sizes ?? [] }) }) },
    createSubProduct: async (data) => {
      calls.createSubProduct.push(data);
      const sizes = (data.sizes || []).map((s, i) => ({ _id: `size${i}`, size: s.size }));
      return { _id: 'sp1', sizes };
    },
    adjustStock: async (args) => { calls.adjustStock.push(args); return { ok: true }; },
  };
  return { deps, calls };
}

test('commitImport creates a new product + sizes and applies opening stock', async () => {
  const { deps, calls } = makeDeps(); // no product match -> createProduct
  const rows = [
    { productName: 'New Gin', productType: 'gin', size: '75cl', openingQty: '10' },
    { productName: 'New Gin', productType: 'gin', size: '50cl', openingQty: '0' },
  ];
  const res = await svc.commitImport(rows, { warehouseId: 'W1' }, 'T1', { _id: 'U1' }, deps);
  assert.equal(res.createdSubProducts, 1);
  assert.equal(res.createdSizes, 2);
  assert.equal(res.stockApplied, 1);                       // only the qty>0 size
  assert.equal(calls.createSubProduct[0].createNewProduct, true);
  assert.equal(calls.createSubProduct[0].newProductData.type, 'gin');
  assert.equal(calls.adjustStock[0].type, 'received');
  assert.equal(calls.adjustStock[0].warehouseId, 'W1');
});

test('commitImport skips a size that already exists on an existing subproduct', async () => {
  const { deps, calls } = makeDeps({
    product: { _id: 'p1' }, sub: { _id: 'sp-existing' }, sizes: [{ size: '75cl' }],
  });
  const rows = [
    { productName: 'Old Rum', subProductSku: 'OR1', costPrice: '900', size: '75cl' }, // exists -> skip
    { productName: 'Old Rum', subProductSku: 'OR1', costPrice: '900', size: '50cl' }, // new
  ];
  const res = await svc.commitImport(rows, { warehouseId: null }, 'T1', { _id: 'U1' }, deps);
  assert.equal(res.skipped, 1);
  assert.equal(res.createdSizes, 1);
  assert.equal(calls.createSubProduct.length, 0);          // used addSize path, not createSubProduct
});
```

Note: the second test expects existing-subproduct groups to add sizes via a different path than `createSubProduct`. Implement existing-subproduct size addition with `deps.addSize` (default `require('./subproduct.service').addSize`) — add `addSize: async () => ({ _id })` to `makeDeps` and assert on it instead if you prefer; the assertion above only checks `createSubProduct` was NOT used.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test test/subProductImport.commit.test.js`
Expected: FAIL — `svc.commitImport is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `server/services/subProductImport.service.js` and export `commitImport`. Extend `defaultDeps` to include the service functions:

```js
function defaultServiceDeps(deps = {}) {
  const base = defaultDeps(deps);
  const sp = require('./subproduct.service');
  const wh = require('./warehouse.service');
  return {
    ...base,
    createSubProduct: deps.createSubProduct || sp.createSubProduct,
    addSize: deps.addSize || sp.addSize,
    adjustStock: deps.adjustStock || wh.adjustStock,
  };
}

function sizePayload(r) {
  return {
    size: r.size,
    sku: r.sizeSku || undefined,
    barcode: r.barcode || undefined,
    basePrice: r.sizePrice ?? undefined,
    costPrice: r.sizeCostPrice ?? undefined,
    stock: 0, // opening stock is applied via adjustStock, not Size.stock
  };
}

async function commitImport(rawRows, opts, tenantId, user, deps) {
  const d = defaultServiceDeps(deps);
  const warehouseId = opts?.warehouseId || null;
  const rows = normalizeRows(rawRows);
  const groups = groupRows(rows);
  const out = { createdProducts: 0, createdSubProducts: 0, createdSizes: 0, stockApplied: 0, skipped: 0, errors: [] };

  for (const g of groups) {
    try {
      // Keep only rows with a usable size; de-dupe within the group (first wins).
      const seen = new Set();
      const goodRows = g.rows.filter((r) => {
        if (!r.productName || !isValidSize(r.size) || seen.has(r.size)) return false;
        seen.add(r.size);
        return true;
      });
      if (goodRows.length === 0) { out.skipped += g.rows.length; continue; }

      const existingProduct = await findProductByName(g.productName, d.Product);
      const firstSku = goodRows.find((r) => r.subProductSku)?.subProductSku;
      const existingSub = existingProduct
        ? await d.SubProduct.findOne({
            tenant: tenantId,
            ...(firstSku ? { sku: firstSku } : { product: existingProduct._id }),
          }).select('_id').lean()
        : null;

      let subProductId;
      let createdSizeDocs = []; // { _id, size }

      if (existingSub) {
        // Add only sizes that don't already exist.
        subProductId = existingSub._id;
        const existing = new Set(
          (await d.Size.find({ subproduct: existingSub._id }).select('size').lean()).map((s) => s.size)
        );
        for (const r of goodRows) {
          if (existing.has(r.size)) { out.skipped += 1; continue; }
          const sizeDoc = await d.addSize(subProductId, sizePayload(r), tenantId, user); // returns the Size doc
          createdSizeDocs.push({ _id: sizeDoc._id, size: r.size, _row: r });
        }
      } else {
        const base = goodRows[0];
        const data = {
          costPrice: base.costPrice ?? undefined,
          baseSellingPrice: base.sellingPrice ?? undefined,
          status: 'active',
          sizes: goodRows.map(sizePayload),
        };
        if (existingProduct) {
          data.product = existingProduct._id;
        } else {
          data.createNewProduct = true;
          data.newProductData = {
            name: base.productName,
            type: base.productType,
            brand: base.brand || undefined,
            category: base.category || undefined,
            subCategory: base.subCategory || undefined,
          };
        }
        const sub = await d.createSubProduct(data, tenantId, user);
        subProductId = sub._id;
        if (!existingProduct) out.createdProducts += 1;
        out.createdSubProducts += 1;
        // Map returned size docs back to their source rows by size value.
        const bySize = new Map((sub.sizes || []).map((s) => [s.size, s._id]));
        createdSizeDocs = goodRows
          .map((r) => ({ _id: bySize.get(r.size), size: r.size, _row: r }))
          .filter((s) => s._id);
      }

      out.createdSizes += createdSizeDocs.length;

      // Apply opening stock for created sizes with qty > 0.
      for (const s of createdSizeDocs) {
        const qty = s._row.openingQty;
        if (qty && qty > 0 && warehouseId) {
          await d.adjustStock(
            { warehouseId, subProduct: subProductId, size: s._id, quantity: qty, type: 'received', notes: 'Bulk import opening stock' },
            user?._id, tenantId
          );
          out.stockApplied += 1;
        }
      }
    } catch (err) {
      out.errors.push({ group: g.key, message: err.message });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test test/subProductImport.commit.test.js`
Expected: PASS (2 tests). Then run the whole suite to confirm no regressions:
Run: `cd server && node --test test/subProductImport.service.test.js test/subProductImport.commit.test.js`
Expected: PASS (7 tests total).

- [ ] **Step 5: Commit**

```bash
git add server/services/subProductImport.service.js server/test/subProductImport.commit.test.js
git commit -m "feat(import): commitImport orchestration (create/link/update + opening stock)"
```

---

### Task 4: Controller + routes

**Files:**
- Create: `server/controllers/subProductImport.controller.js`
- Modify: `server/routes/subproduct.routes.js`

**Interfaces:**
- Consumes: `validateImport`, `commitImport` (Tasks 2-3).
- Produces: `POST /api/subproducts/import/preview` and `POST /api/subproducts/import/commit`, each accepting `{ rows: object[], warehouseId?: string }` and returning `{ success, data }`.

- [ ] **Step 1: Write the controller**

```js
// server/controllers/subProductImport.controller.js
const asyncHandler = require('express-async-handler');
const importSvc = require('../services/subProductImport.service');
const { logPrivilegedAction } = require('../utils/auditLog');

function resolveTenant(req, res) {
  const tenantId = req.tenant?._id || req.user?.tenant;
  if (!tenantId) {
    res.status(401).json({ success: false, message: 'Tenant not resolved' });
    return null;
  }
  return tenantId;
}

exports.previewImport = asyncHandler(async (req, res) => {
  const tenantId = resolveTenant(req, res);
  if (!tenantId) return;
  const { rows, warehouseId } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: 'rows[] is required' });
  }
  const data = await importSvc.validateImport(rows, { warehouseId }, tenantId, undefined);
  res.json({ success: true, data });
});

exports.commitImport = asyncHandler(async (req, res) => {
  const tenantId = resolveTenant(req, res);
  if (!tenantId) return;
  const { rows, warehouseId } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: 'rows[] is required' });
  }
  const data = await importSvc.commitImport(rows, { warehouseId }, tenantId, req.user, undefined);
  if (['super_admin', 'admin'].includes(req.user?.role)) {
    void logPrivilegedAction(req, 'SUBPRODUCT_IMPORT', 'create', {
      targetType: 'SubProduct', targetTenantId: tenantId,
      justification: `imported ${data.createdSubProducts} subproducts, ${data.createdSizes} sizes`,
    });
  }
  res.json({ success: true, data });
});
```

- [ ] **Step 2: Register the routes**

In `server/routes/subproduct.routes.js`, add near the top after the existing requires:

```js
const subProductImportController = require('../controllers/subProductImport.controller');
```

Then add these routes immediately after the `router.use(attachTenant);` block (before `/:id` routes so the literal `import` segment is not read as an id):

```js
// ── Bulk import (CSV/Excel parsed client-side into rows) ─────────────────────
router.post('/import/preview', tenantAdminOrSuperAdmin, subProductImportController.previewImport);
router.post('/import/commit', tenantAdminOrSuperAdmin, subProductImportController.commitImport);
```

- [ ] **Step 3: Smoke-check the server boots**

Run: `cd server && node -e "require('./routes/subproduct.routes'); console.log('routes OK')"`
Expected: prints `routes OK` with no throw.

- [ ] **Step 4: Commit**

```bash
git add server/controllers/subProductImport.controller.js server/routes/subproduct.routes.js
git commit -m "feat(import): preview/commit routes for subproduct bulk import"
```

---

### Task 5: Client import service + template

**Files:**
- Create: `client/apps/admin/src/services/subProductImport.service.ts`

**Interfaces:**
- Produces:
  - `IMPORT_COLUMNS: string[]` — canonical column order.
  - `buildTemplateCsv(): string` — header row + one example row.
  - `type ImportRow` — string-keyed record matching `IMPORT_COLUMNS`.
  - `type PreviewResult` / `type CommitResult` — mirror server shapes.
  - `subProductImportService.preview(rows, warehouseId, token)` and `.commit(rows, warehouseId, token)`.

- [ ] **Step 1: Write the service**

```ts
// client/apps/admin/src/services/subProductImport.service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export const IMPORT_COLUMNS = [
  'productName', 'productType', 'brand', 'category', 'subCategory',
  'subProductSku', 'costPrice', 'sellingPrice',
  'size', 'sizeSku', 'barcode', 'sizePrice', 'sizeCostPrice', 'openingQty',
] as const;

export type ImportRow = Record<string, string | number | undefined>;

export interface PreviewResult {
  ok: boolean;
  groups: {
    key: string; productName: string;
    action: 'createProduct' | 'linkProduct' | 'updateSubProduct';
    sizeCount: number;
    rowErrors: { rowNum: number; field: string; message: string }[];
    sizeNotes: { rowNum: number; size: string; note: string }[];
  }[];
  totals: {
    groups: number; sizes: number;
    willCreateProduct: number; willLinkProduct: number; willUpdateSubProduct: number; errorRows: number;
  };
  blocking: string[];
}

export interface CommitResult {
  createdProducts: number; createdSubProducts: number; createdSizes: number;
  stockApplied: number; skipped: number; errors: { group: string; message: string }[];
}

export function buildTemplateCsv(): string {
  const header = IMPORT_COLUMNS.join(',');
  const example = [
    'Jack Daniels Old No.7', 'whiskey', 'Jack Daniels', 'Spirits', 'Whiskey',
    'JD-OLD7', '9500', '13000',
    '75cl', 'JD-OLD7-75', '', '13500', '9500', '24',
  ].join(',');
  return `${header}\n${example}\n`;
}

async function handle(res: Response, fallback: string) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || fallback);
  }
  return res.json();
}
const jsonAuth = (token: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

export const subProductImportService = {
  async preview(rows: ImportRow[], warehouseId: string | null, token: string): Promise<{ success: boolean; data: PreviewResult }> {
    return handle(
      await fetch(`${API_URL}/api/subproducts/import/preview`, {
        method: 'POST', headers: jsonAuth(token), body: JSON.stringify({ rows, warehouseId }),
      }),
      'Failed to preview import'
    );
  },
  async commit(rows: ImportRow[], warehouseId: string | null, token: string): Promise<{ success: boolean; data: CommitResult }> {
    return handle(
      await fetch(`${API_URL}/api/subproducts/import/commit`, {
        method: 'POST', headers: jsonAuth(token), body: JSON.stringify({ rows, warehouseId }),
      }),
      'Failed to commit import'
    );
  },
};
```

- [ ] **Step 2: Type-check**

Run: `cd client/apps/admin && npx tsc --noEmit -p tsconfig.json 2>&1 | grep subProductImport || echo "no new errors"`
Expected: `no new errors`.

- [ ] **Step 3: Commit**

```bash
git add client/apps/admin/src/services/subProductImport.service.ts
git commit -m "feat(import): admin client service + CSV template for subproduct import"
```

---

### Task 6: Import drawer + Stock browser button

**Files:**
- Create: `client/apps/admin/src/app/shared/inventory/inventory-stock-import.tsx`
- Modify: `client/apps/admin/src/app/shared/inventory/inventory-stock-browser.tsx`

**Interfaces:**
- Consumes: `subProductImportService`, `IMPORT_COLUMNS`, `buildTemplateCsv` (Task 5); `xlsx`, `react-dropzone`, `react-hot-toast`.
- Produces: `<InventoryStockImport open token warehouses onClose onDone />` default export.
- Integration: Stock browser shows an **Import** button (only when `mode === 'stock'`) that opens the drawer; on success it calls the browser's `load()` and closes.

- [ ] **Step 1: Write the drawer component**

```tsx
// client/apps/admin/src/app/shared/inventory/inventory-stock-import.tsx
'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { PiUploadSimple, PiX, PiDownloadSimple, PiCheckCircle, PiWarningCircle } from 'react-icons/pi';
import {
  subProductImportService, buildTemplateCsv, IMPORT_COLUMNS,
  type ImportRow, type PreviewResult, type CommitResult,
} from '@/services/subProductImport.service';

type Warehouse = { id: string; name: string };

function downloadTemplate() {
  const blob = new Blob([buildTemplateCsv()], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'subproduct-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// Parse a File (.csv or .xlsx) into row objects keyed by IMPORT_COLUMNS headers.
async function parseFile(file: File): Promise<ImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return raw.map((r) => {
    const row: ImportRow = {};
    for (const col of IMPORT_COLUMNS) {
      // tolerate header case / spacing differences
      const key = Object.keys(r).find((k) => k.trim().toLowerCase() === col.toLowerCase());
      row[col] = key ? (r[key] as string | number) : '';
    }
    return row;
  });
}

export default function InventoryStockImport({
  open, token, warehouses, onClose, onDone,
}: {
  open: boolean;
  token: string;
  warehouses: Warehouse[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => {
    setRows([]); setFileName(''); setPreview(null); setBusy(false);
  }, []);

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    try {
      const parsed = await parseFile(file);
      if (parsed.length === 0) { toast.error('No rows found in file'); return; }
      setRows(parsed); setFileName(file.name); setPreview(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to parse file');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
  });

  const runPreview = useCallback(async () => {
    setBusy(true);
    try {
      const res = await subProductImportService.preview(rows, warehouseId || null, token);
      setPreview(res.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed');
    } finally { setBusy(false); }
  }, [rows, warehouseId, token]);

  const runCommit = useCallback(async () => {
    setBusy(true);
    try {
      const res = await subProductImportService.commit(rows, warehouseId || null, token);
      const d: CommitResult = res.data;
      toast.success(`Imported ${d.createdSubProducts} products · ${d.createdSizes} sizes · ${d.stockApplied} stock lines`);
      if (d.errors.length) toast.error(`${d.errors.length} group(s) had errors`);
      reset();
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally { setBusy(false); }
  }, [rows, warehouseId, token, reset, onDone]);

  const errorRows = preview?.totals.errorRows ?? 0;
  const canCommit = !!preview && preview.ok && !busy;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/30" onClick={() => { reset(); onClose(); }}>
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Import products &amp; sizes</h2>
            <p className="text-[11px] text-gray-400">Upload a CSV or Excel file to create SubProducts, Sizes and opening stock</p>
          </div>
          <button type="button" onClick={() => { reset(); onClose(); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50">
            <PiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="flex items-center justify-between">
            <button type="button" onClick={downloadTemplate} className="flex items-center gap-1.5 text-xs font-semibold text-[#b20202] hover:underline">
              <PiDownloadSimple className="h-3.5 w-3.5" /> Download template
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Warehouse for opening stock</span>
              <select value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setPreview(null); }}
                className="h-[32px] rounded-lg border border-gray-200 px-2 text-xs text-gray-700 focus:border-[#b20202] focus:outline-none">
                <option value="">— none —</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>

          <div {...getRootProps()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${isDragActive ? 'border-[#b20202] bg-[#b20202]/5' : 'border-gray-200 hover:border-gray-300'}`}>
            <input {...getInputProps()} />
            <PiUploadSimple className="h-7 w-7 text-gray-300" />
            <p className="text-xs font-semibold text-gray-600">{fileName || 'Drop a .csv or .xlsx file, or click to browse'}</p>
            {rows.length > 0 && <p className="text-[11px] text-gray-400">{rows.length} rows parsed</p>}
          </div>

          {rows.length > 0 && !preview && (
            <button type="button" onClick={runPreview} disabled={busy}
              className="w-full rounded-lg bg-gray-900 py-2.5 text-xs font-bold text-white hover:bg-black disabled:opacity-40">
              {busy ? 'Validating…' : 'Validate & preview'}
            </button>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'New products', value: preview.totals.willCreateProduct },
                  { label: 'Link existing', value: preview.totals.willLinkProduct },
                  { label: 'Update existing', value: preview.totals.willUpdateSubProduct },
                  { label: 'Sizes', value: preview.totals.sizes },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-gray-100 bg-gray-50 px-2 py-3">
                    <p className="text-sm font-bold tabular-nums text-gray-900">{s.value}</p>
                    <p className="text-[10px] text-gray-400">{s.label}</p>
                  </div>
                ))}
              </div>

              {preview.blocking.map((b) => (
                <div key={b} className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                  <PiWarningCircle className="h-4 w-4 shrink-0" /> {b}
                </div>
              ))}

              <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100">
                {preview.groups.map((g) => (
                  <div key={g.key} className="border-b border-gray-50 px-3 py-2 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-800">{g.productName || g.key}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${g.rowErrors.length ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {g.action} · {g.sizeCount} size{g.sizeCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    {g.rowErrors.map((e, i) => (
                      <p key={i} className="mt-0.5 text-[10px] text-red-500">Row {e.rowNum}: {e.message}</p>
                    ))}
                    {g.sizeNotes.map((n, i) => (
                      <p key={`n${i}`} className="mt-0.5 text-[10px] text-gray-400">Row {n.rowNum}: {n.size} — {n.note}</p>
                    ))}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPreview(null)} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                  Back
                </button>
                <button type="button" onClick={runCommit} disabled={!canCommit}
                  className="flex flex-[2] items-center justify-center gap-1.5 rounded-lg bg-[#b20202] py-2.5 text-xs font-bold text-white hover:bg-[#9a0101] disabled:opacity-40">
                  <PiCheckCircle className="h-4 w-4" />
                  {busy ? 'Importing…' : errorRows ? `Fix ${errorRows} error(s) to import` : 'Confirm import'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the Import button into the Stock browser**

In `client/apps/admin/src/app/shared/inventory/inventory-stock-browser.tsx`:

Add the import near the other imports (after the `warehouseStockService` import at line ~36):

```tsx
import InventoryStockImport from './inventory-stock-import';
```

Add state near the other `useState` hooks (after `const [counts, setCounts] = useState(...)`, ~line 558):

```tsx
  const [showImport, setShowImport] = useState(false);
```

In the Actions cluster, add an Import button before the Export CSV button (inside the `<div className="flex items-center gap-2">` that holds the refresh/print/export buttons, ~line 1094), only for stock mode:

```tsx
            {mode === 'stock' && (
              <button
                type="button"
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                <PiUploadSimple className="h-3.5 w-3.5" /> Import
              </button>
            )}
```

Add `PiUploadSimple` to the existing `react-icons/pi` import block (top of file).

Mount the drawer just before the final closing `</div>` of the component's returned tree (after the detail-panel block, ~line 1630):

```tsx
      <InventoryStockImport
        open={showImport}
        token={token}
        warehouses={warehouses}
        onClose={() => setShowImport(false)}
        onDone={() => { setShowImport(false); load(); }}
      />
```

- [ ] **Step 3: Type-check**

Run: `cd client/apps/admin && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "inventory-stock-import|inventory-stock-browser" || echo "no new errors"`
Expected: `no new errors`.

- [ ] **Step 4: Manual smoke test**

1. Start server + admin app.
2. Go to Inventory › Stock, click **Import**.
3. Click **Download template**, fill 2-3 rows (one new product with `productType`, one existing product name), set an `openingQty`, pick a warehouse.
4. Upload → **Validate & preview** → confirm the report classifies rows correctly and blocks on missing warehouse when qty>0.
5. **Confirm import** → toast shows counts → the stock list refreshes and shows the new lines.

- [ ] **Step 5: Commit**

```bash
git add client/apps/admin/src/app/shared/inventory/inventory-stock-import.tsx client/apps/admin/src/app/shared/inventory/inventory-stock-browser.tsx
git commit -m "feat(import): Stock page import drawer (dropzone + xlsx parse + preview/commit)"
```

---

## Self-Review Notes

- **Spec coverage:** parse/normalize (T1), size-enum + grouping (T1), validate dry-run + warehouse guard + product match/create decision (T2), commit orchestration reusing `createSubProduct`/`addSize`/`adjustStock` + existing-size skip + opening stock via ledger (T3), routes (T4), client service + template (T5), drawer UI + Import button + refresh (T6). Testing: node:test units (T1-T3) + manual smoke (T6). All spec sections mapped.
- **Types:** `PreviewResult`/`CommitResult` (client) mirror `validateImport`/`commitImport` (server) return shapes. Size payload uses `basePrice`/`costPrice`/`sku`/`barcode`/`stock` per `createSizeVariantsWithoutTransaction`. `adjustStock` arg names (`warehouseId, subProduct, size, quantity, type, notes`) match `warehouse.service.js:144`.
- **addSize (verified):** `addSize(subProductId, sizeData, tenantId, user)` at `subproduct.service.js:4585` returns the Size document directly and itself throws `ValidationError` if the size already exists on the SubProduct. The commit code's pre-check against existing sizes is therefore defensive/dedup only; a duplicate that slips through surfaces as a per-group error (caught by the group `try/catch`), not a crash.
```
