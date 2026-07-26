// server/__tests__/frontendUrl.test.js
//
// Every outbound link we hand to a payment gateway or an email must be an
// ABSOLUTE http(s) URI. Korapay rejects anything else at charge-init time with
// "redirect_url must be a valid uri" (a 400 that reads as "One or more fields
// are invalid" to the shopper), which is exactly how a scheme-less
// FRONTEND_URL in production took checkout down. These tests pin the
// normalisation that makes a sloppy env value harmless.
const test = require('node:test');
const assert = require('node:assert');
const { normalizeUrl, frontendBaseUrl, frontendUrl } = require('../utils/frontendUrl');

const withEnv = async (vars, fn) => {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
};

test('normalizeUrl adds a scheme to bare hosts', () => {
  assert.strictEqual(normalizeUrl('drinksharbour.com'), 'https://drinksharbour.com');
  assert.strictEqual(normalizeUrl('www.drinksharbour.com'), 'https://www.drinksharbour.com');
  assert.strictEqual(
    normalizeUrl('drinksharbour.com/payment/verify'),
    'https://drinksharbour.com/payment/verify',
  );
});

test('normalizeUrl strips stray quotes, whitespace and trailing slashes', () => {
  assert.strictEqual(normalizeUrl('  https://drinksharbour.com/  '), 'https://drinksharbour.com');
  assert.strictEqual(normalizeUrl('"https://drinksharbour.com"'), 'https://drinksharbour.com');
  assert.strictEqual(normalizeUrl("'https://drinksharbour.com/app/'"), 'https://drinksharbour.com/app');
});

test('normalizeUrl keeps valid URLs (including query strings) intact', () => {
  assert.strictEqual(
    normalizeUrl('https://drinksharbour.com/payment/verify?src=wallet'),
    'https://drinksharbour.com/payment/verify?src=wallet',
  );
  assert.strictEqual(normalizeUrl('http://localhost:3002'), 'http://localhost:3002');
});

test('normalizeUrl rejects values that can never be a valid uri', () => {
  assert.strictEqual(normalizeUrl(''), null);
  assert.strictEqual(normalizeUrl('   '), null);
  assert.strictEqual(normalizeUrl(undefined), null);
  assert.strictEqual(normalizeUrl(null), null);
  assert.strictEqual(normalizeUrl('/payment/verify'), null, 'relative paths are not absolute URIs');
  assert.strictEqual(normalizeUrl('javascript:alert(1)'), null, 'only http(s) is allowed');
});

test('frontendBaseUrl repairs a scheme-less FRONTEND_URL (the production outage)', async () => {
  await withEnv({ FRONTEND_URL: 'www.drinksharbour.com', NEXT_PUBLIC_BASE_URL: undefined }, () => {
    assert.strictEqual(frontendBaseUrl(), 'https://www.drinksharbour.com');
    assert.strictEqual(frontendUrl('/payment/verify'), 'https://www.drinksharbour.com/payment/verify');
  });
});

test('frontendBaseUrl falls through to the next candidate when one is unusable', async () => {
  await withEnv(
    { FRONTEND_URL: '   ', NEXT_PUBLIC_BASE_URL: 'https://drinksharbour.com', PLATFORM_URL: undefined },
    () => {
      assert.strictEqual(frontendBaseUrl(), 'https://drinksharbour.com');
    },
  );
});

test('frontendUrl joins paths without doubling slashes', async () => {
  await withEnv({ FRONTEND_URL: 'https://drinksharbour.com/' }, () => {
    assert.strictEqual(frontendUrl('/payment/verify'), 'https://drinksharbour.com/payment/verify');
    assert.strictEqual(frontendUrl('payment/verify'), 'https://drinksharbour.com/payment/verify');
    assert.strictEqual(frontendUrl(), 'https://drinksharbour.com');
  });
});

test('frontendUrl falls back to localhost when nothing is configured', async () => {
  await withEnv(
    { FRONTEND_URL: undefined, NEXT_PUBLIC_BASE_URL: undefined, PLATFORM_URL: undefined },
    () => {
      assert.strictEqual(frontendUrl('/payment/verify'), 'http://localhost:3002/payment/verify');
    },
  );
});
