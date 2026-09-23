const { defaults, safeImage } = require('./validation');
function publicConfig({ kiosk, tenant, location, shopName }) {
  const settings = { ...defaults, ...kiosk.settings };
  return {
    slug: kiosk.slug,
    currency: kiosk.currency,
    settings,
    ...(settings.displayStoreName ? { store: { name: shopName, location: location.name } } : {}),
    ...(settings.displayTenantName ? { tenantName: tenant.name } : {}),
  };
}
function publicProduct({ product, size, pricing, stock, settings: overrides }) {
  const settings = { ...defaults, ...overrides };
  const images = product.images || [];
  const image = safeImage((images.find((row) => row.isPrimary) || images[0])?.url);
  const result = {
    name: product.name,
    price: pricing.price,
    currency: pricing.currency,
    alcoholic: product.isAlcoholic === true,
    taxLabel: pricing.taxLabel || '',
  };
  if (settings.displayImages && image) result.image = image;
  if (settings.displayBrand && product.brand?.name) result.brand = product.brand.name;
  if (settings.displaySize) result.size = size.displayName || size.size;
  if (settings.displayBarcode) result.barcode = size.barcode;
  if (settings.displayStockStatus) result.availability = stock.availability;
  if (settings.displayStockQuantity) result.quantity = stock.quantity;
  if (settings.outOfStock === 'STAFF_MESSAGE' && stock.quantity <= 0)
    result.staffMessage = 'Currently unavailable — please ask a staff member';
  if (settings.displayPromotions && pricing.originalPrice > pricing.price) {
    result.originalPrice = pricing.originalPrice;
    result.savings = Math.round((pricing.originalPrice - pricing.price) * 100) / 100;
    if (settings.displayDiscountPercentage)
      result.discountPercentage = Math.round((result.savings / pricing.originalPrice) * 100);
  }
  return result;
}
module.exports = { publicConfig, publicProduct };
