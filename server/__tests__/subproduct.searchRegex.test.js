// server/__tests__/subproduct.searchRegex.test.js
//
// Regression test for the 500 seen on the purchase edit page:
//
//   SubProduct service error status: 500
//   at Object.getSubProducts (src/services/subproduct.service.ts)
//   at async ensureInitial (src/app/shared/purchases/purchases-edit.tsx)
//
// The product search built `new RegExp(search.trim(), 'i')` straight from user
// input, so any metacharacter threw a SyntaxError that asyncHandler surfaced
// as a 500. This pins the service path itself, not just the escape helper —
// per the convention in salesOrder.quotation.test.js we mock the Mongoose
// model methods rather than booting a database (mongodb-memory-server is not
// a dependency in this repo).
const test = require('node:test');
const assert = require('node:assert');

const METACHARACTERS = ['(', ')', '[', ']', '{', '}', '*', '+', '?', '.', '^', '$', '|', '\\'];

/** A chainable stand-in for a Mongoose query builder. */
function chain(result) {
  const q = {
    select: () => q,
    populate: () => q,
    sort: () => q,
    skip: () => q,
    limit: () => q,
    lean: () => Promise.resolve(result),
  };
  return q;
}

function loadService(t, captured) {
  const Product = require('../models/Product');
  const SubProduct = require('../models/SubProduct');

  t.mock.method(Product, 'find', (filter) => {
    // This is the call that used to throw before it was ever reached.
    if (filter?.name instanceof RegExp) captured.re = filter.name;
    return chain([]);
  });
  t.mock.method(SubProduct, 'find', () => chain([]));
  t.mock.method(SubProduct, 'countDocuments', async () => 0);

  // Fresh require so the mocked methods are the ones the service closes over.
  return require('../services/subproduct.service');
}

const OPTS = {
  page: 1,
  limit: 50,
  sort: 'createdAt',
  order: 'desc',
  isSuperAdmin: false,
  warehouseId: null,
};

test('a metacharacter search resolves instead of throwing a 500', async (t) => {
  for (const term of METACHARACTERS) {
    const captured = {};
    const svc = loadService(t, captured);
    await assert.doesNotReject(
      () => svc.getMySubProducts(undefined, { ...OPTS, search: term }),
      `search=${JSON.stringify(term)} must not throw`
    );
    assert.ok(captured.re instanceof RegExp, `${term}: no RegExp reached Product.find`);
  }
});

test('the reported crash cases are the ones that used to 500', async (t) => {
  for (const term of ['(', '[', '*', '?', 'a(b', 'C++', '.*']) {
    const captured = {};
    const svc = loadService(t, captured);
    await assert.doesNotReject(
      () => svc.getMySubProducts(undefined, { ...OPTS, search: term }),
      `search=${JSON.stringify(term)} must not throw`
    );
  }
});

test('a metacharacter is matched literally, not as a pattern', async (t) => {
  const captured = {};
  const svc = loadService(t, captured);
  await svc.getMySubProducts(undefined, { ...OPTS, search: '.*' });

  assert.ok(captured.re instanceof RegExp);
  assert.strictEqual(captured.re.test('.*'), true, 'literal ".*" should match itself');
  assert.strictEqual(
    captured.re.test('Red Schooner Voyage 4'),
    false,
    '".*" must not behave as a wildcard over the catalogue'
  );
});

test('an ordinary search still matches as before', async (t) => {
  const captured = {};
  const svc = loadService(t, captured);
  await svc.getMySubProducts(undefined, { ...OPTS, search: 'wine' });

  assert.ok(captured.re instanceof RegExp);
  assert.strictEqual(captured.re.test('Sunblessed Red Wine'), true);
  assert.strictEqual(captured.re.flags.includes('i'), true, 'must stay case-insensitive');
});

test('a whitespace-only search is skipped rather than turned into a matcher', async (t) => {
  const captured = {};
  const svc = loadService(t, captured);
  await svc.getMySubProducts(undefined, { ...OPTS, search: '   ' });
  assert.strictEqual(captured.re, undefined, 'blank search should not build a regex');
});
