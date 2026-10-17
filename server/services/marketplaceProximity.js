'use strict';
const { distanceKm } = require('../utils/shoppingLocation');
const id = value => String(value?._id ?? value ?? '');
const available = size => size.stock > 0 && size.availability !== 'out_of_stock';
const buyable = offer => (offer.sizes || []).some(available);
const byId = (a, b) => id(a).localeCompare(id(b));
function byDistance(a, b) {
  const unknown = Number(a.distanceKm == null) - Number(b.distanceKm == null);
  return unknown || ((a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}
function rankOffers(offers, location) {
  return (offers || []).map(offer => {
    const { _sellerLocation, ...publicOffer } = offer;
    const { location: storedLocation, ...tenant } = publicOffer.tenant || {};
    return { ...publicOffer, tenant, distanceKm: distanceKm(location, _sellerLocation || storedLocation), distanceKind: 'geographic' };
  }).sort((a, b) => Number(!buyable(a)) - Number(!buyable(b)) || byDistance(a, b) || byId(a, b));
}
function qualifyingSizes(offer, options) {
  if (options.saleType && (!offer.isOnSale || offer.saleType !== options.saleType)) return [];
  return (offer.sizes || []).filter(size => {
    const price = size.pricing?.websitePrice;
    if (!Number.isFinite(price) || price < 0) return false;
    if (options.minPrice != null && price < Number(options.minPrice)) return false;
    if (options.maxPrice != null && price > Number(options.maxPrice)) return false;
    if ((options.onSale === true || options.onSale === 'true') &&
        !offer.isOnSale && !size.discount?.hasDiscount) return false;
    return true;
  });
}
function selectShoppingOffer(offers, options = {}) {
  const candidates = offers.map(offer => ({ ...offer, sizes: qualifyingSizes(offer, options) })).filter(o => o.sizes.length);
  const chosen = candidates.find(buyable);
  if (!chosen) return null;
  const size = chosen.sizes.find(s => available(s) && s.isDefault) || chosen.sizes.find(available);
  return {
    subProductId: id(chosen), sizeId: id(size), tenantId: id(chosen.tenant),
    distanceKm: chosen.distanceKm, price: size.pricing.websitePrice, currency: size.pricing.currency || 'NGN',
  };
}
function decorateProduct(product, options) {
  const availableAt = rankOffers(product.availableAt, options.shoppingLocation)
    .map(offer => ({ ...offer, sizes: qualifyingSizes(offer, options) })).filter(offer => offer.sizes.length)
    .sort((a, b) => Number(!buyable(a)) - Number(!buyable(b)) || byDistance(a, b) || byId(a, b));
  if (!availableAt.length) return null;
  const shoppingOffer = selectShoppingOffer(availableAt);
  const sizes = availableAt.flatMap(offer => offer.sizes);
  const prices = sizes.map(size => size.pricing.websitePrice);
  const stock = sizes.reduce((sum, size) => sum + (available(size) ? size.stock : 0), 0);
  return { ...product, availableAt, shoppingOffer,
    priceRange: { ...product.priceRange, min: Math.min(...prices), max: Math.max(...prices) },
    stockInfo: { ...product.stockInfo, totalStock: stock, availableStock: stock, tenants: availableAt.length, totalSizes: sizes.length },
    availability: { ...product.availability, status: stock > 0 ? 'in_stock' : 'out_of_stock', inStock: stock > 0 },
    locationOrder: options.sortBy && options.sortBy !== 'nearest' ? 'custom' : 'nearest' };
}
function compareProducts(a, b, sortBy = 'nearest') {
  const price = product => product.shoppingOffer?.price ?? product.priceRange?.min ?? 0;
  let value = 0;
  switch (sortBy) {
    case 'price_low': value = price(a) - price(b); break;
    case 'price_high': value = price(b) - price(a); break;
    case 'newest': value = new Date(b.createdAt || 0) - new Date(a.createdAt || 0); break;
    case 'name': case 'name_asc': value = (a.name || '').localeCompare(b.name || ''); break;
    case 'name_desc': value = (b.name || '').localeCompare(a.name || ''); break;
    case 'rating': value = (b.averageRating || 0) - (a.averageRating || 0); break;
    case 'popular': case 'bestselling': value = (b.totalSold || 0) - (a.totalSold || 0); break;
    case 'discount': value = (b.discount?.percentage || b.discount?.value || 0) - (a.discount?.percentage || a.discount?.value || 0); break;
    case 'relevance': value = (b.relevanceScore || 0) - (a.relevanceScore || 0); break;
    default:
      value = Number(!a.shoppingOffer) - Number(!b.shoppingOffer) ||
        byDistance(a.shoppingOffer || {}, b.shoppingOffer || {});
  }
  return value || byId(a, b);
}
function resolveProximityProducts(products, options) {
  const resolved = products.map(product => decorateProduct(product, options)).filter(Boolean);
  resolved.sort((a, b) => compareProducts(a, b, options.sortBy));
  const page = options.page || 1, limit = options.limit || resolved.length || 1;
  return { products: resolved.slice((page - 1) * limit, page * limit), totalResults: resolved.length };
}
module.exports = { rankOffers, selectShoppingOffer, resolveProximityProducts };
