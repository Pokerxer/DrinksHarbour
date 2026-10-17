const Order = require('../models/Order');
const SalesOrder = require('../models/SalesOrder');
const linkedReturns = require('./linkedReturns.service');

// Resolve actual returned goods before pagination. A receipt refund alone is
// insufficient: the canonical projection must match it to a fulfilled sale line.
async function includeReturnedOrders(query) {
  const { tenant, docType, ...filters } = query;
  const linkedIds = await Order.distinct('linkedSalesOrder', {
    tenant, source: 'pos', linkedSalesOrder: { $ne: null },
    refunds: { $elemMatch: {
      source: { $ne: 'sales' }, items: { $elemMatch: { quantity: { $gt: 0 } } },
    } },
  });
  const candidates = await SalesOrder.find({
    ...filters, tenant, docType: 'order',
    $and: [...(filters.$and || []), { $or: [
      { 'items.returnedQty': { $gt: 0 } },
      { _id: { $in: linkedIds } },
      { convertedFrom: { $in: linkedIds } },
    ] }],
  }).select('tenant items convertedFrom').lean();
  const projected = await linkedReturns.projectSalesReturns(candidates, tenant);
  const ids = projected.filter(order => order.items?.some(item =>
    (!item.lineType || item.lineType === 'product') && item.fulfilledQty > 0 && item.returnedQty > 0))
    .map(order => order._id);
  return {
    ids,
    query: { ...filters, tenant, $and: [...(filters.$and || []), { $or: [
      { docType: 'quotation' }, { docType: 'order', _id: { $in: ids } },
    ] }] },
  };
}

module.exports = { includeReturnedOrders };
