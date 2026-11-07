'use strict';
const mongoose = require('mongoose'); const { fail } = require('./errors');
async function assertDrawerReconciled({ tenantId, drawerId, mongoSession = null }) {
  const open = await require('../../models/VenueServiceSession').exists({ tenant: tenantId, posSessionId: drawerId, state: { $ne: 'closed' } }).session(mongoSession);
  const pending = await require('../../models/Order').exists({ tenant: tenantId, posSessionId: drawerId, venueBillForSession: { $type: 'objectId' }, venueSettlementState: { $ne: 'settled' } }).session(mongoSession);
  if (open || pending) fail('VENUE_DRAWER_UNRESOLVED', 'Settle and reconcile existing venue visits before closing this drawer');
}
async function claimDrawerClose({ tenantId, drawerId, actorId, scope }) {
  const session = await mongoose.startSession();
  try { return await session.withTransaction(async () => {
    const filter = { _id: drawerId, ...scope, tenant: tenantId, status: 'open' };
    const drawer = await require('../../models/POSSession').findOne(filter).session(session);
    if (!drawer) return null;
    await assertDrawerReconciled({ tenantId, drawerId, mongoSession: session });
    return require('../../models/POSSession').findOneAndUpdate(filter, { $set: { status: 'closed', closedBy: actorId, closedAt: new Date() }, $inc: { __v: 1 } }, { new: false, session });
  }); } finally { await session.endSession(); }
}
module.exports = { assertDrawerReconciled, claimDrawerClose };
