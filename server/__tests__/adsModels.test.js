// server/__tests__/adsModels.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const AdCampaign = require('../models/AdCampaign');
const AdWalletTransaction = require('../models/AdWalletTransaction');
const Tenant = require('../models/Tenant');
const ads = require('../config/ads');

test('AdCampaign validates surfaces and defaults', () => {
  const bad = new AdCampaign({ tenant: '507f1f77bcf86cd799439011', name: 'x',
    product: '507f1f77bcf86cd799439012', surfaces: [], dailyBudget: 1000 });
  const err = bad.validateSync();
  assert.ok(err && err.errors.surfaces, 'at least one surface required');

  const good = new AdCampaign({ tenant: '507f1f77bcf86cd799439011', name: 'x',
    product: '507f1f77bcf86cd799439012', surfaces: ['pdp'], dailyBudget: 1000 });
  assert.equal(good.status, 'draft');
  assert.equal(good.spentToday, 0);
  assert.equal(good.clicksTotal, 0);
});

test('AdWalletTransaction is a credit/debit ledger with balanceAfter', () => {
  const tx = new AdWalletTransaction({ tenant: '507f1f77bcf86cd799439011',
    type: 'credit', amount: 10000, balanceAfter: 10000, reason: 'wallet top-up' });
  const err = tx.validateSync();
  // Mongoose 9 validateSync() returns `undefined` (not null) when valid.
  assert.equal(err, undefined);
  assert.equal(tx.type, 'credit');

  const bad = new AdWalletTransaction({ tenant: '507f1f77bcf86cd799439011',
    type: 'debit', amount: 0, balanceAfter: 0 });
  assert.ok(bad.validateSync().errors.amount);
});

test('Tenant carries adWalletBalance defaulting to zero', () => {
  assert.equal(new Tenant({}).adWalletBalance, 0);
});

test('tariff config is a positive integer with a documented default', () => {
  assert.ok(Number.isInteger(ads.CPC_TARIFF_NGN));
  assert.ok(ads.CPC_TARIFF_NGN > 0);
});
