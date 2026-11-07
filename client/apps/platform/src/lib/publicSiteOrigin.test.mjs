import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicSiteOrigin } from './publicSiteOrigin.ts';

test('public canonical origin normalizes official host to HTTPS www without a path', () => {
  assert.equal(publicSiteOrigin('http://drinksharbour.com/somewhere'), 'https://www.drinksharbour.com');
  assert.equal(publicSiteOrigin('http://www.drinksharbour.com'), 'https://www.drinksharbour.com');
});

test('canonical origins preserve local preview ports, secure custom hosts and reject invalid schemes', () => {
  assert.equal(publicSiteOrigin('http://localhost:3017/preview'), 'http://localhost:3017');
  assert.equal(publicSiteOrigin('http://shop.example.com/preview'), 'https://shop.example.com');
  assert.equal(publicSiteOrigin('javascript:alert(1)'), 'https://www.drinksharbour.com');
  assert.equal(publicSiteOrigin('not a URL'), 'https://www.drinksharbour.com');
});
