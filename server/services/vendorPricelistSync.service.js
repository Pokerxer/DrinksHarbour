// services/vendorPricelistSync.service.js
//
// Keeps a vendor's AUTO-MANAGED pricelist in sync with the most recent purchase
// from that vendor. Called when a Purchase Order is validated. "Last purchase
// wins": the validated PO's unit costs overwrite matching auto-list lines and
// new products are appended, with a full price-history entry per change. Manual
// (negotiated) lists are never touched — a separate auto list is created instead.

const VendorPricelist = require('../models/VendorPricelist');
const { applyPOItemsToPricelist } = require('../utils/pricelistHistory');

/**
 * Find or create the vendor's auto-managed pricelist.
 * Targeting order:
 *  1. an existing autoManaged list
 *  2. a single legacy "… Auto Pricelist" (adopt it as auto-managed)
 *  3. only manual lists exist -> create a new auto list
 *  4. no lists -> create a new auto list
 */
async function resolveAutoPricelist(po, tenantId, userId) {
  const lists = await VendorPricelist.find({
    tenant: tenantId,
    vendor: po.vendor,
  }).sort({ updatedAt: -1 });

  let pl = lists.find((l) => l.autoManaged);
  if (pl) return { pl, created: false };

  // Adopt a legacy auto list (named "… Auto Pricelist") if one exists.
  const legacy = lists.find((l) => /Auto Pricelist$/i.test(l.name || ''));
  if (legacy) {
    legacy.source = 'auto';
    legacy.autoManaged = true;
    return { pl: legacy, created: false };
  }

  // Otherwise create a fresh auto list (manual lists, if any, are left alone).
  pl = new VendorPricelist({
    tenant: tenantId,
    name: `${po.vendorName || 'Vendor'} — Auto Pricelist`,
    vendor: po.vendor,
    vendorName: po.vendorName || 'Vendor',
    currency: po.currency || 'NGN',
    isActive: true,
    source: 'auto',
    autoManaged: true,
    items: [],
    createdBy: userId || po.createdBy,
  });
  return { pl, created: true };
}

/**
 * Upsert a vendor's auto-managed pricelist from a validated purchase order.
 * @returns {Promise<{pricelistId, created, updated, added, changed}|null>}
 */
async function syncVendorPricelistFromPO(po, tenantId, userId) {
  if (!po || !po.vendor || !Array.isArray(po.items) || po.items.length === 0) {
    return null;
  }

  const { pl, created } = await resolveAutoPricelist(po, tenantId, userId);

  if (po.currency) pl.currency = po.currency;

  const now = new Date();
  const { updated, added, changed } = applyPOItemsToPricelist(pl, po.items, {
    now,
    userId: userId || po.createdBy,
    poId: po._id,
    poNumber: po.poNumber,
  });

  // Nothing to persist on an existing, unchanged list.
  if (!created && updated === 0 && added === 0) {
    return { pricelistId: pl._id, created, updated, added, changed };
  }

  pl.lastSyncedAt = now;
  pl.lastSyncedPO = { id: po._id, poNumber: po.poNumber };
  pl.updatedBy = userId || po.createdBy;
  pl.markModified('items'); // history mutations on sub-docs
  await pl.save();

  return { pricelistId: pl._id, created, updated, added, changed };
}

module.exports = { syncVendorPricelistFromPO, resolveAutoPricelist };
