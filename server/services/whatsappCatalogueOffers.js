'use strict';

const SubProduct = require('../models/SubProduct');
const { retailSizeWhereClause } = require('../constants/sizeChannels');
const { calculateSizePricing, applySubProductSale } = require('../utils/pricing');
const { resolveCheckoutDefault, defaultWarehouseField } = require('./marketplaceDefaultWarehouse');
const { scopeOffers, selection, selectionFields } = require('./marketplaceWarehouseStock');

async function getWhatsappOffers(productIds) {
  const listings = await SubProduct.find({
    product: { $in: productIds },
    isPublished: true,
    status: { $in: ['active', 'low_stock', 'out_of_stock'] },
    visibleInOnlineStore: { $ne: false },
  }).select('product tenant sizes status costPrice baseSellingPrice isOnSale saleDiscountValue saleType saleStartDate saleEndDate')
    .populate([
      { path: 'product', select: 'type platformMarkup platformDiscount' },
      { path: 'tenant', select: 'name businessName status subscriptionStatus revenueModel sellingPriceMarkupPercentage markupPercentage commissionPercentage packMarkupPercentage packCommissionPercentage packRateMinUnits ' + selectionFields + ' ' + defaultWarehouseField },
      { path: 'sizes', match: retailSizeWhereClause() },
    ]).lean();

  const defaults = new Map();
  const candidates = await Promise.all(listings.map(async listing => {
    const { tenant, product } = listing;
    if (!product || tenant?.status !== 'approved' ||
        !['active', 'trialing'].includes(tenant.subscriptionStatus) ||
        (listing.status !== 'active' && !selection(tenant).length)) return null;
    const sizes = (listing.sizes || []).filter(size =>
      size && (!size.status || size.status === 'active') &&
      String(size.tenant) === String(tenant._id) &&
      String(size.subproduct) === String(listing._id)
    );
    if (!sizes.length) return null;
    if (require('./marketContext').enabled()) {
      const access = await require('./marketPolicy').evaluateMarketAccess({
        tenant, market: require('./marketContext').currentMarket(),
        category: require('./marketIngress').categoryFor(product), channel: 'marketplace',
      });
      if (!access.allowed) return null;
    }
    const tenantId = String(tenant._id);
    if (!defaults.has(tenantId)) defaults.set(tenantId, resolveCheckoutDefault(tenant));
    const warehouse = await defaults.get(tenantId);
    if (!warehouse) return null;
    return {
      ...listing, sizes,
      tenant: { ...tenant, warehouseSettings: { marketplaceWarehouses: [warehouse] } },
    };
  }));

  const scoped = await scopeOffers(candidates.filter(Boolean));
  return scoped.flatMap(listing => {
    const sizes = listing.sizes.flatMap(size => {
      const stock = size.availableStock ?? 0;
      const availableStock = size.maxOrderQuantity > 0 ? Math.min(stock, size.maxOrderQuantity) : stock;
      if (!(availableStock > 0)) return [];
      const { finalPrice } = applySubProductSale(calculateSizePricing(
        size, listing.product, listing.tenant, listing.costPrice, listing.baseSellingPrice
      ), listing);
      if (!(finalPrice > 0)) return [];
      return [{
        sizeId: String(size._id),
        displayName: [size.displayName || size.size || 'Size', size.colorName, size.optionName].filter(Boolean).join(' · '),
        marketplacePrice: finalPrice,
        availableStock,
        sku: size.sku,
      }];
    });
    return sizes.length ? [{
      productId: String(listing.product._id),
      subProductId: String(listing._id),
      tenantId: String(listing.tenant._id),
      tenantName: listing.tenant.businessName || listing.tenant.name || 'Tenant',
      sizes,
    }] : [];
  });
}

module.exports = { getWhatsappOffers };
