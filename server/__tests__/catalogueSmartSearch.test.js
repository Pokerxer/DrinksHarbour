const test = require('node:test');
const assert = require('node:assert/strict');

const products = [
  { _id: 'red', name: 'Johnnie Walker Red Label', type: 'whiskey' },
  { _id: 'blue', name: 'Johnnie Walker Blue Label', type: 'whiskey', barcode: '5010101010101' },
  { _id: 'related', name: 'Jameson', type: 'whiskey' },
  { _id: 'unrelated', name: 'Coca Cola', type: 'soft_drink' },
];

test('catalogue ranking prefers exact identity, reordered words and typo-tolerant names', () => {
  const { rankCatalogueProducts } = require('../services/catalogue-search-ranking');
  for (const query of ['Johnnie Walker Blue Label', 'walker blue', 'johnie walker blue']) {
    const ranked = rankCatalogueProducts(products, query);
    assert.equal(ranked[0]._id, 'blue', query);
    assert.notEqual(ranked[0].matchKind, 'related');
  }
  assert.equal(rankCatalogueProducts(products, '5010101010101')[0]._id, 'blue');
});

test('catalogue ranking folds accents and punctuation, supports synonyms and rejects unrelated guesses', () => {
  const { rankCatalogueProducts } = require('../services/catalogue-search-ranking');
  assert.equal(rankCatalogueProducts([{ _id: 'moet', name: 'Moët & Chandon' }], 'moet chandon')[0]._id, 'moet');
  assert.equal(rankCatalogueProducts([{ _id: 'h', name: 'Hennessy VS' }], 'henessy')[0]._id, 'h');
  assert.equal(rankCatalogueProducts(products, 'whisky').length, 3);
  assert.equal(rankCatalogueProducts(products, 'zzzxxyy').length, 0);
  assert.equal(rankCatalogueProducts(products, '.*').length, 0);
});

test('a shorter matching product name wins over a special edition with the same name words', () => {
  const { rankCatalogueProducts } = require('../services/catalogue-search-ranking');
  const ranked = rankCatalogueProducts([
    { _id: 'special', name: 'Johnnie Walker Blue Label Ghost & Rare' },
    { _id: 'standard', name: 'Johnnie Walker Blue Label Whisky' },
  ], 'johnie walker blue');
  assert.equal(ranked[0]._id, 'standard');
});

test('a complete VS word ranks ahead of VSOP while partial names remain searchable', () => {
  const { rankCatalogueProducts } = require('../services/catalogue-search-ranking');
  const ranked = rankCatalogueProducts([
    { _id: 'vsop', name: 'Hennessy VSOP' },
    { _id: 'vs', name: 'Hennessy VS Cognac' },
  ], 'hennessy vs');
  assert.equal(ranked[0]._id, 'vs');
});

test('candidate regex retrieves transpositions, missing letters and safely treats punctuation', () => {
  const { catalogueNamePattern } = require('../services/catalogue-search-ranking');
  assert.ok(catalogueNamePattern('henessy').test('Hennessy VS'));
  assert.ok(catalogueNamePattern('waler').test('Walker'));
  assert.ok(catalogueNamePattern('walkre').test('Walker'));
  assert.equal(catalogueNamePattern('.*').test('anything'), false);
});

test('smart search is bounded, Product-only, includes pending and never depends on stock', async () => {
  const Product = require('../models/Product');
  const models = ['Brand', 'Category', 'SubCategory'].map((name) => require(`../models/${name}`));
  const originals = models.map((model) => model.find);
  const originalAggregate = Product.aggregate;
  const originalPopulate = Product.populate;
  let pipeline;
  models.forEach((model) => { model.find = () => ({ select() { return this; }, limit() { return this; }, lean: async () => [] }); });
  Product.aggregate = async (value) => { pipeline = value; return products.map((product) => ({ ...product, costPrice: 900, tenant: 'private-tenant', subProducts: [{ costPrice: 800 }] })); };
  Product.populate = async (rows) => rows;
  try {
    const { searchCatalogueProducts } = require('../services/catalogue-search.service');
    const result = await searchCatalogueProducts({ query: 'walker blue', limit: 1000 });
    assert.equal(result.products[0]._id, 'blue');
    assert.deepEqual(pipeline[0].$match.status, { $in: ['approved', 'pending'] });
    assert.equal(pipeline[0].$match.isPublished, undefined);
    assert.ok(pipeline.some((stage) => stage.$limit === 300));
    assert.equal(JSON.stringify(pipeline).includes('subproducts'), false);
    assert.equal(JSON.stringify(result).includes('costPrice'), false);
    assert.equal(JSON.stringify(result).includes('private-tenant'), false);
    assert.ok(result.products.length <= 15);
  } finally {
    models.forEach((model, index) => { model.find = originals[index]; });
    Product.aggregate = originalAggregate;
    Product.populate = originalPopulate;
  }
});

test('smart matching stays on the authenticated catalog handler; public search keeps its visibility gates', async () => {
  const controller = require('../controllers/product.controller');
  const smart = require('../services/catalogue-search.service');
  const general = require('../services/product.service');
  const originalSmart = smart.searchCatalogueProducts;
  const originalGeneral = general.searchProducts;
  let received;
  smart.searchCatalogueProducts = async (params) => { received = params; return { products: [] }; };
  general.searchProducts = async (params) => { received = params; return { products: [] }; };
  const res = { status() { return this; }, json() {} };
  try {
    await controller.searchProducts({ query: { q: 'moet', matchMode: 'smart', type: 'wine' }, user: { role: 'tenant_admin' } }, res, (error) => { throw error; });
    assert.deepEqual(received, { query: 'moet', type: 'wine', limit: undefined });
    await controller.searchProductsPublic({ query: { q: 'moet', matchMode: 'smart', status: 'pending' } }, res, (error) => { throw error; });
    assert.equal(received.status, 'approved');
    assert.equal(received.includeUnpublished, false);
  } finally { smart.searchCatalogueProducts = originalSmart; general.searchProducts = originalGeneral; }
});
