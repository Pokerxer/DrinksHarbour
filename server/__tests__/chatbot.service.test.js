// server/__tests__/chatbot.service.test.js
const test = require('node:test');
const assert = require('node:assert');

const Tenant = require('../models/Tenant');
const Product = require('../models/Product');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const productService = require('../services/product.service');
const chatbotService = require('../services/chatbot.service');
const { anthropic, getGreetingResponse, handleChatbotQuery } = chatbotService;

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

test('getGreetingResponse returns Claude-generated text', async (t) => {
  t.mock.method(anthropic.messages, 'create', async () => textResponse('Welcome, friend! Ask me anything about drinks.'));

  const result = await getGreetingResponse();

  assert.strictEqual(result.response, 'Welcome, friend! Ask me anything about drinks.');
  assert.strictEqual(result.intent, 'greeting');
  assert.deepStrictEqual(result.quickReplies, ['Wines', 'Beers', 'Spirits', 'Events', 'Deals']);
});

test('getGreetingResponse falls back to a fixed string when Claude fails', async (t) => {
  t.mock.method(anthropic.messages, 'create', async () => { throw new Error('API down'); });

  const result = await getGreetingResponse();

  assert.strictEqual(
    result.response,
    "👋 Hi! I'm your DrinksHarbour assistant. Ask me about drinks, prices, or planning an event!"
  );
});
