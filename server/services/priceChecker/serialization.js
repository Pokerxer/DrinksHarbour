const sanitizeHtml = require('sanitize-html');
const { createHash } = require('node:crypto');
require('../../models/Category');
require('../../models/SubCategory');
const CATALOGUE_FIELDS = '_id name brand images isAlcoholic abv originCountry type category subCategory grapeVarieties';
const CATALOGUE_REFS = [
  { path: 'brand', select: 'name' },
  { path: 'category', select: 'name' },
  { path: 'subCategory', select: 'name subType' },
];
const { defaults, safeImage } = require('./validation');
function publicConfig({ kiosk, tenant, location, shopName }) {
  const settings = { ...defaults, ...kiosk.settings };
  return {
    slug: kiosk.slug,
    revision: kiosk.version,
    currency: kiosk.currency,
    settings,
    ...(settings.displayStoreName ? { store: { name: shopName, location: location?.name } } : {}),
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
  if (product.category?.name) result.category = product.category.name;
  if (product.subCategory?.name) result.subCategory = product.subCategory.name;
  if (product.type) result.beverageType = product.type;
  const grapes = (Array.isArray(product.grapeVarieties) ? product.grapeVarieties : [])
    .filter((value) => typeof value === 'string' && value.trim())
    .slice(0, 8)
    .map((value) => value.trim().slice(0, 80));
  if (grapes.length) result.grapeVarieties = grapes;
  else if (product.subCategory?.name && /(?:^|_)varietal$/.test(product.subCategory.subType || '')) {
    result.grapeVarieties = [product.subCategory.name];
  }
  if (settings.enableCompare || settings.enablePhoneScan) {
    if (typeof product.abv === 'number') result.abv = product.abv;
    if (product.originCountry) result.origin = product.originCountry;
  }
  if (size._id) {
    result.variantKey = createHash('sha256').update(String(size._id)).digest('base64url');
  }
  const description = product.description || product.shortDescription;
  if (settings.enablePhoneScan && typeof description === 'string') {
    const entities = { amp: '&', lt: '<', gt: '>', quot: '"' };
    const text = sanitizeHtml(description, { allowedTags: [], allowedAttributes: {} })
      .replace(/&(amp|lt|gt|quot);/g, (_match, entity) => entities[entity])
      .trim();
    if (text) result.description = text;
  }
  if (settings.displayImages && image) result.image = image;
  if (settings.displayBrand && product.brand?.name) result.brand = product.brand.name;
  if (settings.displaySize) {
    const volume = size.volumeMl > 0 ? `${size.volumeMl} ml` : undefined;
    const label = size.displayName || volume || size.size;
    if (label) result.size = String(label);
    if ((settings.enableCompare || settings.enablePhoneScan) && volume) {
      result.volume = volume;
      result.volumeMl = size.volumeMl;
    }
  }
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
module.exports = { publicConfig, publicProduct, CATALOGUE_FIELDS, CATALOGUE_REFS };
