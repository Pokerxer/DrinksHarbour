// Run with:  node --experimental-strip-types --test src/config.test.mjs
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { configureCommerceCore, getApiBaseUrl, __resetCommerceCoreConfig } from './config.ts';

test('getApiBaseUrl throws when the host app never configured it', () => {
  __resetCommerceCoreConfig();
  assert.throws(() => getApiBaseUrl(), /configureCommerceCore/);
});

test('getApiBaseUrl returns what was configured', () => {
  __resetCommerceCoreConfig();
  configureCommerceCore({ apiBaseUrl: 'https://backend.drinksharbour.com' });
  assert.equal(getApiBaseUrl(), 'https://backend.drinksharbour.com');
});

test('a trailing slash is stripped so callers can always template `${base}/api/...`', () => {
  __resetCommerceCoreConfig();
  configureCommerceCore({ apiBaseUrl: 'http://localhost:5001/' });
  assert.equal(getApiBaseUrl(), 'http://localhost:5001');
});

test('an empty base URL is rejected at configure time, not at fetch time', () => {
  __resetCommerceCoreConfig();
  assert.throws(() => configureCommerceCore({ apiBaseUrl: '' }), /apiBaseUrl/);
});
