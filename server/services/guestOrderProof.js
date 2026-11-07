'use strict';
const jwt = require('jsonwebtoken');
const { NotFoundError } = require('../utils/errors');
function issue(order) {
  if (order.user) return undefined;
  return jwt.sign({ purpose: 'guest_order', order: String(order._id) }, process.env.JWT_SECRET, { expiresIn: '24h' });
}
function actor(req, order) {
  if (req.user) return req.user;
  try {
    const value = jwt.verify(req.get('X-Order-Access'), process.env.JWT_SECRET);
    if (value.purpose !== 'guest_order' || value.order !== String(order?._id) || order?.user) throw new Error('scope');
    return { guestOrder: value.order };
  } catch { throw new NotFoundError('Order not found'); }
}
module.exports = { issue, actor };
