'use strict';
// S5 Task 3 — receipt-anchored gratuity ALLOCATION records (spec §2.2).
// Records only: they NEVER create charges/refunds/stock effects and NEVER
// mutate Order.tipAmount or the receipt. Shares follow the cumulative disjoint
// integer discipline copied from refund-components.js (residue to the last
// entry, telescoping to amountMinor exactly). Suffix: gratuity_alloc.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture } = require('./helpers/venueMongo');

const codeOf = error => error && error.code;
const assertFails = (promise, code, status) => assert.rejects(promise, error => codeOf(error) === code && (status === undefined || error.statusCode === status));

async function indexes() {
  await require('../services/venue/service-sessions').ensureIndexes();
  await require('../models/VenueOperation').createIndexes();
  await require('../services/venue/gratuity').ensureIndexes();
}

async function freshVisit(args, name) {
  const table = await require('../models/POSTable').create({ tenant: args.tenantId, location: args.locationId, name });
  return require('../services/venue/service-sessions').ensureServiceSession({ ...args, tableIds: [String(table._id)], expectedTableVersions: [0], idempotencyKey: `visit-${name}` });
}

// A settled bill Order with a POS tip amount, plus a verified v2 receipt
// anchored to the visit — the exact anchor an allocation record references.
async function settledBillReceipt(args, visit, name) {
  const billId = new mongoose.Types.ObjectId();
  await require('../models/Order').collection.insertOne({ _id: billId, orderNumber: `grat-${name}`, tenant: new mongoose.Types.ObjectId(args.tenantId), venueBillForSession: new mongoose.Types.ObjectId(visit.id), venueSettlementState: 'settled', paymentStatus: 'paid', tipAmount: 5000 });
  const attemptId = new mongoose.Types.ObjectId();
  await require('../models/VenuePaymentAttempt').collection.insertOne({ _id: attemptId, tenant: new mongoose.Types.ObjectId(args.tenantId), collectionVersion: 2, collectionSlot: `payer:${name}`, purpose: 'venue_bill', method: 'paystack', amountMinor: 10000, reference: `dhv-grat-${name}`, state: 'verified', key: `grat-${name}`, requestHash: 'test' });
  return require('../models/VenuePaymentReceipt').create({ tenant: args.tenantId, location: args.locationId, session: visit.id, billOrder: String(billId), collectionVersion: 2, attempt: String(attemptId), provider: 'paystack', reference: `dhv-grat-${name}`, providerTransactionId: `txn-${name}`, amountMinor: 10000, currency: 'NGN', verifiedAt: new Date(), state: 'verified', policySnapshot: {} });
}

test('gratuity allocations: exact disjoint shares, duplicate guard, records never touch payments or stock', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'gratuity_alloc_records');
  await indexes();
  const args = await fixture();
  const gratuity = require('../services/venue/gratuity');
  const staffA = new mongoose.Types.ObjectId(), staffB = new mongoose.Types.ObjectId(), shift = new mongoose.Types.ObjectId();
  await require('../models/VenueFinancialPolicy').create({ tenant: args.tenantId, location: args.locationId, version: 1, state: 'approved', currency: 'NGN', gratuityAllocation: { mode: 'staff', defaultStaffIds: [staffA] } });
  const visit = await freshVisit(args, 'core');
  const receipt = await settledBillReceipt(args, visit, 'core');
  const allocate = over => gratuity.recordAllocation({ ...args, sessionId: visit.id, receiptId: String(receipt._id), sourceKind: 'payer', amountMinor: 101, policyVersion: 1, shares: [{ staffId: String(staffA), shareBps: 5000 }, { staffId: String(staffB), shareBps: 5000 }], idempotencyKey: 'g1', ...over });

  const beforeOrder = await require('../models/Order').findById(receipt.billOrder).lean();
  const beforeReceipt = await require('../models/VenuePaymentReceipt').findById(receipt._id).lean();
  assert.equal(await require('../models/VenueStockEffect').countDocuments(), 0);

  // Residue case: 101 kobo at 5000/5000 bps — floor prefixes give 50 and 51
  // (the LAST entry absorbs the integer-division residue); sums EXACTLY 101.
  const created = await allocate({});
  assert.deepEqual(created.allocations.map(row => row.amountMinor), [50, 51]);
  assert.equal(created.allocations.reduce((total, row) => total + row.amountMinor, 0), created.amountMinor);
  assert.equal(created.allocations[0].staffId, String(staffA));
  assert.equal(created.policyVersion, 1);
  // Policy subdoc is a recorded HINT only — rows come from the request.
  assert.deepEqual(created.defaults, { mode: 'staff', defaultStaffIds: [String(staffA)] });

  // Replay with the same key is a no-op; a new key on the same receipt+source is a domain error.
  const replay = await allocate({});
  assert.equal(replay.id, created.id);
  await assertFails(allocate({ idempotencyKey: 'g1-dup' }), 'GRATUITY_ALREADY_ALLOCATED', 409);
  assert.equal(await require('../models/VenueGratuityAllocation').countDocuments(), 1);

  // The other source kind is a separate anchor — allowed exactly once.
  await assertFails(gratuity.recordAllocation({ ...args, sessionId: visit.id, receiptId: String(receipt._id), sourceKind: 'other', amountMinor: 101, policyVersion: 1, shares: [{ shiftId: String(shift), shareBps: 10000 }], idempotencyKey: 'g2' }), 'INVALID_GRATUITY_SOURCE', 400);
  const posRow = await allocate({ sourceKind: 'pos', shares: [{ shiftId: String(shift), shareBps: 10000 }], idempotencyKey: 'g3' });
  assert.equal(posRow.allocations[0].shiftId, String(shift));
  assert.equal(posRow.allocations[0].amountMinor, 101);
  assert.equal(await require('../models/VenueGratuityAllocation').countDocuments(), 2);

  // Share validation: totals must be exactly 10000 bps; each row is XOR staff/shift.
  await assertFails(allocate({ idempotencyKey: 'short', shares: [{ staffId: String(staffA), shareBps: 9999 }] }), 'INVALID_GRATUITY_SHARES', 400);
  await assertFails(allocate({ idempotencyKey: 'both', shares: [{ staffId: String(staffA), shiftId: String(shift), shareBps: 10000 }] }), 'INVALID_GRATUITY_SHARES', 400);
  await assertFails(allocate({ idempotencyKey: 'neither', shares: [{ shareBps: 10000 }] }), 'INVALID_GRATUITY_SHARES', 400);

  // Recording NEVER mutates the receipt or the bill — byte-identical, and no
  // charges/refunds/journals/stock effects exist afterwards.
  assert.equal(JSON.stringify(await require('../models/Order').findById(receipt.billOrder).lean()), JSON.stringify(beforeOrder));
  assert.equal(JSON.stringify(await require('../models/VenuePaymentReceipt').findById(receipt._id).lean()), JSON.stringify(beforeReceipt));
  assert.equal(await require('../models/VenueStockEffect').countDocuments(), 0);
  assert.equal(await require('../models/VenuePaymentReversal').countDocuments(), 0);
  assert.equal(await require('../models/JournalEntry').countDocuments(), 0);

  // Tenant isolation: a foreign tenant cannot allocate on this receipt/visit.
  const other = await fixture();
  await assertFails(gratuity.recordAllocation({ ...other, sessionId: visit.id, receiptId: String(receipt._id), sourceKind: 'payer', amountMinor: 101, policyVersion: 1, shares: [{ staffId: String(staffA), shareBps: 10000 }], idempotencyKey: 'foreign' }), 'NOT_FOUND', 404);
  // Unknown receipt and cross-session receipt anchors are 404s too.
  await assertFails(gratuity.recordAllocation({ ...args, sessionId: visit.id, receiptId: String(new mongoose.Types.ObjectId()), sourceKind: 'payer', amountMinor: 101, policyVersion: 1, shares: [{ staffId: String(staffA), shareBps: 10000 }], idempotencyKey: 'unknown-receipt' }), 'NOT_FOUND', 404);
  const otherVisit = await freshVisit(args, 'other-visit');
  const otherReceipt = await settledBillReceipt(args, otherVisit, 'other');
  await assertFails(gratuity.recordAllocation({ ...args, sessionId: visit.id, receiptId: String(otherReceipt._id), sourceKind: 'payer', amountMinor: 101, policyVersion: 1, shares: [{ staffId: String(staffA), shareBps: 10000 }], idempotencyKey: 'cross-session' }), 'NOT_FOUND', 404);

  // Listing is scoped and newest-first.
  const listed = await gratuity.listAllocations({ tenantId: args.tenantId, sessionId: visit.id, actor: args.actor });
  assert.equal(listed.allocations.length, 2);
  assert.equal(listed.allocations[0].id, posRow.id);
  assert.equal(listed.allocations[1].id, created.id);
  await assertFails(gratuity.listAllocations({ tenantId: other.tenantId, sessionId: visit.id, actor: other.actor }), 'NOT_FOUND', 404);
  assert.equal((await gratuity.listAllocations({ tenantId: args.tenantId, locationId: args.locationId, actor: args.actor })).allocations.length, 2);
});

test('gratuity HTTP: 401 without token, idempotent replay no-op, wrong-tenant 404, staff reads', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'gratuity_alloc_http');
  await indexes();
  const args = await fixture();
  const visit = await freshVisit(args, 'http');
  const receipt = await settledBillReceipt(args, visit, 'http');
  await require('../models/VenueFinancialPolicy').create({ tenant: args.tenantId, location: args.locationId, version: 1, state: 'approved', currency: 'NGN' });

  const previous = { JWT_SECRET: process.env.JWT_SECRET };
  process.env.JWT_SECRET = 'gratuity-http-test-only';
  t.after(() => { for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  const express = require('express');
  const app = express(); app.use(express.json()); app.use('/api/venue-ops', require('../routes/venue-ops.routes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ code: error.code }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const root = `http://127.0.0.1:${server.address().port}/api/venue-ops`;
  const sign = actor => require('jsonwebtoken').sign({ userId: actor.userId }, process.env.JWT_SECRET);
  const headers = (key, over = {}) => ({ Authorization: `Bearer ${sign(args.actor)}`, 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}), ...over });
  const url = `${root}/service-sessions/${visit.id}/gratuity-allocations`;
  const body = JSON.stringify({ receiptId: String(receipt._id), sourceKind: 'payer', amountMinor: 101, policyVersion: 1, shares: [{ staffId: String(args.actor.userId), shareBps: 10000 }] });

  assert.equal((await fetch(url, { method: 'POST' })).status, 401, 'no token → 401');
  const created = await fetch(url, { method: 'POST', headers: headers('http-g1'), body });
  assert.equal(created.status, 201);
  const payload = (await created.json()).data;
  assert.equal(payload.amountMinor, 101);
  const replay = await fetch(url, { method: 'POST', headers: headers('http-g1'), body });
  assert.equal(replay.status, 201);
  assert.equal((await replay.json()).data.id, payload.id);
  assert.equal(await require('../models/VenueGratuityAllocation').countDocuments(), 1, 'replay is a no-op');

  const other = await fixture();
  const foreign = await fetch(url, { method: 'POST', headers: headers('http-g2', { Authorization: `Bearer ${sign(other.actor)}` }), body });
  assert.equal(foreign.status, 404);
  assert.equal((await foreign.json()).code, 'NOT_FOUND');

  const listed = await fetch(url, { headers: headers() });
  assert.equal(listed.status, 200);
  assert.equal(listed.headers.get('cache-control'), 'no-store');
  assert.equal((await listed.json()).data.allocations.length, 1);
  const foreignList = await fetch(url, { headers: { Authorization: `Bearer ${sign(other.actor)}` } });
  assert.equal(foreignList.status, 404);
});
