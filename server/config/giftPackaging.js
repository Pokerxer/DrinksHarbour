'use strict';
// config/giftPackaging.js
//
// Single source of truth for the paid gift-packaging SKU (gift checkout,
// docs/superpowers/specs/2026-10-27-gift-checkout-design.md). The SKU is
// resolved at request time from the central catalog rather than hard-coded, so
// super-admins can approve/move it without a deploy:
//   Product { isGiftPackaging: true } → its published, active SubProduct →
//   its priced Size.
//
// Results are cached ~5 minutes (like chatbot loadCatalog) so checkout doesn't
// add three catalog reads per gift request. Env GIFT_PACKAGING_TENANT_ID
// optionally pins the owning tenant (useful when several tenants seed the
// packaging product during a migration).

const Product = require('../models/Product');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');

// Africa/Lagos is UTC+1 all year (no DST), so "today in Lagos" is simply
// Date.now() shifted one hour forward, read through the UTC getters.
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const GIFT_DATE_MAX_DAYS = 180;

const lagosDayStart = () => {
  const shifted = new Date(Date.now() + LAGOS_OFFSET_MS);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
};

/**
 * Validate a customer-supplied requested delivery date.
 * Contract: 'YYYY-MM-DD', >= tomorrow (Africa/Lagos), <= +180 days.
 * Throws an Error with a customer-safe message; returns true otherwise.
 */
const assertRequestedDeliveryDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Requested delivery date must use the YYYY-MM-DD format');
  }
  const [y, m, d] = value.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d);
  // Round-trip rejects impossible calendar dates (2026-02-31 rolls to March).
  if (new Date(ms).toISOString().slice(0, 10) !== value) {
    throw new Error('Requested delivery date is not a real calendar date');
  }
  const dayStart = lagosDayStart();
  if (ms < dayStart + DAY_MS) {
    throw new Error('Requested delivery date must be at least tomorrow (Lagos time)');
  }
  if (ms > dayStart + GIFT_DATE_MAX_DAYS * DAY_MS) {
    throw new Error('Requested delivery date can be at most 180 days ahead (Lagos time)');
  }
  return true;
};

/**
 * Fold a validated client gift object into the exact Order.gift subdoc shape.
 * Returns undefined when anything essential is missing, so the controller
 * persists gift data only when it is complete and well-formed.
 */
const normalizeRecipientPhone = (value) => {
  const phone = typeof value === 'string' && value.length <= 32
    ? value.trim().replace(/[\s().-]/g, '')
    : '';
  return /^\+?[0-9]{10,15}$/.test(phone) ? phone : undefined;
};

const normalizeGiftSubdoc = (gift) => {
  if (!gift || typeof gift !== 'object' || gift.isGift !== true) return undefined;
  const from = typeof gift.from === 'string' ? gift.from.trim() : '';
  const to = typeof gift.to === 'string' ? gift.to.trim() : '';
  const requestedDeliveryDate =
    typeof gift.requestedDeliveryDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(gift.requestedDeliveryDate)
      ? gift.requestedDeliveryDate
      : '';
  if (!from || !to || !requestedDeliveryDate) return undefined;
  const recipientPhone = normalizeRecipientPhone(gift.recipientPhone);
  return {
    isGift: true,
    from,
    to,
    ...(recipientPhone ? { recipientPhone } : {}),
    message: typeof gift.message === 'string' ? gift.message.slice(0, 500) : '',
    requestedDeliveryDate,
    packagingRequested: gift.packagingRequested === true,
  };
};

// ── SKU resolution (cached ~5 min) ───────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = { at: 0, value: null };

const clearGiftPackagingCache = () => { cache = { at: 0, value: null }; };

const resolveGiftPackagingSku = async () => {
  const product = await Product.findOne({ isGiftPackaging: true })
    .select('_id name')
    .lean();
  if (!product) return null;

  // The storefront-usable listing: published, active, visible online. When
  // GIFT_PACKAGING_TENANT_ID is set, only that tenant's listing counts.
  const spFilter = {
    product: product._id,
    status: 'active',
    isPublished: true,
    visibleInOnlineStore: { $ne: false },
  };
  if (process.env.GIFT_PACKAGING_TENANT_ID) spFilter.tenant = process.env.GIFT_PACKAGING_TENANT_ID;

  const subProduct = await SubProduct.findOne(spFilter)
    .select('_id tenant baseSellingPrice sellWithoutSizeVariants')
    .lean();
  if (!subProduct) return null;

  const size = await Size.findOne({ subproduct: subProduct._id })
    .sort({ sellingPrice: 1, createdAt: 1 })
    .select('_id sellingPrice tenant')
    .lean();

  const price = size?.sellingPrice > 0 ? size.sellingPrice : subProduct.baseSellingPrice;
  if (!(price > 0)) return null;

  return {
    productId: String(product._id),
    subProductId: String(subProduct._id),
    sizeId: size ? String(size._id) : null,
    price,
    tenantId: String(subProduct.tenant),
  };
};

const getGiftPackagingSku = async () => {
  if (Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  let value = null;
  try {
    value = await resolveGiftPackagingSku();
  } catch (err) {
    // Catalog read failure must never break checkout — packaging just reads as
    // "not available yet" and the customer can untick the checkbox.
    console.error('❌ Gift packaging SKU resolution failed:', err.message);
  }
  cache = { at: Date.now(), value };
  return value;
};

module.exports = {
  getGiftPackagingSku,
  clearGiftPackagingCache,
  normalizeGiftSubdoc,
  normalizeRecipientPhone,
  assertRequestedDeliveryDate,
  lagosDayStart,
  GIFT_DATE_MAX_DAYS,
};
