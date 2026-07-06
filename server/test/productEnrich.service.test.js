// server/test/productEnrich.service.test.js
const test = require('node:test');
const assert = require('node:assert');
const svc = require('../services/productEnrich.service');

// Fake Anthropic client returning a canned JSON payload; captures the prompt.
function fakeAnthropic(json, captured = {}) {
  return {
    messages: {
      create: async (req) => {
        captured.req = req;
        return { content: [{ text: JSON.stringify(json) }] };
      },
    },
  };
}

test('getCategoryOptions builds top-level list + children map from Category docs', async () => {
  const docs = [
    { _id: '1', name: 'Whiskey', parent: null },
    { _id: '2', name: 'Scotch', parent: '1' },
    { _id: '3', name: 'Bourbon', parent: '1' },
    { _id: '4', name: 'Gin', parent: null },
  ];
  const Category = { find: () => ({ select: () => ({ lean: async () => docs }) }) };
  const opts = await svc.getCategoryOptions({ Category });
  assert.deepEqual(opts.categories, ['Whiskey', 'Gin']);
  assert.deepEqual(opts.subcategories, { Whiskey: ['Scotch', 'Bourbon'] });
});

test('enrich snaps category/subCategory to canonical DB names (case-insensitive)', async () => {
  const anthropic = fakeAnthropic({
    name: 'Glen Moray Elgin Classic', type: 'scotch',
    category: 'whiskey', subCategory: 'SCOTCH', // wrong casing from the model
  });
  const res = await svc.enrichProductFromName(
    'glen moray 70cl',
    { categories: ['Whiskey', 'Gin'], subcategories: { Whiskey: ['Scotch', 'Bourbon'] } },
    { anthropic }
  );
  assert.equal(res.category, 'Whiskey');   // canonical DB casing
  assert.equal(res.subCategory, 'Scotch'); // canonical DB casing
});

test('enrich drops a category the DB does not have (never invents)', async () => {
  const anthropic = fakeAnthropic({
    name: 'Glen Moray', type: 'scotch',
    category: 'Single Malts', subCategory: 'Speyside', // invented by the model
  });
  const res = await svc.enrichProductFromName(
    'glen moray',
    { categories: ['Whiskey', 'Gin'], subcategories: {} },
    { anthropic }
  );
  assert.equal(res.category, undefined);
  assert.equal(res.subCategory, undefined);
});

test('enrich drops a subCategory that is not a child of the chosen category', async () => {
  const anthropic = fakeAnthropic({
    name: 'Bombay Sapphire', type: 'gin',
    category: 'Gin', subCategory: 'Scotch', // real name, wrong branch
  });
  const res = await svc.enrichProductFromName(
    'bombay sapphire',
    { categories: ['Whiskey', 'Gin'], subcategories: { Whiskey: ['Scotch'] } },
    { anthropic }
  );
  assert.equal(res.category, 'Gin');
  assert.equal(res.subCategory, undefined);
});

test('enrich prompt demands a pick from the DB list and maps subcategories per category', async () => {
  const captured = {};
  const anthropic = fakeAnthropic({ name: 'X', type: 'gin' }, captured);
  await svc.enrichProductFromName(
    'x gin',
    { categories: ['Whiskey', 'Gin'], subcategories: { Whiskey: ['Scotch'] } },
    { anthropic }
  );
  const prompt = captured.req.messages[0].content;
  assert.match(prompt, /Whiskey, Gin/);            // offers the DB categories
  assert.match(prompt, /MUST pick/i);              // forces a best-match choice
  assert.match(prompt, /Whiskey: Scotch/);         // per-category subcategory map
});
