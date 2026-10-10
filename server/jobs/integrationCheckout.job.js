'use strict';
const cron = require('node-cron');
const Checkout = require('../models/IntegrationCheckout');
const settlement = require('../services/storefrontSettlement');
async function sweepCheckouts(now = new Date()) {
  const rows = await Checkout.find({ state: { $in: ['pending', 'initializing', 'ready', 'uncertain'] },
    createdAt: { $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } })
    .sort({ lastReconciledAt: 1, createdAt: 1 }).limit(100).select('_id tenant apiKey').lean();
  for (const row of rows) {
    try {
      await Checkout.updateOne({ _id: row._id, tenant: row.tenant }, { $set: { lastReconciledAt: now } });
      await settlement.cancelCheckout({ _id: row.tenant }, { _id: row.apiKey }, row._id);
    }
    catch (error) {
      // An ongoing/paid transaction is kept; outages must never release stock.
      if (error.statusCode !== 409) console.error('Checkout reconciliation failed:', row._id, error.message);
    }
  }
}
async function reconcileCheckoutAccounting() {
  const Order = require('../models/Order');
  const rows = await Order.find({ integrationCheckout: { $type: 'string' }, paymentStatus: 'paid',
    accountingStatus: 'pending', status: { $ne: 'cancelled' } }).limit(100);
  for (const order of rows) await require('../services/accounting.orders').captureOrderAccounting(order);
}
function startIntegrationCheckoutCron() {
  let running = false;
  return cron.schedule('*/15 * * * *', async () => {
    if (running) return;
    running = true;
    try { await sweepCheckouts(); await reconcileCheckoutAccounting(); }
    catch (error) { console.error('Checkout sweep failed:', error.message); }
    finally { running = false; }
  });
}
module.exports = { sweepCheckouts, reconcileCheckoutAccounting, startIntegrationCheckoutCron };
