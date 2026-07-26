'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const {
  isBlockedUrl,
  hostOf,
  partitionExternalLinks,
  verifyLiveUrls,
  makeExternalLinkValidator,
  clearUrlCache,
  buildExternalLinkRecords,
  keepOnlyKnownLinks,
} = require('../services/blog.links');

// ── Domain policy ─────────────────────────────────────────────────────────

test('hostOf lowercases the hostname and tolerates junk', () => {
  assert.strictEqual(hostOf('https://WWW.Nafdac.GOV.ng/page'), 'www.nafdac.gov.ng');
  assert.strictEqual(hostOf('not a url'), '');
});

test('isBlockedUrl rejects blocked hosts and their subdomains', () => {
  assert.strictEqual(isBlockedUrl('https://www.jumia.com.ng/whisky'), true);
  assert.strictEqual(isBlockedUrl('https://shop.konga.com/x'), true);
  assert.strictEqual(isBlockedUrl('https://drinksharbour.com/blog/x'), true);
});

test('isBlockedUrl does not match lookalike hosts', () => {
  assert.strictEqual(isBlockedUrl('https://notjumia.com.ng/x'), false);
  assert.strictEqual(isBlockedUrl('https://www.nafdac.gov.ng/'), false);
});

test('isBlockedUrl rejects non-http schemes and unparseable urls', () => {
  assert.strictEqual(isBlockedUrl('javascript:alert(1)'), true);
  assert.strictEqual(isBlockedUrl('ftp://example.com/x'), true);
  assert.strictEqual(isBlockedUrl('https://'), true);
});

test('partitionExternalLinks dedupes and separates blocked hosts', () => {
  const content = [
    { type: 'p', text: '[a](https://www.nafdac.gov.ng/) [b](/product/x) [c](https://www.jumia.com.ng/y)' },
    { type: 'ul', items: ['[d](https://www.nafdac.gov.ng/)'] },
  ];
  const { external, blocked } = partitionExternalLinks(content);
  assert.deepStrictEqual(external, ['https://www.nafdac.gov.ng/']);
  assert.deepStrictEqual(blocked, ['https://www.jumia.com.ng/y']);
});

// ── Live verification ─────────────────────────────────────────────────────

function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url, method: options.method });
    const route = routes[url];
    if (typeof route === 'function') return route(options);
    if (route === undefined) throw new Error('network down');
    return { status: route };
  };
  impl.calls = calls;
  return impl;
}

test('verifyLiveUrls marks 2xx alive and everything else dead', async () => {
  clearUrlCache();
  const fetchImpl = fakeFetch({
    'https://a.example/ok': 200,
    'https://b.example/gone': 404,
    'https://c.example/boom': undefined,
  });
  const out = await verifyLiveUrls(
    ['https://a.example/ok', 'https://b.example/gone', 'https://c.example/boom'],
    { fetchImpl }
  );
  assert.strictEqual(out.get('https://a.example/ok').ok, true);
  assert.strictEqual(out.get('https://b.example/gone').ok, false);
  assert.strictEqual(out.get('https://b.example/gone').status, 404);
  assert.strictEqual(out.get('https://c.example/boom').ok, false);
  assert.strictEqual(out.get('https://c.example/boom').status, 0);
});

test('verifyLiveUrls retries with GET when HEAD is rejected', async () => {
  clearUrlCache();
  const fetchImpl = fakeFetch({
    'https://d.example/head-hostile': (options) => ({
      status: options.method === 'HEAD' ? 405 : 200,
    }),
  });
  const out = await verifyLiveUrls(['https://d.example/head-hostile'], { fetchImpl });
  assert.strictEqual(out.get('https://d.example/head-hostile').ok, true);
  assert.deepStrictEqual(fetchImpl.calls.map((c) => c.method), ['HEAD', 'GET']);
});

test('verifyLiveUrls dedupes and caches within the TTL', async () => {
  clearUrlCache();
  const fetchImpl = fakeFetch({ 'https://e.example/x': 200 });
  await verifyLiveUrls(['https://e.example/x', 'https://e.example/x'], { fetchImpl });
  await verifyLiveUrls(['https://e.example/x'], { fetchImpl });
  assert.strictEqual(fetchImpl.calls.length, 1);
});

test('makeExternalLinkValidator is fail-closed for unknown external urls', () => {
  const verdicts = new Map([['https://a.example/ok', { ok: true, status: 200 }]]);
  const isAllowed = makeExternalLinkValidator(verdicts);
  assert.strictEqual(isAllowed('https://a.example/ok'), true);
  assert.strictEqual(isAllowed('https://never-checked.example/x'), false);
  assert.strictEqual(isAllowed('/product/moet'), true);
});

// ── Persisted link records ────────────────────────────────────────────────

test('buildExternalLinkRecords records domain, state and check time', () => {
  const content = [
    { type: 'p', text: '[a](https://www.nafdac.gov.ng/x) [b](https://www.jumia.com.ng/y) [c](https://gone.example/z)' },
  ];
  const verdicts = new Map([
    ['https://www.nafdac.gov.ng/x', { ok: true, status: 200 }],
    ['https://gone.example/z', { ok: false, status: 404 }],
  ]);
  const records = buildExternalLinkRecords(content, verdicts);
  assert.deepStrictEqual(
    records.map((r) => [r.url, r.domain, r.state, r.httpStatus]),
    [
      ['https://www.nafdac.gov.ng/x', 'www.nafdac.gov.ng', 'ok', 200],
      ['https://www.jumia.com.ng/y', 'www.jumia.com.ng', 'blocked', 0],
      ['https://gone.example/z', 'gone.example', 'dead', 404],
    ]
  );
  assert.ok(records[0].lastCheckedAt instanceof Date);
});

test('buildExternalLinkRecords leaves unverified links unchecked', () => {
  const content = [{ type: 'p', text: '[a](https://fresh.example/x)' }];
  const [record] = buildExternalLinkRecords(content, new Map());
  assert.strictEqual(record.state, 'ok');
  assert.strictEqual(record.lastCheckedAt, null);
});

// ── Block-rewrite hardening ───────────────────────────────────────────────

test('keepOnlyKnownLinks drops links the rewrite invented', () => {
  const input = { type: 'p', text: 'Try [Moet](/product/moet) tonight.' };
  const output = [
    { type: 'p', text: 'Try [Moet](/product/moet) with [ice](https://invented.example/ice).' },
  ];
  const [block] = keepOnlyKnownLinks(output, input);
  assert.strictEqual(block.text, 'Try [Moet](/product/moet) with ice.');
});

test('keepOnlyKnownLinks checks list items on both sides', () => {
  const input = { type: 'ul', items: ['See [NAFDAC](https://www.nafdac.gov.ng/x)'] };
  const output = [
    { type: 'ul', items: ['See [NAFDAC](https://www.nafdac.gov.ng/x)', 'And [fake](https://fake.example/y)'] },
  ];
  const [block] = keepOnlyKnownLinks(output, input);
  assert.deepStrictEqual(block.items, [
    'See [NAFDAC](https://www.nafdac.gov.ng/x)',
    'And fake',
  ]);
});
