'use strict';
// S6 Task 3 — move selected lines (docs/superpowers/plans/2026-10-28-venue-phase-3-s6.md).
// moveLines moves N units of an UNFIRED, UNALLOCATED source line to another visit
// (same tenant+location) in ONE transaction: the source row quantity reduces (a
// fully-moved row is removed), the destination line is appended/extended under the
// consolidation merge discipline (same identity+price+note into an UNFIRED row;
// everything else lands distinct) preserving choices/choiceKey/note/courseId/
// frozenRecipeVersion verbatim, and destination units are priced via the existing
// priceVenueLines additions path from the DESTINATION visit's context. A differing
// destination context (presetRef/serviceMode/posShopId) or a differently-derived
// price requires explicit repricingConsent (REPRICING_CONSENT_REQUIRED). Fired
// lines refuse (FIRED_LINES_LOCKED); a line promised to a payer portion refuses
// (LINE_ALLOCATED); both visit versions are checked (stale → STATE_CHANGED); a
// move creates ZERO consumption events/preparation items/stock effects/receipts;
// a same-source move is an idempotent no-op; a zero-quantity move is INVALID_INPUT.
// Suffix: move_lines.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');

const codeOf = error => error && error.code;
const assertFails = (promise, code, status) => assert.rejects(promise, error => codeOf(error) === code && (status === undefined || error.statusCode === status));
const json = value => JSON.stringify(value);
const SessionM = () => require('../models/VenueServiceSession');
const oid = value => new mongoose.Types.ObjectId(value);

async function indexes() {
  await require('../services/venue/service-sessions').ensureIndexes();
  await require('../models/VenueLocationProfile').createIndexes();
}
async function freshVisit(args, name) {
  const table = await require('../models/POSTable').create({ tenant: args.tenantId, location: args.locationId, name: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
  return require('../services/venue/service-sessions').ensureServiceSession({ ...args, tableIds: [String(table._id)], expectedTableVersions: [0], idempotencyKey: `visit-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
}
async function menuFor(args, items) {
  await require('../models/VenueLocationProfile').create({ tenant: args.tenantId, location: args.locationId, menu: require('../services/venue/experience').validateMenu({ sections: [{ id: 'd', name: 'Drinks', items }] }) });
}
// S2 stamps frozenRecipeVersion on a line at fire; fired lines can never move, so
// a movable line never carries it through a real flow — stamp directly to pin the
// verbatim-preservation contract for the field when present.
async function stampRecipe(args, subProductId, sizeId, sessionId, lineId) {
  const profile = await require('../models/IngredientProfile').create({ tenant: oid(args.tenantId), subProduct: oid(subProductId), dimension: 'count', createdBy: args.actor.userId });
  const version = await require('../models/RecipeVersion').create({ tenant: oid(args.tenantId), output: { subProduct: oid(subProductId), size: oid(sizeId) }, version: 1, components: [{ profile: profile._id, quantity: 1, unit: 'count' }], createdBy: args.actor.userId });
  await SessionM().collection.updateOne({ _id: oid(sessionId), 'acceptedLines.lineId': lineId }, { $set: { 'acceptedLines.$.frozenRecipeVersion': { version: version.version, recipe: version._id } } });
  return { version: version.version, recipe: String(version._id) };
}
// The fixture tenant ships without till tax (default-off, posTax.service.js); enable
// the 7.5% rate so recomputed line totals are distinguishable from copied ones.
async function enableTax(args) {
  await require('../models/Tenant').collection.updateOne({ _id: oid(args.tenantId) }, { $set: { posSettings: { isBarRestaurant: true, taxEnabled: true, taxRate: 7.5 } } });
}
const visitDoc = async (tenantId, id) => SessionM().findOne({ _id: id, tenant: tenantId }).lean();
const linesBytes = async (tenantId, id) => json((await visitDoc(tenantId, id)).acceptedLines);
const move = (transfers, args, sessionId, lines, expectedVersion, repricingConsent, key) =>
  transfers.moveLines({ ...args, sessionId, expectedVersion, lines, ...(repricingConsent === undefined ? {} : { repricingConsent }), idempotencyKey: key });

test('move lines: frozen fields preserved verbatim, destination merge discipline, both holds rebuilt, zero side effects, same-source no-op', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'move_lines_happy');
  await indexes();
  const args = await fixture();
  await enableTax(args);
  const transfers = require('../services/venue/transfers'); const linesService = require('../services/venue/lines');
  const parent = await beverage(args, { currentQuantity: 10 }); const tonic = await beverage(args, { currentQuantity: 40 }); const plain = await beverage(args, { currentQuantity: 30 });
  const groups = [{ id: 'mixer', name: 'Mixer', required: true, minSelect: 1, maxSelect: 1, incompatibleWith: [], options: [{ id: 'tonic', label: 'Tonic', subProductId: tonic.subProductId, sizeId: tonic.sizeId }] }];
  await menuFor(args, [
    { subProductId: parent.subProductId, sizeId: parent.sizeId, published: true, modifierGroups: groups },
    { subProductId: plain.subProductId, sizeId: plain.sizeId, published: true },
  ]);
  const source = await freshVisit(args, 'src'); const dest = await freshVisit(args, 'dest');
  const choices = [{ groupId: 'mixer', optionId: 'tonic' }];
  const srcAcc = await linesService.setSessionLines({ ...args, sessionId: source.id, expectedVersion: source.version, lines: [
    { subProductId: parent.subProductId, sizeId: parent.sizeId, quantity: 3, choices, note: 'no ice', courseId: 'starters' },
    { subProductId: plain.subProductId, sizeId: plain.sizeId, quantity: 1 },
  ], idempotencyKey: 'src-accept' });
  // Destination pre-accepts the SAME parent identity (same choices+note) so the
  // moved units EXTEND that row; the plain line has no match and must APPEND.
  await linesService.setSessionLines({ ...args, sessionId: dest.id, expectedVersion: dest.version, lines: [
    { subProductId: parent.subProductId, sizeId: parent.sizeId, quantity: 1, choices, note: 'no ice' },
  ], idempotencyKey: 'dest-accept' });
  const srcParent = srcAcc.lines.find(l => l.subProductId === parent.subProductId);
  const srcPlain = srcAcc.lines.find(l => l.subProductId === plain.subProductId);
  const recipe = await stampRecipe(args, parent.subProductId, parent.sizeId, source.id, srcPlain.lineId);
  await SessionM().collection.updateOne({ _id: oid(source.id), 'acceptedLines.lineId': srcPlain.lineId }, { $set: { 'acceptedLines.$.frozenRecipeVersion': recipe } });
  const before = {
    events: await require('../models/VenueConsumptionEvent').countDocuments({ tenant: args.tenantId }),
    preps: await require('../models/VenuePreparationItem').countDocuments({ tenant: args.tenantId }),
    effects: await require('../models/VenueStockEffect').countDocuments({ tenant: args.tenantId }),
    receipts: await require('../models/VenuePaymentReceipt').countDocuments({ tenant: args.tenantId }),
    holds: (await require('../models/Order').find({ tenant: args.tenantId, venueServiceSession: { $in: [source.id, dest.id] } }).lean()).map(json),
  };
  const destBefore = await visitDoc(args.tenantId, dest.id);
  // NB: the destination's first row is the expanded tonic OPTION line (expandUnits
  // re-emits option units before the parent unit) — select the parent row by identity.
  const destRow = destBefore.acceptedLines.find(l => String(l.subproduct) === parent.subProductId && l.choiceKey);

  const done = await move(transfers, args, source.id, [
    { lineId: srcParent.lineId, revision: srcParent.revision, quantity: 2, toSessionId: dest.id },
    { lineId: srcPlain.lineId, revision: srcPlain.revision, quantity: 1, toSessionId: dest.id },
  ], srcAcc.version, undefined, 'move-1');
  assert.equal(done.version, srcAcc.version + 1, 'source version advanced once');

  const srcDoc = await visitDoc(args.tenantId, source.id); const destDoc = await visitDoc(args.tenantId, dest.id);
  const movedParent = destDoc.acceptedLines.find(l => l.lineId === destRow.lineId);
  assert.equal(movedParent.quantity, 3, 'same identity+price+note EXTENDS the destination row');
  assert.equal(movedParent.revision, destRow.revision, 'extended row keeps its revision');
  assert.equal(movedParent.courseId, 'starters', 'moved units carry their course onto the merged row');
  const appended = destDoc.acceptedLines.find(l => String(l.subproduct) === plain.subProductId);
  assert.ok(appended, 'unmatched identity APPENDS a distinct destination row');
  assert.equal(appended.quantity, 1); assert.equal(appended.unitPriceMinor, 100000); assert.equal(appended.firedQuantity, 0);
  assert.equal(appended.revision, destDoc.lineVersion, 'appended row takes a fresh monotonic destination revision');
  // Raw docs always materialise `choices: []` (Mongoose DocumentArray invariant —
  // probe-verified 28 Oct: every subdoc push persists at least []); the S1 contract
  // "plain lines carry no choices" lives at the DTO layer (lines.js maps
  // empty→absent), matching venueLinesChoices.mongo.test.js's DTO-level assertions.
  const destDTO = require('../services/venue/lines').linesDTO({ ...destDoc, version: destDoc.version });
  const dtoPlain = destDTO.lines.find(l => l.subProductId === plain.subProductId || String(l.subProductId) === String(plain.subProductId));
  assert.equal(dtoPlain ? dtoPlain.choices : undefined, undefined, 'plain line carries no choices (DTO layer)');
  assert.deepEqual(appended.frozenRecipeVersion && { version: appended.frozenRecipeVersion.version, recipe: String(appended.frozenRecipeVersion.recipe) }, recipe, 'frozenRecipeVersion preserved verbatim');
  // Source side: parent reduced to 1 (totals recomputed), plain row fully moved → removed.
  const srcParentAfter = srcDoc.acceptedLines.find(l => l.lineId === srcParent.lineId);
  assert.equal(srcParentAfter.quantity, 1); assert.equal(srcParentAfter.netMinor, 100000); assert.equal(srcParentAfter.taxMinor, 7500);
  assert.equal(srcDoc.acceptedLines.some(l => l.lineId === srcPlain.lineId), false, 'fully-moved row is removed');
  assert.equal(destDoc.courses.some(c => c.courseId === 'starters' && c.state === 'planned'), true, 'courseId auto-registered on the destination');

  assert.equal(await require('../models/VenueConsumptionEvent').countDocuments({ tenant: args.tenantId }), before.events, 'ZERO consumption events created');
  assert.equal(await require('../models/VenuePreparationItem').countDocuments({ tenant: args.tenantId }), before.preps, 'ZERO preparation items created');
  assert.equal(await require('../models/VenueStockEffect').countDocuments({ tenant: args.tenantId }), before.effects, 'ZERO stock effects created');
  assert.equal(await require('../models/VenuePaymentReceipt').countDocuments({ tenant: args.tenantId }), before.receipts, 'ZERO receipts created');
  const holdsAfter = (await require('../models/Order').find({ tenant: args.tenantId, venueServiceSession: { $in: [source.id, dest.id] } }).lean()).map(doc => {
    const copy = { ...doc }; return json(copy);
  });
  assert.notDeepEqual(holdsAfter, before.holds, 'both held tabs rebuilt from the moved lines');
  const destHold = (await require('../models/Order').find({ tenant: args.tenantId, venueServiceSession: dest.id }).lean())[0];
  assert.equal(destHold.holdMetadata.cartItems.reduce((sum, c) => sum + (c.lineId === destRow.lineId ? c.quantity : 0), 0), 3, 'destination hold carries the extended row');
  assert.ok(destHold.holdMetadata.cartItems.some(c => c.quantity === 1 && c.lineId === appended.lineId), 'destination hold carries the appended row');
  const srcHold = (await require('../models/Order').find({ tenant: args.tenantId, venueServiceSession: source.id }).lean())[0];
  assert.equal(srcHold.items.find(i => String(i.subproduct) === String(srcParentAfter.subproduct)).quantity, 1, 'source hold rebuilt');

  // Same-source move: idempotent no-op (no version bump, lines byte-stable).
  const stable = await linesBytes(args.tenantId, source.id);
  const noop = await move(transfers, args, source.id, [{ lineId: srcParent.lineId, revision: srcParent.revision, quantity: 1, toSessionId: source.id }], done.version, undefined, 'move-same');
  assert.equal(noop.version, done.version, 'same-source move is a no-op');
  assert.equal(await linesBytes(args.tenantId, source.id), stable, 'same-source move leaves lines byte-stable');
  // Zero-quantity and over-quantity moves are INVALID_INPUT (documented decision).
  await assertFails(move(transfers, args, source.id, [{ lineId: srcParent.lineId, revision: srcParent.revision, quantity: 0, toSessionId: dest.id }], done.version, undefined, 'move-zero'), 'INVALID_INPUT', 400);
  await assertFails(move(transfers, args, source.id, [{ lineId: srcParent.lineId, revision: srcParent.revision, quantity: 5, toSessionId: dest.id }], done.version, undefined, 'move-over'), 'INVALID_INPUT', 400);
});

test('move lines: version/state gates — stale source, revision mismatch, closed/frozen destination, cross-location, optional toExpectedVersion', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'move_lines_gates');
  await indexes();
  const args = await fixture();
  const transfers = require('../services/venue/transfers'); const linesService = require('../services/venue/lines');
  const bev = await beverage(args, { currentQuantity: 10 });
  await menuFor(args, [{ subProductId: bev.subProductId, sizeId: bev.sizeId, published: true }]);
  const source = await freshVisit(args, 'g-src'); const dest = await freshVisit(args, 'g-dest');
  const acc = await linesService.setSessionLines({ ...args, sessionId: source.id, expectedVersion: source.version, lines: [{ subProductId: bev.subProductId, sizeId: bev.sizeId, quantity: 3 }], idempotencyKey: 'g-accept' });
  const line = acc.lines[0];
  await assertFails(move(transfers, args, source.id, [{ lineId: line.lineId, revision: line.revision, quantity: 1, toSessionId: dest.id }], 0, undefined, 'g-stale'), 'STATE_CHANGED', 409);
  await assertFails(move(transfers, args, source.id, [{ lineId: '507f1f77bcf86cd799433011', revision: 1, quantity: 1, toSessionId: dest.id }], acc.version, undefined, 'g-missing'), 'NOT_FOUND', 404);
  await assertFails(move(transfers, args, source.id, [{ lineId: line.lineId, revision: line.revision + 5, quantity: 1, toSessionId: dest.id }], acc.version, undefined, 'g-rev'), 'STATE_CHANGED', 409);
  const farLocation = await require('../models/Warehouse').create({ _id: new mongoose.Types.ObjectId(), tenant: oid(args.tenantId), name: 'Far Bar', code: `FAR${Date.now()}`, venueServices: { enabled: true, reviewedAt: new Date(), canonicalCheckoutEnabled: true, capabilities: ['tables', 'tabs', 'preparation'] } });
  const farTable = await require('../models/POSTable').create({ tenant: oid(args.tenantId), location: farLocation._id, name: `Far-${Date.now()}` });
  const far = await require('../services/venue/service-sessions').ensureServiceSession({ ...args, locationId: String(farLocation._id), tableIds: [String(farTable._id)], expectedTableVersions: [0], idempotencyKey: `far-${Date.now()}` });
  await assertFails(move(transfers, args, source.id, [{ lineId: line.lineId, revision: line.revision, quantity: 1, toSessionId: far.id }], acc.version, undefined, 'g-far'), 'NOT_FOUND', 404);
  const closed = await freshVisit(args, 'g-closed');
  await SessionM().updateOne({ _id: closed.id }, { $set: { state: 'closed' } });
  await assertFails(move(transfers, args, source.id, [{ lineId: line.lineId, revision: line.revision, quantity: 1, toSessionId: closed.id }], acc.version, undefined, 'g-closed'), 'STATE_CHANGED', 409);
  const frozen = await freshVisit(args, 'g-frozen');
  await SessionM().updateOne({ _id: frozen.id }, { $set: { state: 'closing', billOrder: new mongoose.Types.ObjectId() } });
  await assertFails(move(transfers, args, source.id, [{ lineId: line.lineId, revision: line.revision, quantity: 1, toSessionId: frozen.id }], acc.version, undefined, 'g-frozen'), 'STATE_CHANGED', 409);
  await assertFails(move(transfers, args, source.id, [{ lineId: line.lineId, revision: line.revision, quantity: 1, toSessionId: dest.id, toExpectedVersion: 99 }], acc.version, undefined, 'g-destver'), 'STATE_CHANGED', 409);
  const moved = await move(transfers, args, source.id, [{ lineId: line.lineId, revision: line.revision, quantity: 1, toSessionId: dest.id, toExpectedVersion: dest.version }], acc.version, undefined, 'g-ok');
  assert.equal(moved.version, acc.version + 1, 'matching toExpectedVersion moves');
});

test('move lines: repricing consent both ways — differing context or derived price refuses without consent, destination context prices with consent', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'move_lines_reprice');
  await indexes();
  const args = await fixture();
  await enableTax(args);
  const transfers = require('../services/venue/transfers'); const linesService = require('../services/venue/lines');
  const bev = await beverage(args, { currentQuantity: 20 });
  await menuFor(args, [{ subProductId: bev.subProductId, sizeId: bev.sizeId, published: true }]);

  // (A) destination preset/service context differs → refusal without consent.
  const aSrc = await freshVisit(args, 'r-a-src'); const aDest = await freshVisit(args, 'r-a-dest');
  const aAcc = await linesService.setSessionLines({ ...args, sessionId: aSrc.id, expectedVersion: aSrc.version, lines: [{ subProductId: bev.subProductId, sizeId: bev.sizeId, quantity: 2 }], idempotencyKey: 'r-a-accept' });
  await SessionM().collection.updateOne({ _id: oid(aDest.id) }, { $set: { serviceMode: 'counter_pickup', presetRef: { presetId: new mongoose.Types.ObjectId(), version: 2 } } });
  await assertFails(move(transfers, args, aSrc.id, [{ lineId: aAcc.lines[0].lineId, revision: aAcc.lines[0].revision, quantity: 1, toSessionId: aDest.id }], aAcc.version, undefined, 'r-a-no'), 'REPRICING_CONSENT_REQUIRED', 409);
  const aDone = await move(transfers, args, aSrc.id, [{ lineId: aAcc.lines[0].lineId, revision: aAcc.lines[0].revision, quantity: 1, toSessionId: aDest.id }], aAcc.version, true, 'r-a-yes');
  assert.equal(aDone.version, aAcc.version + 1, 'consent unlocks the context-differing move');
  assert.equal((await visitDoc(args.tenantId, aDest.id)).acceptedLines[0].unitPriceMinor, 100000, 'priced from the destination context');

  // (B) same context but the source line carries a stale frozen price → the price
  // derivation differs → refusal without consent; consent prices at destination rules.
  const bSrc = await freshVisit(args, 'r-b-src'); const bDest = await freshVisit(args, 'r-b-dest');
  const bAcc = await linesService.setSessionLines({ ...args, sessionId: bSrc.id, expectedVersion: bSrc.version, lines: [{ subProductId: bev.subProductId, sizeId: bev.sizeId, quantity: 2 }], idempotencyKey: 'r-b-accept' });
  await SessionM().updateOne({ _id: bSrc.id, 'acceptedLines.lineId': bAcc.lines[0].lineId }, { $set: { 'acceptedLines.$.unitPriceMinor': 12345 } });
  const bLine = { lineId: bAcc.lines[0].lineId, revision: bAcc.lines[0].revision };
  await assertFails(move(transfers, args, bSrc.id, [{ ...bLine, quantity: 1, toSessionId: bDest.id }], bAcc.version, undefined, 'r-b-no'), 'REPRICING_CONSENT_REQUIRED', 409);
  await move(transfers, args, bSrc.id, [{ ...bLine, quantity: 1, toSessionId: bDest.id }], bAcc.version, true, 'r-b-yes');
  assert.equal((await visitDoc(args.tenantId, bDest.id)).acceptedLines[0].unitPriceMinor, 100000, 'destination price re-derived (not the stale frozen price)');

  // (C) destination shop resolves a scoped pricelist rule → destination units take
  // the DESTINATION derivation (70000), never the source's (100000).
  const cSrc = await freshVisit(args, 'r-c-src'); const cDest = await freshVisit(args, 'r-c-dest');
  await SessionM().collection.updateOne({ _id: oid(cDest.id) }, { $set: { posShopId: 'SHOP-B' } });
  await require('../models/Pricelist').create({ tenant: oid(args.tenantId), name: `Shop B ${Date.now()}`, shops: ['SHOP-B'], rules: [{ priceType: 'fixed', fixedPrice: 700, subProduct: oid(bev.subProductId), sequence: 1, minQuantity: 0 }] });
  const cAcc = await linesService.setSessionLines({ ...args, sessionId: cSrc.id, expectedVersion: cSrc.version, lines: [{ subProductId: bev.subProductId, sizeId: bev.sizeId, quantity: 2 }], idempotencyKey: 'r-c-accept' });
  await assertFails(move(transfers, args, cSrc.id, [{ lineId: cAcc.lines[0].lineId, revision: cAcc.lines[0].revision, quantity: 1, toSessionId: cDest.id }], cAcc.version, undefined, 'r-c-no'), 'REPRICING_CONSENT_REQUIRED', 409);
  await move(transfers, args, cSrc.id, [{ lineId: cAcc.lines[0].lineId, revision: cAcc.lines[0].revision, quantity: 1, toSessionId: cDest.id }], cAcc.version, true, 'r-c-yes');
  const cDoc = await visitDoc(args.tenantId, cDest.id);
  assert.equal(cDoc.acceptedLines[0].unitPriceMinor, 70000, 'destination-shop pricelist rule applied');
  assert.equal(cDoc.acceptedLines[0].taxMinor, 5250, 'totals recomputed on the destination derivation');
  assert.equal((await visitDoc(args.tenantId, cSrc.id)).acceptedLines[0].unitPriceMinor, 100000, 'source line keeps its own frozen price');
});

test('move lines: fired lines refuse (FIRED_LINES_LOCKED); payer-portion-allocated lines refuse (LINE_ALLOCATED); expired reservations do not block', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'move_lines_locks');
  await indexes();
  const args = await fixture();
  const transfers = require('../services/venue/transfers'); const linesService = require('../services/venue/lines');
  const bev = await beverage(args, { currentQuantity: 10, reservedQuantity: 0 });
  await menuFor(args, [{ subProductId: bev.subProductId, sizeId: bev.sizeId, published: true }]);
  const firedVisit = await freshVisit(args, 'l-fired'); const dest = await freshVisit(args, 'l-dest');
  const acc = await linesService.setSessionLines({ ...args, sessionId: firedVisit.id, expectedVersion: firedVisit.version, lines: [{ subProductId: bev.subProductId, sizeId: bev.sizeId, quantity: 2 }], idempotencyKey: 'l-accept' });
  await linesService.fireSessionRound({ ...args, sessionId: firedVisit.id, expectedVersion: acc.version, idempotencyKey: 'l-fire' });
  const firedDoc = await visitDoc(args.tenantId, firedVisit.id); const firedLine = firedDoc.acceptedLines[0];
  const destStable = await linesBytes(args.tenantId, dest.id);
  await assertFails(move(transfers, args, firedVisit.id, [{ lineId: firedLine.lineId, revision: firedLine.revision, quantity: 1, toSessionId: dest.id }], acc.version + 1, undefined, 'l-fired'), 'FIRED_LINES_LOCKED', 409);
  assert.equal(await linesBytes(args.tenantId, firedVisit.id), json(firedDoc.acceptedLines), 'fired refusal leaves the source byte-stable');
  assert.equal(await linesBytes(args.tenantId, dest.id), destStable, 'fired refusal leaves the destination byte-stable');

  // LINE_ALLOCATED — the minimal predicate (see transfers.js): an active-or-applied
  // VenuePayerPortion on the source visit whose acceptedLines reference the lineId.
  // Portions normally exist on frozen ('closing') bills; the visit here is open, so
  // the row is inserted directly (the release-test precedent with attempts) to pin
  // the predicate.
  const allocVisit = await freshVisit(args, 'l-alloc');
  const acc2 = await linesService.setSessionLines({ ...args, sessionId: allocVisit.id, expectedVersion: allocVisit.version, lines: [{ subProductId: bev.subProductId, sizeId: bev.sizeId, quantity: 2 }], idempotencyKey: 'l-accept2' });
  const line2 = acc2.lines[0];
  await require('../models/VenuePayerPortion').create({ tenant: oid(args.tenantId), location: oid(args.locationId), session: oid(allocVisit.id), billOrder: new mongoose.Types.ObjectId(), amountMinor: 100000, state: 'reserved', expiresAt: new Date(Date.now() + 60000), acceptedLines: [{ lineId: line2.lineId, revision: line2.revision }] });
  await assertFails(move(transfers, args, allocVisit.id, [{ lineId: line2.lineId, revision: line2.revision, quantity: 1, toSessionId: dest.id }], acc2.version, undefined, 'l-alloc'), 'LINE_ALLOCATED', 409);
  // An EXPIRED reservation promises nothing → the move proceeds.
  await require('../models/VenuePayerPortion').collection.updateMany({ session: oid(allocVisit.id) }, { $set: { expiresAt: new Date(Date.now() - 60000) } });
  const freed = await move(transfers, args, allocVisit.id, [{ lineId: line2.lineId, revision: line2.revision, quantity: 1, toSessionId: dest.id }], acc2.version, undefined, 'l-alloc-freed');
  assert.equal(freed.version, acc2.version + 1, 'expired reservation does not block');
});

test('move lines: BOTH-or-NEITHER — an induced pricing failure after partial validation persists neither visit', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'move_lines_atomic');
  await indexes();
  const args = await fixture();
  const transfers = require('../services/venue/transfers'); const linesService = require('../services/venue/lines');
  const bev = await beverage(args, { currentQuantity: 10 });
  await menuFor(args, [{ subProductId: bev.subProductId, sizeId: bev.sizeId, published: true }]);
  const source = await freshVisit(args, 't-src'); const dest = await freshVisit(args, 't-dest');
  const acc = await linesService.setSessionLines({ ...args, sessionId: source.id, expectedVersion: source.version, lines: [{ subProductId: bev.subProductId, sizeId: bev.sizeId, quantity: 3 }], idempotencyKey: 't-accept' });
  const line = acc.lines[0];
  const srcBefore = await linesBytes(args.tenantId, source.id); const destBefore = await linesBytes(args.tenantId, dest.id);
  const srcVersion = (await visitDoc(args.tenantId, source.id)).version; const destVersion = (await visitDoc(args.tenantId, dest.id)).version;
  const holdsBefore = (await require('../models/Order').find({ tenant: args.tenantId, venueServiceSession: { $in: [source.id, dest.id] } }).lean()).map(json);
  // Induced failure: the beverage leaves the published POS catalog AFTER acceptance
  // (S1 obligations survive; a MOVE must re-derive the destination price) —
  // priceVenueLines fails NOT_FOUND inside the transaction, after the source rows
  // and destination visit already validated.
  await require('../models/SubProduct').collection.updateOne({ _id: oid(bev.subProductId) }, { $set: { status: 'hidden' } });
  await assertFails(move(transfers, args, source.id, [{ lineId: line.lineId, revision: line.revision, quantity: 1, toSessionId: dest.id }], acc.version, undefined, 't-boom'), 'NOT_FOUND', 404);
  assert.equal(await linesBytes(args.tenantId, source.id), srcBefore, 'source lines byte-stable after the failure');
  assert.equal(await linesBytes(args.tenantId, dest.id), destBefore, 'destination lines byte-stable after the failure');
  assert.equal((await visitDoc(args.tenantId, source.id)).version, srcVersion, 'source version untouched');
  assert.equal((await visitDoc(args.tenantId, dest.id)).version, destVersion, 'destination version untouched');
  const holds = (await require('../models/Order').find({ tenant: args.tenantId, venueServiceSession: { $in: [source.id, dest.id] } }).lean()).map(json);
  assert.deepEqual(holds, holdsBefore, 'held tabs byte-stable after the failed move (neither side rebuilt)');
});

test('move-lines route: auth, eligibility action, Idempotency-Key, no-store', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'move_lines_http');
  await indexes();
  const args = await fixture();
  const linesService = require('../services/venue/lines');
  const bev = await beverage(args, { currentQuantity: 10 });
  await menuFor(args, [{ subProductId: bev.subProductId, sizeId: bev.sizeId, published: true }]);
  const source = await freshVisit(args, 'h-src'); const dest = await freshVisit(args, 'h-dest');
  const acc = await linesService.setSessionLines({ ...args, sessionId: source.id, expectedVersion: source.version, lines: [{ subProductId: bev.subProductId, sizeId: bev.sizeId, quantity: 2 }], idempotencyKey: 'h-accept' });
  const previous = { JWT_SECRET: process.env.JWT_SECRET };
  process.env.JWT_SECRET = 'move-lines-http-test-only';
  t.after(() => { for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  const express = require('express');
  const app = express(); app.use(express.json()); app.use('/api/venue-ops', require('../routes/venue-ops.routes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ code: error.code }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const root = `http://127.0.0.1:${server.address().port}/api/venue-ops`;
  const sign = actor => require('jsonwebtoken').sign({ userId: actor.userId }, process.env.JWT_SECRET);
  const headers = () => ({ Authorization: `Bearer ${sign(args.actor)}`, 'Content-Type': 'application/json', 'Idempotency-Key': `ml-${Date.now()}-${Math.random()}` });
  const url = `${root}/service-sessions/${source.id}/move-lines`;
  const body = { lines: [{ lineId: acc.lines[0].lineId, revision: acc.lines[0].revision, quantity: 1, toSessionId: dest.id }], expectedVersion: acc.version };
  assert.equal((await fetch(url, { method: 'POST' })).status, 401, 'no token → 401');
  const noKey = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${sign(args.actor)}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(noKey.status, 400); assert.equal((await noKey.json()).code, 'IDEMPOTENCY_KEY_REQUIRED');
  const ok = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  assert.equal(ok.status, 200); assert.equal(ok.headers.get('cache-control'), 'no-store');
  const dto = (await ok.json()).data;
  assert.equal(dto.version, acc.version + 1);
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: ['transfers.write'] } });
  const denied = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify({ ...body, expectedVersion: dto.version }) });
  assert.equal(denied.status, 403); assert.equal((await denied.json()).code, 'VENUE_PERMISSION_DENIED');
});
