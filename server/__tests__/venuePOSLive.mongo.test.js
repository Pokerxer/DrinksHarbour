'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');
const { startRouter } = require('./helpers/routeAuthHarness');
test('pos_token_uses_canonical_commands_and_cannot_bypass_through_retail', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'pos_http'); const args = await fixture(); const item = await beverage(args);
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { role: 'tenant_staff', posPermissions: ['pos:sell'] } });
  const otherLocation = await require('../models/Warehouse').create({ tenant: args.tenantId, name: 'Other location', code: 'OTHER', venueStaff: [] });
  await require('../models/POSTable').create({ tenant: args.tenantId, location: otherLocation._id, name: 'Other table' });
  await require('../services/venue/service-sessions').ensureIndexes(); await require('../services/venue/billing').ensureIndexes(); await require('../services/venue/collections').ensureIndexes();
  await require('../services/chartOfAccounts.service').ensureDefaultCOA(args.tenantId); await require('../models/JournalEntry').createIndexes();
  await require('../models/Tenant').updateOne({ _id: args.tenantId }, { $set: { 'posSettings.retailWarehouse': args.locationId } });
  const drawer = new mongoose.Types.ObjectId(); await require('../models/POSSession').collection.insertOne({ _id: drawer, tenant: new mongoose.Types.ObjectId(args.tenantId), warehouse: new mongoose.Types.ObjectId(args.locationId), status: 'open', shopId: 'retail' });
  const app = await startRouter(require('../routes/pos.routes'), '/api/pos');
  const token = require('jsonwebtoken').sign({ type: 'pos', userId: args.actor.userId, tenantId: args.tenantId, posPermissions: ['pos:sell'] }, process.env.JWT_SECRET);
  let key = 0;
  async function request(path, method='GET', body) {
    const response = await fetch(app.url(`/api/pos${path}`), { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': `pos-http-${key++}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, ...await response.json() };
  }
  try {
    const floor = await request('/tables'); assert.equal(floor.status, 200, JSON.stringify(floor)); assert.equal(floor.data.tables.length, 1, 'staff only sees assigned location');
    const opened = await request(`/tables/${args.tableIds[0]}/open-tab`, 'POST', { expectedTableVersion: 0 }); assert.equal(opened.status, 201, JSON.stringify(opened));
    const visit = opened.data.serviceSession; const hold = opened.data.tab._id;
    const updated = await request(`/tabs/${hold}`, 'PUT', { expectedVersion: visit.version, items: [item] }); assert.equal(updated.status, 200, JSON.stringify(updated));
    const fired = await request(`/tabs/${hold}/fire`, 'POST', { expectedVersion: updated.data.serviceSession.version, itemKeys: [`${item.subProductId}_${item.sizeId}`] }); assert.equal(fired.status, 200, JSON.stringify(fired));
    const kitchen = await request('/kitchen/active'); assert.equal(kitchen.status, 200, JSON.stringify(kitchen)); assert.equal(kitchen.data.orders.length, 1);
    const freeze = await request(`/venue/service-sessions/${visit.id}/bill`, 'POST', { expectedVersion: fired.data.serviceSession.version, lineVersion: fired.data.serviceSession.lineVersion, ageVerified: true }); assert.equal(freeze.status, 200, JSON.stringify(freeze));
    assert.equal((await require('../models/Order').findById(freeze.data.orderId).lean()).shopId, 'retail', 'final bill keeps the verified drawer shop');
    await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: ['bill.read'] } });
    assert.equal((await request(`/venue/service-sessions/${visit.id}/bill`)).status, 403);
    await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: [] } });
    const close = await request(`/sessions/${drawer}/close`, 'POST', {}); assert.equal(close.status, 409, JSON.stringify(close));
    const cash = await request(`/venue/service-sessions/${visit.id}/collections`, 'POST', { expectedVersion: freeze.data.version, quoteId: freeze.data.quoteId, method: 'cash', amountTenderedMinor: 300000 }); assert.equal(cash.status, 200, JSON.stringify(cash)); assert.equal(cash.data.bill.state, 'settled');
    const generic = await request('/orders', 'POST', { items: [item], paymentMethod: 'cash', amountTendered: 3000 }); assert.equal(generic.status, 409, JSON.stringify(generic));
  } finally { await app.close(); }
});
