const { retailPriceBasis } = require('../retailPrice.service');
const { findMatchingPriceRules, applyPriceRules } = require('../pricelistPricing.service');
const { ValidationError } = require('../../utils/errors');
function resolvePrice({ size, subProduct, pricelist, currency, tenant }) {
  const sourceCurrency = size.currency || subProduct.currency || 'NGN';
  if (sourceCurrency !== currency || (pricelist && (pricelist.currency || 'NGN') !== currency)) {
    throw new ValidationError('Price currency does not match this kiosk.');
  }
  const basis = retailPriceBasis(subProduct, size);
  if (!Number.isFinite(basis.sellingPrice) || basis.sellingPrice <= 0)
    throw new ValidationError('Price unavailable.');
  const rules = findMatchingPriceRules(pricelist?.rules, subProduct._id, 1);
  const setters = rules.filter((rule) => ['fixed', 'formula'].includes(rule.priceType));
  const original = applyPriceRules(
    basis.sellingPrice,
    basis.costPrice,
    setters,
    size.wholesalePrice || 0
  );
  const price = applyPriceRules(
    basis.sellingPrice,
    basis.costPrice,
    rules,
    size.wholesalePrice || 0
  );
  if (!Number.isFinite(price) || price < 0) throw new ValidationError('Price unavailable.');
  const taxRate = Math.max(0, Math.min(100, Number(tenant?.posSettings?.taxRate) || 0));
  const included = tenant?.posSettings?.productPriceDisplay === 'tax_included';
  // POS stores/charges this retail amount; its receipt extracts included tax.
  // A display preference must not add tax to it a second time.
  const round = (n) => Math.round(n * 100) / 100;
  return {
    price: round(price),
    originalPrice: original > price ? round(original) : null,
    currency,
    taxLabel: included ? 'Includes tax' : taxRate > 0 ? 'Excludes tax' : '',
  };
}
function stockState(stock) {
  const quantity = Math.max(0, (stock?.currentQuantity || 0) - (stock?.reservedQuantity || 0));
  const threshold = stock?.minStockLevel || 0;
  return {
    quantity,
    availability: quantity <= 0 ? 'OUT_OF_STOCK' : quantity <= threshold ? 'LOW_STOCK' : 'IN_STOCK',
  };
}
module.exports = { resolvePrice, stockState };
