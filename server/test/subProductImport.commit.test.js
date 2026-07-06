// server/test/subProductImport.commit.test.js
const test = require('node:test');
const assert = require('node:assert');
const svc = require('../services/subProductImport.service');

function makeDeps(overrides = {}) {
  const calls = { createSubProduct: [], adjustStock: [], enrich: [] };
  const deps = {
    Product: { findOne: () => ({ select: () => ({ lean: async () => overrides.product ?? null }) }) },
    SubProduct: { findOne: () => ({ select: () => ({ lean: async () => overrides.sub ?? null }) }) },
    Size: { find: () => ({ select: () => ({ lean: async () => overrides.sizes ?? [] }) }) },
    createSubProduct: async (data) => {
      calls.createSubProduct.push(data);
      const sizes = (data.sizes || []).map((s, i) => ({ _id: `size${i}`, size: s.size }));
      return { _id: 'sp1', sizes };
    },
    addSize: async () => ({ _id: 'newsize' }),
    adjustStock: async (args) => { calls.adjustStock.push(args); return { ok: true }; },
    // Haiku enrichment stub — never hits the network in tests.
    enrich: async (name) => { calls.enrich.push(name); return overrides.ai ?? {}; },
    getCategoryOptions: async () => ({
      categories: overrides.categories ?? [],
      subcategories: overrides.subcategories ?? {},
    }),
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

test('commitImport enriches a new product from its name (AI fills gaps, CSV wins)', async () => {
  const { deps, calls } = makeDeps({
    ai: { name: 'Bombay Sapphire London Dry Gin', type: 'gin', brand: 'Bombay Sapphire', category: 'Spirits', subCategory: 'Gin', shortDescription: 'A crisp gin', description: 'Distilled with botanicals' },
  });
  const rows = [
    // Raw/abbreviated name; no productType/brand/category -> AI supplies them + a cleaner name.
    { productName: 'bombay saph gin', size: '75cl' },
  ];
  const res = await svc.commitImport(rows, { warehouseId: null }, 'T1', { _id: 'U1' }, deps);
  assert.equal(res.createdSubProducts, 1);
  assert.equal(calls.enrich[0], 'bombay saph gin');      // matching uses the raw name
  const np = calls.createSubProduct[0].newProductData;
  assert.equal(np.name, 'Bombay Sapphire London Dry Gin'); // display name is AI-cleaned
  assert.equal(np.type, 'gin');
  assert.equal(np.brand, 'Bombay Sapphire');
  assert.equal(np.category, 'Spirits');
  assert.equal(np.shortDescription, 'A crisp gin');
  assert.equal(np.description, 'Distilled with botanicals');
});

test('commitImport lets spreadsheet productType/brand override AI', async () => {
  const { deps, calls } = makeDeps({
    ai: { type: 'vodka', brand: 'AI Brand' },
  });
  const rows = [{ productName: 'New Gin', productType: 'gin', brand: 'CSV Brand', size: '75cl' }];
  await svc.commitImport(rows, { warehouseId: null }, 'T1', { _id: 'U1' }, deps);
  const np = calls.createSubProduct[0].newProductData;
  assert.equal(np.type, 'gin');        // CSV wins over AI 'vodka'
  assert.equal(np.brand, 'CSV Brand'); // CSV wins over AI 'AI Brand'
  assert.equal(np.name, 'New Gin');    // no AI name -> falls back to the raw row name
});

test('commitImport uses confirmed preview enrichments instead of re-calling Haiku', async () => {
  const { deps, calls } = makeDeps({
    ai: { name: 'WRONG — enrich must not be called', type: 'vodka' },
  });
  const rows = [{ productName: 'bombay saph gin', size: '75cl' }];
  const enrichments = {
    'bombay saph gin|': { // group key = `${name}|${brand}`.toLowerCase()
      name: 'Bombay Sapphire London Dry Gin', type: 'gin', brand: 'Bombay Sapphire',
      category: 'Spirits', subCategory: 'Gin',
      shortDescription: 'A crisp gin', description: 'Distilled with botanicals',
    },
  };
  const res = await svc.commitImport(rows, { warehouseId: null, enrichments }, 'T1', { _id: 'U1' }, deps);
  assert.equal(res.createdSubProducts, 1);
  assert.equal(calls.enrich.length, 0, 'must not re-call Haiku when enrichment is provided');
  const np = calls.createSubProduct[0].newProductData;
  assert.equal(np.name, 'Bombay Sapphire London Dry Gin');
  assert.equal(np.type, 'gin');
  assert.equal(np.brand, 'Bombay Sapphire');
  assert.equal(np.shortDescription, 'A crisp gin');
});

test('commitImport strips size tokens from the raw-name fallback', async () => {
  const { deps, calls } = makeDeps({ ai: { type: 'gin' } }); // AI returns no name
  const rows = [{ productName: 'New Gin 70cl', size: '75cl' }];
  await svc.commitImport(rows, { warehouseId: null }, 'T1', { _id: 'U1' }, deps);
  assert.equal(calls.createSubProduct[0].newProductData.name, 'New Gin');
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
