const { ValidationError } = require('../utils/errors');
const { commissionSellingPrice } = require('../utils/commissionPricing');
const { isDiscountActive } = require('../utils/pricing');
function commissionOverride(price, current, discount) {
  if (Math.abs(price - current) < 0.01) return null;
  let before = price;
  if (isDiscountActive(discount)) {
    if (discount.type === 'percentage') {
      if (discount.value >= 100)
        throw new ValidationError(
          'A 100% catalogue discount cannot support a price override'
        );
      before /= 1 - discount.value / 100;
    } else if (discount.type === 'fixed') before += discount.value;
  }
  // Round down fractional cents; forward clean-hundred rounding must match exactly.
  const stored = Math.floor((before + 1e-7) * 100) / 100;
  if (commissionSellingPrice(stored, discount) !== price)
    throw new ValidationError(
      'Commission price cannot be represented by the current catalogue discount'
    );
  return stored;
}
module.exports = { commissionOverride };
