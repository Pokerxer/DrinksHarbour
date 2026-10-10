const { orderReturnTotals } = require('./posReturnTotals.service');
const Order = require('../models/Order');
const { summarizeSessionOrders, settled } = require('./posSessionTotals.service');
const { projectPOSReturns } = require('./linkedReturns.service');
const money = value => Math.round(value * 100) / 100;

function salesReturnValue(order) {
  return money((order.refunds || []).filter(row => row.source === 'sales').reduce((sum, row) =>
    sum + row.items.reduce((value, line) => {
      const item = order.items?.[line.orderItemIndex];
      if (!item || !(item.quantity > 0)) return value;
      const subtotal = item.itemSubtotal ?? Math.max(0, (item.priceAtPurchase || 0) * item.quantity - (item.discountAmount || 0));
      return value + subtotal * Math.min(item.quantity, line.quantity) / item.quantity;
    }, 0), 0));
}

// Current receipt/refund totals; drawer closing balances remain historical snapshots.
async function enrichSessionHistory(sessions, tenantId) {
  if (!sessions.length) return [];
  const ids = sessions.map(session => session._id);
  const orders = await Order.find({$or:[{tenant:tenantId},{'items.tenant':tenantId}],
    source:'pos',posSessionId:{$in:ids}}).lean();
  const projected = await projectPOSReturns(orders, tenantId);
  const grouped = new Map(ids.map(id => [String(id), []]));
  for (const order of projected) grouped.get(String(order.posSessionId))?.push(order);
  return sessions.map(session => {
    const ownOrders = grouped.get(String(session._id)) || [];
    const stats = summarizeSessionOrders(ownOrders);
    const returns = ownOrders.filter(settled).map(orderReturnTotals);
    return {...(session.toObject ? session.toObject() : session),
      totalSales:money(returns.reduce((sum, row) => sum + row.netSales, 0)), netCollections:stats.totalSales, currentPaymentTotals:stats.breakdown, grossRevenue:stats.grossRevenue,
      totalRefunds:stats.totalRefunds, orderCount:stats.orderCount,
      salesReturnValue:money(returns.reduce((sum, row) => sum + row.salesReturnValue, 0)),
      returnDeduction:money(returns.reduce((sum, row) => sum + row.returnDeduction, 0)),
    };
  });
}
module.exports = { enrichSessionHistory, salesReturnValue };
