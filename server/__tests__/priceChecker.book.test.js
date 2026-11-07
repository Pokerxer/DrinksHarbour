const test = require('node:test');
const assert = require('node:assert/strict');
const Size = require('../models/Size');
const SubProduct = require('../models/SubProduct');
const Product = require('../models/Product');
const Stock = require('../models/WarehouseStock');
const { buildBook } = require('../services/priceChecker/book');

const ids = {
  size: 'a'.repeat(24),
  sub: 'b'.repeat(24),
  product: 'c'.repeat(24),
  brand: 'd'.repeat(24),
};
const q = (value) => ({
  select() { return this; },
  limit() { return this; },
  populate() { return this; },
  lean: async () => value,
});
const sizeRow = {
  _id: ids.size,
  subproduct: ids.sub,
  size: 700,
  displayName: '70cl',
  barcode: '4901877007131',
  sellingPrice: 8000,
  wholesalePrice: 7200,
  currency: 'NGN',
  status: 'active',
};
const subRow = {
  _id: ids.sub,
  product: ids.product,
  baseSellingPrice: 7600,
  basePriceBeforePricelist: 7600,
  currency: 'NGN',
};
const productRow = {
  _id: ids.product,
  name: 'Glen Grant 12',
  brand: { name: 'Glen Grant' },
  images: [{ url: 'https://img.example/gg.png', isPrimary: true }],
  isAlcoholic: true,
  abv: 40,
  volumeMl: 700,
  originCountry: 'Scotland',
  type: 'spirit',
};

test('buildBook returns one compact entry per sellable size', async (t) => {
  t.mock.method(Size, 'find', () => q([sizeRow]));
  t.mock.method(SubProduct, 'find', () => q([subRow]));
  t.mock.method(Product, 'find', () => q([productRow]));
  t.mock.method(Stock, 'find', () => q([{ size: ids.size, currentQuantity: 9, reservedQuantity: 1 }]));
  const book = await buildBook({
    kiosk: { slug: 'counter', currency: 'NGN', tenant: ids.brand, location: 'e'.repeat(24), settings: { outOfStock: 'DISPLAY' } },
    tenant: { posSettings: { taxRate: 7.5 } },
    pricelist: null,
  });
  assert.equal(book.slug, 'counter');
  assert.equal(book.currency, 'NGN');
  assert.match(book.generatedAt, /^20\d{2}-/u);
  assert.equal(book.items.length, 1);
  const item = book.items[0];
  assert.deepEqual(Object.keys(item).sort(), [
    'abv', 'alcoholic', 'availability', 'barcode', 'beverageType', 'brand',
    'currency', 'image', 'name', 'origin', 'price', 'size', 'taxLabel',
    'volumeMl',
  ]);
  assert.equal(item.barcode, '4901877007131');
  assert.equal(item.name, 'Glen Grant 12');
  assert.equal(item.price, 8000);
  assert.equal(item.availability, 'IN_STOCK');
  assert.equal(typeof item.abv, 'number');
  assert.ok(!('_id' in item) && !('subProduct' in item) && !('product' in item));
});

test('buildBook keeps pricelist-aware pricing and honours the HIDE stock rule', async (t) => {
  const kiosk = { slug: 'counter', currency: 'NGN', tenant: ids.brand, location: 'e'.repeat(24) };
  const base = {
    kiosk,
    tenant: { posSettings: { taxRate: 0 } },
    pricelist: { _id: ids.brand, currency: 'NGN' },
  };
  t.mock.method(Size, 'find', () => q([sizeRow]));
  t.mock.method(SubProduct, 'find', () => q([subRow]));
  t.mock.method(Product, 'find', () => q([productRow]));
  t.mock.method(Stock, 'find', () => q([{ size: ids.size, currentQuantity: 0, reservedQuantity: 0 }]));
  const hidden = await buildBook({ ...base, kiosk: { ...kiosk, settings: { outOfStock: 'HIDE' } } });
  assert.deepEqual(hidden.items, []);
});

test('buildBook skips sizes whose prices are unavailable', async (t) => {
  t.mock.method(Size, 'find', () => q([
    { ...sizeRow, currency: 'USD', barcode: 'usd-code' },
    sizeRow,
  ]));
  t.mock.method(SubProduct, 'find', () => q([subRow]));
  t.mock.method(Product, 'find', () => q([productRow]));
  t.mock.method(Stock, 'find', () => q([{ size: ids.size, currentQuantity: 3 }]));
  const book = await buildBook({
    kiosk: { slug: 'counter', currency: 'NGN', tenant: ids.brand, location: 'e'.repeat(24), settings: {} },
    tenant: {},
    pricelist: null,
  });
  assert.equal(book.items.length, 1);
  assert.equal(book.items[0].barcode, '4901877007131');
});
