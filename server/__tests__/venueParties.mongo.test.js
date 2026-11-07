'use strict';
// S6 Task 2 — party grouping & bill consolidation (docs/superpowers/plans/2026-10-28-venue-phase-3-s6.md).
// join stamps one opaque partyGroup {groupId, joinedAt} on both visits (operational
// grouping ONLY — bills/deposits/payer privacy stay separate); leave removes only
// the caller's link. consolidate merges the emptied visit's accepted lines into the
// surviving visit under the S1 choice-signature identity (same identity+price merges
// quantities; everything else lands as distinct re-stamped lines; frozen fields
// verbatim), retargets held orders to exactly ONE held Order, closes the emptied
// visit — and REFUSES with BILL_ALREADY_COLLECTED when either side carries any
// collected/finalised financial effect (documented predicate in
// services/venue/parties.js). Manager-gated (tenant_owner/tenant_admin).
// Suffix: parties_ops.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');

const codeOf = error => error && error.code;
const assertFails = (promise, code, status) => assert.rejects(promise, error => codeOf(error) === code && (status === undefined || error.statusCode === status));
const json = value => JSON.stringify(value);

async function indexes() {
  await require('../services/venue/service-sessions').ensureIndexes();
  await require('../models/VenueLocationProfile').createIndexes();
}
async function freshVisit(args, name) {
  const table = await require('../models/POSTable').create({ tenant: args.tenantId, location: args.locationId, name: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
  return require('../services/venue/service-sessions').ensureServiceSession({ ...args, tableIds: [String(table._id)], expectedTableVersions: [0], idempotencyKey: `visit-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
}

test('join sets one opaque groupId on both visits; money untouched; leave removes only the caller link', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'parties_ops_join');
  await indexes();
  const args = await fixture();
  const parties = require('../services/venue/parties');
  const a = await freshVisit(args, 'join-a'); const b = await freshVisit(args, 'join-b');
  const holdsBefore = (await require('../models/Order').find({ tenant: args.tenantId, venueServiceSession: { $in: [a.id, b.id] } }).lean()).map(json);
  const joined = await parties.join({ ...args, sessionId: a.id, targetSessionId: b.id, expectedVersion: a.version, idempotencyKey: 'join-1' });
  assert.ok(joined.partyGroup?.groupId, 'caller echoes the group');
  const target = await require('../models/VenueServiceSession').findOne({ _id: b.id }).lean();
  assert.equal(target.partyGroup.groupId, joined.partyGroup.groupId, 'one opaque groupId on both visits');
  assert.ok(target.partyGroup.joinedAt);
  assert.deepEqual((await require('../models/Order').find({ tenant: args.tenantId, venueServiceSession: { $in: [a.id, b.id] } }).lean()).map(json), holdsBefore, 'held orders (bills/deposits surfaces) byte-stable by a join');
  assert.equal(await require('../models/VenuePaymentReceipt').countDocuments({ tenant: args.tenantId }), 0);
  assert.equal(await require('../models/VenuePaymentAllocation').countDocuments({ tenant: args.tenantId }), 0);
  // grouping an already-grouped visit refuses (leave is the explicit exit)
  const c = await freshVisit(args, 'join-c');
  await assertFails(parties.join({ ...args, sessionId: a.id, targetSessionId: c.id, expectedVersion: joined.version, idempotencyKey: 'join-2' }), 'STATE_CHANGED', 409);
  await assertFails(parties.join({ ...args, sessionId: a.id, targetSessionId: c.id, expectedVersion: 0, idempotencyKey: 'join-stale' }), 'STATE_CHANGED', 409);
  const closed = await freshVisit(args, 'join-closed');
  await require('../models/VenueServiceSession').updateOne({ _id: closed.id }, { $set: { state: 'closed' } });
  await assertFails(parties.join({ ...args, sessionId: c.id, targetSessionId: closed.id, expectedVersion: c.version, idempotencyKey: 'join-closed' }), 'STATE_CHANGED', 409);
  const noop = await parties.join({ ...args, sessionId: c.id, targetSessionId: c.id, expectedVersion: c.version, idempotencyKey: 'join-self' });
  assert.equal(noop.partyGroup, undefined, 'same-source join is a no-op');
  // cross-location target is NOT_FOUND (party grouping is one floor's operation)
  const farLocation = await require('../models/Warehouse').create({ _id: new mongoose.Types.ObjectId(), tenant: args.tenantId, name: 'Far Bar', code: `FAR${Date.now()}`, venueServices: { enabled: true, reviewedAt: new Date(), canonicalCheckoutEnabled: true, capabilities: ['tables', 'tabs', 'preparation'] } });
  const elsewhere = await require('../models/POSTable').create({ tenant: args.tenantId, location: farLocation._id, name: `Far-${Date.now()}` });
  const far = await require('../services/venue/service-sessions').ensureServiceSession({ ...args, locationId: String(farLocation._id), tableIds: [String(elsewhere._id)], expectedTableVersions: [0], idempotencyKey: `far-${Date.now()}` });
  await assertFails(parties.join({ ...args, sessionId: c.id, targetSessionId: far.id, expectedVersion: c.version, idempotencyKey: 'join-far' }), 'NOT_FOUND', 404);

  // leave: removes only the caller's link; the target keeps the group
  const left = await parties.leaveParty({ ...args, sessionId: a.id, expectedVersion: joined.version, idempotencyKey: 'leave-1' });
  assert.equal(left.partyGroup, undefined, 'caller link removed');
  const targetAfter = await require('../models/VenueServiceSession').findOne({ _id: b.id }).lean();
  assert.equal(targetAfter.partyGroup.groupId, joined.partyGroup.groupId, 'other member keeps the group');
  const leftAgain = await parties.leaveParty({ ...args, sessionId: a.id, expectedVersion: left.version, idempotencyKey: 'leave-2' });
  assert.equal(leftAgain.version, left.version, 'leaving without a group is a no-op');
});

test('consolidate merges lines into the survivor under choice identity, retargets one held order, closes the emptied visit', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'parties_ops_consolidate');
  await indexes();
  const args = await fixture();
  const parties = require('../services/venue/parties'); const linesService = require('../services/venue/lines');
  const parent = await beverage(args, { currentQuantity: 10 }); const tonic = await beverage(args, { currentQuantity: 40 });
  const plain = await beverage(args); const plain2 = await beverage(args);
  const groups = [{ id: 'mixer', name: 'Mixer', required: true, minSelect: 1, maxSelect: 1, incompatibleWith: [], options: [{ id: 'tonic', label: 'Tonic', subProductId: tonic.subProductId, sizeId: tonic.sizeId }] }];
  await require('../models/VenueLocationProfile').create({ tenant: args.tenantId, location: args.locationId, menu: require('../services/venue/experience').validateMenu({ sections: [
    { id: 'c', name: 'Cocktails', items: [{ subProductId: parent.subProductId, sizeId: parent.sizeId, published: true, modifierGroups: groups }] },
    { id: 'd', name: 'Drinks', items: [{ subProductId: plain.subProductId, sizeId: plain.sizeId, published: true }, { subProductId: plain2.subProductId, sizeId: plain2.sizeId, published: true }] },
  ] }) });
  const survivor = await freshVisit(args, 'survivor'); const source = await freshVisit(args, 'source');
  const surAccepted = await linesService.setSessionLines({ ...args, sessionId: survivor.id, expectedVersion: survivor.version, lines: [
    { subProductId: parent.subProductId, sizeId: parent.sizeId, quantity: 1, choices: [{ groupId: 'mixer', optionId: 'tonic' }] },
    { subProductId: plain.subProductId, sizeId: plain.sizeId, quantity: 1 },
  ], idempotencyKey: 'sur-accept' });
  const srcAccepted = await linesService.setSessionLines({ ...args, sessionId: source.id, expectedVersion: source.version, lines: [
    { subProductId: parent.subProductId, sizeId: parent.sizeId, quantity: 2, choices: [{ groupId: 'mixer', optionId: 'tonic' }], courseId: 'starters' },
    { subProductId: plain.subProductId, sizeId: plain.sizeId, quantity: 1 },
    { subProductId: plain2.subProductId, sizeId: plain2.sizeId, quantity: 1, note: 'no nuts' },
  ], idempotencyKey: 'src-accept' });
  // Simulate a differing preset/price context: the source's parent identity carries
  // a different frozen unit price, so it must land as a DISTINCT line (never repriced).
  await require('../models/VenueServiceSession').updateOne({ _id: source.id, 'acceptedLines.choiceKey': { $type: 'string' } }, { $set: { 'acceptedLines.$.unitPriceMinor': 12345 } });
  const srcLine = (await require('../models/VenueServiceSession').findOne({ _id: source.id }).lean()).acceptedLines.find(l => l.choiceKey);
  assert.equal(srcLine.unitPriceMinor, 12345);
  const moneyBefore = {
    receipts: (await require('../models/VenuePaymentReceipt').find({ tenant: args.tenantId }).lean()).map(json),
    allocations: (await require('../models/VenuePaymentAllocation').find({ tenant: args.tenantId }).lean()).map(json),
    effects: await require('../models/VenueStockEffect').countDocuments({ tenant: args.tenantId }),
    events: await require('../models/VenueConsumptionEvent').countDocuments({ tenant: args.tenantId }),
    preps: await require('../models/VenuePreparationItem').countDocuments({ tenant: args.tenantId }),
    holds: (await require('../models/Order').find({ tenant: args.tenantId, venueServiceSession: { $in: [survivor.id, source.id] } }).lean()).map(json),
  };

  const done = await parties.consolidate({ ...args, sessionId: source.id, intoSessionId: survivor.id, expectedVersion: srcAccepted.version, idempotencyKey: 'cons-1' });
  const SessionM = require('../models/VenueServiceSession');
  const surDoc = await SessionM.findOne({ _id: survivor.id }).lean(); const srcDoc = await SessionM.findOne({ _id: source.id }).lean();
  assert.equal(srcDoc.state, 'closed', 'emptied visit closed');
  assert.equal(srcDoc.acceptedLines.length, 0, 'emptied visit has no lines');
  assert.equal(surDoc.state, 'open', 'survivor stays open');
  // identity merge: plain (same identity, same price) merged into the survivor row
  const plainRows = surDoc.acceptedLines.filter(l => String(l.subproduct) === plain.subProductId);
  assert.equal(plainRows.length, 1, 'same identity merges quantities'); assert.equal(plainRows[0].quantity, 2);
  assert.equal(plainRows[0].revision, surAccepted.lines.find(l => l.subProductId === plain.subProductId).revision, 'merged row keeps its revision');
  // differing price (same identity) stays a distinct appended line; frozen fields verbatim
  const parentRows = surDoc.acceptedLines.filter(l => String(l.subproduct) === parent.subProductId);
  assert.equal(parentRows.length, 2, 'differing frozen price keeps the identities distinct');
  const appended = parentRows.find(l => l.unitPriceMinor === 12345);
  assert.ok(appended); assert.equal(appended.quantity, 2); assert.equal(appended.note, undefined);
  assert.deepEqual(appended.choices, srcLine.choices, 'choices preserved verbatim');
  assert.equal(appended.choiceKey, srcLine.choiceKey);
  assert.equal(appended.courseId, 'starters', 'courseId preserved');
  assert.equal(surDoc.acceptedLines.find(l => String(l.subproduct) === plain2.subProductId).quantity, 1, 'distinct product stays distinct');
  assert.equal(surDoc.acceptedLines.find(l => String(l.subproduct) === plain2.subProductId).note, 'no nuts', 'staff note preserved verbatim on the appended line');
  const revisions = surDoc.acceptedLines.map(l => l.revision);
  const originals = new Set(surAccepted.lines.map(l => l.revision));
  const appendedPlain = surDoc.acceptedLines.find(l => String(l.subproduct) === plain2.subProductId);
  assert.ok(appended.revision > Math.max(...originals), 'appended lines re-stamp beyond every survivor original revision');
  assert.ok(appendedPlain.revision > Math.max(...originals), 'appended lines re-stamp beyond every survivor original revision');
  assert.notEqual(appended.revision, appendedPlain.revision, 'appended revisions are strictly increasing');
  assert.ok(surDoc.lineVersion >= appended.revision, 'lineVersion holds the monotonic high-water mark');
  assert.equal(surDoc.courses.some(c => c.courseId === 'starters' && c.state === 'planned'), true, 'unknown courseId auto-registered on the survivor');
  // exactly ONE held order survives for the survivor; the source's is cancelled
  const holds = await require('../models/Order').find({ tenant: args.tenantId, venueServiceSession: { $in: [survivor.id, source.id] } }).lean();
  assert.equal(holds.filter(h => h.status === 'hold' && String(h.venueServiceSession) === survivor.id).length, 1, 'exactly one held Order for the surviving visit');
  const surHold = holds.find(h => String(h.venueServiceSession) === survivor.id);
  assert.equal(surHold.holdMetadata.cartItems.find(i => i.lineId === plainRows[0].lineId).quantity, 2, 'survivor cart rebuilt from merged lines');
  assert.equal(holds.find(h => String(h.venueServiceSession) === source.id).status, 'cancelled', 'source held tab cancelled');
  // tables: the emptied visit's table freed, survivor's untouched
  assert.equal((await require('../models/POSTable').findById(source.tableIds[0]).lean()).status, 'available', 'source table freed');
  assert.equal((await require('../models/POSTable').findById(survivor.tableIds[0]).lean()).status, 'occupied', 'survivor table untouched');
  // zero money/stock/preparation/consumption effects
  assert.deepEqual((await require('../models/VenuePaymentReceipt').find({ tenant: args.tenantId }).lean()).map(json), moneyBefore.receipts, 'receipts byte-stable');
  assert.deepEqual((await require('../models/VenuePaymentAllocation').find({ tenant: args.tenantId }).lean()).map(json), moneyBefore.allocations, 'allocations byte-stable');
  assert.equal(await require('../models/VenueStockEffect').countDocuments({ tenant: args.tenantId }), 0, 'no stock effects created');
  assert.equal(await require('../models/VenueConsumptionEvent').countDocuments({ tenant: args.tenantId }), 0, 'no consumption events created or duplicated');
  assert.equal(await require('../models/VenuePreparationItem').countDocuments({ tenant: args.tenantId }), 0, 'no preparation items created');
  // replay with the same key returns the stored result; same-source is a no-op
  const replay = await parties.consolidate({ ...args, sessionId: source.id, intoSessionId: survivor.id, expectedVersion: srcAccepted.version, idempotencyKey: 'cons-1' });
  assert.equal(json(replay), json(done), 'idempotent replay is a no-op');
  const selfDone = await parties.consolidate({ ...args, sessionId: survivor.id, intoSessionId: survivor.id, expectedVersion: done.version, idempotencyKey: 'cons-self' });
  assert.equal(selfDone.version, done.version, 'same-source consolidate is a no-op');
});

test('consolidate refuses post-collections (BILL_ALREADY_COLLECTED), fired work (FIRED_LINES_LOCKED) and non-managers', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'parties_ops_refusal');
  await indexes();
  const args = await fixture();
  const parties = require('../services/venue/parties'); const linesService = require('../services/venue/lines');
  const bev = await beverage(args, { currentQuantity: 5 });
  await require('../models/VenueLocationProfile').create({ tenant: args.tenantId, location: args.locationId, menu: require('../services/venue/experience').validateMenu({ sections: [{ id: 'd', name: 'Drinks', items: [{ subProductId: bev.subProductId, sizeId: bev.sizeId, published: true }] }] }) });
  const tenant = new mongoose.Types.ObjectId(args.tenantId);
  const SessionM = require('../models/VenueServiceSession');

  // fired work on the emptied visit cannot merge
  const firedSource = await freshVisit(args, 'fired-src'); const sinkA = await freshVisit(args, 'sink-a');
  const acc = await linesService.setSessionLines({ ...args, sessionId: firedSource.id, expectedVersion: firedSource.version, lines: [{ subProductId: bev.subProductId, sizeId: bev.sizeId, quantity: 1 }], idempotencyKey: 'fr-accept' });
  await linesService.fireSessionRound({ ...args, sessionId: firedSource.id, expectedVersion: acc.version, idempotencyKey: 'fr-fire' });
  await assertFails(parties.consolidate({ ...args, sessionId: firedSource.id, intoSessionId: sinkA.id, expectedVersion: acc.version + 1, idempotencyKey: 'cons-fired' }), 'FIRED_LINES_LOCKED', 409);

  // receipts on either side refuse (collected money — the coordinated surface is the separate bills)
  const withReceipt = await freshVisit(args, 'receipt'); const sinkB = await freshVisit(args, 'sink-b');
  await require('../models/VenuePaymentReceipt').create({ tenant, location: args.locationId, session: withReceipt.id, billOrder: new mongoose.Types.ObjectId(), attempt: new mongoose.Types.ObjectId(), provider: 'cash', reference: `r-${Date.now()}`, amountMinor: 500, verifiedAt: new Date() });
  await assertFails(parties.consolidate({ ...args, sessionId: withReceipt.id, intoSessionId: sinkB.id, expectedVersion: withReceipt.version, idempotencyKey: 'cons-receipt' }), 'BILL_ALREADY_COLLECTED', 409);
  const otherReceipt = await freshVisit(args, 'receipt2'); const sinkC = await freshVisit(args, 'sink-c');
  await require('../models/VenuePaymentReceipt').create({ tenant, location: args.locationId, session: otherReceipt.id, billOrder: new mongoose.Types.ObjectId(), attempt: new mongoose.Types.ObjectId(), provider: 'cash', reference: `r2-${Date.now()}`, amountMinor: 500, verifiedAt: new Date() });
  await assertFails(parties.consolidate({ ...args, sessionId: sinkC.id, intoSessionId: otherReceipt.id, expectedVersion: sinkC.version, idempotencyKey: 'cons-receipt2' }), 'BILL_ALREADY_COLLECTED', 409);

  // consumed stock effects on either side refuse
  const withEffect = await freshVisit(args, 'effect'); const sinkD = await freshVisit(args, 'sink-d');
  await require('../models/VenueStockEffect').create({ tenant, location: args.locationId, session: sinkD.id, billOrder: new mongoose.Types.ObjectId(), lineId: 'l1', revision: 1, subproduct: bev.subProductId, size: bev.sizeId, quantity: 1, state: 'consumed' });
  await assertFails(parties.consolidate({ ...args, sessionId: withEffect.id, intoSessionId: sinkD.id, expectedVersion: withEffect.version, idempotencyKey: 'cons-effect' }), 'BILL_ALREADY_COLLECTED', 409);

  // frozen bill on the survivor refuses too
  const sinkE = await freshVisit(args, 'sink-e'); const plain = await freshVisit(args, 'plain-e');
  await SessionM.updateOne({ _id: sinkE.id }, { $set: { state: 'closing', billOrder: new mongoose.Types.ObjectId() } });
  await assertFails(parties.consolidate({ ...args, sessionId: plain.id, intoSessionId: sinkE.id, expectedVersion: plain.version, idempotencyKey: 'cons-frozen' }), 'BILL_ALREADY_COLLECTED', 409);

  // manager gate: a non-manager staff member is denied even with pos:sell
  const staffId = new mongoose.Types.ObjectId();
  await require('../models/User').collection.insertOne({ _id: staffId, tenant: tenant, role: 'attendant', status: 'active', venueDeniedActions: [], posPermissions: ['pos:sell'] });
  await require('../models/Warehouse').updateOne({ _id: args.locationId }, { $push: { venueStaff: staffId } });
  const staffActor = { userId: String(staffId), tenantId: args.tenantId, role: 'attendant', permissions: ['pos:sell'], venueDeniedActions: [] };
  const sinkF = await freshVisit(args, 'sink-f');
  await assertFails(parties.consolidate({ ...args, sessionId: sinkF.id, intoSessionId: plain.id, expectedVersion: sinkF.version, actor: staffActor, idempotencyKey: 'cons-staff' }), 'VENUE_PERMISSION_DENIED', 403);
  await assertFails(parties.consolidate({ ...args, sessionId: plain.id, intoSessionId: sinkF.id, expectedVersion: plain.version + 1, idempotencyKey: 'cons-stale' }), 'STATE_CHANGED', 409);
});
