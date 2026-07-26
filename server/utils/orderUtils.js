// utils/orderUtils.js

const Order = require('../models/Order');
const SalesOrder = require('../models/SalesOrder');
const User = require('../models/User');

/**
 * Resolve who to notify about an order.
 *
 * Orders carry no top-level `customer` field — web checkouts snapshot the buyer
 * into `shippingAddress`, POS sales into `paymentDetails.customer`, and only
 * signed-in orders hold a `user` ref. Callers used to read `order.customer` and
 * bail when it came back undefined, which silently muted every status SMS and
 * WhatsApp message for guest orders.
 *
 * @param {Object} order - Order document or lean object
 * @returns {Promise<{firstName: string, lastName: string, email: string, phone: string}|null>}
 */
async function resolveOrderRecipient(order) {
  if (!order) return null;

  const addr = order.shippingAddress;
  if (addr?.phone || addr?.email) {
    const [firstName, ...rest] = (addr.fullName || '').trim().split(/\s+/).filter(Boolean);
    return {
      firstName: firstName || 'Customer',
      lastName:  rest.join(' '),
      email:     addr.email || '',
      phone:     addr.phone || '',
    };
  }

  const pos = order.paymentDetails?.customer;
  if (pos?.phone) {
    return {
      firstName: pos.firstName || 'Customer',
      lastName:  pos.lastName  || '',
      email:     '',
      phone:     pos.phone,
    };
  }

  if (order.user) {
    const user = await User.findById(order.user).lean().catch(() => null);
    if (user) return user;
  }

  return null;
}

async function generateOrderNumber() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  const prefix = `DH${year}${month}${day}`;

  const todayStart = new Date(date.setHours(0, 0, 0, 0));
  const todayEnd = new Date(date.setHours(23, 59, 59, 999));

  const count = await Order.countDocuments({
    createdAt: { $gte: todayStart, $lte: todayEnd },
  });

  const sequence = (count + 1).toString().padStart(4, '0');

  return `${prefix}${sequence}`;
}

async function generateReceiptNumber() {
  const date = new Date();
  const y = date.getFullYear().toString();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);
  const count = await Order.countDocuments({
    receiptNumber: { $exists: true, $regex: `^RCP-${y}${m}${d}` },
    createdAt: { $gte: todayStart, $lte: todayEnd },
  });
  return `RCP-${y}${m}${d}-${(count + 1).toString().padStart(4, '0')}`;
}

async function generateReturnNumber() {
  const date = new Date();
  const y = date.getFullYear().toString();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);
  const count = await Order.countDocuments({
    'refunds.receiptNumber': { $regex: `^RTN-${y}${m}${d}` },
    createdAt: { $gte: todayStart, $lte: todayEnd },
  });
  return `RTN-${y}${m}${d}-${(count + 1).toString().padStart(4, '0')}`;
}

async function generateSalesOrderNumber() {
  const count = await SalesOrder.countDocuments({});
  const sequence = (count + 1).toString().padStart(5, '0');
  return `SO${sequence}`;
}

module.exports = {
  resolveOrderRecipient,
  generateOrderNumber,
  generateReceiptNumber,
  generateReturnNumber,
  generateSalesOrderNumber,
};
