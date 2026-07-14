// server/__tests__/blog.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  BLOG_CATEGORIES,
  BLOCK_TYPES,
  AI_BLOCK_ACTIONS,
  slugify,
  dedupeSlug,
  computeReadTime,
  sanitizeContentBlocks,
  snapCategory,
  parseAiJson,
  isRewritableBlock,
} = require('../services/blog.helpers');

test('slugify lowercases, strips apostrophes, and kebab-cases', () => {
  assert.strictEqual(slugify("Nigeria's Top 10 Wines!"), 'nigerias-top-10-wines');
  assert.strictEqual(slugify('  Gin & Tonic — 101  '), 'gin-tonic-101');
  assert.strictEqual(slugify(''), '');
});

test('dedupeSlug returns base when free, else appends -2, -3, ...', () => {
  assert.strictEqual(dedupeSlug('wine-guide', []), 'wine-guide');
  assert.strictEqual(dedupeSlug('wine-guide', ['wine-guide']), 'wine-guide-2');
  assert.strictEqual(dedupeSlug('wine-guide', ['wine-guide', 'wine-guide-2']), 'wine-guide-3');
});

test('computeReadTime counts words in text and items at ~200wpm, min 1 min', () => {
  assert.strictEqual(computeReadTime([]), '1 min read');
  const words400 = { type: 'p', text: Array(400).fill('word').join(' ') };
  assert.strictEqual(computeReadTime([words400]), '2 min read');
  const listBlock = { type: 'ul', items: [Array(100).fill('w').join(' '), Array(100).fill('w').join(' ')] };
  assert.strictEqual(computeReadTime([words400, listBlock]), '3 min read');
});

test('sanitizeContentBlocks drops invalid types and strips unknown keys', () => {
  const out = sanitizeContentBlocks([
    { type: 'p', text: 'hello', junk: 1 },
    { type: 'div', text: 'nope' },
    { type: 'ul', items: ['a', 'b'] },
    null,
    { type: 'tip' },
  ]);
  assert.deepStrictEqual(out, [
    { type: 'p', text: 'hello', items: [] },
    { type: 'ul', text: '', items: ['a', 'b'] },
    { type: 'tip', text: '', items: [] },
  ]);
});

test('snapCategory matches case-insensitively and returns null for unknown', () => {
  assert.strictEqual(snapCategory('wine guide'), 'Wine Guide');
  assert.strictEqual(snapCategory('Recipes'), 'Recipes');
  assert.strictEqual(snapCategory('Gossip'), null);
});

test('parseAiJson handles raw JSON, fenced JSON, and JSON with prose around it', () => {
  assert.deepStrictEqual(parseAiJson('{"a":1}'), { a: 1 });
  assert.deepStrictEqual(parseAiJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepStrictEqual(parseAiJson('Sure! {"a":1} hope that helps'), { a: 1 });
  assert.throws(() => parseAiJson('no json here'));
});

test('sanitizeContentBlocks preserves image block fields and drops stray text', () => {
  const out = sanitizeContentBlocks([
    { type: 'image', src: 'https://x/i.jpg', alt: 'a', caption: 'c', text: 'ignored' },
    { type: 'p', text: 'hi' },
    { type: 'bogus', text: 'nope' },
  ]);
  assert.deepStrictEqual(out[0], { type: 'image', src: 'https://x/i.jpg', alt: 'a', caption: 'c' });
  assert.deepStrictEqual(out[1], { type: 'p', text: 'hi', items: [] });
  assert.strictEqual(out.length, 2);
});

test('exports category and block-type enums', () => {
  assert.deepStrictEqual(BLOG_CATEGORIES, ['Wine Guide', 'Spirits Guide', 'Beer Guide', 'Recipes', 'Entertaining', 'Lifestyle']);
  assert.deepStrictEqual(BLOCK_TYPES, ['p', 'h2', 'h3', 'ul', 'ol', 'quote', 'tip', 'image']);
});

test('AI_BLOCK_ACTIONS enumerates the per-block rewrite actions', () => {
  assert.deepStrictEqual(AI_BLOCK_ACTIONS, ['rewrite', 'expand', 'shorten']);
});

test('isRewritableBlock accepts prose and list blocks, rejects image/unknown/empty', () => {
  // text-bearing prose blocks
  for (const type of ['p', 'h2', 'h3', 'quote', 'tip']) {
    assert.strictEqual(isRewritableBlock({ type, text: 'hi' }), true, `${type} with text`);
  }
  // list blocks with items
  assert.strictEqual(isRewritableBlock({ type: 'ul', items: ['a'] }), true);
  assert.strictEqual(isRewritableBlock({ type: 'ol', items: ['a', 'b'] }), true);
  // image blocks have no prose to rewrite
  assert.strictEqual(isRewritableBlock({ type: 'image', src: 'x', alt: 'a' }), false);
  // empty content is not rewritable
  assert.strictEqual(isRewritableBlock({ type: 'p', text: '   ' }), false);
  assert.strictEqual(isRewritableBlock({ type: 'ul', items: [] }), false);
  assert.strictEqual(isRewritableBlock({ type: 'ul', items: ['', '  '] }), false);
  // junk
  assert.strictEqual(isRewritableBlock({ type: 'bogus', text: 'x' }), false);
  assert.strictEqual(isRewritableBlock(null), false);
  assert.strictEqual(isRewritableBlock(undefined), false);
});
