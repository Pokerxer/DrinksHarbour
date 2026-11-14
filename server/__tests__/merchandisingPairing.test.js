// server/__tests__/merchandisingPairing.test.js
// Manual pairings let a tenant say "when shoppers view X, suggest Y". Schema
// guards: max 4 suggestions, no duplicate suggestions, unique per tenant+source.

const test = require('node:test');
const assert = require('node:assert/strict');

const Merchant = require('../models/MerchandisingPairing');
const ermPlans = require('../config/erm-plans');

test('model rejects more than 4 suggested products', () => {
  const doc = new Merchant({
    tenant: '507f1f77bcf86cd799439011',
    sourceProduct: '507f1f77bcf86cd799439012',
    suggestedProducts: [
      '507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014',
      '507f1f77bcf86cd799439015', '507f1f77bcf86cd799439016',
      '507f1f77bcf86cd799439017',
    ],
  });
  const err = doc.validateSync();
  assert.ok(err && err.errors.suggestedProducts, 'expected a suggestedProducts validation error');
});

test('model rejects duplicate suggestions and an empty list', () => {
  const dupes = new Merchant({
    tenant: '507f1f77bcf86cd799439011',
    sourceProduct: '507f1f77bcf86cd799439012',
    suggestedProducts: ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439013'],
  });
  const errDupes = dupes.validateSync();
  assert.ok(errDupes && errDupes.errors.suggestedProducts);

  const empty = new Merchant({
    tenant: '507f1f77bcf86cd799439011',
    sourceProduct: '507f1f77bcf86cd799439012',
    suggestedProducts: [],
  });
  const errEmpty = empty.validateSync();
  assert.ok(errEmpty && errEmpty.errors.suggestedProducts);
});

test('active defaults to true; unique index is tenant+sourceProduct', () => {
  const doc = new Merchant({
    tenant: '507f1f77bcf86cd799439011',
    sourceProduct: '507f1f77bcf86cd799439012',
    suggestedProducts: ['507f1f77bcf86cd799439013'],
  });
  assert.equal(doc.active, true);
  const indexes = Merchant.schema.indexes();
  const hasUniquePair = indexes.some(([fields, opts]) =>
    fields.tenant === 1 && fields.sourceProduct === 1 && opts.unique);
  assert.ok(hasUniquePair, 'expected unique {tenant, sourceProduct} index');
});

test('merchandising_manual capability exists on Growth+ and passes the drift check', () => {
  assert.ok(ermPlans.EXTRA_CAPABILITIES.includes('merchandising_manual'));
  for (const plan of ['growth', 'pro', 'enterprise', 'venue', 'custom']) {
    assert.ok(
      ermPlans.ERM_PLANS[plan].features.includes('merchandising_manual'),
      `${plan} must carry merchandising_manual`
    );
  }
  for (const plan of ['free_trial', 'starter']) {
    assert.ok(
      !ermPlans.ERM_PLANS[plan].features.includes('merchandising_manual'),
      `${plan} must NOT carry merchandising_manual`
    );
  }
});
