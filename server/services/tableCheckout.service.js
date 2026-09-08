'use strict';
const crypto = require('node:crypto');
const Booking = require('../models/Booking');
const Order = require('../models/Order');
const Size = require('../models/Size');
const SubProduct = require('../models/SubProduct');
const { ValidationError, ConflictError, NotFoundError } = require('../utils/errors');
const { generateOrderNumber } = require('../utils/orderUtils');
const inventory = require('./inventory.service');
const payments = require('./payment.service');
const { round2 } = require('./accounting.helpers');

function tableRevenue(amount) {
  const subtotal = round2(amount);
  const commission = round2(subtotal * 0.09);
  return { subtotal, commission, tenantShare: round2(subtotal - commission) };
}

async function tableMenu(tenant) {
  const products = await SubProduct.find({ tenant, isPublished: true, status: 'active' })
    .select('_id product').populate('product', 'name').limit(100).lean();
  const sizes = await Size.find({ tenant, subproduct: { $in: products.map(p => p._id) }, sellingPrice: { $gt: 0 } })
    .select('_id subproduct size sellingPrice').lean();
  return sizes.map(size => ({ _id: size._id, price: size.sellingPrice,
    name: `${products.find(p => String(p._id) === String(size.subproduct))?.product?.name || 'Beverage'} · ${size.size}` }));
}

async function startTableCheckout(tenant, actor, bookingId, body = {}) {
  const booking = await Booking.findOne({ _id: bookingId, tenant: tenant._id });
  if (!booking) throw new NotFoundError('Booking not found');
  if (booking.status !== 'checked_in') throw new ConflictError('Check the guest in before checkout');
  const existing = await Order.findOne({ tableServiceBooking: booking._id, tenant: tenant._id }).select('+tableCheckoutUrl');
  if (existing) {
    if (existing.tableCheckoutUrl && existing.paymentStatus === 'pending') return { authorizationUrl: existing.tableCheckoutUrl, orderId: existing._id };
    throw new ConflictError('This booking already has a checkout; reconcile its payment before retrying');
  }
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100) throw new ValidationError('Select 1–100 menu items');
  if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw new ValidationError('A customer email is required');
  if (body.ageVerified !== true) throw new ValidationError('Confirm the guest meets the legal drinking age');
  const items = [];
  for (const input of body.items) {
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100) throw new ValidationError('Invalid quantity');
    const size = await Size.findOne({ _id: input.sizeId, tenant: tenant._id }).lean();
    const product = size && await SubProduct.findOne({ _id: size.subproduct, tenant: tenant._id, isPublished: true, status: 'active' }).lean();
    if (!product || !Number.isFinite(size.sellingPrice) || size.sellingPrice <= 0) throw new ValidationError('Menu item is unavailable');
    const split = tableRevenue(size.sellingPrice * input.quantity);
    items.push({ product: product.product, subproduct: product._id, size: size._id, tenant: tenant._id,
      quantity: input.quantity, priceAtPurchase: size.sellingPrice, itemSubtotal: split.subtotal,
      tenantRevenueShare: split.tenantShare, platformCommission: split.commission,
      tenantRevenueModel: 'commission', revenueRateAtPurchase: 9 });
  }
  const total = round2(items.reduce((sum, item) => sum + item.itemSubtotal, 0));
  const reference = `table-${crypto.randomUUID()}`;
  const claimed = await Booking.updateOne({ _id: booking._id, tenant: tenant._id,
    status: 'checked_in', checkoutStartedAt: null },
  { $set: { checkoutStartedAt: new Date() }, $inc: { __v: 1 } });
  if (!claimed.modifiedCount) throw new ConflictError('Booking changed or checkout is already being prepared; reload and reconcile');
  // Unique booking index makes concurrent/double submissions share one bill.
  const order = await Order.create({ orderNumber: await generateOrderNumber(), tenant: tenant._id,
    tableServiceBooking: booking._id, items, subtotal: total, totalAmount: total, shippingFee: 0,
    platformCommissionTotal: round2(items.reduce((sum, item) => sum + item.platformCommission, 0)),
    paymentMethod: 'card', paymentReference: reference, paymentStatus: 'pending', status: 'pending',
    currency: 'NGN', ageVerifiedAtOrderTime: true, tableAccountingStatus: 'pending' });
  const reserved = await inventory.reserve(items, order._id, actor);
  if (!reserved.success) {
    await Order.updateOne({ _id: order._id, tenant: tenant._id }, { $set: { status: 'cancelled', paymentStatus: 'failed' } });
    throw new ConflictError('Insufficient stock; no payment was requested');
  }
  const result = await payments.createGatewayTransaction(total, body.email,
    { orderId: String(order._id), bookingId: String(booking._id) }, { reference,
      callbackUrl: `${process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001'}/bookings` });
  await Order.updateOne({ _id: order._id, tenant: tenant._id }, { $set: { tableCheckoutUrl: result.authorizationUrl } });
  return { authorizationUrl: result.authorizationUrl, orderId: order._id };
}

async function postTableAccounting(order) {
  const { findEntry, postJournalEntry } = require('./journalEntry.service');
  const entry = await findEntry({ tenantId: order.tenant, refDoc: order._id, entryType: 'sales_revenue' });
  if (!entry) {
    try {
      await postJournalEntry({ tenantId: order.tenant, refDoc: order._id, refDocType: 'Order',
        entryType: 'sales_revenue', source: 'table_service', date: order.paidAt,
        lines: [
          { account: '1300', debit: round2(order.totalAmount - order.platformCommissionTotal), credit: 0, memo: 'Due from platform' },
          { account: '6000', debit: order.platformCommissionTotal, credit: 0, memo: 'Table-service commission (9%)' },
          { account: '4000', debit: 0, credit: order.totalAmount, memo: 'Table-service revenue' },
        ] });
    } catch (error) { if (error.code !== 11000) throw error; }
  }
  await Order.updateOne({ _id: order._id, tenant: order.tenant, paymentStatus: 'paid' }, { $set: { tableAccountingStatus: 'posted' } });
}

async function settleTablePayment(order) {
  if (order.status === 'cancelled') throw new ConflictError('Cancelled bill requires payment review');
  if (!['pending', 'paid'].includes(order.paymentStatus)) throw new ConflictError('This bill cannot be settled');
  if (order.paymentStatus === 'paid') {
    await postTableAccounting(order);
    return order;
  }
  const verified = await payments.verifyGatewayTransaction(order.paymentReference);
  if (!verified.success || verified.status !== 'paid' || verified.data.reference !== order.paymentReference ||
      verified.data.currency !== 'NGN' || round2(verified.data.amount) !== round2(order.totalAmount)) {
    throw new ValidationError('Provider payment does not match this bill');
  }
  const paidAt = new Date(verified.data.paidAt || Date.now());
  const paid = await Order.findOneAndUpdate({ _id: order._id, tenant: order.tenant, status: { $ne: 'cancelled' }, paymentStatus: 'pending' },
    { $set: { paymentStatus: 'paid', status: 'confirmed', paidAt } }, { new: true });
  if (!paid) {
    const current = await Order.findOne({ _id: order._id, tenant: order.tenant });
    if (current?.paymentStatus === 'paid' && current.status !== 'cancelled') {
      await postTableAccounting(current);
      return current;
    }
    throw new ConflictError('Payment state changed');
  }
  await postTableAccounting(paid);
  return paid;
}
async function completeTableBooking(tenantId, bookingId) {
  const session = await Order.startSession();
  let completed;
  try {
    await session.withTransaction(async () => {
      const booking = await Booking.findOne({ _id: bookingId, tenant: tenantId }).session(session);
      if (!booking) throw new NotFoundError('Booking not found');
      if (booking.status === 'completed') { completed = booking.toObject(); return; }
      if (booking.status !== 'checked_in') throw new ConflictError('Only checked-in bookings can be completed');
      const bill = await Order.findOne({ tableServiceBooking: bookingId, tenant: tenantId }).session(session);
      if (!bill || bill.paymentStatus !== 'paid' || bill.tableAccountingStatus !== 'posted' ||
          bill.status === 'cancelled') throw new ConflictError('Settle and reconcile the bill before completing the booking');
      if (!['shipped', 'delivered'].includes(bill.status)) {
        await inventory.commitShipment(bill.items, bill._id, booking.createdBy, { session });
      }
      bill.status = 'delivered';
      bill.deliveredAt = bill.deliveredAt || new Date();
      bill.shippedAt = bill.shippedAt || bill.deliveredAt;
      await bill.save({ session });
      booking.status = 'completed';
      await booking.save({ session });
      completed = booking.toObject();
    });
    return completed;
  } finally { await session.endSession(); }
}
module.exports = { tableRevenue, tableMenu, startTableCheckout, settleTablePayment, postTableAccounting, completeTableBooking };
