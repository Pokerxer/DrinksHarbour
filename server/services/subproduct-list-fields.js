// Private admin list only. Keep fields used by filters, cards, expanded rows and
// bulk actions; edit/detail consumers continue to request full records.
const SUBPRODUCT_LIST_FIELDS = [
  '_id', 'product', 'tenant', 'sku', 'sizes', 'baseSellingPrice', 'costPrice',
  'currency', 'totalStock', 'availableStock', 'stockStatus', 'status',
  'isPublished', 'isFeaturedByTenant', 'isBestSeller', 'isNewArrival', 'isOnSale',
  'descriptionOverride', 'imagesOverride', 'totalSold', 'totalRevenue',
  'viewCount', 'conversionRate', 'marginPercentage', 'reorderPoint',
  'lowStockThreshold', 'visibleInPOS', 'visibleInOnlineStore', 'seasonality',
  'specialOccasions', 'lastSoldDate', 'lastRestockDate', 'createdAt', 'updatedAt',
].join(' ');

const SIZE_LIST_FIELDS = [
  '_id', 'size', 'displayName', 'sellingPrice', 'stock', 'availableStock',
  'availability', 'lowStockThreshold',
].join(' ');

module.exports = { SUBPRODUCT_LIST_FIELDS, SIZE_LIST_FIELDS };
