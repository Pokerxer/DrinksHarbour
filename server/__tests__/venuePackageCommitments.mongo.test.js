'use strict';
// Task 2 (E4) — the coordinated package COMMIT. Tables (a REAL
// VenueCapacityClaim state 'confirmed' whose booking anchor is the commitment id —
// never a synthetic Booking row, never on the request queue), component stock
// (WarehouseStock guarded reserve — the SAME rows inventory.reserveBillStock
// guards) and the included-admissions entitlement (kind 'table_inclusion')
// commit in ONE transaction: atomic all-or-nothing (03 §7's two-phase
// "release the other" superseded). A stock-short commit leaves ZERO residual
// rows. Inclusions redeem through the UNCHANGED E2 door path and count
// against occurrence.guestsAdmitted (ONE capacity ledger).
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');
const { businessDate } = require('../services/venue/clock');

const codeOf = error => error && error.code;
const assertFails = (promise, code, status) => assert.rejects(promise, error => codeOf(error) === code && (status === undefined || error.statusCode === status));
const at = n => new Date(Date.now() + n * 60000).toISOString();
const plusDays = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d; };

async function boot(t, suffix, { maxGuests = 50 } = {}) {
  await connectVenueMongo(t, suffix);
  const args = await fixture();
  process.env.VENUE_CAPACITY_ENABLED = 'true';
  t.after(() => delete process.env.VENUE_CAPACITY_ENABLED);
  await require('../models/Warehouse').updateOne({ _id: args.locationId }, { $set: { 'venueServices.timezone': 'UTC', 'venueServices.businessDayStartMinutes': 240 }, $addToSet: { 'venueServices.capabilities': 'events' } });
  for (const model of ['VenueEventPackage', 'VenueEventOccurrence', 'VenuePackageCommitment', 'VenuePackageRedemption', 'VenueOperation']) await require(`../models/${model}`).createIndexes();
  const capacity = require('../services/venue/capacity');
  await require('../services/venue/service-sessions').ensureIndexes();
  await capacity.ensureIndexes();
  const second = await require('../models/POSTable').create({ tenant: args.tenantId, location: args.locationId, name: 'Table 2', seats: 4 });
  const resources = [...args.tableIds, String(second._id)];
  // WIDE service windows: any instant before the +8-day mark receives claims.
  await capacity.savePolicy({ ...args, expectedVersion: 0, idempotencyKey: 'policy', input: {
    enabled: true, timezone: 'UTC', resources, combinations: [resources],
    windows: [{ start: at(5), end: at(1200) }, { start: new Date(plusDays(7).getTime() - 2 * 3600000).toISOString(), end: new Date(plusDays(7).getTime() + 20 * 3600000).toISOString() }],
    durationMinutes: 60, bufferBeforeMinutes: 5, bufferAfterMinutes: 10, holdSeconds: 60,
  } });
  const occurrence = await require('../models/VenueEventOccurrence').create({
    tenant: args.tenantId, location: args.locationId, eventSlug: 'afro-night', name: 'Afro Night',
    occurrenceDate: businessDate(plusDays(7), 'UTC', 240), startAt: plusDays(7), endAt: new Date(plusDays(7).getTime() + 4 * 3600000),
    capacity: { maxGuests }, agePolicy: { minimumAge: 21, admissionTerms: '21+ with valid ID.' },
    publication: 'published', version: 0,
  });
  // the sellable package line (fixture style: legacy docs default to beverage kind)
  const oid = () => new mongoose.Types.ObjectId();
  const product = oid(), subproduct = oid(), size = oid(); const tenant = new mongoose.Types.ObjectId(args.tenantId);
  await require('../models/Product').collection.insertOne({ _id: product, name: 'VIP Package', type: 'beer', isAlcoholic: true, tracksBatch: false });
  await require('../models/SubProduct').collection.insertOne({ _id: subproduct, tenant, product, status: 'active', visibleInPOS: true, baseSellingPrice: 120000, defaultSize: size });
  await require('../models/Size').collection.insertOne({ _id: size, tenant, subproduct, sellingPrice: 120000 });
  const bottle = await beverage(args, { currentQuantity: 10, reservedQuantity: 2 }); // available: 8
  const packages = require('../services/venue/packages');
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, ...over });
  const definition = await packages.createPackage(base({ idempotencyKey: 'def-1', input: {
    name: 'VIP Booth', packageSubProductId: String(subproduct), sizeId: String(size),
    components: [{ subProductId: bottle.subProductId, sizeId: bottle.sizeId, quantity: 2 }],
    includedAdmissions: 2, tablePlan: { tableIds: args.tableIds },
  } }));
  return { ...args, resources, occurrenceId: String(occurrence._id), packageLineId: String(subproduct), packageLineSizeId: String(size), ...bottle, packages, definition, base };
}

test('commit: tables + stock + included admissions in one transaction; idempotent replay; claim anchor', { skip: !uri }, async t => {
  const args = await boot(t, 'package_commit');
  const committed = await args.packages.commitPackage(args.base({
    input: { packageId: args.definition.id, expectedVersion: 0, occurrenceId: args.occurrenceId }, idempotencyKey: 'c-1',
  }));
  assert.equal(committed.state, 'committed');
  assert.equal(committed.name, 'VIP Booth');
  assert.equal(committed.version, 0);
  assert.deepEqual(committed.tableResourceIds, args.tableIds);
  assert.equal(committed.includedAdmissions, 2);
  assert.equal(committed.stockReservations.length, 1);
  assert.equal(committed.stockReservations[0].quantity, 2);
  assert.ok(committed.businessDate, 'business date stamped');
  // the table claim: state confirmed, anchored on the COMMITMENT id (no synthetic Booking)
  const claim = await require('../models/VenueCapacityClaim').findOne({ tenant: new mongoose.Types.ObjectId(args.tenantId), booking: new mongoose.Types.ObjectId(committed.id) }).lean();
  assert.ok(claim, 'claim anchored on the commitment id');
  assert.equal(claim.state, 'confirmed');
  assert.deepEqual(claim.resources.map(String), args.tableIds);
  // the inclusion entitlement: kind table_inclusion, issued 2, one token, partySize 2
  assert.ok(committed.admissionEntitlementId);
  const entitlement = await require('../models/VenueAdmissionEntitlement').findOne({ tenant: new mongoose.Types.ObjectId(args.tenantId), sourceRef: new mongoose.Types.ObjectId(committed.id) }).lean();
  assert.ok(entitlement, 'inclusion entitlement issued');
  assert.equal(entitlement.kind, 'table_inclusion');
  assert.equal(entitlement.tokens[0].partySize, 2);
  assert.match(entitlement.tokens[0].token, /^pk-[0-9a-f]{32}$/);
  // stock: reserved 2 of the available 8
  const stock = await require('../models/WarehouseStock').findOne({ tenant: new mongoose.Types.ObjectId(args.tenantId), subProduct: new mongoose.Types.ObjectId(args.subProductId) }).lean();
  assert.equal(stock.reservedQuantity, 4); // fixture's 2 + our 2
  // idempotent replay with the same key → the same commitment back
  const replay = await args.packages.commitPackage(args.base({
    input: { packageId: args.definition.id, expectedVersion: 0, occurrenceId: args.occurrenceId }, idempotencyKey: 'c-1',
  }));
  assert.equal(replay.id, committed.id);
});

test('inclusions ride the E2 shared-cap door path exactly once', { skip: !uri }, async t => {
  const args = await boot(t, 'package_door', { maxGuests: 4 });
  const committed = await args.packages.commitPackage(args.base({
    input: { packageId: args.definition.id, expectedVersion: 0, occurrenceId: args.occurrenceId }, idempotencyKey: 'd-1',
  }));
  const door = require('../services/venue/door');
  await door.assignDoorStaff(args.base({ occurrenceId: args.occurrenceId, staffIds: [args.actor.userId], idempotencyKey: 'd-2' }));
  const token = (await require('../models/VenueAdmissionEntitlement').findOne({ tenant: new mongoose.Types.ObjectId(args.tenantId), sourceRef: new mongoose.Types.ObjectId(committed.id) })).tokens[0].token;
  const result = await require('../services/venue/admissions').redeem(args.base({ occurrenceId: args.occurrenceId, token, guests: 2, ageVerified: true, idempotencyKey: 'd-3' }));
  assert.deepEqual(Object.keys(result).sort(), ['name', 'partySize', 'result']); // door response stays MINIMUM
  const occurrence = await require('../models/VenueEventOccurrence').findOne({ _id: args.occurrenceId }).lean();
  assert.equal(occurrence.guestsAdmitted, 2); // the SHARED counter moved — no second ledger
});

test('atomic failure: a stock-short commit leaves ZERO residual rows; races pick one winner', { skip: !uri }, async t => {
  const args = await boot(t, 'package_atomic');
  // race: TWO packages (different names) with the same explicit table — the
  // claim machinery arbitrates (the E3 race idiom): exactly ONE wins, so the
  // same table is never promised by two commitments (loser's surfaced error
  // varies with transaction retry: never asserted, only the winner count is).
  const second = await args.packages.createPackage(args.base({ idempotencyKey: 'a-0', input: {
    name: 'Rival Booth', packageSubProductId: args.packageLineId, sizeId: args.packageLineSizeId,
    components: [{ subProductId: args.subProductId, sizeId: args.sizeId, quantity: 1 }],
    includedAdmissions: 1, tablePlan: { tableIds: args.tableIds },
  } }));
  const races = await Promise.allSettled([
    args.packages.commitPackage(args.base({ input: { packageId: args.definition.id, expectedVersion: 0, occurrenceId: args.occurrenceId }, idempotencyKey: 'a-1' })),
    args.packages.commitPackage(args.base({ input: { packageId: second.id, expectedVersion: 0, occurrenceId: args.occurrenceId }, idempotencyKey: 'a-2' })),
  ]);
  assert.equal(races.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(await require('../models/VenuePackageCommitment').countDocuments({ 'packageSnapshot.name': { $in: ['VIP Booth', 'Rival Booth'] } }), 1);

  // stock short: component quantity 15 exceeds the available 8 → STOCK_UNAVAILABLE,
  // and NOTHING survives (no claim, no entitlement, no commitment, no reservation)
  const third = await args.packages.createPackage(args.base({ idempotencyKey: 'a-3', input: {
    name: 'Huge Booth', packageSubProductId: args.packageLineId, sizeId: args.packageLineSizeId,
    components: [{ subProductId: args.subProductId, sizeId: args.sizeId, quantity: 15 }],
    includedAdmissions: 0, tablePlan: {},
  } }));
  const before = await require('../models/WarehouseStock').findOne({ tenant: new mongoose.Types.ObjectId(args.tenantId), subProduct: new mongoose.Types.ObjectId(args.subProductId) }).lean();
  await assertFails(args.packages.commitPackage(args.base({
    input: { packageId: third.id, expectedVersion: 0, occurrenceId: args.occurrenceId }, idempotencyKey: 'a-4',
  })), 'STOCK_UNAVAILABLE', 409);
  assert.equal(await require('../models/VenueCapacityClaim').countDocuments({ tenant: new mongoose.Types.ObjectId(args.tenantId), booking: new mongoose.Types.ObjectId(third.id) }), 0);
  assert.equal(await require('../models/VenuePackageCommitment').countDocuments({ 'packageSnapshot.name': 'Huge Booth' }), 0);
  assert.equal(await require('../models/VenueAdmissionEntitlement').countDocuments({ sourceRef: new mongoose.Types.ObjectId(third.id) }), 0);
  const after = await require('../models/WarehouseStock').findOne({ tenant: new mongoose.Types.ObjectId(args.tenantId), subProduct: new mongoose.Types.ObjectId(args.subProductId) }).lean();
  assert.equal(after.reservedQuantity, before.reservedQuantity, 'no reservation leaked');
});

test('commit gates: admissions without occurrence → INVALID_INPUT; stale version → STATE_CHANGED; unknown package → NOT_FOUND; stock-only commit works', { skip: !uri }, async t => {
  const args = await boot(t, 'package_gates');
  const admissionsOnly = await args.packages.createPackage(args.base({ idempotencyKey: 'g-0', input: {
    name: 'No Table Booth', packageSubProductId: args.packageLineId, sizeId: args.packageLineSizeId,
    components: [{ subProductId: args.subProductId, sizeId: args.sizeId, quantity: 1 }], includedAdmissions: 2, tablePlan: {},
  } }));
  await assertFails(args.packages.commitPackage(args.base({
    input: { packageId: admissionsOnly.id, expectedVersion: 0 }, idempotencyKey: 'g-1', // no occurrenceId
  })), 'INVALID_INPUT', 400);
  await assertFails(args.packages.commitPackage(args.base({
    input: { packageId: args.definition.id, expectedVersion: 7, occurrenceId: args.occurrenceId }, idempotencyKey: 'g-2',
  })), 'STATE_CHANGED', 409);
  await assertFails(args.packages.commitPackage(args.base({
    input: { packageId: String(new mongoose.Types.ObjectId()), expectedVersion: 0, occurrenceId: args.occurrenceId }, idempotencyKey: 'g-3',
  })), 'NOT_FOUND', 404);
  // a stock-only standing package (no tables, no admissions, no occurrence) commits fine
  const standing = await args.packages.createPackage(args.base({ idempotencyKey: 'g-4', input: {
    name: 'Bar Snack', packageSubProductId: args.packageLineId, sizeId: args.packageLineSizeId,
    components: [{ subProductId: args.subProductId, sizeId: args.sizeId, quantity: 1 }], includedAdmissions: 0, tablePlan: {},
  } }));
  void 0; // bookingAt rides INSIDE input (commitInput shape)
  const committed = await args.packages.commitPackage(args.base({ input: { packageId: standing.id, expectedVersion: 0, bookingAt: at(30) }, idempotencyKey: 'g-5' }));
  assert.equal(committed.admissionEntitlementId, null);
  assert.deepEqual(committed.tableResourceIds, []);
  // the occurrence gate is CONDITIONAL: once bound to an occurrence the SAME
  // admissions package commits (proving the gate, not a permanent state)
  const bound = await args.packages.commitPackage(args.base({
    input: { packageId: admissionsOnly.id, expectedVersion: 0, occurrenceId: args.occurrenceId }, idempotencyKey: 'g-6',
  }));
  assert.ok(bound.admissionEntitlementId);
  // the listing reflects both commitments, newest first
  const listing = await args.packages.listCommitments(args.base({}));
  assert.ok(listing.items.length >= 2);
});
