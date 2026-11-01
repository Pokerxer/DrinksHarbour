import test from 'node:test';
import assert from 'node:assert/strict';
import robots from './robots.ts';

test('normalizes sitemap origins without leaking credentials or paths', () => {
  const old = process.env.NEXT_PUBLIC_BASE_URL;
  try {
    for (const [input, expected] of [
      ['http://drinksharbour.com/path', 'https://www.drinksharbour.com/sitemap.xml'],
      ['https://www.drinksharbour.com/', 'https://www.drinksharbour.com/sitemap.xml'],
      ['http://user:password@shop.example/path?q=1', 'https://shop.example/sitemap.xml'],
      ['http://localhost:3002/shop', 'http://localhost:3002/sitemap.xml'],
      ['invalid origin', 'https://www.drinksharbour.com/sitemap.xml'],
      ['javascript:example', 'https://www.drinksharbour.com/sitemap.xml'],
    ]) {
      process.env.NEXT_PUBLIC_BASE_URL = input;
      assert.equal(robots().sitemap, expected);
    }
  } finally {
    if (old === undefined) delete process.env.NEXT_PUBLIC_BASE_URL; else process.env.NEXT_PUBLIC_BASE_URL = old;
  }
});

test('requires query-key boundaries and preserves discovery, private-route and rendering rules', () => {
  const [general, named] = robots().rules;
  assert.deepEqual(general.allow, ['/', '/_next/image?', '/_next/static/']);
  assert.deepEqual(named.allow, general.allow);
  assert.deepEqual(named.disallow, general.disallow);
  assert.ok(general.disallow.includes('/*?q='));
  assert.ok(general.disallow.includes('/*?*&q='));
  assert.ok(!general.disallow.includes('/*?*q='));
  assert.ok(general.disallow.includes('/api$'));
  assert.ok(general.disallow.includes('/api?'));
  assert.ok(general.disallow.includes('/my-account'));
  assert.ok(general.disallow.includes('/payment/verify'));
  assert.ok(!general.disallow.some(value => /(?:category|subcategory|brand|page)=/.test(value)));
});
