'use strict';
const { sum } = require('./money-rules');
const activePortions = (now = new Date()) => ({ $or: [{ state: 'pending' }, { state: 'reserved', expiresAt: { $gt: now } }] });
async function balanceFor(bill, mongoSession = null) {
  const scope = { tenant: bill.tenant, billOrder: bill._id };
  const allocations = await require('../../models/VenuePaymentAllocation').find(scope).session(mongoSession).lean();
  const portions = await require('../../models/VenuePayerPortion').find({ ...scope, ...activePortions() }).session(mongoSession).lean();
  const allocatedMinor = sum(...allocations.map(a => a.amountMinor)), reservedMinor = sum(...portions.map(p => p.amountMinor));
  return { allocatedMinor, reservedMinor, outstandingMinor: bill.venueBillSnapshot.totalMinor - allocatedMinor, availableMinor: bill.venueBillSnapshot.totalMinor - allocatedMinor - reservedMinor };
}
module.exports = { activePortions, balanceFor };
