'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');
const { startRouter, signToken } = require('./helpers/routeAuthHarness');
test('lapsed_existing_visit_can_freeze_but_cannot_add_service_or_cross_tenant_or_suspend', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'lapse_guards'); const args = await fixture(); const item = await beverage(args);
  await require('../services/venue/service-sessions').ensureIndexes(); await require('../services/venue/billing').ensureIndexes();
  const visit = await require('../services/venue/service-sessions').ensureServiceSession({ ...args, idempotencyKey: 'open' });
  const accepted = await require('../services/venue/lines').setSessionLines({ ...args, sessionId: visit.id, expectedVersion: visit.version, lines: [item], idempotencyKey: 'lines' });
  const other = await fixture(); const token = signToken({ _id: args.actor.userId, tenant: args.tenantId, role: 'tenant_owner' }); const foreign = signToken({ _id: other.actor.userId, tenant: other.tenantId, role: 'tenant_owner' });
  const app = await startRouter(require('../routes/venue-ops.routes'), '/api/venue-ops'); let n = 0;
  async function request(path, method='GET', body, auth=token) { const response = await fetch(app.url(`/api/venue-ops${path}`), { method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json', 'Idempotency-Key': `lapse-${n++}`, 'x-venue-recovery': 'true' }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, ...await response.json() }; }
  try {
    assert.equal((await request(`/service-sessions/${visit.id}/bill`, 'GET', undefined, foreign)).status, 404);
    await require('../models/Tenant').updateOne({ _id: args.tenantId }, { $set: { subscriptionStatus: 'past_due', venueSubscriptionReadOnlySince: new Date() } });
    assert.equal((await request('/service-sessions', 'POST', { locationId: args.locationId, tableIds: args.tableIds, expectedTableVersions: [1] })).status, 403);
    assert.equal((await request(`/service-sessions/${visit.id}/lines`, 'PUT', { expectedVersion: accepted.version, lines: [item] })).status, 403);
    const frozen = await request(`/service-sessions/${visit.id}/bill`, 'POST', { expectedVersion: accepted.version, lineVersion: accepted.lineVersion, ageVerified: true }); assert.equal(frozen.status, 200, JSON.stringify(frozen));
    await require('../models/Tenant').updateOne({_id:args.tenantId},{$set:{subscriptionStatus:'canceled',plan:'starter'}});
    const listed=await request('/open-visits');assert.equal(listed.status,200,JSON.stringify(listed));assert.equal(listed.data.items[0].id,visit.id);
    assert.equal((await request(`/service-sessions/${visit.id}/bill`)).status,200);
    assert.equal((await request('/open-visits','GET',undefined,foreign)).data.items.length,0);
    const storedTenant=await require('../models/Tenant').findOne({_id:args.tenantId}).select('_id').lean();
    await require('../models/Tenant').collection.updateOne({_id:storedTenant._id},{$set:{isActive:false}});
    assert.equal((await request(`/service-sessions/${visit.id}/bill`)).status,403);
    await require('../models/Tenant').updateOne({ _id: args.tenantId }, { $set: { status: 'suspended',isActive:true } });
    assert.equal((await request(`/service-sessions/${visit.id}/bill`)).status, 403);
  } finally { await app.close(); }
});
