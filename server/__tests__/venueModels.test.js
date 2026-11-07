'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const oid = () => new mongoose.Types.ObjectId();
test('new_location_configuration_defaults_to_reviewed_rollout_off', () => {
  const Warehouse = require('../models/Warehouse');
  const row = new Warehouse({ tenant: oid(), name: 'Bar', code: 'BAR' });
  assert.equal(row.venueServices.canonicalCheckoutEnabled, false);
  assert.equal(row.venueServices.reviewedAt, null);
  assert.deepEqual([...row.venueStaff], []);
});
test('legacy_documents_do_not_gain_visit_or_location_authority', () => {
  const Booking = require('../models/Booking');
  const Table = require('../models/POSTable');
  assert.equal(new Booking().venueIdentityVersion, 0);
  assert.equal(new Table().location, null);
  assert.equal(new Table().venueVersion, 0);
});
test('invalid_location_clock_settings_are_rejected', () => {
  const Warehouse = require('../models/Warehouse');
  const row = new Warehouse({ tenant: oid(), name: 'Bar', code: 'BAR', venueServices: { timezone: 'Made/Up', businessDayStartMinutes: 1440 } });
  assert.ok(row.validateSync());
});
