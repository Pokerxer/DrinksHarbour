'use strict';
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Channel = require('../models/StorefrontChannel');
const Warehouse = require('../models/Warehouse');
const stock = require('./storefrontLocationStock');
const legacyStock = require('./storefrontStock');
const { ConflictError, NotFoundError } = require('../utils/errors');
const { id } = require('./storefrontPricing');
async function createMappedOrder(data, tenantConfigs, options = {}) {
  const tenantIds = tenantConfigs ? tenantConfigs.filter(t => t.storefrontIntegrationEnabled).map(id)
    : [...new Set(data.items.map(i => id(i.tenant)))];
  if (!tenantIds.length) return null;
  const channels = await Channel.find({ tenant: { $in: tenantIds } }).lean();
  if (!channels.length) {
    if (tenantConfigs) throw new ConflictError('Marketplace stock mapping needs review');
    return null;
  }
  if (tenantConfigs && tenantIds.some(tenantId => !channels.some(c => id(c.tenant) === id(tenantId)))) throw new ConflictError('Marketplace stock mapping needs review');
  const session = options.session || await mongoose.startSession();
  let order;
  try {
    const work = async () => {
      const items = data.items.map(item => {
        const channel = channels.find(c => id(c.tenant) === id(item.tenant));
        if (channel && !item.size) throw new ConflictError('Select a stock variant for this merchant');
        return { ...item, ...(channel ? { warehouse: channel.warehouse } : {}) };
      });
      for (const channel of channels) {
        if (!await Warehouse.exists({ _id: channel.warehouse, tenant: channel.tenant, isActive: true }).session(session)) throw new ConflictError('Marketplace stock location unavailable');
      }
      order = new Order({ ...data, items, onlineStockVersion: 1, salesChannel: 'DRINKSHARBOUR_NG',
        settlementOwner: 'platform' });
      const reservationVersion = require('./merchantFulfillment/quantity/candidate').initialize(order);
      const located = order.items.filter(i => i.warehouse), legacy = order.items.filter(i => !i.warehouse);
      if (located.length) await stock.reserve(located, order._id, session, { version: reservationVersion });
      if (legacy.length) await legacyStock.reserveStock(legacy, session);
      await require('./merchantFulfillment').prepare(order, { session });
      order.$locals.deferAccounting = true;
      await order.save({ session });
    };
    if (options.session) await work(); else await session.withTransaction(work);
  } finally { if (!options.session) await session.endSession(); }
  if (!options.session && order.paymentStatus === 'paid') await require('./accounting.orders').captureOrderAccounting(order);
  return order;
}
const transitions = { pending: ['confirmed', 'cancelled'], confirmed: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [] };
async function applyStatus(original, status, options = {}) {
  require('./merchantFulfillment/identity').assertLegacy(original);
  const session = await mongoose.startSession();
  let previousStatus, changed = false, saved;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: original._id, onlineStockVersion: 1 }).session(session);
      if (!order) throw new NotFoundError('Online order not found');
      require('./merchantFulfillment/identity').assertLegacy(order);
      if (options.tenantId && order.items.some(i => id(i.tenant) !== id(options.tenantId))) throw new ConflictError('Mixed-tenant order needs separate fulfillment review');
      previousStatus = order.status;
      if (status === previousStatus) { saved = order; return; }
      if (!transitions[previousStatus]?.includes(status)) throw new ConflictError('Order transition requires a reviewed return or refund');
      if (status === 'cancelled' && order.paymentStatus === 'paid') throw new ConflictError('Paid order requires a verified refund before cancellation');
      if (['shipped', 'delivered'].includes(status) && order.paymentStatus !== 'paid' && order.paymentMethod !== 'cash_on_delivery') throw new ConflictError('Verify payment before fulfillment');
      const legacy = order.items.filter(i => !i.warehouse);
      if (status === 'shipped') {
        await stock.transition(order, 'consume', session, options.actorId);
        if (legacy.length) await require('./inventory.service').commitShipment(legacy, order._id, options.actorId, { session });
      }
      if (status === 'cancelled') {
        await stock.transition(order, 'release', session, options.actorId);
        if (legacy.length) await legacyStock.releaseStock(legacy, session);
      }
      order.status = status;
      const stamp = { confirmed: 'confirmedAt', processing: 'processingAt', shipped: 'shippedAt', delivered: 'deliveredAt', cancelled: 'cancelledAt' }[status];
      if (stamp && !order[stamp]) order[stamp] = new Date();
      if (status === 'cancelled') order.cancelReason = options.cancelReason || 'Cancelled by owner';
      if (options.tenantId) order.fulfillmentStatus.set(String(options.tenantId), status);
      order.$locals.deferAccounting = true; await order.save({ session }); saved = order; changed = true;
    });
  } finally { await session.endSession(); }
  if (saved) original.set(saved.toObject());
  return { previousStatus, changed };
}
module.exports = { createMappedOrder, applyStatus };
