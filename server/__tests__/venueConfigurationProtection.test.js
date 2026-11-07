'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
for (const operation of ['createWarehouse', 'updateWarehouse']) test(`${operation}_cannot_self_grant_reviewed_venue_configuration`, async t => {
  let writes = 0;
  const Warehouse = require('../models/Warehouse');
  t.mock.method(Warehouse, 'create', async value => { writes++; return value; });
  t.mock.method(Warehouse, 'findOneAndUpdate', async () => { writes++; return {}; });
  const service = require('../services/warehouse.service');
  for (const data of [{ code: 'BAR', venueServices: { reviewedAt: new Date(), canonicalCheckoutEnabled: true } }, { code: 'BAR', 'venueServices.enabled': true }, { code: 'BAR', venueStaff: ['user'] }, { code: 'BAR', venueMappingFingerprint: 'pretend-reviewed' }]) {
    await assert.rejects(operation === 'createWarehouse' ? service[operation](data, 'user', 'tenant') : service[operation]('location', data, 'tenant'), /reviewed venue/i);
  }
  assert.equal(writes, 0);
});
