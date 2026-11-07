'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVenueFoundationReport } = require('../services/venue/legacy-audit');
const fixture = () => ({
  tenant: { _id: 'tenant', plan: 'venue', subscriptionStatus: 'active', status: 'approved', posSettings: { isBarRestaurant: true } },
  warehouses: [{ _id: 'a', tenant: 'tenant', isActive: true }, { _id: 'b', tenant: 'tenant', isActive: true }],
  bookings: [{ _id: 'booking', tenant: 'tenant', status: 'checked_in', guest: { name: 'Secret', phone: '080SECRET', email: 'secret@example.test' } }],
  tables: [], orders: [], posSessions: [], approvedMappings: [],
});
test('classifies_ambiguous_location', () => {
  const report = buildVenueFoundationReport(fixture());
  assert.equal(report.locationFindings[0].reason, 'needs_review');
  assert.equal(report.locationFindings[0].locationId, null);
});
test('does_not_match_name_or_time', () => {
  const input = fixture();
  input.orders.push({ _id: 'hold', tenant: 'tenant', status: 'hold', holdMetadata: { customer: input.bookings[0].guest } });
  const report = buildVenueFoundationReport(input);
  assert.equal(report.visitCandidates[0].classification, 'needs_review');
  assert.equal(report.visitCandidates[0].heldOrderId, null);
});
test('identifies_booking_bill_and_tab_conflict', () => {
  const input = fixture();
  input.orders = ['bill1', 'bill2'].map(_id => ({ _id, tenant: 'tenant', tableServiceBooking: 'booking', paymentStatus: 'pending' }));
  const report = buildVenueFoundationReport(input);
  assert.equal(report.visitCandidates[0].classification, 'blocked_conflict');
  assert.equal(report.duplicateKeys[0].kind, 'booking_bill');
  assert.ok(report.blockers.includes('DUPLICATE_BILL'));
});
test('report_omits_guest_and_payment_secrets', () => {
  const input = fixture();
  input.orders = [{ _id: 'bill', tenant: 'tenant', tableServiceBooking: 'booking', paymentStatus: 'pending', paymentReference: 'SECRET_REFERENCE' }];
  const result = JSON.stringify(buildVenueFoundationReport(input));
  for (const secret of ['Secret', '080SECRET', 'secret@example.test', 'SECRET_REFERENCE']) assert.equal(result.includes(secret), false);
  assert.deepEqual(input.bookings[0].guest, { name: 'Secret', phone: '080SECRET', email: 'secret@example.test' });
});
