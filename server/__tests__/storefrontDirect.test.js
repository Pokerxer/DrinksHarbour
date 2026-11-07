'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const gateway = require('../services/storefrontGateway');
const { orderPostings } = require('../services/accounting.orders');
function env(t, key, value) { const old = process.env[key]; process.env[key] = value; t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; }); }
const payment = { reference: 'dhw-direct', amountKobo: 120000, email: 'buyer@example.test',
  returnUrl: 'https://shop.example.test/done', paymentAccount: 'WYN_TEST' };

test('direct checkout uses its saved merchant account rather than platform credentials', async t => {
  env(t, 'PAYSTACK_SECRET_KEY', 'platform-test-only');
  env(t, 'STOREFRONT_PAYSTACK_WYN_TEST_SECRET_KEY', 'merchant-test-only');
  let authorization;
  t.mock.method(axios, 'post', async (url, body, options) => {
    authorization = options.headers.Authorization;
    return { data: { status: true, data: { reference: body.reference, authorization_url: 'https://checkout.paystack.com/test' } } };
  });
  await gateway.initialize(payment);
  assert.equal(authorization, 'Bearer merchant-test-only');
});
test('missing direct credentials fail closed even with a configured platform key', async t => {
  env(t, 'PAYSTACK_SECRET_KEY', 'platform-test-only');
  env(t, 'STOREFRONT_PAYSTACK_MISSING_SECRET_KEY', '');
  t.mock.method(axios, 'post', async () => { throw new Error('must not call provider'); });
  await assert.rejects(gateway.initialize({ ...payment, paymentAccount: 'MISSING' }), e => e.statusCode === 503);
});
test('direct payment verification is bound to the saved merchant account', async t => {
  env(t, 'PAYSTACK_SECRET_KEY', 'platform-test-only');
  env(t, 'STOREFRONT_PAYSTACK_WYN_TEST_SECRET_KEY', 'merchant-test-only');
  let authorization;
  t.mock.method(axios, 'get', async (url, options) => {
    authorization = options.headers.Authorization;
    return { data: { status: true, data: { reference: 'dhw-direct', status: 'success', amount: 120000, currency: 'NGN', id: 1 } } };
  });
  const verified = await gateway.verify('dhw-direct', 'WYN_TEST');
  assert.equal(authorization, 'Bearer merchant-test-only');
  assert.equal(verified.paymentAccount, 'WYN_TEST');
});
test('direct website accounting recognizes merchant bank receipt without marketplace receivable or fee', () => {
  const entries = orderPostings({ source: 'web', salesChannel: 'WYN_WEBSITE', settlementOwner: 'tenant',
    tenant: 'a'.repeat(24), totalAmount: 1350, shippingFee: 150, paymentMethod: 'card',
    items: [{ tenant: 'a'.repeat(24), quantity: 1, itemSubtotal: 1200, tenantRevenueShare: 1200,
      platformCommission: 0, vendorPriceAtPurchase: 500 }] });
  assert.deepEqual(entries[0].lines, [
    { account: '1100', debit: 1350, credit: 0 },
    { account: '4000', debit: 0, credit: 1200 },
    { account: '4100', debit: 0, credit: 150 },
  ]);
});
test('direct website journal entries carry a storefront source rather than marketplace attribution', async t => {
  const tenant = 'a'.repeat(24), writes = [];
  t.mock.method(require('../services/chartOfAccounts.service'), 'ensureDefaultCOA', async () => {});
  t.mock.method(require('../services/journalEntry.service'), 'postJournalEntry', async value => { writes.push(value); });
  const order = { _id: 'b'.repeat(24), tenant, source: 'web', salesChannel: 'WYN_WEBSITE', settlementOwner: 'tenant',
    paymentStatus: 'paid', paymentMethod: 'card', totalAmount: 1200, currency: 'NGN',
    items: [{ tenant, quantity: 1, itemSubtotal: 1200, platformCommission: 0, vendorPriceAtPurchase: 0 }],
    constructor: { updateOne: async () => ({ modifiedCount: 1 }) } };
  await require('../services/accounting.orders').captureOrderAccounting(order);
  assert.equal(writes[0].source, 'storefront');
});
