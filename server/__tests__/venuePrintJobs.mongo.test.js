'use strict';
// Task 2 (S4) — print-jobs service contracts (spec §3): emission at fire (one
// `print` job per involved station, payload = safe ticket fields, part of the
// fire commit so a failed fire leaves no job and a replay emits nothing new);
// pull delivery (pendingForDevice marks queued→delivered with attempts+1 and
// flags redeliveries as recovery duplicates of the original — never a new job);
// ack (acknowledged + ackAt, double ack no-op, foreign/unknown 404); attempts
// cap → failed with lastError (state moves ONLY via these functions, never
// timers); reprint (new labelled job, duplicateOf original, ZERO new
// consumption events / VenuePreparationItem mutations); amendment emission
// when an advance correction links a `ref` (supersedes the round's
// unacknowledged print job; acknowledged jobs are never mutated).
// Suffix: print_jobs.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');

const codeOf = error => error && error.code;
const assertFails = (promise, code, status) => assert.rejects(promise, error => codeOf(error) === code && (status === undefined || error.statusCode === status));

async function indexes() {
  await require('../services/venue/service-sessions').ensureIndexes();
  await require('../models/VenueLocationProfile').createIndexes();
  await require('../services/venue/audit-indexes').applyPrintModelIndexes(mongoose.connection.db);
  await require('../models/PreparationStation').createIndexes();
  await require('../models/VenuePreparationItem').createIndexes();
}

async function freshVisit(args, name) {
  const table = await require('../models/POSTable').create({ tenant: args.tenantId, location: args.locationId, name });
  return require('../services/venue/service-sessions').ensureServiceSession({ ...args, tableIds: [String(table._id)], expectedTableVersions: [0], idempotencyKey: `visit-${name}` });
}

async function standardFixture(t, suffix) {
  await connectVenueMongo(t, suffix);
  await indexes();
  const args = await fixture();
  const tenant = new mongoose.Types.ObjectId(args.tenantId);
  const grill = await require('../models/PreparationStation').create({ tenant, location: args.locationId, name: 'Grill', categories: ['grill'], deviceIds: ['grill-printer'] });
  const pass = await require('../models/PreparationStation').create({ tenant, location: args.locationId, name: 'Pass', isDefault: true, deviceIds: ['pass-printer'] });
  const items = { grilled: await beverage(args, { currentQuantity: 5, reservedQuantity: 0 }), plain: await beverage(args, { currentQuantity: 5, reservedQuantity: 0 }) };
  await require('../models/VenueLocationProfile').create({ tenant: args.tenantId, location: args.locationId, menu: require('../services/venue/experience').validateMenu({ sections: [{ id: 'd', name: 'Drinks', items: [
    { subProductId: items.grilled.subProductId, sizeId: items.grilled.sizeId, published: true, category: 'grill' },
    { subProductId: items.plain.subProductId, sizeId: items.plain.sizeId, published: true },
  ] }] }) });
  return { args, grill, pass, items };
}

async function acceptAndFire(args, items, tag, courseId) {
  const lines = require('../services/venue/lines');
  const visit = await freshVisit(args, tag);
  const accepted = await lines.setSessionLines({ ...args, sessionId: visit.id, expectedVersion: visit.version, idempotencyKey: `accept-${tag}`,
    lines: Object.values(items).map(item => ({ subProductId: item.subProductId, sizeId: item.sizeId, quantity: 1, ...(courseId ? { courseId } : {}) })) });
  const fired = await lines.fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: accepted.version, idempotencyKey: `fire-${tag}`, ...(courseId ? { courseId } : {}) });
  return { visit, accepted, fired };
}

const jobs = () => require('../models/PreparationPrintJob');

test('emission at fire: one queued print job per involved station, safe ticket payload', { skip: !uri, timeout: 120000 }, async t => {
  const { args, grill, pass, items } = await standardFixture(t, 'print_jobs_emit');
  const { visit, accepted, fired } = await acceptAndFire(args, items, 'emit');
  assert.equal((await jobs().find()).length, 2, 'one job per involved station');
  const byDevice = new Map((await jobs().find().lean()).map(job => [job.deviceId, job]));
  const grillJob = byDevice.get('grill-printer');
  const passJob = byDevice.get('pass-printer');
  assert.equal(grillJob.actionType, 'print'); assert.equal(passJob.actionType, 'print');
  assert.equal(grillJob.deliveryState, 'queued'); assert.equal(passJob.deliveryState, 'queued');
  assert.equal(grillJob.attempts, 0);
  assert.match(grillJob.jobId, /^pj:[0-9a-f]{20}$/);
  assert.equal(String(grillJob.roundId), String(fired.round.roundId));
  assert.equal(String(grillJob.session), visit.id);
  assert.equal(String(grillJob.stationId), String(grill._id));
  assert.equal(String(passJob.stationId), String(pass._id));
  // readable delta payload: exactly this round's items routed to this station,
  // venue-prep room shape only (no unit price, no guest PII)
  assert.deepEqual(grillJob.payload, { sessionId: visit.id, roundId: String(fired.round.roundId), roundNo: 1, firedAt: fired.round.firedAt,
    items: [{ lineId: fired.round.items[0].lineId, revision: 1, name: 'Bottle', quantity: 1, stationId: String(grill._id) }] });
  assert.deepEqual(passJob.payload.items, [{ lineId: fired.round.items[1].lineId, revision: 1, name: 'Bottle', quantity: 1, stationId: String(pass._id) }]);

  // replaying the same fire is prevented by the existing firedQuantity guards —
  // repeating the round fails NO_UNFIRED_LINES and never emits new jobs
  const countBefore = await jobs().countDocuments();
  await assertFails(require('../services/venue/lines').fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: fired.version, idempotencyKey: 'replay-fire' }), 'NO_UNFIRED_LINES');
  await assertFails(require('../services/venue/lines').fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: 9999, idempotencyKey: 'replay-version' }), 'STATE_CHANGED');
  assert.equal(await jobs().countDocuments(), countBefore, 'failed/replayed fire emits nothing');
});

test('fire transaction failure leaves no job (STOCK_UNAVAILABLE)', { skip: !uri, timeout: 120000 }, async t => {
  const { args, items } = await standardFixture(t, 'print_jobs_fail');
  // a pour line with no open bottles fails the fire before anything is written
  const pourMenu = { sections: [{ id: 'd', name: 'Drinks', items: [
    { subProductId: items.plain.subProductId, sizeId: items.plain.sizeId, published: true, pourMl: 150 },
  ] }] };
  await require('../models/VenueLocationProfile').findOneAndUpdate({ tenant: args.tenantId, location: args.locationId }, { $set: { menu: require('../services/venue/experience').validateMenu(pourMenu) } });
  const visit = await freshVisit(args, 'fail');
  const accepted = await require('../services/venue/lines').setSessionLines({ ...args, sessionId: visit.id, expectedVersion: visit.version, idempotencyKey: 'accept-fail', lines: [{ subProductId: items.plain.subProductId, sizeId: items.plain.sizeId, quantity: 1 }] });
  await assertFails(require('../services/venue/lines').fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: accepted.version, idempotencyKey: 'fire-fail' }), 'STOCK_UNAVAILABLE');
  assert.equal(await jobs().countDocuments(), 0, 'a failed fire commit leaves no print job');
  assert.equal(await require('../models/VenuePreparationItem').countDocuments(), 0);
});

test('reprint: labelled duplicate of the original, zero consumption/preparation changes', { skip: !uri, timeout: 120000 }, async t => {
  const { args, items } = await standardFixture(t, 'print_jobs_reprint');
  const delivery = require('../services/venue/print-delivery');
  const ConsumptionEvent = require('../models/VenueConsumptionEvent');
  const PrepItem = require('../models/VenuePreparationItem');
  const { visit } = await acceptAndFire(args, items, 'reprint');
  const original = await jobs().findOne({ deviceId: 'grill-printer' }).lean();
  const eventsBefore = await ConsumptionEvent.countDocuments();
  const prepBefore = await PrepItem.findOne({ lineId: original.payload.items[0].lineId }).lean();

  const reprinted = await delivery.reprint({ tenantId: args.tenantId, sessionId: visit.id, jobId: original.jobId, actor: args.actor, idempotencyKey: 'reprint-1' });
  assert.equal(reprinted.actionType, 'reprint');
  assert.equal(reprinted.duplicateOf, original.jobId);
  assert.equal(reprinted.payload.label, 'REPRINT');
  assert.equal(reprinted.payload.reprintOf, original.jobId);
  assert.equal(reprinted.deviceId, 'grill-printer');
  assert.equal(reprinted.deliveryState, 'queued');
  assert.equal(await ConsumptionEvent.countDocuments(), eventsBefore, 'reprint adds NO consumption event');
  const prepAfter = await PrepItem.findById(prepBefore._id).lean();
  assert.equal(prepAfter.state, prepBefore.state);
  assert.equal(prepAfter.stateHistory.length, prepBefore.stateHistory.length, 'reprint mutates nothing on the preparation ledger');

  // idempotent replay returns the recorded reprint; foreign/unknown job → 404
  const replay = await delivery.reprint({ tenantId: args.tenantId, sessionId: visit.id, jobId: original.jobId, actor: args.actor, idempotencyKey: 'reprint-1' });
  assert.equal(replay.jobId, reprinted.jobId);
  await assertFails(delivery.reprint({ tenantId: args.tenantId, sessionId: visit.id, jobId: 'pj:ffffffffffffffffffff', actor: args.actor, idempotencyKey: 'reprint-2' }), 'NOT_FOUND', 404);
});

test('pull delivery + ack: delivered, recovery duplicates, cap → failed, double-ack no-op', { skip: !uri, timeout: 120000 }, async t => {
  const { args, items } = await standardFixture(t, 'print_jobs_delivery');
  const delivery = require('../services/venue/print-delivery');
  const { visit } = await acceptAndFire(args, items, 'delivery');
  const grillJobId = (await jobs().findOne({ deviceId: 'grill-printer' }).lean()).jobId;
  const poll = () => delivery.pendingForDevice({ tenantId: args.tenantId, locationId: args.locationId, deviceId: 'grill-printer' });

  // first poll: queued → delivered (attempts+1, lastDeliveredAt), device-scoped
  const first = await poll();
  assert.equal(first.jobs.length, 1, 'only this device\'s jobs');
  assert.equal(first.jobs[0].jobId, grillJobId);
  assert.equal(first.jobs[0].deliveryState, 'delivered');
  assert.equal(first.jobs[0].attempts, 1);
  assert.ok(first.jobs[0].lastDeliveredAt);
  assert.equal(first.jobs[0].recoveryDuplicate, undefined);
  // device scoping: the pass printer never sees the grill job
  assert.equal((await delivery.pendingForDevice({ tenantId: args.tenantId, locationId: args.locationId, deviceId: 'pass-printer' })).jobs.length, 1);
  assert.equal((await delivery.pendingForDevice({ tenantId: args.tenantId, locationId: args.locationId, deviceId: 'grill-printer' })).jobs[0].attempts, 2);

  // reconnect recovery: the delivered-unacked job is redelivered flagged as a
  // recovery duplicate of the original — the ledger is never duplicated
  const redelivered = (await poll()).jobs[0];
  assert.equal(redelivered.recoveryDuplicate, true);
  assert.equal(redelivered.duplicateOf, grillJobId);
  assert.equal(await jobs().countDocuments(), 2, 'recovery NEVER creates a new job');
  const ledgerRow = await jobs().findOne({ jobId: grillJobId }).lean();
  assert.equal(ledgerRow.duplicateOf, undefined, 'the stored job keeps its ledger identity');

  // attempts cap (station default 5): the 6th poll marks failed with lastError
  for (let i = 0; i < 3; i++) await poll();
  assert.equal((await poll()).jobs.length, 0, 'past the cap the job is no longer offered');
  const failed = await jobs().findOne({ jobId: grillJobId }).lean();
  assert.equal(failed.deliveryState, 'failed');
  assert.equal(failed.attempts, 6);
  assert.match(failed.lastError, /cap/i);
  // a failed job is no longer pollable and stays failed (no timer mutation)
  assert.equal((await poll()).jobs.length, 0);
  assert.equal((await jobs().findOne({ jobId: grillJobId }).lean()).deliveryState, 'failed');

  // ack: acknowledged + ackAt; double ack is a no-op; foreign/unknown → 404
  const passJobId = (await jobs().findOne({ deviceId: 'pass-printer' }).lean()).jobId;
  const acked = await delivery.acknowledge({ tenantId: args.tenantId, locationId: args.locationId, jobId: passJobId });
  assert.equal(acked.deliveryState, 'acknowledged');
  assert.ok(acked.ackAt);
  const ackAt = acked.ackAt;
  const again = await delivery.acknowledge({ tenantId: args.tenantId, locationId: args.locationId, jobId: passJobId });
  assert.equal(again.deliveryState, 'acknowledged');
  assert.equal(String(again.ackAt), String(ackAt), 'double ack does not move ackAt');
  await assertFails(delivery.acknowledge({ tenantId: args.tenantId, locationId: args.locationId, jobId: 'pj:ffffffffffffffffffff' }), 'NOT_FOUND', 404);
  const other = await fixture();
  await assertFails(delivery.acknowledge({ tenantId: other.tenantId, locationId: other.locationId, jobId: passJobId }), 'NOT_FOUND', 404);

  // state never moves from timers: reads leave deliveryState untouched
  await require('../services/venue/preparation').listSessionPreparation({ tenantId: args.tenantId, sessionId: visit.id, actor: args.actor });
  await delivery.listSessionPrintJobs({ tenantId: args.tenantId, sessionId: visit.id, actor: args.actor });
  assert.equal((await jobs().findOne({ jobId: passJobId }).lean()).deliveryState, 'acknowledged');
});

test('amendment hook: a ref-linked advance correction notifies the owning station', { skip: !uri, timeout: 120000 }, async t => {
  const { args, items, grill } = await standardFixture(t, 'print_jobs_amend');
  const preparation = require('../services/venue/preparation');
  const { visit } = await acceptAndFire(args, items, 'amend');
  const list = await preparation.listSessionPreparation({ tenantId: args.tenantId, sessionId: visit.id, actor: args.actor });
  const grillItem = list.items.find(item => item.stationId === String(grill._id));
  const printJob = await jobs().findOne({ deviceId: 'grill-printer', actionType: 'print' }).lean();

  // advance WITHOUT ref → no amendment
  await preparation.advance({ tenantId: args.tenantId, itemId: grillItem.id, to: 'preparing', actor: args.actor, idempotencyKey: 'adv-1' });
  assert.equal(await jobs().countDocuments({ actionType: 'amendment' }), 0);

  // advance WITH a ref (waste/remake link) → an amendment job for the owning
  // station, superseding the round's unacknowledged print job
  await preparation.advance({ tenantId: args.tenantId, itemId: grillItem.id, to: 'ready', reason: 'remade', ref: 'waste-abc', actor: args.actor, idempotencyKey: 'adv-2' });
  const amendment = await jobs().findOne({ actionType: 'amendment' }).lean();
  assert.ok(amendment);
  assert.equal(amendment.deviceId, 'grill-printer');
  assert.equal(amendment.duplicateOf, printJob.jobId, 'supersedes the unacknowledged print job');
  assert.deepEqual(amendment.payload.items.map(item => item.lineId), [grillItem.lineId]);
  assert.equal(amendment.payload.ref, 'waste-abc');
  assert.equal(amendment.payload.reason, 'remade');
  // the superseded print job itself is never mutated
  const untouched = await jobs().findOne({ jobId: printJob.jobId }).lean();
  assert.equal(untouched.deliveryState, 'queued');
  assert.equal(untouched.duplicateOf, undefined);

  // an ACKNOWLEDGED print job is never superseded: ack it, then a second
  // ref-linked advance emits an amendment without a duplicateOf reference
  const passItem = list.items.find(item => item.stationId !== String(grill._id));
  const passPrint = await jobs().findOne({ deviceId: 'pass-printer', actionType: 'print' }).lean();
  await require('../services/venue/print-delivery').pendingForDevice({ tenantId: args.tenantId, locationId: args.locationId, deviceId: 'pass-printer' });
  await require('../services/venue/print-delivery').acknowledge({ tenantId: args.tenantId, locationId: args.locationId, jobId: passPrint.jobId });
  await preparation.advance({ tenantId: args.tenantId, itemId: passItem.id, to: 'preparing', actor: args.actor, idempotencyKey: 'adv-3a' });
  await preparation.advance({ tenantId: args.tenantId, itemId: passItem.id, to: 'ready', reason: 'remade', ref: 'waste-def', actor: args.actor, idempotencyKey: 'adv-3b' });
  const secondAmendment = await jobs().findOne({ actionType: 'amendment', deviceId: 'pass-printer' }).lean();
  assert.ok(secondAmendment);
  assert.equal(secondAmendment.duplicateOf, undefined, 'acknowledged jobs are never mutated nor referenced as superseded');
  assert.equal((await jobs().findOne({ jobId: passPrint.jobId }).lean()).deliveryState, 'acknowledged');

  // staff read surface: newest-first, delivery states and duplicate labels
  const listed = await require('../services/venue/print-delivery').listSessionPrintJobs({ tenantId: args.tenantId, sessionId: visit.id, actor: args.actor });
  assert.equal(listed.sessionId, visit.id);
  assert.ok(listed.jobs.length >= 4);
  const createdDesc = listed.jobs.map(job => job.jobId);
  assert.equal(new Set(createdDesc).size, createdDesc.length);
  assert.ok(listed.jobs.every(job => ['queued', 'delivered', 'acknowledged', 'failed'].includes(job.deliveryState)));
  assert.ok(listed.jobs.some(job => job.actionType === 'amendment' && job.duplicateOf === undefined));
});
