// utils/orderUtils.js

const Order = require('../models/Order');
const SalesOrder = require('../models/SalesOrder');

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
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  const prefix = `SO${year}${month}${day}`;

  const todayStart = new Date(date.setHours(0, 0, 0, 0));
  const todayEnd = new Date(date.setHours(23, 59, 59, 999));

  const count = await SalesOrder.countDocuments({
    createdAt: { $gte: todayStart, $lte: todayEnd },
  });

  const sequence = (count + 1).toString().padStart(4, '0');

  return `${prefix}${sequence}`;
}

module.exports = {
  generateOrderNumber,
  generateReceiptNumber,
  generateReturnNumber,
  generateSalesOrderNumber,
};
