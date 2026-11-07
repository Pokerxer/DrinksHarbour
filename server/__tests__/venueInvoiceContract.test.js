'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { eligible } = require('../services/customerInvoice/snapshot');
test('settled_canonical_booking_bill_can_project_one_invoice', () => {
  const bill = { source: 'manual', venueIdentityVersion: 1, venueBillForSession: 'visit', venueSettlementState: 'settled', tableServiceBooking: 'booking', status: 'delivered', paymentStatus: 'paid' };
  assert.equal(eligible('pos', bill), true);
  assert.equal(eligible('pos', { ...bill, venueSettlementState: 'receipt_verified' }), false);
  assert.equal(eligible('pos', { ...bill, venueIdentityVersion: 0 }), false);
});
