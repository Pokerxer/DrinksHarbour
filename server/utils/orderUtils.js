// utils/orderUtils.js

const Order = require('../models/Order');

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

module.exports = {
  generateOrderNumber,
};
