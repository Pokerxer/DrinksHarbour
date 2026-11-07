'use strict';
const mongoose = require('mongoose');
const Receipt = require('../../models/VenuePaymentReceipt'); const Order = require('../../models/Order');
const Session = require('../../models/VenueServiceSession'); const Attempt = require('../../models/VenuePaymentAttempt');
const { applyVerifiedReceipt } = require('./payment-allocations'); const { consumeBillStock } = require('./inventory');
const { postVenueAccounting } = require('./accounting'); const { billDTO } = require('./billing');
const { fail, requireId } = require('./errors'); const { id } = require('./eligibility');
async function settleVenueBill({ tenantId, receiptId, actor }) {
  requireId(tenantId); requireId(receiptId);
  const mongoSession = await mongoose.startSession();
  try {
    return await mongoSession.withTransaction(async () => {
      const receipt = await Receipt.findOne({ _id: receiptId, tenant: tenantId, state: { $in: ['verified', 'applied'] } }).session(mongoSession);
      if (!receipt) fail('NOT_FOUND', 'Verified payment receipt not found', 404);
      const bill = await Order.findOne({ _id: receipt.billOrder, tenant: tenantId, venueBillForSession: receipt.session }).session(mongoSession);
      const visit = await Session.findOne({ _id: receipt.session, tenant: tenantId, location: receipt.location, billOrder: receipt.billOrder }).session(mongoSession);
      if (!bill || !visit) fail('BILL_LINK_CONFLICT', 'Bill and visit need reconciliation');
      if (bill.venueSettlementState === 'settled' && receipt.state === 'applied') return billDTO(bill, visit);
      if (bill.venueMoneyVersion === 2 && receipt.state === 'applied' && bill.venueAppliedMinor < bill.venueBillSnapshot.totalMinor) return billDTO(bill, visit);
      const tenant=await require('../../models/Tenant').findOne({_id:tenantId,status:'approved',isActive:{$ne:false}}).session(mongoSession).lean();
      if(!tenant)fail('VENUE_DISABLED','Settlement is unavailable while the tenant is disabled');
      let multiple;
      if (bill.venueMoneyVersion === 2) {
        multiple = await require('./multiple-allocations').applyReceipt({ tenantId, receiptId, bill, mongoSession });
        if (multiple.outstandingMinor > 0 || bill.venueSettlementState === 'settled') {
          if (bill.venueSettlementState !== 'settled') { bill.venueSettlementState = 'unpaid'; await bill.save({ session: mongoSession }); visit.version++; await visit.save({ session: mongoSession }); }
          return billDTO(bill, visit);
        }
      }
      if (bill.status === 'cancelled' || bill.venueStockState !== 'reserved') fail('PAYMENT_REVIEW_REQUIRED', 'Cancelled or released bill cannot settle automatically');
      const allocation = multiple || await applyVerifiedReceipt({ tenantId, receiptId, bill, mongoSession });
      await consumeBillStock({ tenantId, billOrder: bill, actor: actor || { userId: visit.createdBy }, mongoSession });
      await postVenueAccounting({ bill, receipt, allocation, mongoSession });
      const Table = require('../../models/POSTable');
      for (const tableId of visit.tableIds) {
        const changed = await Table.updateOne({ _id: tableId, tenant: tenantId, location: visit.location, currentTabId: visit.heldOrder }, { $set: { currentTabId: null, status: 'available' }, $inc: { venueVersion: 1 } }, { session: mongoSession });
        if (!changed.modifiedCount) fail('TABLE_REVIEW_REQUIRED', 'Table ownership changed; do not free another visit');
      }
      const hold = await Order.findOne({ _id: visit.heldOrder, tenant: tenantId, venueServiceSession: visit._id, status: 'hold' }).session(mongoSession);
      if (!hold) fail('VISIT_LINK_CONFLICT', 'Held tab needs review');
      hold.status = 'cancelled'; hold.paymentStatus = 'failed'; hold.cancelReason = `Venue tab settled via ${id(bill)}`; hold.$locals.deferAccounting = true; await hold.save({ session: mongoSession });
      bill.paymentStatus = 'paid'; bill.status = 'delivered'; bill.paidAt = receipt.paidAt || receipt.verifiedAt; bill.deliveredAt = new Date(); bill.shippedAt = bill.deliveredAt;
      bill.paymentMethod = receipt.provider === 'cash' ? 'cash' : 'card'; bill.paymentReference = receipt.reference;
      bill.paymentDetails = { reference: receipt.reference, paidAt: bill.paidAt.toISOString(), channel: receipt.provider };
      if(bill.venueMoneyVersion===2){
        const allocations=await require('../../models/VenuePaymentAllocation').find({tenant:tenantId,billOrder:bill._id,collectionVersion:2}).session(mongoSession).lean();
        const receipts=await Receipt.find({tenant:tenantId,_id:{$in:allocations.map(a=>a.receipt)}}).session(mongoSession).lean();
        const tenders={};for(const a of allocations){const source=receipts.find(r=>id(r)===id(a.receipt));if(!source)fail('PAYMENT_REVIEW_REQUIRED');const method=source.provider==='cash'?'cash':'card';tenders[method]=(tenders[method]||0)+a.amountMinor;}
        bill.paymentMethod=Object.keys(tenders).length>1?'split':Object.keys(tenders)[0];bill.paymentDetails.splitPayments=Object.entries(tenders).map(([method,minor])=>({method,amount:minor/100}));
      }
      bill.venueStockState = 'consumed'; bill.venueSettlementState = 'settled'; bill.accountingStatus = 'posted'; if (visit.booking) bill.tableAccountingStatus = 'posted';
      bill.$locals.deferAccounting = true; await bill.save({ session: mongoSession });
      visit.state = 'closed'; visit.closedAt = new Date(); visit.version++; await visit.save({ session: mongoSession });
      if (visit.booking) {
        const booking = await require('../../models/Booking').updateOne({ _id: visit.booking, tenant: tenantId, serviceSession: visit._id, status: 'checked_in' }, { $set: { status: 'completed' }, $inc: { __v: 1 } }, { session: mongoSession });
        if (!booking.modifiedCount) fail('VISIT_LINK_CONFLICT', 'Booking changed during settlement');
      }
      await Attempt.updateOne({ _id: receipt.attempt, tenant: tenantId, receipt: receipt._id }, { $set: { state: 'settled' } }, { session: mongoSession });
      await require('./collections').enqueue({ tenant: tenantId, location: visit.location, kind: 'project_invoice', targetId: bill._id, mongoSession });
      await require('../../models/AuditLog').create([{ actorUserId: actor?.userId || visit.createdBy, actorRole: actor?.role || 'system', action: 'VENUE_SETTLEMENT', actionCategory: 'update', targetType: 'Order', targetId: bill._id, targetTenantId: tenantId, changes: { after: { sessionId: id(visit), receiptId, state: 'settled' } } }], { session: mongoSession });
      return billDTO(bill, visit);
    });
  } finally { await mongoSession.endSession(); }
}
module.exports = { settleVenueBill };
