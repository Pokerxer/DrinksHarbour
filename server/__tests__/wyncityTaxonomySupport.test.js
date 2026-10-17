const test = require('node:test');
const assert = require('node:assert/strict');
const Product = require('../models/Product');
const Category = require('../models/Category');
const types = require('../constants/productTypes');
const { validateImport, isValidSize } = require('../services/subProductImport.service');

test('vape validates without retaining drink attributes or reporting itself as a beverage', async () => {
  const product = new Product({ name: 'SKE 600 Vape Lemon & Lime', slug: 'test-vape', type: 'vape', abv: 40, volumeMl: 700, isAlcoholic: true });
  await product.validate();
  assert.equal(product.isAlcoholic, false);
  assert.equal(product.isBeverage, false);
  assert.equal(product.abv, undefined);
  assert.equal(product.volumeMl, undefined);
  assert.equal(types.isBeverageType('vape'), false);
  assert.equal(types.isAlcoholicType('vape'), false);
  assert.deepEqual(types.getSizesForType('vape'), ['unit-single']);
});

test('category accepts the dedicated vape classification', () => {
  const category = new Category({ name: 'Vapes', slug: 'test-vapes', type: 'vape', alcoholCategory: 'non_alcoholic' });
  assert.equal(category.validateSync(), undefined);
});

test('nuts validate as a supported non-beverage product rather than a drink', async () => {
  const product = new Product({ name: 'Tollis Roasted Cashew Nut', slug: 'test-cashew', type: 'nuts', isAlcoholic: true, volumeMl: 700 });
  await product.validate();
  assert.equal(product.isAlcoholic, false);
  assert.equal(product.isBeverage, false);
  assert.equal(product.volumeMl, undefined);
});

const query = value => ({ select() { return this; }, lean: async () => value });
const deps = {
  Product: { find: () => query([]) },
  SubProduct: { findOne: () => query(null) },
  Size: { find: () => query([]) },
  enrich: async name => ({ name }),
  getCategoryOptions: async () => ({ categories: [], subcategories: {} }),
  getProductNames: async () => [],
};

test('untyped vape preview does not fall back to spirit', async () => {
  const out = await validateImport([{ productName: 'Elfbar 600 Vape Menthol', size: 'unit-single' }], { mode: 'create' }, 'tenant1', deps);
  assert.equal(out.groups[0].enrichment.type, 'vape');
});

test('stock preview accepts vape device units and exact 240g snack sizes', async () => {
  const rows = [
    { productName: 'SKE 600 Vape Lemon & Lime', productType: 'vape', size: 'unit-single', costPrice: 4720, sellingPrice: 12000, openingQty: 2 },
    { productName: 'Tollis Roasted Cashew Nut 240g Bottle', productType: 'snack', size: '240g', costPrice: 3800, sellingPrice: 4800, openingQty: 30 },
  ];
  assert.equal(isValidSize('240g'), true);
  assert(types.getSizesForType('snack').includes('240g'));
  const out = await validateImport(rows, { mode: 'create', warehouseId: 'warehouse1' }, 'tenant1', deps);
  assert.equal(out.ok, true);
  assert.equal(out.totals.errorRows, 0);
  assert.equal(out.totals.willCreateProduct, 2);
  assert.deepEqual(out.groups.map(g => g.enrichment.type), ['vape', 'snack']);
  assert.equal(rows[1].size, '240g');
  assert.equal(rows[0].sellingPrice, 12000);
  assert.equal(rows[1].openingQty, 30);
});

test('unknown product types remain rejected and wine remains a beverage', async () => {
  const out = await validateImport([{ productName: 'Unsupported Product', productType: 'invented_type', size: 'unit-single' }], { mode: 'create' }, 'tenant1', deps);
  assert.equal(out.ok, false);
  const wine = new Product({ name: 'Test Wine', slug: 'test-wine', type: 'wine', volumeMl: 750 });
  await wine.validate();
  assert.equal(wine.isBeverage, true);
  assert.equal(wine.volumeMl, 750);
});
