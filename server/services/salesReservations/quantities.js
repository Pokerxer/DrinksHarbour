const { ValidationError } = require('../../utils/errors');
const qty = (value = 0) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new ValidationError('Invalid stock quantity');
  return value;
};
function freeStock({ onHand = 0, reserved = 0, expired = 0, quarantinedExpired = 0 }) {
  if (!Number.isFinite(onHand)) throw new ValidationError('Invalid on-hand quantity');
  return Math.max(0, onHand - qty(reserved) - Math.max(0, qty(expired) - qty(quarantinedExpired)));
}
function neededQty({ ordered, delivered = 0, held = 0 }) {
  return Math.max(0, qty(ordered) - qty(delivered) - qty(held));
}
const productLines = rows => (rows || []).filter(row => !row.lineType || row.lineType === 'product');
const id = value => String(value?._id || value || '');
module.exports = { qty, freeStock, neededQty, productLines, id };
