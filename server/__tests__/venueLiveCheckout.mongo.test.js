'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');
const { startRouter, signToken } = require('./helpers/routeAuthHarness');
test('hosted_booking_checkout_lapse_reconcile_uses_one_bill_receipt_and_stock_issue', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'http_live');
  const sessions = require('../services/venue/service-sessions'); await sessions.ensureIndexes();
  await require('../services/venue/billing').ensureIndexes(); await require('../services/venue/collections').ensureIndexes();
  const args = await fixture(); const input = await beverage(args);
  await require('../services/chartOfAccounts.service').ensureDefaultCOA(args.tenantId); await require('../models/JournalEntry').createIndexes();
  const booking = await require('../models/Booking').create({ tenant: args.tenantId, location: args.locationId, createdBy: args.actor.userId, guest: { name: 'Guest', phone: '123' }, partySize: 2, bookingAt: new Date(), status: 'confirmed', source: 'discovery', acquisitionAuthority: 'server' });
  const token = signToken({ _id: args.actor.userId, tenant: args.tenantId, role: 'tenant_owner', email: 'owner@test.local' });
  const app = await startRouter(require('../routes/venue-ops.routes'), '/api/venue-ops');
  let key = 0;
  const request = async (path, method = 'GET', body) => {
    const response = await fetch(app.url(`/api/venue-ops${path}`), { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': `http-${key++}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json(); return { status: response.status, ...result };
  };
  try {
    const opened = await request('/service-sessions', 'POST', { locationId: args.locationId, bookingId: String(booking._id), tableIds: args.tableIds, expectedTableVersions: [0] });
    assert.equal(opened.status, 201, JSON.stringify(opened)); const sessionId = opened.data.id;
    const accepted = await request(`/service-sessions/${sessionId}/lines`, 'PUT', { expectedVersion: opened.data.version, lines: [input] }); assert.equal(accepted.status, 200, JSON.stringify(accepted));
    const frozen = await request(`/service-sessions/${sessionId}/bill`, 'POST', { expectedVersion: accepted.data.version, lineVersion: accepted.data.lineVersion, ageVerified: true }); assert.equal(frozen.status, 200, JSON.stringify(frozen));
    assert.equal(frozen.data.commissionMinor, 27000);
    const gateway = require('../services/venue/paystack'); let initializations = 0;
    t.mock.method(gateway, 'initialize', async () => { initializations++; return { authorizationUrl: 'https://checkout.paystack.com/test-only' }; });
    const collection = await request(`/service-sessions/${sessionId}/collections`, 'POST', { expectedVersion: frozen.data.version, quoteId: frozen.data.quoteId, method: 'paystack', email: 'guest@test.local' }); assert.equal(collection.status, 200, JSON.stringify(collection)); assert.equal(initializations, 1);
    const attempt = await require('../models/VenuePaymentAttempt').findOne({ tenant: args.tenantId }).lean();
    t.mock.method(gateway, 'verify', async reference => ({ success: true, status: 'paid', data: { reference, amountMinor: 300000, transactionId: '12345', currency: 'NGN' } }));
    await require('../services/paystackWebhook').processEvent({ event: 'charge.success', data: { reference: attempt.reference, amount: 300000, currency: 'NGN', status: 'success', id: 12345 } });
    assert.equal(await require('../models/VenuePaymentReceipt').countDocuments({ tenant: args.tenantId }), 1);
    await require('../models/Tenant').updateOne({ _id: args.tenantId }, { $set: { subscriptionStatus: 'past_due', venueSubscriptionReadOnlySince: new Date(Date.now() + 1) } });
    await new Promise(resolve => setTimeout(resolve, 5));
    const deny = await request(`/service-sessions/${sessionId}/lines`, 'PUT', { expectedVersion: collection.data.bill.version, lines: [input] }); assert.equal(deny.status, 403);
    const reconciled = await request(`/service-sessions/${sessionId}/reconcile`, 'POST', {}); assert.equal(reconciled.status, 200, JSON.stringify(reconciled)); assert.equal(reconciled.data.state, 'settled');
    await require('../services/venue/collections').verifyVenuePayment({ reference: attempt.reference });
    assert.equal(await require('../models/VenuePaymentReceipt').countDocuments({ tenant: args.tenantId }), 1);
    assert.equal(await require('../models/VenuePaymentAllocation').countDocuments({ tenant: args.tenantId }), 1);
    assert.equal(await require('../models/WarehouseMovement').countDocuments({ tenant: args.tenantId }), 1);
    await require('../services/venue/recovery').recoverVenueWork();
    const invoice = await require('../models/CustomerInvoice').findOne({ tenant: args.tenantId, sourceId: frozen.data.orderId }).lean();
    assert.ok(invoice, 'settled booking has an invoice');
    assert.equal(invoice.state, 'posted', JSON.stringify(invoice));
    assert.equal(invoice.outstanding, 0);
    await require('../services/venue/recovery').recoverVenueWork();
    assert.equal(await require('../models/CustomerInvoice').countDocuments({ tenant: args.tenantId, sourceId: frozen.data.orderId }), 1);
    assert.equal((await require('../models/Booking').findById(booking._id).lean()).status, 'completed');
  } finally { await app.close(); }
});
