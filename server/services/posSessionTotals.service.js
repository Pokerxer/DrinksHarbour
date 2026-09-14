// Canonical tender totals for one explicitly selected set of POS orders.
const settled = o => !o.isVoided && !['hold', 'voided', 'cancelled'].includes(o.status)
  && ['paid', 'partially_refunded', 'refunded'].includes(o.paymentStatus);
const money = value => Math.round((Number(value) || 0) * 100) / 100;
function summarizeSessionOrders(orders) {
  const stats = { totalSales: 0, grossRevenue: 0, totalRefunds: 0, orderCount: 0, totalTips: 0, totalRounding: 0, breakdown: {} };
  const add = (method, amount) => {
    const row = stats.breakdown[method] ||= { total: 0, count: 0 };
    row.total = money(row.total + amount); row.count++;
  };
  for (const order of orders.filter(settled)) {
    const total = money(order.totalAmount);
    stats.orderCount++; stats.grossRevenue += total;
    stats.totalTips += money(order.tipAmount); stats.totalRounding += money(order.roundingAmount);
    const payments = order.paymentMethod === 'split' ? order.paymentDetails?.splitPayments || []
      : [{ method: order.paymentMethod || 'cash', amount: total }];
    payments.forEach(p => add(p.method, money(p.amount)));
    for (const refund of order.refunds || []) {
      const amount = money(refund.totalRefunded);
      stats.totalRefunds += amount;
      if (refund.paymentMethod && refund.paymentMethod !== 'split') add(refund.paymentMethod, -amount);
      else if (total > 0) {
        // An unspecified split refund reverses the original tender proportions.
        let remaining = amount;
        payments.forEach((p, i) => {
          const part = i === payments.length - 1 ? remaining : money(amount * p.amount / total);
          add(p.method, -part); remaining = money(remaining - part);
        });
      }
    }
  }
  stats.grossRevenue = money(stats.grossRevenue); stats.totalRefunds = money(stats.totalRefunds);
  stats.totalSales = money(stats.grossRevenue - stats.totalRefunds);
  return stats;
}
async function getSessionOrderStats(tenantId, sessionId) {
  const Order = require('../models/Order');
  const orders = await Order.find({ $or: [{ tenant: tenantId }, { 'items.tenant': tenantId }], source: 'pos', posSessionId: sessionId }).lean();
  return summarizeSessionOrders(orders);
}
module.exports = { summarizeSessionOrders, settled, getSessionOrderStats };
