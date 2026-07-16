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
  const isAllowed = (href) => allowed.has(href) || href.startsWith('/categories') || href.startsWith('/brands');
  const content = [
    { type: 'p', text: 'Buy [Real](/product/real-one) not [Fake](/product/made-up).' },
    { type: 'ul', items: ['See [Wine](/categories/wine)', 'Bad [X](/product/nope)'] },
  ];
  const out = sanitizeInlineLinks(content, isAllowed);
  assert.strictEqual(out[0].text, 'Buy [Real](/product/real-one) not Fake.');
  assert.strictEqual(out[1].items[0], 'See [Wine](/categories/wine)');
  assert.strictEqual(out[1].items[1], 'Bad X');
});

test('sanitizeInlineLinks keeps /brands detail links', () => {
  const isAllowed = (href) => href.startsWith('/brands') || href.startsWith('/categories');
  const content = [
    { type: 'p', text: 'Explore the [Hennessy](/brands/hennessy) range tonight.' },
    { type: 'ul', items: ['Try [Moet](/brands/moet-chandon)', 'Skip [Fake](/product/nope)'] },
  ];
  const out = sanitizeInlineLinks(content, isAllowed);
  assert.strictEqual(out[0].text, 'Explore the [Hennessy](/brands/hennessy) range tonight.');
  assert.strictEqual(out[1].items[0], 'Try [Moet](/brands/moet-chandon)');
  assert.strictEqual(out[1].items[1], 'Skip Fake');
});

test('sanitizeInlineLinks keeps /categories/{cat}/{sub} detail links', () => {
  const isAllowed = (href) => href.startsWith('/categories');
  const content = [
    { type: 'p', text: 'Pour a glass of [Cabernet](/categories/red-wine/cabernet-sauvignon) tonight.' },
  ];
  const out = sanitizeInlineLinks(content, isAllowed);
  assert.strictEqual(
    out[0].text,
    'Pour a glass of [Cabernet](/categories/red-wine/cabernet-sauvignon) tonight.'
  );
});

test('sanitizeInlineLinks strips legacy /shop? filter URLs the blog no longer emits', () => {
  const allowed = new Set(['/product/real-one']);
  const isAllowed = (href) =>
    allowed.has(href) || href.startsWith('/categories') || href.startsWith('/brands') || href.startsWith('/blog');
  const content = [
    { type: 'p', text: 'Old [Wine](/shop?category=wine) link is now plain text.' },
  ];
  const out = sanitizeInlineLinks(content, isAllowed);
  assert.strictEqual(out[0].text, 'Old Wine link is now plain text.');
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

test('makeLinkValidator allows catalog /product + /categories + /brands + /blog + /, strips unknown /product and /shop', () => {
  const allowed = new Set(['/product/real', '/categories/wine', '/brands/hennessy']);
  const isAllowed = (href) => {
    if (allowed.has(href)) return true;
    if (href.startsWith('/product/')) return false;
    return href.startsWith('/categories') || href.startsWith('/brands') || href.startsWith('/blog') || href === '/';
  };
  assert.ok(isAllowed('/product/real'));
  assert.ok(!isAllowed('/product/fake'));
  assert.ok(isAllowed('/categories/wine'));
  assert.ok(isAllowed('/categories/red-wine/cabernet-sauvignon'));
  assert.ok(isAllowed('/brands/hennessy'));
  assert.ok(isAllowed('/blog/some-post'));
  assert.ok(isAllowed('/'));
  assert.ok(!isAllowed('/shop?category=wine'));
  assert.ok(!isAllowed('https://example.com'));
});