// server/helpers/cart.helpers.js
'use strict';

/**
 * Cart line identity. MUST stay byte-identical to generateCartItemId in
 * client/apps/platform/src/context/CartContext.tsx — if these drift, merged
 * lines duplicate instead of collapsing.
 *
 * `vendor` is the tenant NAME, not its id. The colour slot appears ONLY when
 * the colour is truthy: the platform is a beverage marketplace (no colour
 * dimension — the Size row is the variant), while fashion tenant lines keep
 * per-colour ids.
 */
const buildCartItemId = (productId, size, vendor, color) =>
  color
    ? `${productId}-${size || 'default'}-${vendor || 'default'}-${color}`
    : `${productId}-${size || 'default'}-${vendor || 'default'}`;

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
  // Identity stays on the RAW `size` code — the client's generateCartItemId
  // and save echoes use the same string, so both sides must derive the same
  // cartItemId (a display label here would split every merged line in two).
  const idSizeLabel = size.size || size.displayName || '';
  // Human label for display only — displayName ("M · Emerald", "256 GB"), then
  // the explicit size label, then the raw channel code as a last resort. The
  // cart page renders selectedSizeLabel, falling back to selectedSize.
  const sizeLabel = size.displayName || size.sizeLabel || idSizeLabel;
  const vendorName = tenant.name || '';

  return {
    cartItemId: buildCartItemId(productId, idSizeLabel, vendorName, size.colorName || ''),

    // Product identity — the cart page reads _id/id, name, slug, images
    _id: productId,
    id: productId,
    name: product.name,
    slug: product.slug,
    sku: subproduct.sku,
    images: product.images || [],
    type: product.type,
    subType: product.subType,
    category: product.category,
    subCategory: product.subCategory,
    isAlcoholic: product.isAlcoholic,
    abv: product.abv,

    // Selection — echoed back verbatim on the next save
    selectedProductId: productId,
    selectedSubProductId: String(subproduct._id),
    selectedSizeId: String(size._id),
    selectedVendorId: String(tenant._id),
    selectedVendor: vendorName,
    selectedSize: idSizeLabel,
    selectedSizeLabel: sizeLabel,
    selectedColor: size.colorName || '',

    // Pricing — platform price AFTER any sub-product sale, never size.sellingPrice.
    // The caller passes the applySubProductSale() output, so finalPrice already
    // carries the sale and packUnitPrice is null while a sale runs.
    price: pricing?.finalPrice ?? 0,
    packUnitPrice: pricing?.packUnitPrice ?? null,
    packThreshold: pricing?.packThreshold ?? null,

    // Sale provenance for the drawer — without this the cart is the only surface
    // on the site that shows a sale item at its sale price with no sign it's on
    // sale. Mirrors the packInfo contract validateCartItems returns.
    saleActive: pricing?.saleActive === true,
    priceBeforeSale: pricing?.priceBeforeSale ?? pricing?.finalPrice ?? 0,

    quantity: item.quantity || 1,
    addedAt: item.addedAt ? new Date(item.addedAt).getTime() : Date.now(),
  };
};

/**
 * Union of the stored cart and the browser's cart, keyed by cartItemId.
 * A line present on both sides keeps the HIGHER quantity - never the sum, so
 * logging in repeatedly cannot inflate a line. Every other field comes from
 * the DB line, which carries freshly-computed pricing.
 *
 * The same offer can arrive under TWO ids - a stale browser mirror may still
 * carry the pre-2026-11-13 colour-suffixed id while the stored cart emits the
 * current colourless one. Identity therefore falls back to the offer key
 * (selectedSubProductId + selectedSizeId): one offer = one line, higher
 * quantity wins. Without this, syncCart re-added the offer once per id and
 * the quantity doubled "on its own" (2026-11-14 report).
 */
const offerKey = (line) =>
  line?.selectedSubProductId && line?.selectedSizeId
    ? `${line.selectedSubProductId}-${line.selectedSizeId}`
    : null;

const mergeCartLines = (dbLines, localLines) => {
  const merged = [];
  const byId = new Map();
  const byOffer = new Map();
  const place = (line) => {
    merged.push(line);
    if (line.cartItemId) byId.set(line.cartItemId, merged.length - 1);
    const key = offerKey(line);
    if (key && !byOffer.has(key)) byOffer.set(key, merged.length - 1);
  };

  for (const dbLine of dbLines || []) place({ ...dbLine });

  for (const local of localLines || []) {
    const existingIndex =
      byId.get(local.cartItemId) ??
      (offerKey(local) !== null ? byOffer.get(offerKey(local)) : undefined);

    if (existingIndex === undefined) {
      place({ ...local });
      continue;
    }

    const existing = merged[existingIndex];
    existing.quantity = Math.max(existing.quantity || 1, local.quantity || 1);
    // Backfill identity fields a legacy mirror line lacks so the offer key
    // keeps protecting the merged line from further duplicate arrivals.
    if (!existing.selectedSubProductId && local.selectedSubProductId) {
      existing.selectedSubProductId = local.selectedSubProductId;
      existing.selectedSizeId = local.selectedSizeId;
    }
  }

  return merged;
};

module.exports = { buildCartItemId, buildCartLine, mergeCartLines };
