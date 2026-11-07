'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');
const Session = require('../models/VenueServiceSession');
const lines = require('../services/venue/lines');
const oid = value => new mongoose.Types.ObjectId(value);
async function setup(t, suffix) {
  await connectVenueMongo(t, suffix);
  const args = await fixture();
  const sessions = require('../services/venue/service-sessions');
  await sessions.ensureIndexes();
  const item = { ...await beverage(args), quantity: 2 };
  const open = async key => {
    const table = await require('../models/POSTable').create({ tenant: args.tenantId, location: args.locationId, name: key });
    return sessions.ensureServiceSession({ ...args, tableIds: [String(table._id)], expectedTableVersions: [0], idempotencyKey: key });
  };
  const source = await open('source'), dest = await open('dest');
  const accepted = await lines.setSessionLines({ ...args, sessionId: source.id, expectedVersion: source.version, lines: [item], idempotencyKey: 'accept' });
  const metadata = { servingSnapshot: { sizeId: item.sizeId, servingVersion: 1, code: 'plate', displayName: 'Plate', mode: 'made_to_order', saleUnit: 'plate' },
    menuConfigVersion: 1, menuItemId: 'menu', categoryId: 'category', acceptedRecipeVersionId: new mongoose.Types.ObjectId(),
    choices: [{ groupId: 'cooking:style', optionId: 'well', quantity: 2 }], choiceKey: 'c:cooking:style:well:2',
    choiceSnapshots: [{ groupId: 'cooking:style', optionId: 'well', quantity: 2, label: 'Well done', type: 'instruction', unitPriceMinor: 0 }] };
  await Session.collection.updateOne({ _id: oid(source.id) }, { $set: Object.fromEntries(Object.entries(metadata).map(([key, value]) => [`acceptedLines.0.${key}`, value])) });
  return { args, item, source, dest, accepted, metadata };
}
test('selected line move preserves accepted v2 snapshots and quantities in visit and held tab', async t => {
  const { args, source, dest, accepted, metadata } = await setup(t, 'transfer_snapshots');
  await require('../services/venue/move-lines').moveLines({ ...args, sessionId: source.id, expectedVersion: accepted.version,
    lines: [{ lineId: accepted.lines[0].lineId, revision: 1, quantity: 1, toSessionId: dest.id }], idempotencyKey: 'move' });
  const moved = await Session.findById(dest.id).lean();
  assert.deepEqual(moved.acceptedLines[0].servingSnapshot, metadata.servingSnapshot);
  assert.equal(String(moved.acceptedLines[0].acceptedRecipeVersionId), String(metadata.acceptedRecipeVersionId));
  assert.deepEqual(moved.acceptedLines[0].choiceSnapshots, metadata.choiceSnapshots);
  assert.deepEqual(moved.acceptedLines[0].choices.map(({ groupId, optionId, quantity }) => ({ groupId, optionId, quantity })), metadata.choices);
  const held = await require('../models/Order').findById(moved.heldOrder).lean();
  assert.equal(held.holdMetadata.cartItems[0].choices[0].quantity, 2);
});
test('party consolidation keeps distinct accepted serving versions as separate rows', async t => {
  const { args, source, dest, accepted, metadata } = await setup(t, 'party_snapshots');
  const src = await Session.findById(source.id).lean();
  await Session.collection.updateOne({ _id: oid(dest.id) }, { $set: { acceptedLines: [{ ...src.acceptedLines[0],
    lineId: 'dest-line', servingSnapshot: { ...metadata.servingSnapshot, servingVersion: 2 } }] } });
  const result = await require('../services/venue/parties').consolidate({ ...args, sessionId: source.id,
    intoSessionId: dest.id, expectedVersion: accepted.version, idempotencyKey: 'consolidate' });
  assert.equal(result.lines.length, 2);
  assert.deepEqual(result.lines.map(row => row.servingSnapshot.servingVersion).sort(), [1, 2]);
  const held = await require('../models/Order').findById((await Session.findById(dest.id)).heldOrder).lean();
  assert.ok(held.holdMetadata.cartItems.every(row => row.choices[0].quantity === 2));
});
test('moving a v2 priced-addon parent fails closed without an owned addon grouping', async t => {
  const { args, source, dest, accepted } = await setup(t, 'transfer_addon_guard');
  await Session.collection.updateOne({ _id: oid(source.id) }, { $set: { 'acceptedLines.0.choiceSnapshots.0.type': 'addon' } });
  await assert.rejects(require('../services/venue/move-lines').moveLines({ ...args, sessionId: source.id,
    expectedVersion: accepted.version, lines: [{ lineId: accepted.lines[0].lineId, revision: 1, quantity: 1, toSessionId: dest.id }],
    idempotencyKey: 'unsafe-parent' }), { code: 'VENUE_UNSUPPORTED_CART' });
  assert.equal((await Session.findById(source.id)).acceptedLines[0].quantity, 2);
  assert.equal((await Session.findById(dest.id)).acceptedLines.length, 0);
});
test('party consolidation rejects a stale owner actor after persisted role demotion', async t => {
  const { args, source, dest, accepted } = await setup(t, 'party_fresh_role');
  await require('../models/User').collection.updateOne({ _id: oid(args.actor.userId) },
    { $set: { role: 'tenant_staff', posPermissions: ['pos:sell'] } });
  await assert.rejects(require('../services/venue/parties').consolidate({ ...args, sessionId: source.id,
    intoSessionId: dest.id, expectedVersion: accepted.version, idempotencyKey: 'stale-manager' }),
  { code: 'VENUE_PERMISSION_DENIED' });
  assert.equal((await Session.findById(source.id)).state, 'open');
});
test('party consolidation appends incoming units instead of extending a fired survivor revision', async t => {
  const { args, source, dest, accepted } = await setup(t, 'party_fired_survivor');
  const src = await Session.findById(source.id).lean();
  await Session.collection.updateOne({ _id: oid(dest.id) }, { $set: { acceptedLines: [{ ...src.acceptedLines[0], lineId: 'fired-dest', firedQuantity: 1 }] } });
  const result = await require('../services/venue/parties').consolidate({ ...args, sessionId: source.id,
    intoSessionId: dest.id, expectedVersion: accepted.version, idempotencyKey: 'fired-survivor' });
  assert.equal(result.lines.length, 2);
  assert.equal(result.lines.find(row => row.lineId === 'fired-dest').quantity, 2);
  assert.equal(result.lines.find(row => row.lineId === 'fired-dest').firedQuantity, 1);
});
test('moving an independently selected priced-addon row fails closed without parent ownership', async t => {
  const { args, source, dest, accepted } = await setup(t, 'transfer_addon_child_guard');
  const extra = await beverage(args);
  const sub = await require('../models/SubProduct').findById(extra.subProductId).lean();
  const addon = require('../services/venue/pricing').priceAcceptedLine({ sp: sub,
    size: await require('../models/Size').findById(extra.sizeId).lean(), tenant: {}, actor: {}, input: { quantity: 2 } });
  await Session.collection.updateOne({ _id: oid(source.id) }, { $set: {
    'acceptedLines.0.choiceSnapshots.0.type': 'addon',
    'acceptedLines.0.choiceSnapshots.0.subProductId': extra.subProductId,
    'acceptedLines.0.choiceSnapshots.0.sizeId': extra.sizeId,
  } });
  await Session.collection.updateOne({ _id: oid(source.id) }, { $push: { acceptedLines: addon } });
  await assert.rejects(require('../services/venue/move-lines').moveLines({ ...args, sessionId: source.id,
    expectedVersion: accepted.version, lines: [{ lineId: addon.lineId, revision: 1, quantity: 1, toSessionId: dest.id }],
    idempotencyKey: 'unsafe-child' }), { code: 'VENUE_UNSUPPORTED_CART' });
});
