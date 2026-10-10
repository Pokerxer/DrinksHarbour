// __tests__/subscriptionEvents.classification.test.js
const test = require('node:test');
const assert = require('node:assert');
const { classifyPlanChange, dedupeKey } = require('../services/subscriptionEvents.service');

test('a move up the plan ladder is an expansion', () => {
  assert.equal(classifyPlanChange('starter', 'growth'), 'expansion');
  assert.equal(classifyPlanChange('growth', 'venue'), 'expansion');
  assert.equal(classifyPlanChange('free_trial', 'enterprise'), 'expansion');
});

test('a move down the plan ladder is a contraction, not a cancellation', () => {
  // A downgrade is the tenant choosing to shrink. Calling it a cancellation
  // would overstate churn.
  assert.equal(classifyPlanChange('enterprise', 'growth'), 'contraction');
  assert.equal(classifyPlanChange('pro', 'starter'), 'contraction');
});

test('an unchanged or unknown plan produces no event at all', () => {
  assert.equal(classifyPlanChange('pro', 'pro'), null);
  assert.equal(classifyPlanChange('', 'pro'), null, 'an initial activation is not a plan change');
  assert.equal(classifyPlanChange('pro', ''), null);
  assert.equal(classifyPlanChange('nonsense', 'pro'), null,
    'an unranked plan is not silently treated as the bottom of the ladder');
  assert.equal(classifyPlanChange('pro', 'nonsense'), null);
});

test('custom sits outside the ladder and is never ranked', () => {
  // `custom` is in the Tenant.plan enum but deliberately absent from
  // PLAN_ORDER, so indexOf would be -1. Ranking it as the bottom rung would
  // turn every custom->pro move into a fake expansion.
  assert.equal(classifyPlanChange('custom', 'pro'), null);
  assert.equal(classifyPlanChange('pro', 'custom'), null);
});

test('dedupeKey is stable for the same change and differs across kinds', () => {
  const t = 'tenant-1';
  const a = dedupeKey({ tenant: t, kind: 'cancellation', effectiveAt: new Date('2026-08-01T00:00:00Z'), source: 'sub_123' });
  const b = dedupeKey({ tenant: t, kind: 'cancellation', effectiveAt: new Date('2026-08-01T00:00:00Z'), source: 'sub_123' });
  const c = dedupeKey({ tenant: t, kind: 'expansion', effectiveAt: new Date('2026-08-01T00:00:00Z'), source: 'sub_123' });
  assert.equal(a, b, 'a redelivered webhook must map to the same key');
  assert.notEqual(a, c);
});

test('dedupeKey falls back to the effective date when there is no source id', () => {
  const at = new Date('2026-08-01T09:30:00Z');
  const a = dedupeKey({ tenant: 't', kind: 'expansion', effectiveAt: at, source: '' });
  const b = dedupeKey({ tenant: 't', kind: 'expansion', effectiveAt: at, source: '' });
  assert.equal(a, b, 'without a provider id the timestamp is the only stable identity');
});
