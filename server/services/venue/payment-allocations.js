'use strict';
const Allocation = require('../../models/VenuePaymentAllocation'); const Receipt = require('../../models/VenuePaymentReceipt');
const { fail, requireId } = require('./errors'); const { validateKey } = require('./operations'); const { id } = require('./eligibility');
function validateAllocationDraft(draft) {
  const keys = ['tenantId', 'locationId', 'sessionId', 'billOrderId', 'receiptId', 'purpose', 'currency', 'amountMinor', 'idempotencyKey'];
  if (!draft || Object.keys(draft).some(key => !keys.includes(key))) fail('INVALID_ALLOCATION', 'Unknown allocation fields', 400);
  for (const key of keys.slice(0, 5)) requireId(draft[key]);
  validateKey(draft.idempotencyKey);
  if (draft.purpose !== 'venue_bill' || draft.currency !== 'NGN' || !Number.isSafeInteger(draft.amountMinor) || draft.amountMinor <= 0) fail('INVALID_ALLOCATION', 'Invalid amount, purpose or currency', 400);
  return { ...draft };
}
async function applyVerifiedReceipt({ tenantId, receiptId, bill, mongoSession }) {
  const receipt = await Receipt.findOne({ _id: receiptId, tenant: tenantId, billOrder: bill._id, session: bill.venueServiceSession, state: { $in: ['verified', 'applied'] } }).session(mongoSession);
  if (!receipt) fail('PAYMENT_REVIEW_REQUIRED', 'Verified receipt not found');
  const previous = await Allocation.findOne({ tenant: tenantId, billOrder: bill._id }).session(mongoSession);
  if (previous) { if (id(previous.receipt) !== receiptId) fail('BILL_ALREADY_PAID'); return previous; }
  const amountMinor = bill.venueBillSnapshot.totalMinor;
  if (receipt.currency !== 'NGN' || receipt.amountMinor !== amountMinor || receipt.appliedMinor !== 0 || bill.paymentStatus === 'paid') fail('PAYMENT_REVIEW_REQUIRED', 'Receipt does not cover the outstanding bill');
  const [allocation] = await Allocation.create([{ tenant: tenantId, location: receipt.location, session: receipt.session, billOrder: bill._id, receipt: receipt._id,
    amountMinor, currency: 'NGN', key: `full:${id(receipt)}`, appliedAt: new Date(), termsVersion: bill.venueBillSnapshot.termsVersion, rateBps: bill.venueBillSnapshot.rateBps }], { session: mongoSession });
  receipt.appliedMinor = amountMinor; receipt.state = 'applied'; await receipt.save({ session: mongoSession });
  return allocation;
}
module.exports = { validateAllocationDraft, applyVerifiedReceipt };
