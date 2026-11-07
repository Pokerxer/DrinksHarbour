'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const at = new Date('2030-06-01T00:00:00Z');
const base = () => ({ tenant: { _id: 'tenant-a', subscriptionStatus: 'active' }, market: 'NG', category: 'beverage', channel: 'marketplace', at,
  country: { code: 'NG', active: true, version: 3, capabilities: { erm: true, marketplace: true, storefront: true } },
  enrollment: { tenant: 'tenant-a', market: 'NG', category: 'beverage', channel: 'marketplace', status: 'approved', version: 2, effectiveFrom: new Date('2030-01-01'), effectiveUntil: new Date('2031-01-01') },
  policy: { market: 'NG', category: 'beverage', channel: 'marketplace', mode: 'exclusive', exclusiveTenant: 'tenant-a', exceptions: ['tenant-c'], version: 4, effectiveFrom: new Date('2030-01-01'), effectiveUntil: new Date('2031-01-01') } });
const decide = args => require('../services/marketPolicy/decision').decideMarketAccess(args);
test('approved marketplace access freezes exact policy/enrollment/country versions', () => {
  assert.deepEqual(decide(base()), { allowed: true, reason: 'APPROVED', countryVersion: 3, policyVersion: 4, enrollmentVersion: 2 });
});
test('ERM entitlement survives marketplace rejection and does not require policy/enrollment', () => {
  const args = base(); args.channel = 'erm'; args.enrollment.status = 'rejected'; args.policy.mode = 'closed';
  assert.equal(decide(args).allowed, true);
  args.tenant.subscriptionStatus = 'canceled'; assert.equal(decide(args).reason, 'ERM_NOT_ENTITLED');
});
test('stable exclusive IDs, explicit exceptions and isolated channels/categories/markets', () => {
  const args = base(); args.tenant._id = 'tenant-b'; args.tenant.name = 'Wyn City'; args.enrollment.tenant = 'tenant-b';
  assert.equal(decide(args).reason, 'CATEGORY_RESTRICTED');
  args.tenant._id = 'tenant-c'; args.enrollment.tenant = 'tenant-c'; assert.equal(decide(args).allowed, true);
  for (const [field,value] of [['market','GB'],['category','gift'],['channel','storefront']]) {
    const isolated = base(); isolated[field] = value; assert.equal(decide(isolated).allowed, false);
  }
});
test('country capability, pending and missing policy fail closed', () => {
  for (const status of ['pending','rejected','suspended']) { const args = base(); args.enrollment.status = status; assert.equal(decide(args).reason, 'ENROLLMENT_NOT_APPROVED'); }
  const args = base(); args.policy = null; assert.equal(decide(args).reason, 'POLICY_MISSING');
  args.country.active = false; assert.equal(decide(args).reason, 'COUNTRY_INACTIVE');
  args.country = null; assert.equal(decide(args).reason, 'COUNTRY_UNKNOWN');
});
test('policy and enrollment dates use inclusive start, exclusive end and never accept invalid dates', () => {
  for (const field of ['policy','enrollment']) {
    const args = base(); args[field].effectiveFrom = at; assert.equal(decide(args).allowed, true);
    args[field].effectiveUntil = at; assert.equal(decide(args).allowed, false);
    args[field].effectiveUntil = new Date('2031-01-01'); args[field].effectiveFrom = new Date('2030-06-02'); assert.equal(decide(args).allowed, false);
    args[field].effectiveFrom = 'invalid'; assert.equal(decide(args).allowed, false);
  }
  const args = base(); args.at = 'bad'; assert.equal(decide(args).allowed, false);
});
test('ERM decision uses current entitlement clock for trial expiry without marketplace dependency', () => {
  const args = base(); args.channel = 'erm'; args.policy = null; args.enrollment = null;
  args.tenant.subscriptionStatus = 'trialing'; args.tenant.trialEndsAt = '2030-06-01T00:00:00Z';
  assert.equal(decide(args).reason, 'ERM_NOT_ENTITLED');
  args.tenant.trialEndsAt = '2030-06-01T00:00:01Z';
  assert.equal(decide(args).allowed, true);
  args.at = 'invalid'; assert.equal(decide(args).reason, 'DATE_INVALID');
});
