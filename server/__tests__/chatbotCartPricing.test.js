const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const Product = require('../models/Product');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const productService = require('../services/product.service');
const { extractCartProposal, handleChatbotQuery, anthropic } = require('../services/chatbot.service');

const product = {
  id: 'kopke', name: 'Kopke Fine Tawny Porto', slug: 'kopke-fine-tawny-porto',
  minPrice: 28500, sizes: [{ label: '75cl', price: 28500 }, { label: '1L', price: 35000 }],
};
const reply = (size) => `Price: ₦28,500 (75cl)\nCART_JSON: ${JSON.stringify([{ name: product.name, size, qty: 1 }])}`;

test('cart offer uses the requested size price rather than the product minimum', () => {
  const { proposal } = extractCartProposal(reply('1L'), [product]);
  assert.equal(proposal[0].price, 35000);
});
test('cart offer recognizes equivalent units and returns the catalog label', () => {
  const { proposal } = extractCartProposal(reply('750ml'), [product]);
  assert.equal(proposal[0].size, '75cl');
  assert.equal(proposal[0].price, 28500);
});
test('cart offer rejects an unknown size and an ambiguous unspecified size', () => {
  assert.deepEqual(extractCartProposal(reply('70cl'), [product]).proposal, []);
  assert.deepEqual(extractCartProposal(reply(null), [product]).proposal, []);
});
test('a single known size is selected explicitly when size is omitted', () => {
  const { proposal } = extractCartProposal(reply(null), [{ ...product, sizes: [product.sizes[0]] }]);
  assert.equal(proposal[0].size, '75cl');
});

const chain = (data) => {
  let fields;
  const query = { lean: async () => !fields ? data : data.map(row => Object.fromEntries(
    Object.entries(row).filter(([key]) => key === '_id' || fields.includes(key))
  )) };
  query.select = (selection) => { fields = selection.split(' '); return query; };
  for (const method of ['populate', 'limit', 'sort', 'skip']) query[method] = () => query;
  return query;
};
test('Kopke reply and cart offer retain the actual 28500 storefront price override', async (t) => {
  const tenantId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const sizeId = new mongoose.Types.ObjectId();
  t.mock.method(Tenant, 'find', () => chain([{ _id: tenantId, revenueModel: 'markup', markupPercentage: 0 }]));
  t.mock.method(Product, 'find', () => chain([{ ...product, _id: productId, platformMarkup: 10.8 }]));
  t.mock.method(SubProduct, 'find', () => chain([{
    product: productId, tenant: tenantId, costPrice: 25000, baseSellingPrice: 28500,
    availableStock: 10, sizes: [sizeId],
  }]));
  t.mock.method(Size, 'find', () => chain([{ _id: sizeId, size: '75cl', stock: 10, costPrice: 25000, sellingPrice: 28500, platformMarkupOverridePct: 14 }]));
  t.mock.method(productService, 'searchProducts', async () => ({ products: [{
    ...product, sizes: [], _id: productId, priceRange: { min: 28500 }, stockInfo: { availableStock: 10 },
  }] }));
  let system;
  t.mock.method(anthropic.messages, 'create', async (args) => {
    system = args.system;
    return { content: [{ type: 'text', text: reply('75cl') }] };
  });
  const result = await handleChatbotQuery({ query: 'Kopke Fine Tawny Porto price', tenantId });
  assert.ok(JSON.stringify(system).includes('28,500'), 'model must receive the actual storefront price');
  assert.ok(!JSON.stringify(system).includes('27,700'), 'model must not receive the price calculated without the saved override');
  assert.equal(result.cartProposal[0].price, 28500);
  assert.equal(result.cartProposal[0].size, '75cl');
});

for (const scenario of ['wholesale input', 'size-free price override']) {
  test(`catalog preserves storefront ${scenario}`, async (t) => {
    const tenantId = new mongoose.Types.ObjectId();
    const productId = new mongoose.Types.ObjectId();
    const sizeId = new mongoose.Types.ObjectId();
    const hasSize = scenario === 'wholesale input';
    t.mock.method(Tenant, 'find', () => chain([{ _id: tenantId, revenueModel: 'markup', markupPercentage: 0 }]));
    t.mock.method(Product, 'find', () => chain([{
      _id: productId, name: product.name, slug: product.slug, platformMarkup: hasSize ? 0 : 10.8,
    }]));
    t.mock.method(SubProduct, 'find', () => chain([{
      product: productId, tenant: tenantId, costPrice: 25000, baseSellingPrice: 40000,
      platformMarkupOverridePct: 14, availableStock: 10, sizes: hasSize ? [sizeId] : [],
    }]));
    t.mock.method(Size, 'find', () => chain([{
      _id: sizeId, size: '75cl', stock: 10, costPrice: 25000, wholesalePrice: 28500, sellingPrice: 40000,
    }]));
    const { loadCatalog } = require('../services/chatbot.service');
    const catalog = await loadCatalog(tenantId);
    assert.equal(catalog.entries[0].minPrice, 28500);
  });
}
