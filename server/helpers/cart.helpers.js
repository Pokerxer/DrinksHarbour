// server/helpers/cart.helpers.js
'use strict';

/**
 * Cart line identity. MUST stay byte-identical to generateCartItemId in
 * client/apps/platform/src/context/CartContext.tsx — if these drift, merged
 * lines duplicate instead of collapsing.
 *
 * `vendor` is the tenant NAME, not its id.
 */
const buildCartItemId = (productId, size, vendor, color) =>
  `${productId}-${size || 'default'}-${vendor || 'default'}-${color || 'default'}`;

/**
 * Turn a populated Cart.items[n] into the shape client/CartContext stores.
 * `pricing` is the calculateSizePricing output — the SAME pipeline the product
 * page and /api/cart/validate use. Returns null for lines that can no longer be
 * rendered (deleted product, delisted tenant, removed size) so callers drop them.
 */
const buildCartLine = (item, pricing) => {
  const product = item?.product;
  const subproduct = item?.subproduct;
  const size = item?.size;
  const tenant = subproduct?.tenant;

  if (!product || !subproduct || !size || !tenant) return null;

  const productId = String(product._id);
  const sizeLabel = size.size || size.displayName || '';
  const vendorName = tenant.name || '';

  return {
    cartItemId: buildCartItemId(productId, sizeLabel, vendorName, ''),

    // Product identity — the cart page reads _id/id, name, slug, images
    _id: productId,
    id: productId,
    name: product.name,
    slug: product.slug,
    sku: subproduct.sku,
    images: product.images || [],
    type: product.type,
    isAlcoholic: product.isAlcoholic,
    abv: product.abv,

    // Selection — echoed back verbatim on the next save
    selectedProductId: productId,
    selectedSubProductId: String(subproduct._id),
    selectedSizeId: String(size._id),
    selectedVendorId: String(tenant._id),
    selectedVendor: vendorName,
    selectedSize: sizeLabel,
    selectedColor: '',

    // Pricing — platform price, never size.sellingPrice
    price: pricing?.finalPrice ?? 0,
    packUnitPrice: pricing?.packUnitPrice ?? null,
    packThreshold: pricing?.packThreshold ?? null,

    quantity: item.quantity || 1,
    addedAt: item.addedAt ? new Date(item.addedAt).getTime() : Date.now(),
  };
};

/**
 * Union of the stored cart and the browser's cart, keyed by cartItemId.
 * A line present on both sides keeps the HIGHER quantity — never the sum, so
 * logging in repeatedly cannot inflate a line. Every other field comes from the
 * DB line, which carries freshly-computed pricing.
 */
const mergeCartLines = (dbLines, localLines) => {
  const merged = (dbLines || []).map((line) => ({ ...line }));
  const indexById = new Map(merged.map((line, i) => [line.cartItemId, i]));

  for (const local of localLines || []) {
    const existingIndex = indexById.get(local.cartItemId);

    if (existingIndex === undefined) {
      merged.push({ ...local });
      indexById.set(local.cartItemId, merged.length - 1);
      continue;
    }

    const existing = merged[existingIndex];
    existing.quantity = Math.max(existing.quantity || 1, local.quantity || 1);
  }

  return merged;
};

module.exports = { buildCartItemId, buildCartLine, mergeCartLines };
