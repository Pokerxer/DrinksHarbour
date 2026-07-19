// server/__tests__/featured.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const { mergeFeaturedWithFallback } = require('../services/featured.helpers');

const p = (id) => ({ _id: id, name: `p${id}` });

test('featured products come first, then fallback fills the rest', () => {
  const out = mergeFeaturedWithFallback([p('a'), p('b')], [p('c'), p('d')], 4);
  assert.deepStrictEqual(out.map((x) => x._id), ['a', 'b', 'c', 'd']);
});

test('caps the result at limit', () => {
  const out = mergeFeaturedWithFallback([p('a'), p('b')], [p('c'), p('d')], 3);
  assert.deepStrictEqual(out.map((x) => x._id), ['a', 'b', 'c']);
});

test('de-duplicates by _id, keeping the featured copy', () => {
  const out = mergeFeaturedWithFallback([p('a')], [p('a'), p('b')], 5);
  assert.deepStrictEqual(out.map((x) => x._id), ['a', 'b']);
});

test('handles ObjectId-like _id via toString', () => {
  const oid = (v) => ({ _id: { toString: () => v }, name: v });
  const out = mergeFeaturedWithFallback([oid('a')], [oid('a'), oid('b')], 5);
  assert.deepStrictEqual(out.map((x) => x._id.toString()), ['a', 'b']);
});

test('empty featured returns fallback up to limit', () => {
  const out = mergeFeaturedWithFallback([], [p('c'), p('d'), p('e')], 2);
  assert.deepStrictEqual(out.map((x) => x._id), ['c', 'd']);
});
