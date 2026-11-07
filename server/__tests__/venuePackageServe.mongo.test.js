'use strict';
// Task 2 (E4) — the package life AFTER commit: tracked SERVES (redeemComponent —
// unique per commitment+component+sequence, COMPONENT_EXHAUSTED beyond the
// snapshot quantity, physical stock decremented exactly once with shipped
// movement rows), DELTA-ONLY upgrades (added admissions/components/tables —
// never a duplicate issuance), and staff RELEASE (stock remainder returned,
// the table claim released via the existing capacity path, the inclusion
// entitlement frozen — unredeemed admissions can never scan afterwards).
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
  const oid = () => new mongoose.Types.ObjectId();
  const product = oid(), subproduct = oid(), size = oid(); const tenant = new mongoose.Types.ObjectId(args.tenantId);
  await require('../models/Product').collection.insertOne({ _id: product, name: 'VIP Package', type: 'beer', isAlcoholic: true, tracksBatch: false });
  await require('../models/SubProduct').collection.insertOne({ _id: subproduct, tenant, product, status: 'active', visibleInPOS: true, baseSellingPrice: 120000, defaultSize: size });
  await require('../models/Size').collection.insertOne({ _id: size, tenant, subproduct, sellingPrice: 120000 });
  const bottle = await beverage(args, { currentQuantity: 10, reservedQuantity: 2 }); // available 8
  const packages = require('../services/venue/packages');
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, ...over });
  const definition = await packages.createPackage(base({ idempotencyKey: 'def-1', input: {
    name: 'VIP Booth', packageSubProductId: String(subproduct), sizeId: String(size),
    components: [{ subProductId: bottle.subProductId, sizeId: bottle.sizeId, quantity: 3 }],
    includedAdmissions: 2, tablePlan: { tableIds: args.tableIds },
  } }));
  const committed = await packages.commitPackage(base({ idempotencyKey: 'c-1', input: { packageId: definition.id, expectedVersion: 0, occurrenceId: String(occurrence._id) } }));
  return { ...args, resources, occurrenceId: String(occurrence._id), subProductId: bottle.subProductId, sizeId: bottle.sizeId, packages, definition, committed, base };
}

test('redeemComponent: tracked serves, exhaustion, physical decrement exactly once, movements', { skip: !uri }, async t => {
  const args = await boot(t, 'package_serve');
  const serve = over => args.packages.redeemComponent(args.base({ commitmentId: args.committed.id, input: { componentIndex: 0, quantity: 1 }, ...over }));
  const first = await serve({ idempotencyKey: 's-1' });
  assert.equal(first.componentIndex, 0);
  assert.equal(first.quantity, 1);
  assert.equal(first.sequence, 1);
  // physical stock: reserved -1 AND current -1 (the consumeBillStock decrement pair)
  const Stock = require('../models/WarehouseStock');
  const readStock = async () => Stock.findOne({ tenant: new mongoose.Types.ObjectId(args.tenantId), subProduct: new mongoose.Types.ObjectId(args.subProductId) }).lean();
  let stock = await readStock();
  assert.equal(stock.reservedQuantity, 4); // fixture 2 + snapshot 3 = 5? — snapshot 3 → commit 5; serve 1 → 4
  assert.equal(stock.currentQuantity, 9); // 10 - 1
  // movement ledger: a shipped WarehouseMovement anchored on the redemption
  const redemption = await require('../models/VenuePackageRedemption').findOne({ tenant: new mongoose.Types.ObjectId(args.tenantId), commitment: new mongoose.Types.ObjectId(args.committed.id) }).lean();
  assert.ok(redemption);
  assert.equal((redemption.movements || []).length >= 1, true, 'shipped movements recorded');
  const movement = await require('../models/WarehouseMovement').findById(redemption.movements[0]).lean();
  assert.ok(movement);
  assert.equal(movement.type, 'shipped');
  assert.equal(movement.quantity, 1);
  // replay with the same key → the same redemption back, NO second serve
  const replayed = await serve({ idempotencyKey: 's-1' });
  assert.equal(replayed.id, first.id);
  assert.equal((await require('../models/VenuePackageRedemption').countDocuments({ commitment: new mongoose.Types.ObjectId(args.committed.id) })), 1);
  // serve up to the snapshot quantity (3): two more; then COMPONENT_EXHAUSTED
  await serve({ idempotencyKey: 's-2' });
  await serve({ idempotencyKey: 's-3' });
  stock = await readStock();
  assert.equal(stock.reservedQuantity, 2); // all snapshot units served
  assert.equal(stock.currentQuantity, 7);
  await assertFails(serve({ idempotencyKey: 's-4' }), 'COMPONENT_EXHAUSTED', 409);
  // invalid component index → INVALID_INPUT; unknown commitment → NOT_FOUND
  await assertFails(args.packages.redeemComponent(args.base({ commitmentId: args.committed.id, input: { componentIndex: 9, quantity: 1 }, idempotencyKey: 's-5' })), 'INVALID_INPUT', 400);
  await assertFails(args.packages.redeemComponent(args.base({ commitmentId: String(new mongoose.Types.ObjectId()), input: { componentIndex: 0, quantity: 1 }, idempotencyKey: 's-6' })), 'NOT_FOUND', 404);
});

test('upgrade: DELTA-ONLY admissions/components extend the same snapshot; entitlement grows once', { skip: !uri }, async t => {
  const args = await boot(t, 'package_upgrade');
  const upgraded = await args.packages.upgradeCommitment(args.base({
    commitmentId: args.committed.id, expectedVersion: 0, idempotencyKey: 'u-1',
    input: { addedAdmissions: 2, addedComponents: [{ subProductId: args.subProductId, sizeId: args.sizeId, quantity: 2 }] },
  }));
  assert.equal(upgraded.version, 1);
  assert.equal(upgraded.includedAdmissions, 4); // 2 + 2 — same snapshot extended
  assert.equal(upgraded.stockReservations.length, 2); // the reserved pair again (no merge needed)
  const entitlement = await require('../models/VenueAdmissionEntitlement').findOne({ tenant: new mongoose.Types.ObjectId(args.tenantId), sourceRef: new mongoose.Types.ObjectId(args.committed.id) }).lean();
  assert.equal(entitlement.issuedCount, 4);
  assert.equal(entitlement.tokens.length, 1, 'upgrade extends THE token, never duplicates');
  assert.equal(entitlement.tokens[0].partySize, 4);
  // reserve check: 3 (commit) + 2 (upgrade) = 5 incremental reserved on top of the fixture's 2
  const stock = await require('../models/WarehouseStock').findOne({ tenant: new mongoose.Types.ObjectId(args.tenantId), subProduct: new mongoose.Types.ObjectId(args.subProductId) }).lean();
  assert.equal(stock.reservedQuantity, 7); // fixture 2 + 3 + 2
  // stale version → STATE_CHANGED; a second admission upgrade with a DIFFERENT key is an explicit delta → 4 → 6
  await assertFails(args.packages.upgradeCommitment(args.base({
    commitmentId: args.committed.id, expectedVersion: 0, idempotencyKey: 'u-2', input: { addedAdmissions: 1 },
  })), 'STATE_CHANGED', 409);
  const second = await args.packages.upgradeCommitment(args.base({
    commitmentId: args.committed.id, expectedVersion: 1, idempotencyKey: 'u-3', input: { addedAdmissions: 2 },
  }));
  assert.equal(second.includedAdmissions, 6);
  // the door redeems the FULL extended allowance through the SAME token in its
  // ONE entry (E2 invariant: an entry row is unique per {tenant, token}; a
  // second scan of the same token is TOKEN_ALREADY_USED — upgrades extend the
  // ONE allowance, they never mint admission rows).
  const door = require('../services/venue/door');
  await door.assignDoorStaff(args.base({ occurrenceId: args.occurrenceId, staffIds: [args.actor.userId], idempotencyKey: 'u-4' }));
  const entitlement2 = await require('../models/VenueAdmissionEntitlement').findOne({ tenant: new mongoose.Types.ObjectId(args.tenantId), sourceRef: new mongoose.Types.ObjectId(args.committed.id) }).lean();
  const admitted = await require('../services/venue/admissions').redeem(args.base({ occurrenceId: args.occurrenceId, token: entitlement2.tokens[0].token, guests: 6, ageVerified: true, idempotencyKey: 'u-5' }));
  assert.equal(admitted.partySize, 6);
  const occurrence = await require('../models/VenueEventOccurrence').findOne({ _id: args.occurrenceId }).lean();
  assert.equal(occurrence.guestsAdmitted, 6);
  // table upgrades: acquiring MORE tables (different key, delta-only — grow-only)
  const third = await args.packages.upgradeCommitment(args.base({
    commitmentId: args.committed.id, expectedVersion: 2, idempotencyKey: 'u-8', input: { addedTableIds: [args.resources[1]] },
  }));
  assert.deepEqual(third.tableResourceIds.map(String).sort(), [...args.tableIds, ...[args.resources[1]]].sort());
});

test('release: remainder returned after partial serves, claim released, unredeemed admissions frozen', { skip: !uri }, async t => {
  const args = await boot(t, 'package_release');
  await args.packages.redeemComponent(args.base({ commitmentId: args.committed.id, input: { componentIndex: 0, quantity: 1 }, idempotencyKey: 'r-0' })); // serve 1 of 3
  const released = await args.packages.releaseCommitment(args.base({ commitmentId: args.committed.id, idempotencyKey: 'r-1' }));
  assert.equal(released.state, 'released');
  assert.ok(released.releasedAt);
  const stock = await require('../models/WarehouseStock').findOne({ tenant: new mongoose.Types.ObjectId(args.tenantId), subProduct: new mongoose.Types.ObjectId(args.subProductId) }).lean();
  assert.equal(stock.reservedQuantity, 2); // fixture 2 back; served unit stays sailed
  assert.equal(stock.currentQuantity, 9); // the serve already consumed it
  const claim = await require('../models/VenueCapacityClaim').findOne({ tenant: new mongoose.Types.ObjectId(args.tenantId), booking: new mongoose.Types.ObjectId(args.committed.id) }).lean();
  assert.equal(claim.state, 'released');
  // unredeemed inclusion admissions can never scan afterwards (entitlement frozen)
  const entitlement = await require('../models/VenueAdmissionEntitlement').findOne({ tenant: new mongoose.Types.ObjectId(args.tenantId), sourceRef: new mongoose.Types.ObjectId(args.committed.id) }).lean();
  assert.ok(entitlement.expiresAt <= new Date(), 'entitlement frozen at release');
  const door = require('../services/venue/door');
  await door.assignDoorStaff(args.base({ occurrenceId: args.occurrenceId, staffIds: [args.actor.userId], idempotencyKey: 'r-2' }));
  await assertFails(require('../services/venue/admissions').redeem(args.base({ occurrenceId: args.occurrenceId, token: entitlement.tokens[0].token, guests: 1, ageVerified: true, idempotencyKey: 'r-3' })), 'EVENT_CLOSED', 409);
  // release is idempotent (replay → same state, no double restore)
  const again = await args.packages.releaseCommitment(args.base({ commitmentId: args.committed.id, idempotencyKey: 'r-4' }));
  assert.equal(again.state, 'released');
  assert.equal((await require('../models/WarehouseStock').findOne({ tenant: new mongoose.Types.ObjectId(args.tenantId), subProduct: new mongoose.Types.ObjectId(args.subProductId) })).reservedQuantity, 2);
  // serving after release → STATE_CHANGED
  await assertFails(args.packages.redeemComponent(args.base({ commitmentId: args.committed.id, input: { componentIndex: 0, quantity: 1 }, idempotencyKey: 'r-5' })), 'STATE_CHANGED', 409);
});
