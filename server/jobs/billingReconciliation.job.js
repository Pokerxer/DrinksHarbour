'use strict';
const cron = require('node-cron');
const Tenant = require('../models/Tenant');
const { reconcileSubscription, reconcileAddOn } = require('../services/billingReconciliation.service');
const { reconcilePlanChange } = require('../services/planTransition.service');
async function sweepBillingReconciliation() {
  const result = { checked: 0, failed: 0 };
  for await (const tenant of Tenant.find({ paystackSubscriptionCode: { $type: 'string' } }).cursor()) {
    try {
      await reconcilePlanChange(tenant);
      await reconcileSubscription(await Tenant.findById(tenant._id));
      for (const row of tenant.addOns || []) {
        if (row.paystackSubscriptionCode) await reconcileAddOn(await Tenant.findById(tenant._id), row.paystackSubscriptionCode);
      }
      result.checked++;
    } catch (error) { result.failed++; console.error('Billing reconciliation failed for tenant', String(tenant._id), error.message); }
  }
  const Order = require('../models/Order');
  for await (const order of Order.find({ tableServiceBooking: { $type: 'objectId' },
    paymentStatus: 'paid', tableAccountingStatus: 'pending' }).cursor()) {
    try { await require('../services/tableCheckout.service').postTableAccounting(order); }
    catch (error) { result.failed++; console.error('Table accounting reconciliation failed:', String(order._id), error.message); }
  }
  return result;
}
function startBillingReconciliationCron() {
  return cron.schedule('*/10 * * * *', () => sweepBillingReconciliation().catch(error => console.error('Billing sweep failed:', error.message)));
}
module.exports = { sweepBillingReconciliation, startBillingReconciliationCron };
