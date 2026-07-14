'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { extractInternalLinks, sanitizeInlineLinks } = require('../services/blog.helpers');

test('extractInternalLinks finds links in text and list items', () => {
  const content = [
    { type: 'p', text: 'Try [Hennessy VS](/product/hennessy-vs) tonight.' },
    { type: 'ul', items: ['Pair with [Moet](/product/moet)', 'no link here'] },
  ];
  const links = extractInternalLinks(content);
  assert.strictEqual(links.length, 2);
  assert.deepStrictEqual(links[0], { text: 'Hennessy VS', href: '/product/hennessy-vs' });
  assert.deepStrictEqual(links[1], { text: 'Moet', href: '/product/moet' });
});

test('sanitizeInlineLinks strips disallowed product links but keeps anchor text', () => {
  const allowed = new Set(['/product/real-one']);
  const isAllowed = (href) => allowed.has(href) || href.startsWith('/shop');
  const content = [
    { type: 'p', text: 'Buy [Real](/product/real-one) not [Fake](/product/made-up).' },
    { type: 'ul', items: ['See [Wine](/shop?category=wine)', 'Bad [X](/product/nope)'] },
  ];
  const out = sanitizeInlineLinks(content, isAllowed);
  assert.strictEqual(out[0].text, 'Buy [Real](/product/real-one) not Fake.');
  assert.strictEqual(out[1].items[0], 'See [Wine](/shop?category=wine)');
  assert.strictEqual(out[1].items[1], 'Bad X');
});

test('sanitizeInlineLinks keeps brand /shop links (any /shop path is allowed)', () => {
  const allowed = new Set(['/product/real-one']);
  const isAllowed = (href) => allowed.has(href) || href.startsWith('/shop');
  const content = [
    { type: 'p', text: 'Explore the [Hennessy](/shop?brand=hennessy) range tonight.' },
    { type: 'ul', items: ['Try [Moet](/shop?brand=moet-chandon)', 'Skip [Fake](/product/nope)'] },
  ];
  const out = sanitizeInlineLinks(content, isAllowed);
  assert.strictEqual(out[0].text, 'Explore the [Hennessy](/shop?brand=hennessy) range tonight.');
  assert.strictEqual(out[1].items[0], 'Try [Moet](/shop?brand=moet-chandon)');
  assert.strictEqual(out[1].items[1], 'Skip Fake');
});

test('sanitizeInlineLinks leaves link-free content untouched', () => {
  const content = [{ type: 'p', text: 'Plain paragraph.' }, { type: 'h2', text: 'Heading' }];
  const out = sanitizeInlineLinks(content, () => true);
  assert.strictEqual(out[0].text, 'Plain paragraph.');
  assert.strictEqual(out[1].text, 'Heading');
});

test('helpers tolerate non-array and empty input', () => {
  assert.deepStrictEqual(extractInternalLinks(null), []);
  assert.deepStrictEqual(sanitizeInlineLinks(undefined, () => true), []);
});
