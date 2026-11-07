'use strict';
const Checkout = require('../models/IntegrationCheckout');
const Order = require('../models/Order');
const { Types } = require('mongoose');
const { pagination, id, objectId, onlyKeys } = require('./storefrontPricing');
const { NotFoundError, ValidationError } = require('../utils/errors');
const fields = '_id orderNumber user items subtotal shippingFee totalAmount currency status paymentStatus placedAt createdAt salesChannel integrationCheckout';
function publicOrder(order) {
  return { id: id(order), orderNumber: order.orderNumber, salesChannel: order.salesChannel || null,
    currency: order.currency, subtotal: order.subtotal, shippingFee: order.shippingFee, total: order.totalAmount,
    status: order.status, paymentStatus: order.paymentStatus, createdAt: order.createdAt,
    items: order.items.map(i => ({ productId: id(i.product), subProductId: id(i.subproduct), sizeId: id(i.size),
      quantity: i.quantity, unitPrice: i.priceAtPurchase, subtotal: i.itemSubtotal })) };
}
const oid = value => objectId(id(value)) ? new Types.ObjectId(id(value)) : value;
function orderPipeline(tenant, key, customerId, extra = {}) {
  return [{ $match: { tenant: oid(tenant._id), apiKey: oid(key._id), ...(customerId ? { customer: oid(customerId) } : {}), ...extra } },
    { $lookup: { from: 'orders', localField: 'order', foreignField: '_id', as: 'order' } },
    { $unwind: '$order' },
    { $match: { 'order.tenant': oid(tenant._id), ...(customerId ? { 'order.user': oid(customerId) } : {}), $expr: { $eq: ['$order.integrationCheckout', '$_id'] } } },
    { $replaceRoot: { newRoot: '$order' } }];
}
async function listOrders(tenant, key, query = {}, customerId) {
  const { page, limit, skip } = pagination(query);
  const [result] = await Checkout.aggregate([...orderPipeline(tenant, key, customerId),
    { $facet: { rows: [{ $sort: { createdAt: -1, _id: -1 } }, { $skip: skip }, { $limit: limit },
      { $project: Object.fromEntries(fields.split(' ').map(field => [field, 1])) }], count: [{ $count: 'total' }] } }]);
  const total = result.count[0]?.total || 0;
  return { data: result.rows.map(publicOrder), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
async function getOrder(tenant, key, orderId, customerId) {
  if (!objectId(orderId)) throw new ValidationError('Invalid order ID');
  const checkout = await Checkout.findOne({ tenant: tenant._id, apiKey: key._id, order: orderId,
    ...(customerId ? { customer: customerId } : {}) }).select('_id').lean();
  if (!checkout) throw new NotFoundError('Order not found');
  const order = await Order.findOne({ _id: orderId, tenant: tenant._id, integrationCheckout: checkout._id,
    ...(customerId ? { user: customerId } : {}) }).select(fields).lean();
  if (!order) throw new NotFoundError('Order not found');
  return publicOrder(order);
}
async function salesReport(tenant, key, query = {}) {
  onlyKeys(query, ['from', 'to']);
  const dates = {};
  for (const [name, op] of [['from', '$gte'], ['to', '$lte']]) {
    if (query[name] === undefined) continue;
    if (typeof query[name] !== 'string' || !Number.isFinite(Date.parse(query[name]))) throw new ValidationError('Invalid report date');
    dates[op] = new Date(query[name]);
  }
  if (dates.$gte && dates.$lte && dates.$gte > dates.$lte) throw new ValidationError('Invalid report date range');
  return Checkout.aggregate([...orderPipeline(tenant, key, null, { state: 'paid' }),
    { $match: { paymentStatus: 'paid', status: { $nin: ['cancelled', 'refunded'] }, ...(Object.keys(dates).length ? { createdAt: dates } : {}) } },
    { $group: { _id: { channel: '$salesChannel', currency: '$currency' }, paidOrderCount: { $sum: 1 },
      paidOrderTotal: { $sum: '$totalAmount' }, shippingTotal: { $sum: '$shippingFee' }, platformCommission: { $sum: '$platformCommissionTotal' } } },
    { $project: { _id: 0, salesChannel: '$_id.channel', currency: '$_id.currency', paidOrderCount: 1, paidOrderTotal: 1, shippingTotal: 1, platformCommission: 1 } }]);
}
module.exports = { publicOrder, listOrders, getOrder, salesReport };
