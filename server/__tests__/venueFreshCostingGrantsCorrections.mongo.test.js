'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { connectVenueMongo, fixture } = require('./helpers/venueMongo');
test('new costing grants require persisted permission even for legacy owner records', async t => {
  await connectVenueMongo(t, 'fresh_costing_grant');
  const args = await fixture();
  const { loadVenueContext } = require('../services/venue/context');
  const actor = { ...args.actor, permissions: ['pos:sell', 'venue:profitability_read'] };
  await assert.rejects(loadVenueContext({ ...args, actor, action: 'profitability.read' }),
    { code: 'VENUE_PERMISSION_DENIED' });
});
