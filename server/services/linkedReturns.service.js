const Order = require('../models/Order');
const SalesOrder = require('../models/SalesOrder');
const { buildLinkedReturnState, matchingLine, id } = require('./linkedReturns.helpers');
const plain = doc => typeof doc.toObject === 'function' ? doc.toObject() : doc;
const receiptFields = 'tenant linkedSalesOrder receiptNumber createdAt items refunds';

async function receiptsFor(orders, tenantId) {
  const ids = orders.flatMap(order => [order._id, order.convertedFrom].filter(Boolean));
  if (!ids.length) return [];
  return Order.find({ tenant: tenantId, source: 'pos', linkedSalesOrder: { $in: ids } })
    .select(receiptFields).lean();
}

function salesView(order, receipts) {
  const state = buildLinkedReturnState(order, receipts);
  const returnHistory = [];
  const ownQuantity = (order.items || []).reduce((sum, item) => sum + (item.returnedQty || 0), 0);
  if (ownQuantity > 0) returnHistory.push({source:'sales', reference:order.soNumber,
    quantity:ownQuantity, refundAmount:0, description:'Stock returned through Sales; no POS refund recorded by this action.'});
  for (const receipt of receipts) {
    if (id(receipt.tenant) !== id(order.tenant) ||
        ![id(order._id), id(order.convertedFrom)].includes(id(receipt.linkedSalesOrder))) continue;
    for (const refund of receipt.refunds || []) {
      const quantity = (refund.items || []).reduce((sum, row) =>
        matchingLine(order, receipt.items?.[row.orderItemIndex] || {}) ? sum + (row.quantity || 0) : sum, 0);
      if (quantity > 0) returnHistory.push({source:'pos', reference:refund.receiptNumber,
        receiptNumber:receipt.receiptNumber, quantity, refundAmount:refund.totalRefunded || 0,
        at:refund.refundedAt, description:refund.reason || 'Refund processed through POS'});
    }
  }
  return {...order, returnHistory, items:(order.items || []).map(item => ({...item,
    salesReturnedQty:item.returnedQty || 0,
    posReturnedQty:state.posReturnedByLine[id(item._id)] || 0,
    returnedQty:Math.min(item.fulfilledQty || 0, (item.returnedQty || 0) + (state.posReturnedByLine[id(item._id)] || 0)),
  }))};
}

async function projectSalesReturns(docs, tenantId) {
  const orders = docs.map(plain);
  const eligible = orders.filter(order => (order.items || []).some(item => item.fulfilledQty > 0));
  if (!eligible.length) return orders;
  const receipts = await receiptsFor(eligible, tenantId);
  return orders.map(order => salesView(order, receipts));
}

async function projectPOSReturns(docs, tenantId) {
  const orders = docs.map(plain);
  const ids = orders.map(order => order.linkedSalesOrder).filter(Boolean);
  if (!ids.length) return orders;
  const salesOrders = await SalesOrder.find({tenant:tenantId, _id:{$in:ids}})
    .select('tenant soNumber items convertedFrom').lean();
  const receipts = await receiptsFor(salesOrders, tenantId);
  const states = new Map(salesOrders.map(order => [id(order._id), {order, state:buildLinkedReturnState(order, receipts)}]));
  return orders.map(receipt => {
    const entry = states.get(id(receipt.linkedSalesOrder));
    if (!entry) return receipt;
    const rows = entry.state.salesByReceipt[id(receipt._id)] || {};
    const items = Object.entries(rows).map(([index, quantity]) => ({orderItemIndex:Number(index), quantity,
      unitPrice:0, amount:0, discPct:0, restock:true}));
    if (!items.length) return receipt;
    const saved = (receipt.salesReturns || []).find(row => id(row.salesOrder) === id(entry.order._id));
    const stockReturn = {refundedAt:saved?.returnedAt, source:'sales', receiptNumber:`Sales return · ${entry.order.soNumber}`,
      salesOrderId:entry.order._id, items, totalRefunded:0,
      reason:'Stock already returned through Sales. No money refunded by this action.'};
    return {...receipt, refunds:[...(receipt.refunds || []).filter(refund => refund.source !== 'sales'), stockReturn]};
  });
}

async function posReturnState(salesOrder, tenantId) {
  return buildLinkedReturnState(plain(salesOrder), await receiptsFor([salesOrder], tenantId));
}

async function salesReturnsForReceipt(receipt, tenantId) {
  if (!receipt.linkedSalesOrder) return {};
  const order = await SalesOrder.findOne({_id:receipt.linkedSalesOrder, tenant:tenantId}).lean();
  if (!order) return {};
  const state = await posReturnState(order, tenantId);
  return state.salesByReceipt[id(receipt._id)] || {};
}
module.exports = { projectSalesReturns, projectPOSReturns, posReturnState, salesReturnsForReceipt, salesView };
