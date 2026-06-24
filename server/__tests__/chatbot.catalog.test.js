// server/__tests__/chatbot.catalog.test.js
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const Tenant = require('../models/Tenant');
const Product = require('../models/Product');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const chatbotService = require('../services/chatbot.service');

// Mongoose query chains end in .lean() — this stub supports every chain
// method buildFullCatalogContext calls (select/populate/limit/sort/skip) and resolves
// to the given data, regardless of the filter passed to .find().
const chainable = (data) => {
  const obj = {};
  ['select', 'populate', 'limit', 'sort', 'skip'].forEach((m) => { obj[m] = () => obj; });
  obj.lean = async () => data;
  return obj;
};

test('buildFullCatalogContext tags on-sale products with [ON SALE] and does not throw', async (t) => {
  const tenantId = new mongoose.Types.ObjectId();
  const saleProductId = new mongoose.Types.ObjectId();
  const regularProductId = new mongoose.Types.ObjectId();
  const saleSizeId = new mongoose.Types.ObjectId();
  const regularSizeId = new mongoose.Types.ObjectId();

  t.mock.method(Tenant, 'find', () => chainable([
    { _id: tenantId, name: 'Test Tenant', revenueModel: 'markup', markupPercentage: 25, commissionPercentage: 12 },
  ]));
  t.mock.method(Product, 'find', () => chainable([
    { _id: saleProductId, name: 'Sale Whiskey', slug: 'sale-whiskey', type: 'spirit', category: null, subCategory: null, images: [] },
    { _id: regularProductId, name: 'Regular Gin', slug: 'regular-gin', type: 'spirit', category: null, subCategory: null, images: [] },
  ]));
  t.mock.method(SubProduct, 'find', () => chainable([
    {
      _id: new mongoose.Types.ObjectId(), product: saleProductId, tenant: tenantId,
      baseSellingPrice: 1000, costPrice: 1000, availableStock: 10,
      isOnSale: true, saleType: 'percentage', saleDiscountValue: 10,
      sizes: [saleSizeId],
    },
    {
      _id: new mongoose.Types.ObjectId(), product: regularProductId, tenant: tenantId,
      baseSellingPrice: 1000, costPrice: 1000, availableStock: 10,
      isOnSale: false,
      sizes: [regularSizeId],
    },
  ]));
  t.mock.method(Size, 'find', () => chainable([
    { _id: saleSizeId, size: '75cl', volumeMl: 750, stock: 10, status: 'active', availability: 'available', costPrice: 1000, sellingPrice: 1000 },
    { _id: regularSizeId, size: '75cl', volumeMl: 750, stock: 10, status: 'active', availability: 'available', costPrice: 1000, sellingPrice: 1000 },
  ]));

  const catalog = await chatbotService.buildFullCatalogContext();

  assert.ok(catalog, 'expected a non-null catalog string — buildFullCatalogContext must not throw/return null');
  assert.match(catalog, /Sale Whiskey[^\n]*\[ON SALE\]/);
  assert.ok(!/Regular Gin[^\n]*\[ON SALE\]/.test(catalog), 'non-sale product should not be tagged [ON SALE]');
});
