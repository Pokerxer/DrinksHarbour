'use strict';
const catalog = require('./storefrontCatalog.service');
const { normalizeCart, retailPrice, money, id, onlyKeys } = require('./storefrontPricing');
const { ValidationError, NotFoundError, ConflictError } = require('../utils/errors');
const { resolveLineRates } = require('../utils/pricing');
const { shippingQuote } = require('./storefrontShipping.service');
async function quoteCart(tenant, body, session = null) {
  const input = normalizeCart(body);
  const products = await catalog.loadProducts(tenant, [...new Set(input.map(i => i.subProductId))], session);
  const sizes = await catalog.loadSizes(tenant, products, session);
  const orderItems = [], items = [], parentQuantities = new Map();
  for (const line of input) {
    const sp = products.find(row => id(row) === line.subProductId);
    if (!sp) throw new NotFoundError('Product not found or unavailable');
    const size = line.sizeId ? sizes.find(row => id(row) === line.sizeId && id(row.subproduct) === id(sp) && id(row.tenant) === id(tenant)) : null;
    if (line.sizeId && !size) throw new NotFoundError('Product variant not found');
    if (!size && !sp.sellWithoutSizeVariants) throw new ValidationError('Select a product variant');
    if (sp.product.isAlcoholic === true && body.ageVerified !== true) throw new ValidationError('Confirm the customer meets the legal drinking age');
    if (size && (line.quantity > (size.maxOrderQuantity || 1000) || line.quantity > (size.availableStock || 0))) {
      throw new ConflictError('Variant quantity exceeds available stock or order limit');
    }
    const quantity = (parentQuantities.get(id(sp)) || 0) + line.quantity;
    if (quantity > (sp.availableStock || 0)) throw new ConflictError('Insufficient product stock');
    parentQuantities.set(id(sp), quantity);
    const unitPrice = retailPrice(sp, size), subtotal = money(unitPrice * line.quantity);
    const rates = resolveLineRates(tenant, size, line.quantity);
    const cost = size?.costPrice ?? sp.costPrice ?? 0;
    const model = tenant.revenueModel === 'commission' ? 'commission' : 'markup';
    const share = money(model === 'commission' ? subtotal * (1 - rates.commissionPct / 100) : Math.min(subtotal, cost * line.quantity));
    orderItems.push({ product: sp.product._id, subproduct: sp._id, size: size?._id || undefined,
      tenant: tenant._id, quantity: line.quantity, priceAtPurchase: unitPrice, itemSubtotal: subtotal,
      vendorPriceAtPurchase: cost, tenantRevenueShare: share, platformCommission: money(subtotal - share),
      tenantRevenueModel: model, revenueRateAtPurchase: model === 'commission' ? rates.commissionPct : rates.markupPct,
      packRateApplied: rates.isPackRate });
    items.push({ subProductId: id(sp), sizeId: size ? id(size) : null, name: sp.product.name,
      quantity: line.quantity, unitPrice, subtotal });
  }
  const subtotal = money(items.reduce((sum, row) => sum + row.subtotal, 0));
  const shipping = await shippingQuote(body, subtotal, tenant);
  const total = money(subtotal + shipping.fee);
  if (!Number.isSafeInteger(Math.round(total * 100)) || total <= 0) throw new ValidationError('Invalid cart total');
  return { currency: 'NGN', items, subtotal, shippingFee: shipping.fee, total, shipping, orderItems };
}
function publicQuote(quote) {
  return { currency: quote.currency, items: quote.items, subtotal: quote.subtotal, shippingFee: quote.shippingFee,
    total: quote.total, shipping: quote.shipping };
}
module.exports = { quoteCart, publicQuote, shippingQuote };
