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
    addSize: async () => ({ _id: 'newsize' }),
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
