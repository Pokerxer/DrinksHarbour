'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Stock = require('../models/WarehouseStock');
const item = { tenant: 'a'.repeat(24), warehouse: 'b'.repeat(24), subproduct: 'c'.repeat(24),
  size: 'd'.repeat(24), product: 'e'.repeat(24), quantity: 1 };
test('location reservation cannot run outside an owning transaction', async () => {
  await assert.rejects(require('../services/storefrontLocationStock').reserve([item], 'f'.repeat(24), null), /transaction/i);
});
test('aggregate stock cannot authorize a website hold when its physical location is unavailable', async t => {
  t.mock.method(Stock, 'findOne', () => ({ session() { return this; }, lean: async () => null }));
  const Tenant = require('../models/Tenant');
  t.mock.method(Tenant, 'findOne', () => ({ select() { return this; }, session() { return this; }, lean: async () => ({}) }));
  const session = { inTransaction: () => true };
  await assert.rejects(require('../services/storefrontLocationStock').reserve([item], 'f'.repeat(24), session), e => e.statusCode === 409);
});
