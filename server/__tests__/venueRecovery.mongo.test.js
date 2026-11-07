'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { uri, connectVenueMongo, fixture } = require('./helpers/venueMongo');
test('crash_on_final_lease_moves_to_operator_review', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'recovery'); const args = await fixture();
  const Work = require('../models/VenueWorkItem');
  await Work.create({ tenant: args.tenantId, location: args.locationId, kind: 'project_invoice', targetId: args.tableIds[0], dedupeKey: 'crash', state: 'running', attempts: 8, leaseUntil: new Date(Date.now()-10000), nextRunAt: new Date(Date.now()-10000) });
  await require('../services/venue/recovery').recoverVenueWork();
  assert.equal((await Work.findOne({ dedupeKey: 'crash' }).lean()).state, 'needs_review');
});
