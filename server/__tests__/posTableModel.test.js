const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const POSTable = require('../models/POSTable');
const oid = () => new mongoose.Types.ObjectId();

test('defaults a new table to available in Main with 4 seats', () => {
  const t = new POSTable({ tenant: oid(), name: 'T1' }).toObject();
  assert.equal(t.status, 'available');
  assert.equal(t.section, 'Main');
  assert.equal(t.seats, 4);
  assert.equal(t.sortOrder, 0);
  assert.equal(t.currentTabId, null);
});

test('rejects a status outside the enum', () => {
  const t = new POSTable({ tenant: oid(), name: 'T2', status: 'broken' });
  const err = t.validateSync();
  assert.ok(err, 'expected validateSync to return a ValidationError');
  assert.equal(err.name, 'ValidationError');
  assert.match(err.errors.status.message, /not a valid enum value/i);
});
