'use strict';
const crypto = require('node:crypto'); const Work = require('../../models/VenueWorkItem');
function recoveryDelay(attempts) { return Math.min(900000, 30000 * 2 ** Math.max(0, attempts - 1)); }
function recoveryFailureState(attempts) { return attempts >= 8 ? 'needs_review' : 'pending'; }
async function recoverVenueWork({ now = new Date(), limit = 50 } = {}) {
  await Work.updateMany({ attempts: { $gte: 8 }, state: 'running', leaseUntil: { $lte: now } }, { $set: { state: 'needs_review', leaseUntil: null, lastErrorCode: 'LEASE_EXHAUSTED' } });
  const stats = { processed: 0, done: 0, pending: 0, review: 0 };
  for (let n = 0; n < Math.min(50, Math.max(0, limit)); n++) {
    const token = crypto.randomUUID();
    const work = await Work.findOneAndUpdate({ nextRunAt: { $lte: now }, attempts: { $lt: 8 }, $or: [{ state: 'pending' }, { state: 'running', leaseUntil: { $lte: now } }] },
      { $set: { state: 'running', leaseUntil: new Date(now.getTime() + 60000), leaseToken: token }, $inc: { attempts: 1 } }, { new: true, sort: { nextRunAt: 1 } });
    if (!work) break;
    stats.processed++;
    try {
      if (work.kind === 'verify_payment') {
        const attempt = await require('../../models/VenuePaymentAttempt').findOne({ _id: work.targetId, tenant: work.tenant }).lean();
        if (!attempt) throw Object.assign(new Error('Attempt missing'), { code: 'NOT_FOUND' });
        await require('./collections').verifyVenuePayment({ reference: attempt.reference });
      } else if (work.kind === 'post_advance') await require('./advance-accounting').postAdvance(String(work.targetId), String(work.tenant));
      else if (work.kind === 'money_resolution') throw Object.assign(new Error('Paid obligation requires operator review'), { code: 'PAID_NEEDS_RESOLUTION' });
      else if (work.kind === 'cost_resolution') throw Object.assign(new Error('Original cost sources require manager review'), { code: 'COST_REVIEW_REQUIRED' });
      else if (work.kind === 'settle_bill') await require('./settlement').settleVenueBill({ tenantId: String(work.tenant), receiptId: String(work.targetId) });
      else {
        const bill = await require('../../models/Order').findOne({ _id: work.targetId, tenant: work.tenant, venueSettlementState: 'settled' });
        if (!bill) throw Object.assign(new Error('Bill pending'), { code: 'BILL_NOT_SETTLED' });
        const invoice = await require('../customerInvoice/sync').syncSource({ tenantId: work.tenant, source: 'pos', sourceId: bill._id });
        if (!invoice || invoice.state === 'needs_review') throw Object.assign(new Error('Invoice needs review'), { code: 'INVOICE_REVIEW_REQUIRED' });
      }
      await Work.updateOne({ _id: work._id, leaseToken: token }, { $set: { state: 'done', leaseUntil: null } }); stats.done++;
    } catch (error) {
      const state = ['money_resolution','cost_resolution'].includes(work.kind) ? 'needs_review' : recoveryFailureState(work.attempts);
      await Work.updateOne({ _id: work._id, leaseToken: token }, { $set: { state, leaseUntil: null, nextRunAt: new Date(now.getTime() + recoveryDelay(work.attempts)), lastErrorCode: typeof error.code === 'string' && /^[A-Z_]+$/.test(error.code) ? error.code : 'VENUE_RECOVERY_FAILED' } });
      state === 'needs_review' ? stats.review++ : stats.pending++;
    }
  }
  return stats;
}
module.exports = { recoverVenueWork, recoveryDelay, recoveryFailureState };
