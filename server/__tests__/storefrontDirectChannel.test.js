'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const tenantId = 'a'.repeat(24), keyId = 'b'.repeat(24), warehouse = 'c'.repeat(24);
const input = { tenant: tenantId, apiKey: keyId, warehouse, code: 'WYN_WEBSITE',
  paymentAccount: 'WYN_TEST', returnOrigins: ['https://wyn.example.test'], enabled: true };
test('channel configuration rejects arbitrary account namespaces and untrusted callback origins', () => {
  const service = require('../services/storefrontChannels');
  assert.equal(service.validateConfiguration(input).code, 'WYN_WEBSITE');
  for (const change of [{ tenant: 'invalid' }, { paymentAccount: '../PAYSTACK' },
    { code: 'DRINKSHARBOUR_NG' }, { returnOrigins: ['https://wyn.example.test/path'] },
    { returnOrigins: ['http://wyn.example.test'] }, { returnOrigins: ['https://user:pass@wyn.example.test'] }]) {
    assert.throws(() => service.validateConfiguration({ ...input, ...change }), e => e.statusCode === 400);
  }
});
test('a return URL must match the exact configured website origin', () => {
  const { assertReturnUrl } = require('../services/storefrontChannels');
  const tenant = { _id: tenantId, storefrontChannel: input };
  assert.doesNotThrow(() => assertReturnUrl(tenant, 'https://wyn.example.test/complete?ref=1'));
  for (const url of ['https://wyn.example.test.evil.test/complete', 'https://evil.test', 'https://wyn.example.test:8443']) {
    assert.throws(() => assertReturnUrl(tenant, url), e => e.statusCode === 400);
  }
});
test('direct cart uses location availability and retains all merchandise revenue for tenant', async t => {
  const catalog = require('../services/storefrontCatalog.service');
  const sp = { _id: 'd'.repeat(24), product: { _id: 'e'.repeat(24), name: 'Bottle' },
    sellWithoutSizeVariants: false, availableStock: 9, costPrice: 100, baseSellingPrice: 1200 };
  const size = { _id: 'f'.repeat(24), subproduct: sp._id, tenant: tenantId, availableStock: 9, sellingPrice: 1200, costPrice: 100 };
  t.mock.method(catalog, 'loadProducts', async () => [sp]);
  t.mock.method(catalog, 'loadSizes', async () => [size]);
  const tenant = { _id: tenantId, revenueModel: 'commission', commissionPercentage: 13, storefrontChannel: input };
  const quote = await require('../services/storefrontCart.service').quoteCart(tenant, {
    items: [{ subProductId: sp._id, sizeId: size._id, quantity: 1 }], shippingMethod: 'pickup' });
  assert.equal(quote.orderItems[0].platformCommission, 0);
  assert.equal(quote.orderItems[0].tenantRevenueShare, 1200);
  assert.equal(String(quote.orderItems[0].warehouse), warehouse);
});
