'use strict';
const { ValidationError } = require('../utils/errors');
const { applyDiscount } = require('../utils/pricing');
const id = value => String(value?._id ?? value ?? '');
const money = value => Math.round(value * 100) / 100;
const objectId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
function onlyKeys(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('Expected an object');
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new ValidationError('Unsupported request field');
}
function pagination(query) {
  const number = (name, fallback, max) => {
    const value = query[name] ?? String(fallback);
    if (!['string', 'number'].includes(typeof value) || !/^\d+$/.test(String(value)) ||
        !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > max) {
      throw new ValidationError(`Invalid ${name}`);
    }
    return Number(value);
  };
  const page = number('page', 1, 100000), limit = number('limit', 20, 100);
  return { page, limit, skip: (page - 1) * limit };
}
function retailPrice(sp, size, now = new Date()) {
  let price = size ? size.sellingPrice : sp.baseSellingPrice;
  const discount = size
    ? { type: size.discountType, value: size.discountValue, start: size.discountStart, end: size.discountEnd }
    : sp.isOnSale ? { type: sp.saleType, value: sp.saleDiscountValue, start: sp.saleStartDate, end: sp.saleEndDate } : null;
  const active = discount?.value > 0 && (!discount.start || now >= new Date(discount.start)) &&
    (!discount.end || now <= new Date(discount.end));
  if (active) price = applyDiscount(price, discount);
  if (!Number.isFinite(price) || price <= 0) throw new ValidationError('Product has no valid selling price');
  return money(price);
}
const media = rows => (rows || []).map(row => ({ url: row.url, alt: row.alt || '' })).filter(row => row.url);
function publicProduct(sp, sizes = []) {
  const product = sp.product;
  const pricedSizes = sizes.filter(size => { try { retailPrice(sp, size); return true; } catch { return false; } });
  const variants = pricedSizes.map(size => ({ id: id(size), label: size.size, volume: size.volumeMl,
    unitsPerPack: size.unitsPerPack || 1, sellingPrice: retailPrice(sp, size),
    availableStock: size.availability === 'out_of_stock' ? 0 : Math.max(0, Math.min(sp.availableStock || 0, size.availableStock || 0)),
    maxOrderQuantity: size.maxOrderQuantity || 1000 }));
  let basePrice = null;
  if (sp.sellWithoutSizeVariants) { try { basePrice = retailPrice(sp); } catch { /* Unpriced records cannot be sold. */ } }
  const prices = variants.map(v => v.sellingPrice);
  if (basePrice != null) prices.push(basePrice);
  const sellingPrice = prices.length ? Math.min(...prices) : null;
  return { id: id(sp), productId: id(product), name: product.name, slug: product.slug, sku: sp.sku,
    shortDescription: sp.shortDescriptionOverride || product.shortDescription || '',
    description: sp.descriptionOverride || product.description || '',
    images: media(sp.imagesOverride?.length ? sp.imagesOverride : product.images),
    categoryId: id(product.category), beverageType: product.type, alcoholic: product.isAlcoholic === true,
    ageVerificationRequired: product.isAlcoholic === true, abv: product.abv ?? 0, volume: product.volumeMl,
    origin: product.originCountry || '', flavorNotes: product.flavorProfile || [],
    shelfLife: product.shelfLife || '', barcode: product.barcode || '', currency: 'NGN', sellingPrice, baseSellingPrice: basePrice,
    availableStock: sp.availableStock || 0, availability: (sp.availableStock || 0) > 0 && (basePrice != null || variants.some(v => v.availableStock > 0)),
    variants, requiresVariant: !sp.sellWithoutSizeVariants };
}
function normalizeCart(body) {
  onlyKeys(body, ['items', 'shipping', 'shippingMethod', 'customer', 'ageVerified', 'returnUrl']);
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50) throw new ValidationError('Cart must contain 1–50 items');
  const merged = new Map();
  for (const item of body.items) {
    onlyKeys(item, ['subProductId', 'sizeId', 'quantity']);
    if (!objectId(item.subProductId) || (item.sizeId != null && !objectId(item.sizeId))) throw new ValidationError('Invalid product or size ID');
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000) throw new ValidationError('Invalid quantity (1–1000)');
    const subProductId = item.subProductId.toLowerCase(), sizeId = item.sizeId?.toLowerCase() || null;
    const key = `${subProductId}:${sizeId || ''}`;
    const row = merged.get(key) || { subProductId, sizeId, quantity: 0 };
    row.quantity += item.quantity;
    if (row.quantity > 1000) throw new ValidationError('Invalid combined quantity (1–1000)');
    merged.set(key, row);
  }
  return [...merged.values()].sort((a, b) => `${a.subProductId}:${a.sizeId}`.localeCompare(`${b.subProductId}:${b.sizeId}`));
}
function paymentMatches(checkout, payment) {
  return payment?.status === 'success' && payment.reference === checkout.reference && payment.currency === 'NGN' &&
    Number.isFinite(payment.amount) && Math.round(payment.amount * 100) === checkout.amountKobo;
}
module.exports = { id, money, objectId, onlyKeys, pagination, retailPrice, publicProduct, normalizeCart, paymentMatches };
