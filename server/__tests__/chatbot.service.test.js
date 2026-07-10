// server/__tests__/chatbot.service.test.js
const test = require('node:test');
const assert = require('node:assert');

const Tenant = require('../models/Tenant');
const Product = require('../models/Product');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const productService = require('../services/product.service');
const chatbotService = require('../services/chatbot.service');
const { anthropic, getGreetingResponse, handleChatbotQuery, findSubstitutes } = chatbotService;

// Mongoose query chains end in .lean() — supports every chain method these
// flows call, regardless of the filter passed to .find().
const chainable = (data) => {
  const obj = {};
  ['select', 'populate', 'limit', 'sort', 'skip'].forEach((m) => { obj[m] = () => obj; });
  obj.lean = async () => data;
  return obj;
};

// Every test in this file forces an empty catalog/product set so we're only
// exercising the Claude-response orchestration logic, not real DB pricing
// (that's covered separately in chatbot.catalog.test.js).
const stubEmptyCatalog = (t) => {
  t.mock.method(Tenant, 'find', () => chainable([]));
  t.mock.method(Product, 'find', () => chainable([]));
  t.mock.method(SubProduct, 'find', () => chainable([]));
  t.mock.method(Size, 'find', () => chainable([]));
  t.mock.method(productService, 'searchProducts', async () => ({ products: [] }));
};

const textResponse = (text) => ({ content: [{ type: 'text', text }] });

test('getGreetingResponse is instant and never calls Claude', async (t) => {
  let calls = 0;
  t.mock.method(anthropic.messages, 'create', async () => { calls += 1; return textResponse('should not be used'); });

  const result = await getGreetingResponse();

  assert.strictEqual(calls, 0, 'greeting must not make an AI round-trip');
  assert.ok(typeof result.response === 'string' && result.response.length > 20);
  assert.strictEqual(result.intent, 'greeting');
  assert.ok(Array.isArray(result.quickReplies) && result.quickReplies.length >= 4);
  assert.ok(result.quickReplies.every(qr => qr.label && qr.query));
});

test('getGreetingResponse still works when Claude is down', async (t) => {
  t.mock.method(anthropic.messages, 'create', async () => { throw new Error('API down'); });

  const result = await getGreetingResponse();

  assert.ok(typeof result.response === 'string' && result.response.length > 20);
  assert.strictEqual(result.intent, 'greeting');
});

test('handleChatbotQuery uses the first Claude response when available', async (t) => {
  stubEmptyCatalog(t);
  let calls = 0;
  t.mock.method(anthropic.messages, 'create', async () => {
    calls += 1;
    return textResponse('Here is a great whiskey pick for you!');
  });

  const result = await handleChatbotQuery({ query: 'What whiskey do you recommend?' });

  assert.strictEqual(result.response, 'Here is a great whiskey pick for you!');
  assert.strictEqual(calls, 1);
});

test('handleChatbotQuery retries once with a minimal prompt before falling back', async (t) => {
  stubEmptyCatalog(t);
  let calls = 0;
  t.mock.method(anthropic.messages, 'create', async () => {
    calls += 1;
    if (calls === 1) return { content: [] }; // no text block -> callClaude returns null
    return textResponse('Sure, happy to help with that!');
  });

  const result = await handleChatbotQuery({ query: 'What whiskey do you recommend?' });

  assert.strictEqual(calls, 2);
  assert.strictEqual(result.response, 'Sure, happy to help with that!');
});

test('handleChatbotQuery falls back to one honest message when Claude fails twice, even with no conversation history', async (t) => {
  stubEmptyCatalog(t);
  let calls = 0;
  t.mock.method(anthropic.messages, 'create', async () => { calls += 1; return { content: [] }; });

  const result = await handleChatbotQuery({ query: 'What whiskey do you recommend?' });

  assert.strictEqual(calls, 2, 'expected exactly 2 attempts: initial + one retry');
  assert.strictEqual(result.response, "I'm having trouble answering right now — please try again in a moment, or browse /shop.");
});

test('findSubstitutes ranks same-category in-stock products by brand/ABV/price similarity', () => {
  const entries = [
    { id: '1', name: 'Jameson Irish Whiskey', slug: 'jameson', type: 'spirit', subType: 'whiskey', category: 'Spirits', subCategory: 'Whiskey', brand: 'Jameson', abv: 40, minPrice: 28000, maxPrice: 28000, totalStock: 12, onSale: false, image: null, sizes: [] },
    { id: '2', name: 'Four Cousins Sweet Red', slug: 'four-cousins', type: 'wine', subType: 'red wine', category: 'Wine', subCategory: 'Red', brand: 'Four Cousins', abv: 7.5, minPrice: 9000, maxPrice: 9000, totalStock: 30, onSale: false, image: null, sizes: [] },
    { id: '3', name: 'Jack Daniels Honey', slug: 'jd-honey', type: 'spirit', subType: 'whiskey', category: 'Spirits', subCategory: 'Whiskey', brand: 'Jack Daniels', abv: 35, minPrice: 32000, maxPrice: 32000, totalStock: 5, onSale: false, image: null, sizes: [] },
    { id: '4', name: 'Glenfiddich 12', slug: 'glenfiddich-12', type: 'spirit', subType: 'whiskey', category: 'Spirits', subCategory: 'Whiskey', brand: 'Glenfiddich', abv: 40, minPrice: 65000, maxPrice: 65000, totalStock: 0, onSale: false, image: null, sizes: [] },
  ];
  const identified = { name: "Jack Daniel's Old No. 7", brand: 'Jack Daniels', type: 'whiskey', subType: 'Tennessee whiskey', abv: 40, estimatedPriceNgn: 30000 };

  const subs = findSubstitutes(identified, entries, 4);

  assert.ok(subs.length >= 2, 'expected whiskey substitutes to be found');
  assert.strictEqual(subs[0].id, '3', 'same-brand bottle should rank first');
  assert.ok(!subs.some(s => s.id === '4'), 'out-of-stock products must be excluded');
  assert.ok(subs.findIndex(s => s.id === '1') < subs.findIndex(s => s.id === '2') || !subs.some(s => s.id === '2'),
    'whiskeys must outrank unrelated wine');
});

test('findSubstitutes returns empty for missing identification or catalog', () => {
  assert.deepStrictEqual(findSubstitutes(null, [{ id: '1' }]), []);
  assert.deepStrictEqual(findSubstitutes({ type: 'wine' }, []), []);
});

test('file upload: Claude composes the order summary using computed totals as context', async (t) => {
  stubEmptyCatalog(t);
  let lastSystemPrompt = null;
  t.mock.method(anthropic.messages, 'create', async (params) => {
    lastSystemPrompt = params.system;
    return textResponse('Here is your order summary!');
  });

  const result = await handleChatbotQuery({
    query: 'Please check my list',
    fileContent: '2 Heineken\n1 Red Wine',
    fileName: 'order.txt',
  });

  assert.strictEqual(result.response, 'Here is your order summary!');
  assert.strictEqual(result.intent, 'file_query');
  assert.ok(lastSystemPrompt.includes('ITEMS NOT FOUND IN CATALOG: Heineken, Red Wine'));
  assert.strictEqual(result.orderSummary.totalPrice, 0);
  assert.strictEqual(result.orderSummary.itemsNotFound, 2);
});

test('file upload: falls back to the literal computed summary when Claude fails', async (t) => {
  stubEmptyCatalog(t);
  t.mock.method(anthropic.messages, 'create', async () => ({ content: [] }));

  const result = await handleChatbotQuery({
    query: 'Please check my list',
    fileContent: '2 Heineken',
    fileName: 'order.txt',
  });

  assert.match(result.response, /Not in catalog: Heineken/);
});

// ── extractCartProposal ───────────────────────────────────────────────────────
test('extractCartProposal parses and strips CART_JSON, matching products by name', () => {
  const { extractCartProposal } = chatbotService;
  const products = [
    { _id: 'p1', name: 'Moët & Chandon Imperial', slug: 'moet-chandon-imperial', minPrice: 85000, image: 'moet.jpg' },
    { _id: 'p2', name: 'Jameson Irish Whiskey', slug: 'jameson-irish-whiskey', minPrice: 22000, image: null },
  ];
  const raw = 'Here is your event plan! Want me to add these to your cart? 🛒\nCART_JSON: [{"name":"Moët & Chandon Imperial","size":"75cl","qty":3},{"name":"jameson irish whiskey","size":null,"qty":2}]';
  const { text, proposal } = extractCartProposal(raw, products);

  assert.ok(!text.includes('CART_JSON'), 'CART_JSON line must be stripped from display text');
  assert.ok(text.includes('Want me to add these'), 'conversational text preserved');
  assert.strictEqual(proposal.length, 2);
  assert.deepStrictEqual(proposal[0], {
    id: 'p1', slug: 'moet-chandon-imperial', name: 'Moët & Chandon Imperial',
    size: '75cl', qty: 3, price: 85000, image: 'moet.jpg',
  });
  assert.strictEqual(proposal[1].qty, 2, 'case-insensitive name match keeps qty');
  assert.strictEqual(proposal[1].size, null);
});

test('extractCartProposal drops unknown products, clamps qty, tolerates bad JSON', () => {
  const { extractCartProposal } = chatbotService;
  const products = [{ _id: 'p1', name: 'Star Lager', slug: 'star-lager', minPrice: 800 }];

  const mixed = extractCartProposal('Text.\nCART_JSON: [{"name":"Star Lager","qty":500},{"name":"Not In Catalog","qty":1}]', products);
  assert.strictEqual(mixed.proposal.length, 1, 'unmatched names are dropped');
  assert.strictEqual(mixed.proposal[0].qty, 99, 'qty clamped to 99');

  const bad = extractCartProposal('Text.\nCART_JSON: [{"name": broken', products);
  assert.strictEqual(bad.proposal.length, 0);

  const none = extractCartProposal('Just a normal reply with no offer.', products);
  assert.strictEqual(none.proposal.length, 0);
  assert.strictEqual(none.text, 'Just a normal reply with no offer.');
});
