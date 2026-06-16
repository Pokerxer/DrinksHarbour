// services/pricelist.service.js
const Pricelist = require('../models/Pricelist');
const { resolveShopWarehouse } = require('./warehouse.service');

/**
 * Pure resolution core — no DB. Given the tenant's pricelists, the active
 * shopId, and its resolved warehouseId, decide:
 *   resolved — the auto-resolved pricelist by precedence shop → warehouse →
 *              default, or null.
 *   allowed  — dedup of shop-bound ∪ warehouse-bound ∪ default ∪
 *              unscoped-selectable; the set a manual override is validated
 *              against.
 * Tie-break within a tier: createdAt ascending (oldest wins), deterministic.
 */
function pickPricelistForShop({ pricelists, shopId, warehouseId }) {
  const sid = String(shopId || '');
  const wid = warehouseId ? String(warehouseId) : null;
  const list = Array.isArray(pricelists) ? pricelists : [];

  const hasShop = (p) => (p.shops || []).map(String).includes(sid);
  const hasWh = (p) => !!wid && (p.warehouses || []).map(String).includes(wid);
  const isUnscoped = (p) =>
    !!p.isSelectable && !(p.shops || []).length && !(p.warehouses || []).length;
  const byCreated = (a, b) =>
    new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();

  const shopMatch = list.filter(hasShop).sort(byCreated);
  const whMatch = list.filter(hasWh).sort(byCreated);
  const defMatch = list.filter((p) => p.isDefault).sort(byCreated);
  const unscoped = list.filter(isUnscoped).sort(byCreated);

  const resolved = shopMatch[0] || whMatch[0] || defMatch[0] || null;

  const allowedMap = new Map();
  for (const p of [...shopMatch, ...whMatch, ...defMatch, ...unscoped]) {
    allowedMap.set(String(p._id), p);
  }
  return { resolved, allowed: [...allowedMap.values()] };
}

/**
 * Async wrapper: resolves the shop's warehouse, loads the tenant's pricelists,
 * and runs the pure core. Returns { resolved, allowed, warehouseId }.
 */
async function resolveShopPricelist(tenant, tenantId, shopId) {
  const warehouseId = await resolveShopWarehouse(tenant, tenantId, shopId);
  const pricelists = await Pricelist.find({ tenant: tenantId }).lean();
  const { resolved, allowed } = pickPricelistForShop({ pricelists, shopId, warehouseId });
  return { resolved, allowed, warehouseId };
}

/**
 * Ensure at most one default pricelist per tenant (mirrors Warehouse.isDefault).
 * Clears isDefault on all tenant pricelists except `exceptId`.
 */
async function enforceSingleDefault(tenantId, exceptId = null) {
  const filter = { tenant: tenantId };
  if (exceptId) filter._id = { $ne: exceptId };
  await Pricelist.updateMany(filter, { $set: { isDefault: false } });
}

module.exports = { pickPricelistForShop, resolveShopPricelist, enforceSingleDefault };
