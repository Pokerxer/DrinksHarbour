'use strict';
const { visitContext } = require('./lines'); const { id } = require('./eligibility'); const { fail } = require('./errors');
const { runVenueOperation } = require('./operations');
// Support-only. There is deliberately no public/admin UI cancellation shortcut.
async function releaseUnpaidBillStock(args) {
  const { tenantId, sessionId, expectedVersion, confirmedUnserved, reason, idempotencyKey } = args;
  if (confirmedUnserved !== true || typeof reason !== 'string' || reason.trim().length < 10) fail('SUPPORT_REVIEW_REQUIRED', 'Confirm sealed goods were not served and record the reason');
  const context = await visitContext({ ...args, action: 'bill.freeze' });
  if (!['tenant_owner', 'tenant_admin'].includes(context.actor.role)) fail('VENUE_PERMISSION_DENIED', 'Manager review required', 403);
  return runVenueOperation({ tenantId, locationId: id(context.location), actor: context.actor, operation: 'stock.release', key: idempotencyKey,
    payload: { sessionId, expectedVersion, confirmedUnserved, reason: reason.trim() }, execute: async ({ mongoSession }) => {
      const { visit } = await visitContext({ ...args, action: 'bill.freeze', mongoSession });
      if (visit.version !== expectedVersion || visit.state !== 'closing') fail('STATE_CHANGED', 'Visit changed; review again');
      const filter = { tenant: tenantId, session: visit._id, billOrder: visit.billOrder };
      if (await require('../../models/VenuePaymentAttempt').exists(filter).session(mongoSession) || await require('../../models/VenuePaymentReceipt').exists(filter).session(mongoSession)) fail('PAYMENT_REVIEW_REQUIRED', 'A collection exists; reconcile it before any stock release');
      const Order = require('../../models/Order');
      const bill = await Order.findOne({ _id: visit.billOrder, tenant: tenantId, venueBillForSession: visit._id, paymentStatus: 'pending', venueSettlementState: 'unpaid', venueStockState: 'reserved' }).session(mongoSession);
      if (!bill) fail('STATE_CHANGED', 'Only an unpaid, reserved bill can be released');
      const effects = await require('../../models/VenueStockEffect').find({ ...filter, state: 'reserved' }).session(mongoSession);
      if (!effects.length) fail('STOCK_REVIEW_REQUIRED');
      for (const effect of effects) {
        const scope = { tenant: tenantId, warehouse: effect.location, subProduct: effect.subproduct, size: effect.size };
        const changed = await require('../../models/WarehouseStock').updateOne({ ...scope, reservedQuantity: { $gte: effect.quantity } }, { $inc: { reservedQuantity: -effect.quantity } }, { session: mongoSession });
        if (!changed.modifiedCount) fail('STOCK_REVIEW_REQUIRED');
        for (const allocation of effect.batchAllocations) {
          const batch = await require('../../models/WarehouseBatch').updateOne({ _id: allocation.batch, ...scope }, { $inc: { quantity: allocation.quantity } }, { session: mongoSession });
          if (!batch.modifiedCount) fail('STOCK_REVIEW_REQUIRED', 'Owned batch allocation is missing');
        }
        effect.state = 'released'; await effect.save({ session: mongoSession });
        await require('../warehouseStock.helpers').recalcSubProductStock(effect.subproduct, mongoSession, tenantId);
      }
      bill.venueStockState = 'released'; bill.venueSettlementState = 'needs_review'; bill.status = 'cancelled'; bill.paymentStatus = 'failed'; bill.cancelReason = reason.trim();
      bill.$locals.deferAccounting = true; await bill.save({ session: mongoSession });
      visit.state = 'needs_review'; visit.version++; await visit.save({ session: mongoSession });
      // Keep the table bound until support reconciles the operational visit.
      return { sessionId, version: visit.version, state: 'needs_review', stockState: 'released' };
    } });
}
module.exports = { releaseUnpaidBillStock };
