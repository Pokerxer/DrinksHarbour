'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), mongoose = require('mongoose'), express = require('express'), jwt = require('jsonwebtoken');
const { connectVenueMongo, fixture } = require('./helpers/venueMongo');
test('market applications and immutable reviews enforce actual JWT tenant ownership and transactional audit', async t => {
  await connectVenueMongo(t, 'market_enrollment');
  const owner = await fixture(), other = await fixture();
  const secret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'market-enrollment-test-secret';
  t.after(() => secret === undefined ? delete process.env.JWT_SECRET : process.env.JWT_SECRET = secret);
  const admin = new mongoose.Types.ObjectId();
  await require('../models/User').collection.insertOne({ _id: admin, role: 'super_admin', status: 'active', email: 'reviewer@example.invalid' });
  const service = require('../services/marketPolicy/management'); await service.ensureIndexes();
  const app = express(); app.use(express.json()); app.use('/api/market-enrollments', require('../routes/marketEnrollment.routes'));
  app.use((e, req, res, next) => res.status(e.statusCode || 500).json({ code: e.code, message: e.message }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); t.after(() => new Promise(resolve => server.close(resolve)));
  const root = `http://127.0.0.1:${server.address().port}/api/market-enrollments`;
  const call = async (path, userId, method = 'GET', body) => {
    const response = await fetch(root + path, { method, headers: { 'Content-Type': 'application/json', ...(userId ? { Authorization: `Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  const input = { market: 'NG', category: 'beverage', channel: 'marketplace', statement: 'Apply for reviewed marketplace access', expectedVersion: 0 };
  assert.equal((await call('/mine', null)).status, 401);
  assert.equal((await call('/apply', owner.actor.userId, 'POST', { ...input, tenant: other.tenantId, status: 'approved' })).status, 400);
  // Country resolver is intentionally not bypassed; applications may be submitted to inactive markets for review.
  const applied = await call('/apply', owner.actor.userId, 'POST', input); assert.equal(applied.status, 201);
  const row = applied.body.data; assert.equal(String(row.tenant), owner.tenantId); assert.equal(row.status, 'pending');
  assert.equal((await call('/mine', other.actor.userId)).body.data.length, 0);
  assert.equal((await call(`/${row._id}/review`, owner.actor.userId, 'POST', { expectedVersion: 1, status: 'approved', reason: 'Self approval' })).status, 403);
  assert.equal((await call('/', owner.actor.userId)).status, 403);
  const review = { expectedVersion: 1, status: 'approved', reason: 'Synthetic reviewed terms', effectiveFrom: '2030-01-01', effectiveUntil: '2031-01-01' };
  const approved = await call(`/${row._id}/review`, String(admin), 'POST', review); assert.equal(approved.status, 201); assert.equal(approved.body.data.version, 2);
  assert.equal((await call(`/${row._id}/review`, String(admin), 'POST', review)).status, 409);
  const reapply = await call('/apply', owner.actor.userId, 'POST', { ...input, expectedVersion: 2 });
  assert.equal(reapply.status, 409);
  assert.equal(reapply.body.code, 'MARKET_APPROVAL_REVIEW_REQUIRED');
  assert.match(reapply.body.message, /platform review/i);
  assert.equal(await require('../models/MarketEnrollment').countDocuments({ tenant: owner.tenantId }), 2);
  assert.equal(await require('../models/AuditLog').countDocuments({ action: 'MARKET_ENROLLMENT_APPLY', targetTenantId: owner.tenantId }), 1);
  const Model = require('../models/MarketEnrollment');
  assert.equal((await Model.findById(row._id).lean()).status, 'pending');
  await assert.rejects(Model.updateOne({ _id: row._id }, { $set: { status: 'approved' } }), /immutable/i);
  assert.equal(await require('../models/AuditLog').countDocuments({ action: 'MARKET_ENROLLMENT_REVIEW', targetTenantId: owner.tenantId }), 1);
  assert.equal((await require('../models/Tenant').findById(owner.tenantId).lean()).subscriptionStatus, 'active');
  const latest = approved.body.data;
  const rejected = await call(`/${latest._id}/review`, String(admin), 'POST', { expectedVersion: 2, status: 'rejected', reason: 'Synthetic rejection preserves ERM' });
  assert.equal(rejected.status, 201); assert.equal((await require('../models/Tenant').findById(owner.tenantId).lean()).subscriptionStatus, 'active');
});

test('versioned policy validates stable identities, dates, atomic audit and rejects competing revisions', async t => {
  await connectVenueMongo(t, 'market_policy');
  const owner = await fixture(); const actor = { _id: new mongoose.Types.ObjectId(), role: 'super_admin' };
  const management = require('../services/marketPolicy/management'); await management.ensureIndexes();
  const base = { market: 'NG', category: 'beverage', channel: 'marketplace', mode: 'exclusive', exclusiveTenant: owner.tenantId,
    exceptions: [], effectiveFrom: '2030-01-01', effectiveUntil: '2031-01-01', contractReference: 'Synthetic policy fixture', reason: 'Synthetic review', expectedVersion: 0 };
  await assert.rejects(management.createPolicy({ actor, input: { ...base, exclusiveTenant: 'Wyn City' } }), /tenant/i);
  await assert.rejects(management.createPolicy({ actor, input: { ...base, effectiveUntil: '2029-01-01' } }), /date|term/i);
  const results = await Promise.allSettled([management.createPolicy({ actor, input: base }), management.createPolicy({ actor, input: base })]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(results.find(x => x.status === 'rejected').reason.statusCode, 409);
  const policy = results.find(x => x.status === 'fulfilled').value;
  assert.equal(policy.version, 1);
  const Policy = require('../models/MarketCategoryPolicy');
  await assert.rejects(Policy.deleteOne({ _id: policy._id }), /immutable/i);
  assert.equal(await require('../models/AuditLog').countDocuments({ action: 'MARKET_POLICY_REVISE' }), 1);
  const revised = await management.createPolicy({ actor, input: { ...base, expectedVersion: 1, mode: 'closed', exclusiveTenant: undefined } });
  assert.equal(revised.version, 2); assert.equal((await Policy.findById(policy._id).lean()).mode, 'exclusive');
});

test('market revisions fail closed without indexes and rollback completely when audit storage fails', async t => {
  await connectVenueMongo(t, 'market_atomic');
  const fixtureRow = await fixture();
  const actor = { _id: new mongoose.Types.ObjectId(), role: 'super_admin' };
  const management = require('../services/marketPolicy/management');
  const input = { market: 'NG', category: 'beverage', channel: 'marketplace', mode: 'open',
    effectiveFrom: '2030-01-01', effectiveUntil: '2031-01-01', reason: 'Synthetic review', contractReference: 'Synthetic agreement', expectedVersion: 0 };
  await assert.rejects(management.createPolicy({ actor, input }), error => error.statusCode === 503);
  await management.ensureIndexes();
  const Audit = require('../models/AuditLog'), originalCreate = Audit.create;
  Audit.create = async () => { throw new Error('Synthetic audit storage unavailable'); };
  try { await assert.rejects(management.createPolicy({ actor, input }), /audit storage/); }
  finally { Audit.create = originalCreate; }
  assert.equal(await require('../models/MarketCategoryPolicy').countDocuments({}), 0);
  assert.equal((await management.createPolicy({ actor, input })).version, 1);
  const owner = { _id: fixtureRow.actor.userId, tenant: fixtureRow.tenantId, role: 'tenant_owner' };
  const application = { market: 'NG', category: 'beverage', channel: 'storefront', statement: 'Synthetic independent storefront application', expectedVersion: 0 };
  const results = await Promise.allSettled([management.apply({ actor: owner, input: application }), management.apply({ actor: owner, input: application })]);
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(results.find(row => row.status === 'rejected').reason.statusCode, 409);
});

test('resolved access and catalogue eligibility use latest immutable scope and preserve independent ERM', async t => {
  await connectVenueMongo(t, 'market_resolved');
  const fixtureRow = await fixture();
  const management = require('../services/marketPolicy/management'); await management.ensureIndexes();
  const access = require('../services/marketPolicy');
  const owner = { _id: fixtureRow.actor.userId, tenant: fixtureRow.tenantId, role: 'tenant_owner' };
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'super_admin' };
  const scope = { market: 'NG', category: 'beverage', channel: 'marketplace' };
  const args = { ...scope, tenant: fixtureRow.tenantId, at: new Date('2030-06-01') };
  await management.createPolicy({ actor: admin, input: { ...scope, mode: 'open', effectiveFrom: '2030-01-01', effectiveUntil: '2031-01-01', reason: 'Synthetic review', contractReference: 'Synthetic agreement', expectedVersion: 0 } });
  const application = await management.apply({ actor: owner, input: { ...scope, statement: 'Synthetic application', expectedVersion: 0 } });
  assert.equal((await access.evaluateMarketAccess(args)).reason, 'ENROLLMENT_NOT_APPROVED');
  const approved = await management.review({ actor: admin, enrollmentId: String(application._id), input: { status: 'approved', reason: 'Synthetic approval', expectedVersion: 1, effectiveFrom: '2030-01-01', effectiveUntil: '2031-01-01' } });
  assert.equal((await access.assertMarketAccess(args)).allowed, true);
  assert.deepEqual((await access.getEligibleTenantIds(args)).map(String), [fixtureRow.tenantId]);
  assert.deepEqual(await access.getEligibleTenantIds({ ...args, channel: 'storefront' }), []);
  await management.review({ actor: admin, enrollmentId: String(approved._id), input: { status: 'suspended', reason: 'Synthetic suspension', expectedVersion: 2 } });
  assert.equal((await access.evaluateMarketAccess(args)).reason, 'ENROLLMENT_NOT_APPROVED');
  assert.deepEqual(await access.getEligibleTenantIds(args), []);
  assert.equal((await access.evaluateMarketAccess({ ...args, channel: 'erm' })).allowed, true);
  await require('../models/Tenant').updateOne({ _id: fixtureRow.tenantId }, { $set: { subscriptionStatus: 'trialing', trialEndsAt: args.at } });
  assert.equal((await access.evaluateMarketAccess({ ...args, channel: 'erm' })).reason, 'ERM_NOT_ENTITLED');
  assert.deepEqual(await access.getEligibleTenantIds({ ...args, channel: 'erm' }), []);
  await require('../models/Tenant').updateOne({ _id: fixtureRow.tenantId }, { $set: { status: 'suspended' } });
  assert.equal((await access.evaluateMarketAccess({ ...args, channel: 'erm' })).reason, 'TENANT_INACTIVE');
  assert.deepEqual(await access.getEligibleTenantIds({ ...args, channel: 'erm' }), []);
});


test('applications preserve unexpired approvals while expired, pending and rejected scopes can reapply', async t => {
  await connectVenueMongo(t, 'market_reapply');
  const fixtureRow = await fixture();
  const management = require('../services/marketPolicy/management'); await management.ensureIndexes();
  const owner = { _id: fixtureRow.actor.userId, tenant: fixtureRow.tenantId, role: 'tenant_owner' };
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'super_admin' };
  const input = { market: 'NG', category: 'beverage', channel: 'storefront', statement: 'Synthetic storefront application', expectedVersion: 0 };
  let row = await management.apply({ actor: owner, input });
  row = await management.apply({ actor: owner, input: { ...input, expectedVersion: row.version } });
  row = await management.review({ actor: admin, enrollmentId: String(row._id), input: { expectedVersion: row.version, status: 'rejected', reason: 'Synthetic rejected review' } });
  row = await management.apply({ actor: owner, input: { ...input, expectedVersion: row.version } });
  row = await management.review({ actor: admin, enrollmentId: String(row._id), input: { expectedVersion: row.version, status: 'approved', reason: 'Synthetic current approval', effectiveFrom: new Date(Date.now() - 3600000).toISOString(), effectiveUntil: new Date(Date.now() + 3600000).toISOString() } });
  await assert.rejects(management.apply({ actor: owner, input: { ...input, expectedVersion: row.version } }), error => error.statusCode === 409 && error.code === 'MARKET_APPROVAL_REVIEW_REQUIRED');
  assert.equal((await require('../models/MarketEnrollment').findOne({ tenant: owner.tenant }).sort({ version: -1 }).lean()).status, 'approved');
  row = await management.review({ actor: admin, enrollmentId: String(row._id), input: { expectedVersion: row.version, status: 'approved', reason: 'Synthetic expired historical term', effectiveFrom: '2020-01-01', effectiveUntil: '2021-01-01' } });
  const renewed = await management.apply({ actor: owner, input: { ...input, expectedVersion: row.version } });
  assert.equal(renewed.status, 'pending'); assert.equal(renewed.version, row.version + 1);
  assert.equal((await require('../models/Tenant').findById(owner.tenant).lean()).subscriptionStatus, 'active');
});
