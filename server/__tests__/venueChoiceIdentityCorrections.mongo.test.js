'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');
test('historical separator-bearing accepted choices retain their fired line identity', async t => {
  await connectVenueMongo(t, 'choice_identity_correction');
  const args = await fixture();
  const sessions = require('../services/venue/service-sessions');
  await sessions.ensureIndexes();
  const visit = await sessions.ensureServiceSession({ ...args, idempotencyKey: 'open' });
  const item = await beverage(args);
  const size = new mongoose.Types.ObjectId(item.sizeId);
  await require('../models/Size').collection.updateOne({ _id: size }, { $set: {
    servingSchemaVersion: 2, size: 'venue_serving', displayName: 'Plate',
    venueServing: { code: 'plate', mode: 'sealed', saleUnit: 'plate', channels: ['venue'], version: 0 },
  } });
  const groupId = 'cooking:style', optionId = 'well';
  await require('../models/VenueLocationProfile').collection.insertOne({
    tenant: new mongoose.Types.ObjectId(args.tenantId), location: new mongoose.Types.ObjectId(args.locationId), version: 1,
    menu: { schemaVersion: 2, sections: [{ id: 'section', name: 'Dinner', items: [{
      subProductId: item.subProductId, sizeId: item.sizeId, published: true,
      servingVersion: 0, modifierSchemaVersion: 2,
      modifierGroups: [{ id: groupId, name: 'Cooking', required: true,
        options: [{ id: optionId, label: 'Well done', type: 'instruction' }] }],
    }] }] },
  });
  const lines = require('../services/venue/lines');
  const input = { ...item, quantity: 1, servingVersion: 0, choices: [{ groupId, optionId, quantity: 1 }] };
  const accepted = await lines.setSessionLines({ ...args, sessionId: visit.id, expectedVersion: visit.version, lines: [input], idempotencyKey: 'accept' });
  await require('../models/VenueServiceSession').collection.updateOne({ _id: new mongoose.Types.ObjectId(visit.id) }, { $set: {
    'acceptedLines.0.choiceKey': 'c:cooking:style:well:1', 'acceptedLines.0.firedQuantity': 1,
  } });
  const retained = await lines.setSessionLines({ ...args, sessionId: visit.id, expectedVersion: accepted.version, lines: [input], idempotencyKey: 'retain' });
  assert.equal(retained.lines.length, 1);
  assert.equal(retained.lines[0].lineId, accepted.lines[0].lineId);
  assert.equal(retained.lines[0].revision, accepted.lines[0].revision);
  assert.equal(retained.lines[0].firedQuantity, 1);
});
