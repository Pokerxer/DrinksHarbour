'use strict';
const Receipt = require('../../models/VenuePaymentReceipt');
const { fail } = require('./errors'); const { id } = require('./eligibility');
async function linkAtArrival({ booking, visit, mongoSession }) {
  if (!booking) return;
  const receipts = await Receipt.find({ tenant: booking.tenant, booking: booking._id, purpose: 'venue_deposit' }).session(mongoSession);
  for (const receipt of receipts) {
    if (id(receipt.location) !== id(visit.location) || id(receipt.payer) !== id(booking.createdBy) || receipt.session && id(receipt.session) !== id(visit)) fail('PAYMENT_REVIEW_REQUIRED', 'Advance association requires review');
    receipt.session = visit._id; await receipt.save({ session: mongoSession });
  }
}
async function applyAtFreeze({ bill, visit, mongoSession }) {
  if (!visit.booking) return;
  const booking = await require('../../models/Booking').findOne({ _id: visit.booking, tenant: visit.tenant, location: visit.location, serviceSession: visit._id }).session(mongoSession).lean();
  if (!booking?.financialPolicy) return;
  const policy = require('./financial-policy').validatePolicy(booking.financialPolicy);
  const receipts = await Receipt.find({ tenant: visit.tenant, booking: booking._id, session: visit._id, purpose: 'venue_deposit', collectionVersion: 2, resolution: 'none', state: 'verified' }).sort({ _id: 1 }).session(mongoSession);
  if (!receipts.length) return;
  await require('./financial-policy').moneyIndexesReady();
  bill.venueMoneyVersion = 2; bill.venueFinancialPolicy = policy; await bill.save({ session: mongoSession });
  for (const receipt of receipts) {
    receipt.billOrder = bill._id; await receipt.save({ session: mongoSession });
    await require('./multiple-allocations').applyReceipt({ tenantId: id(visit.tenant), receiptId: id(receipt), bill, mongoSession });
    await require('./collections').enqueue({ tenant: visit.tenant, location: visit.location, kind: 'settle_bill', targetId: receipt._id, mongoSession });
  }
}
module.exports = { linkAtArrival, applyAtFreeze };
