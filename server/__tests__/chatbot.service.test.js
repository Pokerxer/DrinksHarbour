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
