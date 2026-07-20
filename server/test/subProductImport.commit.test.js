// server/test/subProductImport.commit.test.js
const test = require('node:test');
const assert = require('node:assert');
const svc = require('../services/subProductImport.service');

function makeDeps(overrides = {}) {
  const calls = { createSubProduct: [], adjustStock: [], recordReceiptMovement: [], enrich: [], sizeUpdates: [] };
  const deps = {
    Product: {
      findOne: () => ({ select: () => ({ lean: async () => overrides.product ?? null }) }),
      findById: () => ({ select: () => ({ lean: async () => overrides.productDoc ?? {} }) }),
    },
    Tenant: {
      findById: () => ({ select: () => ({ lean: async () => overrides.tenant ?? null }) }),
    },
    SubProduct: {
      findOne: () => ({ select: () => ({ lean: async () => overrides.sub ?? null }) }),
      findById: () => ({ select: () => ({ lean: async () => overrides.subDoc ?? {} }) }),
    },
    Size: {
      find: () => ({ select: () => ({ lean: async () => overrides.sizes ?? [] }) }),
      findByIdAndUpdate: async (id, upd) => { calls.sizeUpdates.push({ id, upd }); return {}; },
    },
    createSubProduct: async (data) => {
      calls.createSubProduct.push(data);
      const sizes = (data.sizes || []).map((s, i) => ({ _id: `size${i}`, size: s.size }));
      return { _id: 'sp1', product: data.product ?? 'np1', sizes };
    },
    addSize: async () => ({ _id: 'newsize' }),
    adjustStock: async (args) => { calls.adjustStock.push(args); return { ok: true }; },
    recordReceiptMovement: async (args) => { calls.recordReceiptMovement.push(args); return {}; },
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
  // Movement links to the Product so "Recent moves" shows the name, not "bulk-import".
  assert.equal(calls.recordReceiptMovement[0].product, 'np1');
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

test('commitImport (create mode) is additive — skips existing sizes, adds new ones', async () => {
  const { deps, calls } = makeDeps({
    product: { _id: 'p1' }, sub: { _id: 'sp-existing' },
    sizes: [{ _id: 's75', size: '75cl', costPrice: 800, basePrice: 1200 }],
  });
  const rows = [
    { productName: 'Old Rum', subProductSku: 'OR1', sizeCostPrice: '900', size: '75cl' }, // exists -> skip
    { productName: 'Old Rum', subProductSku: 'OR1', sizeCostPrice: '900', size: '50cl' }, // new -> add
  ];
  const res = await svc.commitImport(rows, { warehouseId: null }, 'T1', { _id: 'U1' }, deps);
  assert.equal(res.skipped, 1);
  assert.equal(res.createdSizes, 1);
  assert.equal(res.updatedSizes, 0);
  assert.equal(calls.sizeUpdates.length, 0); // create mode never mutates existing sizes
});

test('commitImport (update mode) updates existing size cost, preserves markup, sets stock', async () => {
  const { deps, calls } = makeDeps({
    product: { _id: 'p1' }, sub: { _id: 'sp-existing' },
    // 75cl exists at 50% markup (cost 800 -> selling 1200), stock 5
    sizes: [{ _id: 's75', size: '75cl', costPrice: 800, basePrice: 1200, stock: 5 }],
  });
  const rows = [
    { productName: 'Old Rum', subProductSku: 'OR1', sizeCostPrice: '900', size: '75cl', openingQty: '40' },
  ];
  const res = await svc.commitImport(rows, { warehouseId: 'wh1', mode: 'update' }, 'T1', { _id: 'U1' }, deps);
  assert.equal(res.updatedSizes, 1);
  assert.equal(res.stockUpdated, 1);
  assert.equal(res.createdSizes, 0);
  // Selling recomputed from preserved markup: 900 * (1200/800) = 1350 -> round up 1400
  const priceUpd = calls.sizeUpdates.find((u) => u.upd.$set.costPrice != null);
  assert.equal(priceUpd.upd.$set.costPrice, 900);
  assert.equal(priceUpd.upd.$set.basePrice, 1400);
  // Absolute stock set as an 'adjusted' movement
  assert.equal(calls.adjustStock.length, 1);
  assert.equal(calls.adjustStock[0].type, 'adjusted');
  assert.equal(calls.adjustStock[0].quantity, 40);
});

test('commitImport (update mode) captures platform markup override when cost changes', async () => {
  const { deps, calls } = makeDeps({
    product: { _id: 'p1' }, sub: { _id: 'sp-existing' },
    tenant: { revenueModel: 'markup', markupPercentage: 25, packRateMinUnits: 2 },
    productDoc: { platformMarkup: 15, platformDiscount: null },
    // 75cl, cost 800 -> selling 1200, no prior override
    sizes: [{ _id: 's75', size: '75cl', costPrice: 800, basePrice: 1200, sellingPrice: 1200, unitsPerPack: 1, platformMarkupOverridePct: null, packPlatformMarkupOverridePct: null }],
  });
  const rows = [
    { productName: 'Old Rum', subProductSku: 'OR1', sizeCostPrice: '900', size: '75cl' },
  ];
  const res = await svc.commitImport(rows, { warehouseId: null, mode: 'update' }, 'T1', { _id: 'U1' }, deps);
  assert.equal(res.updatedSizes, 1);
  const upd = calls.sizeUpdates.find((u) => u.upd.$set.costPrice != null);
  // The last effective platform markup is snapshotted so the platform selling
  // price stays proportional at the new cost.
  assert.ok(
    upd.upd.$set.platformMarkupOverridePct != null,
    'platform markup override captured on cost change'
  );
});

test('commitImport (update mode) honors an explicit size price over preserved markup', async () => {
  const { deps, calls } = makeDeps({
    product: { _id: 'p1' }, sub: { _id: 'sp-existing' },
    sizes: [{ _id: 's75', size: '75cl', costPrice: 800, basePrice: 1200 }],
  });
  const rows = [
    { productName: 'Old Rum', subProductSku: 'OR1', sizeCostPrice: '900', sizePrice: '2000', size: '75cl' },
  ];
  const res = await svc.commitImport(rows, { warehouseId: null, mode: 'update' }, 'T1', { _id: 'U1' }, deps);
  assert.equal(res.updatedSizes, 1);
  assert.equal(calls.sizeUpdates[0].upd.$set.basePrice, 2000);
});

test('commitImport (update mode) skips products/sizes that do not exist', async () => {
  const { deps, calls } = makeDeps({}); // no product match
  const rows = [
    { productName: 'Ghost Gin', subProductSku: 'GG1', sizeCostPrice: '900', size: '75cl' },
  ];
  const res = await svc.commitImport(rows, { warehouseId: null, mode: 'update' }, 'T1', { _id: 'U1' }, deps);
  assert.equal(res.skippedNoMatch, 1);
  assert.equal(res.updatedSizes, 0);
  assert.equal(calls.createSubProduct.length, 0); // never creates in update mode
});
