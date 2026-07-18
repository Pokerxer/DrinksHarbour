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

// Preview stubs: enrich/getCategoryNames must never hit the network in tests.
function previewDeps(overrides = {}) {
  const calls = { enrich: [] };
  const deps = {
    Product: overrides.Product || { findOne: async () => null }, // no match -> create
    SubProduct: overrides.SubProduct || { findOne: async () => null },
    Size: overrides.Size || { find: async () => [] },
    enrich: async (name, opts) => {
      calls.enrich.push({ name, opts });
      return overrides.ai ?? {};
    },
    getCategoryOptions: async () => ({
      categories: overrides.categories ?? [],
      subcategories: overrides.subcategories ?? {},
    }),
  };
  return { deps, calls };
}

test('validateImport flags bad size + missing name, but NOT missing type (AI-enriched)', async () => {
  const { deps } = previewDeps();
  const rows = [
    { productName: '', size: '75cl' },               // missing name
    { productName: 'New Gin', size: 'banana' },       // bad size, missing type is OK (AI fills it)
  ];
  const res = await svc.validateImport(rows, { warehouseId: null }, 'T1', deps);
  assert.equal(res.ok, false);
  const errs = res.groups.flatMap((g) => g.rowErrors.map((e) => e.field));
  assert.ok(errs.includes('productName'));
  assert.ok(errs.includes('size'));
  assert.ok(!errs.includes('productType'), 'missing productType must not error — AI enriches it');
});

test('validateImport still flags a productType that is supplied but invalid', async () => {
  const { deps } = previewDeps();
  const rows = [{ productName: 'New Gin', productType: 'notacategory', size: '75cl' }];
  const res = await svc.validateImport(rows, { warehouseId: null }, 'T1', deps);
  const errs = res.groups.flatMap((g) => g.rowErrors.map((e) => e.field));
  assert.ok(errs.includes('productType'));
});

test('validateImport blocks when openingQty>0 but no warehouse', async () => {
  const { deps } = previewDeps({
    Product: { findOne: async () => ({ _id: 'p1' }) }, // matches existing product
  });
  const rows = [{ productName: 'Old Rum', size: '75cl', costPrice: '900', openingQty: '5' }];
  const res = await svc.validateImport(rows, { warehouseId: null }, 'T1', deps);
  assert.equal(res.ok, false);
  assert.ok(res.blocking.some((m) => /warehouse/i.test(m)));
  assert.equal(res.groups[0].action, 'linkProduct');
});

test('validateImport attaches AI enrichment to createProduct groups (CSV wins, AI fills gaps)', async () => {
  const { deps, calls } = previewDeps({
    ai: { name: 'Bombay Sapphire London Dry Gin', type: 'gin', brand: 'Bombay Sapphire', category: 'Spirits', subCategory: 'Gin', shortDescription: 'A crisp gin', description: 'Distilled with botanicals' },
    categories: ['Spirits', 'Wine'],
  });
  const rows = [{ productName: 'bombay saph gin 70cl', brand: 'CSV Brand', size: '75cl' }];
  const res = await svc.validateImport(rows, { warehouseId: null }, 'T1', deps);
  assert.equal(calls.enrich.length, 1);
  assert.equal(calls.enrich[0].name, 'bombay saph gin 70cl');       // enrich sees the raw name
  assert.deepEqual(calls.enrich[0].opts.categories, ['Spirits', 'Wine']);
  const e = res.groups[0].enrichment;
  assert.ok(e, 'createProduct group must carry an enrichment');
  assert.equal(e.name, 'Bombay Sapphire London Dry Gin');           // AI-cleaned display name
  assert.equal(e.type, 'gin');
  assert.equal(e.brand, 'CSV Brand');                               // spreadsheet wins over AI
  assert.equal(e.category, 'Spirits');
  assert.equal(e.shortDescription, 'A crisp gin');
});

test('validateImport strips size tokens from the fallback name when AI returns no name', async () => {
  const { deps } = previewDeps({ ai: {} });
  const rows = [{ productName: 'New Gin 70cl', size: '75cl' }];
  const res = await svc.validateImport(rows, { warehouseId: null }, 'T1', deps);
  assert.equal(res.groups[0].enrichment.name, 'New Gin');
});

test('validateImport does NOT enrich linkProduct/updateSubProduct groups', async () => {
  const { deps, calls } = previewDeps({
    Product: { findOne: async () => ({ _id: 'p1' }) }, // existing product -> linkProduct
  });
  const rows = [{ productName: 'Old Rum', size: '75cl', costPrice: '900' }];
  const res = await svc.validateImport(rows, { warehouseId: null }, 'T1', deps);
  assert.equal(calls.enrich.length, 0);
  assert.equal(res.groups[0].enrichment, undefined);
});

test('normalizeProductName drops apostrophes and punctuation, collapses whitespace', () => {
  assert.equal(svc.normalizeProductName("Jack Daniel's Old No. 7"), 'jack daniels old no 7');
  assert.equal(svc.normalizeProductName('Jack Daniels Old No 7'), 'jack daniels old no 7');
  assert.equal(svc.normalizeProductName('Jack Daniels Old No. 7'), 'jack daniels old no 7');
  assert.equal(svc.normalizeProductName('  Baileys  Irish   Cream '), 'baileys irish cream');
});

test('buildProductIndex keys products by normalized name (first wins)', () => {
  const idx = svc.buildProductIndex([
    { _id: 'p1', name: "Jack Daniel's Old No. 7" },
    { _id: 'p2', name: 'Jack Daniels Old No 7' }, // same normalized key -> ignored
  ]);
  assert.equal(idx.get('jack daniels old no 7')._id, 'p1');
  assert.equal(idx.size, 1);
});

test('findProductByName matches via normalized index despite punctuation/apostrophes', async () => {
  const idx = svc.buildProductIndex([{ _id: 'p1', name: "Jack Daniel's Old No. 7" }]);
  const hit = await svc.findProductByName('Jack Daniels Old No 7', null, idx);
  assert.equal(hit._id, 'p1');
  const miss = await svc.findProductByName('Totally Different', null, idx);
  assert.equal(miss, null);
});

test('validateImport links to existing product when names match only after normalization', async () => {
  const { deps } = previewDeps();
  deps.Product = {
    findOne: async () => null, // exact-string match fails
    find: () => ({ select: () => ({ lean: async () => [{ _id: 'p9', name: "Jack Daniel's Old No. 7" }] }) }),
  };
  const rows = [{ productName: 'Jack Daniels Old No 7', size: '75cl', costPrice: '900' }];
  const res = await svc.validateImport(rows, { warehouseId: null }, 'T1', deps);
  assert.equal(res.groups[0].action, 'linkProduct');
});

test('validateImport passes existing product names to enrich for exact-spelling reuse', async () => {
  const { deps, calls } = previewDeps({ ai: {} });
  deps.getProductNames = async () => ["Jack Daniel's Old No. 7", 'Hennessy VS'];
  const rows = [{ productName: 'new whiskey', size: '75cl' }];
  await svc.validateImport(rows, { warehouseId: null }, 'T1', deps);
  assert.deepEqual(calls.enrich[0].opts.productNames, ["Jack Daniel's Old No. 7", 'Hennessy VS']);
});
