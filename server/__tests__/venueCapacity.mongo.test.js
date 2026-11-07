'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { connectVenueMongo, fixture } = require('./helpers/venueMongo');
const at = n => new Date(Date.now() + n * 60000).toISOString();

test('capacity serializes overlapping physical and combined claims, expiry and safe amendments', async t => {
  await connectVenueMongo(t, 'capacity');
  const capacity = require('../services/venue/capacity');
  const args = await fixture();
  const Table = require('../models/POSTable');
  const second = await Table.create({ tenant: args.tenantId, location: args.locationId, name: 'Table 2', seats: 4 });
  const resources = [...args.tableIds, String(second._id)];
  await capacity.ensureIndexes();
  const input = { enabled: true, timezone: 'Africa/Lagos', resources, combinations: [resources],
    windows: [{ start: at(10), end: at(600) }], durationMinutes: 60, bufferBeforeMinutes: 5, bufferAfterMinutes: 10, holdSeconds: 60 };
  await capacity.savePolicy({ ...args, expectedVersion: 0, input, idempotencyKey: 'policy' });
  const booking = async () => String((await require('../models/Booking').create({tenant:args.tenantId,location:args.locationId,createdBy:args.actor.userId,guest:{name:'Guest',phone:'123'},partySize:4,bookingAt:at(30),acquisitionAuthority:'server'}))._id);
  const command = (bookingId, resourceIds = args.tableIds) => ({ ...args, bookingId, resourceIds, bookingAt: at(30), partySize: 4, policyVersion: 1 });
  const a = await booking(), b = await booking();
  await assert.rejects(capacity.claim({...command(String(new mongoose.Types.ObjectId())),idempotencyKey:'orphan'}),e=>e.code==='NOT_FOUND');
  const results = await Promise.allSettled([
    capacity.claim({ ...command(a), idempotencyKey: 'a' }),
    capacity.claim({ ...command(b, resources), idempotencyKey: 'b' }),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'CAPACITY_UNAVAILABLE');
  const winner = results.find(r => r.status === 'fulfilled').value;
  const original = await require('../models/VenueCapacityClaim').findById(winner.id).lean();
  const foreign = { ...args, tenantId: String(new mongoose.Types.ObjectId()) };
  await assert.rejects(capacity.availability({ ...foreign, bookingAt: at(30), partySize: 4 }), /Tenant not found/);
  await assert.rejects(capacity.savePolicy({ ...args, expectedVersion: 1, input: { ...input, durationMinutes: 90 }, idempotencyKey: 'live-edit' }), e => e.code === 'CAPACITY_COMMITMENTS_EXIST');
  await capacity.release({ ...args, bookingId: String(original.booking), idempotencyKey: 'release' });
  const held = await capacity.claim({ ...command(b), state: 'held', idempotencyKey: 'held' });
  await require('../models/VenueCapacityClaim').updateOne({ _id: held.id }, { $set: { expiresAt: new Date(Date.now() - 1) } });
  const replacement = await capacity.claim({ ...command(a), idempotencyKey: 'replace-expired' });
  assert.equal(replacement.state, 'confirmed');
  const before = await require('../models/VenueCapacityClaim').findById(replacement.id).lean();
  const blocker = await capacity.claim({ ...command(await booking(), [String(second._id)]), idempotencyKey: 'second' });
  await assert.rejects(capacity.claim({ ...command(a, resources), expectedVersion: replacement.version, idempotencyKey: 'amend' }), e => e.code === 'CAPACITY_UNAVAILABLE');
  const after = await require('../models/VenueCapacityClaim').findById(replacement.id).lean();
  assert.deepEqual(after.resources, before.resources);
  assert.equal(after.start.getTime(), before.start.getTime());
  assert.ok(blocker.id);
  const free = await capacity.availability({ ...args, bookingAt: at(120), partySize: 4 });
  assert.equal(free.options.length, 3);
  const busy = await capacity.availability({ ...args, bookingAt: at(40), partySize: 4 });
  assert.equal(busy.options.length, 0);
});

test('accepted request acquires capacity and cancellation releases it with owner privacy', async t => {
  await connectVenueMongo(t, 'capacity_lifecycle');
  process.env.VENUE_CAPACITY_ENABLED = 'true'; t.after(() => delete process.env.VENUE_CAPACITY_ENABLED);
  const capacity = require('../services/venue/capacity');
  const args = await fixture();
  await require('../services/venue/service-sessions').ensureIndexes();
  await capacity.ensureIndexes();
  await capacity.savePolicy({ ...args, expectedVersion: 0, idempotencyKey: 'policy', input: {
    enabled: true, timezone: 'Africa/Lagos', resources: args.tableIds, combinations: [], windows: [{ start: at(10), end: at(600) }], durationMinutes: 60, bufferBeforeMinutes: 5, bufferAfterMinutes: 10, holdSeconds: 60,
  } });
  const Booking = require('../models/Booking'), customer = new mongoose.Types.ObjectId();
  const booking = await Booking.create({ tenant: args.tenantId, location: args.locationId, createdBy: customer,
    guest: { name: 'Guest', phone: '123' }, partySize: 2, bookingAt: at(30), source: 'discovery', acquisitionAuthority: 'server',
    requestPolicy: { timezone: 'Africa/Lagos', policies: 'Request only' }, requestMode: 'request_only', requestReference: 'VR-capacity', requestState: 'reviewed' });
  const reservations = require('../services/venue/reservations');
  const input = { resourceIds: args.tableIds, policyVersion: 1 };
  const command = { ...args, bookingId: String(booking._id), action: 'accept', expectedVersion: 0, input, idempotencyKey: 'accept' };
  const accepted = await reservations.reviewRequest(command);
  assert.equal(accepted.status, 'confirmed'); assert.equal(accepted.capacity.state, 'confirmed');
  assert.deepEqual(await reservations.reviewRequest(command), accepted);
  await assert.rejects(reservations.cancelRequest({ customerId: String(new mongoose.Types.ObjectId()), reference: booking.requestReference, expectedVersion: 1, idempotencyKey: 'foreign' }), /not found/i);
  const cancelled = await reservations.cancelRequest({ customerId: String(customer), reference: booking.requestReference, expectedVersion: 1, idempotencyKey: 'cancel' });
  assert.equal(cancelled.status, 'cancelled');
  const claim = await require('../models/VenueCapacityClaim').findOne({ booking: booking._id }).lean();
  assert.equal(claim.state, 'released');
  assert.equal((await capacity.availability({ ...args, bookingAt: at(30), partySize: 2 })).options.length, 1);
});

test('capacity-managed tables cannot be resized or deleted through legacy CRUD', async t => {
  await connectVenueMongo(t, 'capacity_config');
  const args = await fixture(); const capacity = require('../services/venue/capacity'); await capacity.ensureIndexes();
  await capacity.savePolicy({ ...args, expectedVersion: 0, idempotencyKey: 'policy', input: { enabled: true, timezone: 'Africa/Lagos', resources: args.tableIds, combinations: [], windows: [{ start: at(10), end: at(600) }], durationMinutes: 60, bufferBeforeMinutes: 0, bufferAfterMinutes: 0, holdSeconds: 60 } });
  const req = { tenant: { _id: args.tenantId, posSettings: { isBarRestaurant: true } }, params: { id: args.tableIds[0] }, body: { seats: 1 } };
  const response = () => ({ code: 200, status(n) { this.code = n; return this; }, json(v) { this.body = v; return this; } });
  for (const handler of [require('../controllers/posTable.controller').updateTable, require('../controllers/posTable.controller').deleteTable]) {
    const res = response(); let error;
    await handler(req, res, e => { error = e; });
    assert.equal(error?.code || res.code, 'CAPACITY_CONFIGURATION_REQUIRED');
  }
});

test('accepted arrival consumes its claim and replays one canonical visit', async t => {
  await connectVenueMongo(t, 'capacity_arrival'); const args = await fixture();
  const previous = process.env.VENUE_CAPACITY_ENABLED; process.env.VENUE_CAPACITY_ENABLED = 'true';
  t.after(() => previous === undefined ? delete process.env.VENUE_CAPACITY_ENABLED : process.env.VENUE_CAPACITY_ENABLED = previous);
  const capacity = require('../services/venue/capacity'), sessions = require('../services/venue/service-sessions');
  await capacity.ensureIndexes(); await sessions.ensureIndexes();
  const bookingAt = at(30);
  await capacity.savePolicy({ ...args, expectedVersion: 0, idempotencyKey: 'policy', input: { enabled: true, timezone: 'Africa/Lagos', resources: args.tableIds, combinations: [], windows: [{ start: at(10), end: at(600) }], durationMinutes: 60, bufferBeforeMinutes: 5, bufferAfterMinutes: 10, holdSeconds: 60 } });
  const booking = await require('../models/Booking').create({ tenant: args.tenantId, location: args.locationId, createdBy: args.actor.userId, guest: { name: 'Arrival', phone: '123' }, partySize: 2, bookingAt, source: 'discovery', acquisitionAuthority: 'server', requestMode: 'request_only', requestReference: 'VR-arrival', requestState: 'reviewed', requestPolicy: { timezone: 'Africa/Lagos' } });
  const accepted = await require('../services/venue/reservations').reviewRequest({ ...args, bookingId: String(booking._id), action: 'accept', expectedVersion: 0, input: { resourceIds: args.tableIds, policyVersion: 1 }, idempotencyKey: 'accept' });
  const table = await require('../models/POSTable').findById(args.tableIds[0]).lean();
  const command = { ...args, expectedTableVersions: [table.venueVersion], bookingId: String(booking._id), expectedBookingVersion: accepted.version, now: new Date(bookingAt), idempotencyKey: 'arrive' };
  const visit = await sessions.ensureServiceSession(command); assert.deepEqual(JSON.parse(JSON.stringify(await sessions.ensureServiceSession(command))), JSON.parse(JSON.stringify(visit)));
  assert.equal(await require('../models/VenueServiceSession').countDocuments({ booking: booking._id }), 1);
  const projection = await require('../services/venue/reservations').ownedRequest({ customerId: args.actor.userId, reference: booking.requestReference });
  assert.equal(projection.status, 'checked_in'); assert.equal(projection.capacity.state, 'arrived');
});
