// server/services/subproductStats.js
//
// Live Purchased/Sold stats for SubProducts, computed from the source
// collections the drill-down panels read.
//
// WHY THIS EXISTS
//
// The sub-product toolbar ("Purchased / Sold") and the list's expanded row
// ("Total Sold / Total Revenue") used to read the SubProduct DOCUMENT's
// analytics counters. Two of those counters are dead weight:
//   - `SubProduct.totalSold` is incremented by exactly one code path — the POS
//     controller (see services/orderDemand.helper.js). Marketplace and ERP
//     sales never touch it.
//   - `SubProduct.purchaseCount` has NO increment path anywhere in the
//     codebase.
// So a product with a 1,200-unit purchase order and 6 paid orders showed
// "Purchased 0 / Sold 0" (2026-11-11, Sunblessed Vinho Branco) while its
// drill-down panels — which aggregate Orders/PurchaseOrders directly — showed
// the real records.
//
// PARITY RULE: a counter must equal what its panel's default "All" view
// shows. The Sold panel (/api/orders?subProductId=) lists EVERY order
// containing the subproduct, any status; the Purchased panel
// (/api/purchase-orders?subProductId=) lists every PO, any status, scoped to
// the tenant. These aggregations mirror exactly that, so the number on the
// toolbar always matches the number at the top of the panel it opens.
//
// Performance shape: ONE aggregation per collection per call, bounded by the
// requested id set. Never call these per-row over the whole catalog — the
// admin list loads up to 5000 sub-products at once; that is why the list's
// expanded row fetches on expand instead.

const mongoose = require('mongoose');

const toObjectIdSet = (ids) => {
  const list = Array.isArray(ids) ? ids : [ids];
  return list
    .filter((id) => id != null)
    .map((id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id))));
};

/**
 * Units + revenue per sub-product across ALL orders containing it.
 *
 * Same population the Sold panel sees: `items.subproduct` match, any order
 * status, any payment state. Unwind + re-match so only the requested
 * sub-product's lines are summed when an order bundles several products.
 *
 * @param {Model} Order
 * @param {Array<ObjectId|string>} ids
 * @returns {Promise<Map<string, {units: number, revenue: number}>>}
 */
async function fetchSoldStats(Order, ids) {
  const wanted = toObjectIdSet(ids);
  if (!wanted.length) return new Map();
  try {
    const rows = await Order.aggregate([
      { $match: { 'items.subproduct': { $in: wanted } } },
      { $unwind: '$items' },
      { $match: { 'items.subproduct': { $in: wanted } } },
      {
        $group: {
          _id: '$items.subproduct',
          units: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.itemSubtotal' },
        },
      },
    ]);
    const map = new Map();
    for (const id of wanted) map.set(String(id), { units: 0, revenue: 0 });
    for (const row of rows) {
      if (row?._id == null) continue;
      map.set(String(row._id), {
        units: Number(row.units) || 0,
        revenue: Number(row.revenue) || 0,
      });
    }
    return map;
  } catch (error) {
    // A stats blip must degrade to zeros, never break the page that shows it.
    console.error('subproductStats: sold aggregation failed:', error.message);
    return new Map();
  }
}

/**
 * Units per sub-product across the tenant's purchase orders, every status —
 * the Purchased panel's "All" view (drafts included: an order that was placed
 * is what the panel shows; the counter must not disagree with it).
 *
 * @param {Model} PurchaseOrder
 * @param {Array<ObjectId|string>} ids
 * @param {{ tenantId?: string|null }} [options] — tenant scope mirrors the
 *        panel endpoint ({ tenant, 'items.subProductId' }). Null (platform
 *        admin reviewing another tenant's listing) counts across tenants.
 * @returns {Promise<Map<string, {units: number}>>}
 */
async function fetchPurchasedUnits(PurchaseOrder, ids, { tenantId = null } = {}) {
  const wanted = toObjectIdSet(ids);
  if (!wanted.length) return new Map();
  const match = { 'items.subProductId': { $in: wanted } };
  if (tenantId) match.tenant = new mongoose.Types.ObjectId(String(tenantId));
  try {
    const rows = await PurchaseOrder.aggregate([
      { $match: match },
      { $unwind: '$items' },
      { $match: match },
      { $group: { _id: '$items.subProductId', units: { $sum: '$items.quantity' } } },
    ]);
    const map = new Map();
    for (const id of wanted) map.set(String(id), { units: 0 });
    for (const row of rows) {
      if (row?._id == null) continue;
      map.set(String(row._id), { units: Number(row.units) || 0 });
    }
    return map;
  } catch (error) {
    console.error('subproductStats: purchased aggregation failed:', error.message);
    return new Map();
  }
}

/**
 * Combined live stats for a set of sub-product ids.
 *
 * @param {Array<ObjectId|string>} ids
 * @param {{ Order: Model, PurchaseOrder: Model, tenantId?: string|null }} models
 * @returns {Promise<Map<string, {units: number, revenue: number, purchased: number}>>}
 */
async function getSubProductStats(ids, { Order, PurchaseOrder, tenantId = null } = {}) {
  const wanted = toObjectIdSet(ids);
  const empty = new Map();
  for (const id of wanted) empty.set(String(id), { units: 0, revenue: 0, purchased: 0 });
  if (!wanted.length) return empty;

  const [sold, purchased] = await Promise.all([
    Order ? fetchSoldStats(Order, wanted) : Promise.resolve(new Map()),
    PurchaseOrder ? fetchPurchasedUnits(PurchaseOrder, wanted, { tenantId }) : Promise.resolve(new Map()),
  ]);

  const merged = new Map();
  for (const id of wanted) {
    const key = String(id);
    const s = sold.get(key) || { units: 0, revenue: 0 };
    const p = purchased.get(key) || { units: 0 };
    merged.set(key, { units: s.units, revenue: s.revenue, purchased: p.units });
  }
  return merged;
}

module.exports = { fetchSoldStats, fetchPurchasedUnits, getSubProductStats };
