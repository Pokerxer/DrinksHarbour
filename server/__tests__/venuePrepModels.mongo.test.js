'use strict';
// Task 1 (S3) — three additive preparation/preset collections: uniqueness bites,
// enums spill exactly as spec §2 lists them, tenancy scoping, and the session's
// additive fields (serviceMode/presetRef/courses/line.courseId) stay absent on
// legacy-shaped documents. Index readiness rides the audit-indexes extension.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture } = require('./helpers/venueMongo');
const dupCode = error => error && error.code === 11000;

test('prep collections enforce unique keys, enums, tenant scoping and legacy absence', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'prep_models');
  const args = await fixture();
  const tenant = new mongoose.Types.ObjectId(args.tenantId);
  const otherTenant = new mongoose.Types.ObjectId();
  const Preset = require('../models/VenueServicePreset');
  const Station = require('../models/PreparationStation');
  const Item = require('../models/VenuePreparationItem');
  await Promise.all([Preset, Station, Item].map(model => model.createIndexes()));
  const oid = () => new mongoose.Types.ObjectId();
  const actor = oid(), session = oid();

  // VenueServicePreset unique {tenant, location, name}
  const presetBase = { tenant, location: args.locationId, name: 'Dinner', allowedModes: ['dine-in'], paymentTiming: 'deferred', createdBy: actor };
  await Preset.create(presetBase);
  await assert.rejects(Preset.create(presetBase), dupCode);
  // same name at another location is a different preset (location-scoped, not tenant-global)
  await Preset.create({ ...presetBase, location: oid() });
  // allowedModes enum: delivery is forbidden in S3 (spec §2)
  await assert.rejects(Preset.create({ ...presetBase, name: 'Delivery', allowedModes: ['delivery'] }), /invalid|allowedmodes/i);
  // paymentTiming enum
  await assert.rejects(Preset.create({ ...presetBase, name: 'Pay', paymentTiming: 'on_receipt' }), /paymentTiming/i);
  // requiredGuestFields enum subset
  await assert.rejects(Preset.create({ ...presetBase, name: 'Guest', requiredGuestFields: ['email'] }), /invalid.*enum|guestfield/i);
  // cross-tenant rows never leak
  const clone = await Preset.create({ ...presetBase, tenant: otherTenant });
  assert.equal(await Preset.findOne({ _id: clone._id, tenant }).lean(), null);

  // PreparationStation unique {tenant, location, name}
  const stationBase = { tenant, location: args.locationId, name: 'Main bar', categories: ['beer'], staffIds: [String(actor)] };
  await Station.create(stationBase);
  await assert.rejects(Station.create(stationBase), dupCode);

  // VenuePreparationItem unique {tenant, lineId, revision}; state enum pending|preparing|ready|served
  const itemBase = { tenant, location: args.locationId, session, lineId: 'L1', revision: 1, roundId: oid(), stationId: oid(), firedAt: new Date(), actor };
  const item = await Item.create(itemBase);
  assert.equal(item.state, 'pending');
  assert.deepEqual(item.stateHistory, []);
  await assert.rejects(Item.create(itemBase), dupCode);
  await Item.create({ ...itemBase, lineId: 'L2' });
  await assert.rejects(Item.create({ ...itemBase, lineId: 'L3', state: 'cooked' }), /invalid.*state|preparation state/i);
  // served is a member of the semantic set
  await Item.create({ ...itemBase, lineId: 'L4', state: 'served' });

  // Declared indexes exist after createIndexes (readiness contract)
  const indexRows = async model => (await model.collection.listIndexes().toArray()).map(row => row.key);
  assert.ok((await indexRows(Preset)).find(row => row.tenant === 1 && row.location === 1 && row.name === 1));
  assert.ok((await indexRows(Station)).find(row => row.tenant === 1 && row.location === 1 && row.name === 1));
  assert.ok((await indexRows(Item)).find(row => row.tenant === 1 && row.lineId === 1 && row.revision === 1));

  // Readiness service (audit-indexes.js) agrees with the declared schema indexes
  const preview = await require('../services/venue/audit-indexes').previewPrepModelIndexes(mongoose.connection.db);
  assert.equal(preview.filter(row => row.missing.length).length, 0);
});

test('session additive S3 fields are absent on legacy-shaped documents', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'prep_models_legacy');
  const args = await fixture();
  const Session = require('../models/VenueServiceSession');
  const oid = () => new mongoose.Types.ObjectId();
  const legacy = { _id: oid(), tenant: new mongoose.Types.ObjectId(args.tenantId), location: new mongoose.Types.ObjectId(args.locationId), createdBy: oid(), businessDate: '2026-10-27', timezone: 'UTC', state: 'closed', openedAt: new Date(), acceptedLines: [{ lineId: 'L1', revision: 1, quantity: 1 }] };
  await Session.collection.insertOne({ ...legacy });
  const row = await Session.findOne({ tenant: args.tenantId }).lean();
  // additive fields never materialise with defaults on docs written before S3
  assert.equal(row.serviceMode, undefined);
  assert.equal(row.presetRef, undefined);
  assert.equal(row.courses, undefined);
  assert.equal(row.acceptedLines[0].courseId, undefined);
});
