'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { preflight } = require('../scripts/validate-staging');
test('staging preflight never treats missing config or live credentials as ready', () => {
  assert.equal(preflight({}).ready, false);
  assert.ok(preflight({ PAYSTACK_SECRET_KEY: 'sk_live_example' }).errors.includes('Paystack must use a test key'));
});
test('complete test configuration passes offline preflight only', () => {
  const env = Object.fromEntries(preflight({}).missing.map(key => [key, 'configured']));
  env.PAYSTACK_SECRET_KEY = 'sk_test_example'; env.MAIL_PASSWORD = 'test-only';
  assert.equal(preflight(env).ready, true);
});
