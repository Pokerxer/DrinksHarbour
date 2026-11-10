'use strict';
// Task 3 (S3) — courses: courseId on accepted lines (auto-registration in insertion
// order, free reassignment while unfired, FIRED_LINES_LOCKED on a fired line's course),
// filtered course fire through the SAME fireSessionRound path (dedup/consumption/stock
// untouched), hold/release state machine, and the version-checked courses.set registry.
// Suffix: courses_fire.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');

const codeOf = error => error && error.code;
const assertFails = (promise, code) => assert.rejects(promise, error => codeOf(error) === code);

async function pourSetup(args, beverages) {
  const tenant = new mongoose.Types.ObjectId(args.tenantId);
  const menu = { sections: [{ id: 'drinks', name: 'Drinks', items: beverages.map(b => ({ subProductId: b.subProductId, sizeId: b.sizeId, published: true, pourMl: 50 })) }] };
  await require('../models/VenueLocationProfile').create({ tenant: args.tenantId, location: args.locationId, menu: require('../services/venue/experience').validateMenu(menu) });
  for (const b of beverages) await require('../models/OpenedBottle').create({ tenant, location: args.locationId, source: { subProduct: b.subProductId, size: b.sizeId }, contentsMl: 750, remainingMl: 750, openedBy: args.actor.userId });
  return tenant;
}

test('courses: auto-registration, filtered fire, hold/release, registry rules', { skip: !uri, timeout: 240000 }, async t => {
  await connectVenueMongo(t, 'courses_fire');
  await require('../services/venue/service-sessions').ensureIndexes();
  await require('../models/VenueLocationProfile').createIndexes();
  await require('../models/VenueConsumptionEvent').createIndexes();
  await require('../models/OpenedBottle').createIndexes();

  const args = await fixture();
  const linesService = require('../services/venue/lines');
  const coursesService = require('../services/venue/courses');
  const Session = require('../models/VenueServiceSession');
  const Order = require('../models/Order');
  const ConsumptionEvent = require('../models/VenueConsumptionEvent');

  const starter = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const main = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const extra = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  await pourSetup(args, [starter, main, extra]);

  const visit = await require('../services/venue/service-sessions').ensureServiceSession({ ...args, idempotencyKey: 'visit' });
  const accepted = await linesService.setSessionLines({ ...args, sessionId: visit.id, expectedVersion: visit.version, lines: [
    { subProductId: starter.subProductId, sizeId: starter.sizeId, quantity: 2, courseId: 'starters' },
    { subProductId: main.subProductId, sizeId: main.sizeId, quantity: 1, courseId: 'mains' },
    { subProductId: extra.subProductId, sizeId: extra.sizeId, quantity: 1 },
  ], idempotencyKey: 'accept' });
  const starterLine = accepted.lines.find(l => l.subProductId === starter.subProductId);
  const mainLine = accepted.lines.find(l => l.subProductId === main.subProductId);
  const extraLine = accepted.lines.find(l => l.subProductId === extra.subProductId);

  // Auto-registration: insertion order (order = position), planned, unnamed;
  // the courseless line registers nothing.
  assert.deepEqual(accepted.courses.map(c => ({ courseId: c.courseId, name: c.name, order: c.order, state: c.state })), [
    { courseId: 'starters', name: undefined, order: 0, state: 'planned' },
    { courseId: 'mains', name: undefined, order: 1, state: 'planned' },
  ]);

  // Unfired reassignment is free: the courseless line joins 'mains'.
  const reassigned = await linesService.setSessionLines({ ...args, sessionId: visit.id, expectedVersion: accepted.version, lines: [
    { subProductId: starter.subProductId, sizeId: starter.sizeId, quantity: 2, courseId: 'starters' },
    { subProductId: main.subProductId, sizeId: main.sizeId, quantity: 1, courseId: 'mains' },
    { subProductId: extra.subProductId, sizeId: extra.sizeId, quantity: 1, courseId: 'mains' },
  ], idempotencyKey: 'accept2' });
  assert.equal(reassigned.lines.find(l => l.lineId === extraLine.lineId).courseId, 'mains');

  // Course fire sends exactly its course's unfired lines ONCE through the fire path.
  const fired = await linesService.fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: reassigned.version, idempotencyKey: 'fire-starters', courseId: 'starters' });
  assert.equal(fired.round.items.length, 1);
  assert.equal(fired.round.items[0].lineId, starterLine.lineId);
  assert.equal(await ConsumptionEvent.countDocuments({ tenant: args.tenantId }), 1, 'consumption events only for the fired course');
  const afterFire = await Session.findById(visit.id).lean();
  assert.equal(afterFire.courses.find(c => c.courseId === 'starters').state, 'fired');
  assert.equal(afterFire.courses.find(c => c.courseId === 'mains').state, 'planned');
  assert.equal(afterFire.acceptedLines.find(l => l.lineId === starterLine.lineId).firedQuantity, 2);
  assert.equal(afterFire.acceptedLines.find(l => l.lineId === mainLine.lineId).firedQuantity, 0);
  assert.equal(afterFire.acceptedLines.find(l => l.lineId === extraLine.lineId).firedQuantity, 0);

  // Replay of the same operation key is a no-op, never a second send.
  const replay = await linesService.fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: reassigned.version, idempotencyKey: 'fire-starters', courseId: 'starters' });
  assert.equal(replay.round.roundNo, fired.round.roundNo);
  assert.equal(await ConsumptionEvent.countDocuments({ tenant: args.tenantId }), 1);
  assert.equal((await Order.findById(accepted.heldOrderId).lean()).holdMetadata.firedRounds.length, 1);

  // Repeat course fire → domain error, no second send.
  await assertFails(linesService.fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: fired.version, idempotencyKey: 'fire-starters-again', courseId: 'starters' }), 'NO_UNFIRED_LINES');
  assert.equal((await Order.findById(accepted.heldOrderId).lean()).holdMetadata.firedRounds.length, 1);

  // Unknown course → NOT_FOUND.
  await assertFails(linesService.fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: fired.version, idempotencyKey: 'fire-ghost', courseId: 'ghost' }), 'NOT_FOUND');

  // Hold then fire works: mains goes hold → fired (releases its unfired lines).
  const held = await coursesService.setCourseState({ ...args, sessionId: visit.id, expectedVersion: fired.version, courseId: 'mains', to: 'hold', idempotencyKey: 'hold-mains' });
  assert.equal(held.courses.find(c => c.courseId === 'mains').state, 'hold');
  const firedMain = await linesService.fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: held.version, idempotencyKey: 'fire-mains', courseId: 'mains' });
  assert.deepEqual(firedMain.round.items.map(i => i.lineId).sort(), [mainLine.lineId, extraLine.lineId].sort());
  assert.equal((await Session.findById(visit.id).lean()).courses.find(c => c.courseId === 'mains').state, 'fired');

  // Fired course is terminal for hold.
  await assertFails(coursesService.setCourseState({ ...args, sessionId: visit.id, expectedVersion: firedMain.version, courseId: 'mains', to: 'hold', idempotencyKey: 'hold-fired' }), 'STATE_CHANGED');

  // A fired line submitted with a DIFFERENT courseId is rejected — never forked.
  const resubmit = startersCourse => [
    { subProductId: starter.subProductId, sizeId: starter.sizeId, quantity: 2, courseId: startersCourse },
    { subProductId: main.subProductId, sizeId: main.sizeId, quantity: 1, courseId: 'mains' },
    { subProductId: extra.subProductId, sizeId: extra.sizeId, quantity: 1, courseId: 'mains' },
  ];
  await assertFails(linesService.setSessionLines({ ...args, sessionId: visit.id, expectedVersion: firedMain.version, lines: resubmit('mains'), idempotencyKey: 'recourse-mismatch' }), 'FIRED_LINES_LOCKED');
  // Resubmitting the fired line with its OWN courseId is a no-op, not a fork.
  const same = await linesService.setSessionLines({ ...args, sessionId: visit.id, expectedVersion: firedMain.version, lines: resubmit('starters'), idempotencyKey: 'recourse-same' });
  assert.equal(same.lines.filter(l => l.subProductId === starter.subProductId).length, 1);
  assert.equal(same.lines.find(l => l.subProductId === starter.subProductId).courseId, 'starters');

  // courses.set: unique ids enforced; dropping a course that fired lines still
  // reference is rejected; full replacement keeps each course's state by id.
  await assertFails(coursesService.setCourses({ ...args, sessionId: visit.id, expectedVersion: same.version, idempotencyKey: 'set-dup', courses: [{ courseId: 'starters' }, { courseId: 'starters' }] }), 'INVALID_INPUT');
  await assertFails(coursesService.setCourses({ ...args, sessionId: visit.id, expectedVersion: same.version, idempotencyKey: 'set-drop-fired', courses: [{ courseId: 'starters', name: 'First' }] }), 'FIRED_LINES_LOCKED');
  const reordered = await coursesService.setCourses({ ...args, sessionId: visit.id, expectedVersion: same.version, idempotencyKey: 'set-reorder', courses: [
    { courseId: 'mains', name: 'Mains' }, { courseId: 'starters', name: 'First' }, { courseId: 'deserts', name: 'Last' },
  ] });
  assert.deepEqual(reordered.courses.map(c => [c.courseId, c.name, c.order, c.state]), [['mains', 'Mains', 0, 'fired'], ['starters', 'First', 1, 'fired'], ['deserts', 'Last', 2, 'planned']]);
  // Version-checked: a stale expectedVersion never reorders.
  await assertFails(coursesService.setCourses({ ...args, sessionId: visit.id, expectedVersion: same.version, idempotencyKey: 'set-stale', courses: [{ courseId: 'mains' }, { courseId: 'starters' }, { courseId: 'deserts' }] }), 'STATE_CHANGED');

  // hold → planned reverts nothing; a course with zero unfired lines is the
  // same domain error as an empty fire.
  const heldDesert = await coursesService.setCourseState({ ...args, sessionId: visit.id, expectedVersion: reordered.version, courseId: 'deserts', to: 'hold', idempotencyKey: 'hold-deserts' });
  assert.equal(heldDesert.courses.find(c => c.courseId === 'deserts').state, 'hold');
  const released = await coursesService.setCourseState({ ...args, sessionId: visit.id, expectedVersion: heldDesert.version, courseId: 'deserts', to: 'planned', idempotencyKey: 'release-deserts' });
  assert.equal(released.courses.find(c => c.courseId === 'deserts').state, 'planned');
  await assertFails(linesService.fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: released.version, idempotencyKey: 'fire-deserts', courseId: 'deserts' }), 'NO_UNFIRED_LINES');
});

test('course routes: fire/hold/set wiring with idempotency and version checks', { skip: !uri, timeout: 240000 }, async t => {
  await connectVenueMongo(t, 'courses_http');
  await require('../services/venue/service-sessions').ensureIndexes();
  await require('../models/VenueLocationProfile').createIndexes();
  const args = await fixture();
  const linesService = require('../services/venue/lines');
  const experience = require('../services/venue/experience');

  // Sealed menu — fire needs no bottles, the round path alone is exercised.
  const starter = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const main = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const menu = { sections: [{ id: 'drinks', name: 'Drinks', items: [starter, main].map(b => ({ subProductId: b.subProductId, sizeId: b.sizeId, published: true })) }] };
  await require('../models/VenueLocationProfile').create({ tenant: args.tenantId, location: args.locationId, menu: experience.validateMenu(menu) });

  const previous = { JWT_SECRET: process.env.JWT_SECRET };
  process.env.JWT_SECRET = 'courses-http-test-only';
  t.after(() => { for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  const express = require('express');
  const app = express(); app.use(express.json()); app.use('/api/venue-ops', require('../routes/venue-ops.routes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ code: error.code }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const root = `http://127.0.0.1:${server.address().port}/api/venue-ops`;
  const headers = () => ({ Authorization: `Bearer ${require('jsonwebtoken').sign({ userId: args.actor.userId }, process.env.JWT_SECRET)}`, 'Content-Type': 'application/json' });

  const table = await require('../models/POSTable').create({ tenant: args.tenantId, location: args.locationId, name: 'Course HTTP' });
  const visit = await require('../services/venue/service-sessions').ensureServiceSession({ ...args, tableIds: [String(table._id)], expectedTableVersions: [0], idempotencyKey: 'visit-http' });
  const accepted = await linesService.setSessionLines({ ...args, sessionId: visit.id, expectedVersion: visit.version, lines: [
    { subProductId: starter.subProductId, sizeId: starter.sizeId, quantity: 1, courseId: 'starters' },
    { subProductId: main.subProductId, sizeId: main.sizeId, quantity: 1, courseId: 'mains' },
  ], idempotencyKey: 'accept-http' });

  const fire = await fetch(`${root}/service-sessions/${visit.id}/courses/starters/fire`, { method: 'POST', headers: { ...headers(), 'Idempotency-Key': 'http-fire' }, body: JSON.stringify({ expectedVersion: accepted.version }) });
  assert.equal(fire.status, 200);
  assert.equal(fire.headers.get('cache-control'), 'no-store');
  const firedData = (await fire.json()).data;
  const roundNo = firedData.round.roundNo;
  const replay = await fetch(`${root}/service-sessions/${visit.id}/courses/starters/fire`, { method: 'POST', headers: { ...headers(), 'Idempotency-Key': 'http-fire' }, body: JSON.stringify({ expectedVersion: accepted.version }) });
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).data.round.roundNo, roundNo, 'replayed course fire is a no-op, not a second send');

  const ghost = await fetch(`${root}/service-sessions/${visit.id}/courses/ghost/fire`, { method: 'POST', headers: { ...headers(), 'Idempotency-Key': 'http-ghost' }, body: JSON.stringify({ expectedVersion: firedData.version }) });
  assert.equal(ghost.status, 404);

  const hold = await fetch(`${root}/service-sessions/${visit.id}/courses/mains/hold`, { method: 'POST', headers: { ...headers(), 'Idempotency-Key': 'http-hold' }, body: JSON.stringify({ expectedVersion: firedData.version }) });
  assert.equal(hold.status, 200);
  assert.equal((await hold.json()).data.courses.find(c => c.courseId === 'mains').state, 'hold');

  const stale = await fetch(`${root}/service-sessions/${visit.id}/courses`, { method: 'PUT', headers: { ...headers(), 'Idempotency-Key': 'http-set-stale' }, body: JSON.stringify({ expectedVersion: accepted.version, courses: [{ courseId: 'starters' }, { courseId: 'mains' }] }) });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).code, 'STATE_CHANGED');
  const set = await fetch(`${root}/service-sessions/${visit.id}/courses`, { method: 'PUT', headers: { ...headers(), 'Idempotency-Key': 'http-set' }, body: JSON.stringify({ expectedVersion: firedData.version + 1, courses: [{ courseId: 'mains', name: 'Mains' }, { courseId: 'starters', name: 'First' }] }) });
  assert.equal(set.status, 200);
  assert.deepEqual((await set.json()).data.courses.map(c => [c.courseId, c.order]), [['mains', 0], ['starters', 1]]);
});

// Task 6 (S3): the workspace courses panel loads a visit's snapshot through the
// EXISTING open-visit bill read (bill.read) — so that read must echo the course
// registry additively. No new route, no change to the frozen bill DTO.
test('open-visit bill read echoes the course registry for the courses panel', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'courses_bill_read');
  await require('../services/venue/service-sessions').ensureIndexes();
  await require('../models/VenueLocationProfile').createIndexes();
  await require('../models/VenueConsumptionEvent').createIndexes();
  await require('../models/OpenedBottle').createIndexes();
  const args = await fixture();
  const linesService = require('../services/venue/lines');
  const experience = require('../services/venue/experience');
  const starter = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const menu = { sections: [{ id: 'drinks', name: 'Drinks', items: [{ subProductId: starter.subProductId, sizeId: starter.sizeId, published: true, pourMl: 50 }] }] };
  await require('../models/VenueLocationProfile').create({ tenant: args.tenantId, location: args.locationId, menu: experience.validateMenu(menu) });
  await require('../models/OpenedBottle').create({ tenant: new mongoose.Types.ObjectId(args.tenantId), location: args.locationId, source: { subProduct: starter.subProductId, size: starter.sizeId }, contentsMl: 750, remainingMl: 750, openedBy: args.actor.userId });

  const visit = await require('../services/venue/service-sessions').ensureServiceSession({ ...args, idempotencyKey: 'visit-bill' });
  const accepted = await linesService.setSessionLines({ ...args, sessionId: visit.id, expectedVersion: visit.version, lines: [
    { subProductId: starter.subProductId, sizeId: starter.sizeId, quantity: 2, courseId: 'starters' },
  ], idempotencyKey: 'accept-bill' });
  await linesService.fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: accepted.version, idempotencyKey: 'fire-bill', courseId: 'starters' });

  // BEFORE the change this read drops the registry (only `.lines` is projected).
  const bill = await require('../services/venue/billing').getBill({ tenantId: args.tenantId, sessionId: visit.id, actor: args.actor });
  assert.equal(bill.state, 'open');
  assert.deepEqual(bill.courses.map(c => [c.courseId, c.state]), [['starters', 'fired']], 'the open-visit bill read echoes the course registry');
  const line = bill.lines.find(l => l.courseId === 'starters');
  assert.ok(line, 'the echoed lines carry courseId for unfired-count derivation');
  assert.equal(line.firedQuantity, 2);
});
