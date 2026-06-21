// services/pricelist.service.js
const Pricelist = require('../models/Pricelist');
const { resolveShopWarehouse } = require('./warehouse.service');

/**
 * Pure resolution core — no DB. Given the tenant's pricelists, the active
 * shopId, its resolved warehouseId, and an optional customer-assigned pricelist
 * id, decide:
 *   resolved — the auto-resolved pricelist by precedence customer → shop →
 *              warehouse → default, or null.
 *   allowed  — dedup of customer-assigned ∪ shop-bound ∪ warehouse-bound ∪
 *              default ∪ unscoped-selectable; the set a manual override is
 *              validated against.
 * Tie-break within a tier: createdAt ascending (oldest wins), deterministic.
 *
 * A customer's pricelist takes top precedence (it's the per-customer default
 * auto-pick), but only when its id actually belongs to the tenant's list — a
 * dangling/off-tenant id is ignored so a customer can never be priced against a
 * pricelist that isn't theirs.
 */
function pickPricelistForShop({ pricelists, shopId, warehouseId, customerPricelistId }) {
  const sid = String(shopId || '');
  const wid = warehouseId ? String(warehouseId) : null;
  const cid = customerPricelistId ? String(customerPricelistId) : null;
  const list = Array.isArray(pricelists) ? pricelists : [];

  const hasShop = (p) => (p.shops || []).map(String).includes(sid);
  const hasWh = (p) => !!wid && (p.warehouses || []).map(String).includes(wid);
  const isUnscoped = (p) =>
    !!p.isSelectable && !(p.shops || []).length && !(p.warehouses || []).length;
  const byCreated = (a, b) =>
    new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();

  // Only honour a customer id that resolves to a real tenant pricelist.
  const customerMatch = cid ? list.find((p) => String(p._id) === cid) || null : null;
  const shopMatch = list.filter(hasShop).sort(byCreated);
  const whMatch = list.filter(hasWh).sort(byCreated);
  const defMatch = list.filter((p) => p.isDefault).sort(byCreated);
  const unscoped = list.filter(isUnscoped).sort(byCreated);

  const resolved = customerMatch || shopMatch[0] || whMatch[0] || defMatch[0] || null;

  const allowedMap = new Map();
  for (const p of [
    ...(customerMatch ? [customerMatch] : []),
    ...shopMatch, ...whMatch, ...defMatch, ...unscoped,
  ]) {
    allowedMap.set(String(p._id), p);
  }
  return { resolved, allowed: [...allowedMap.values()] };
}

/**
 * Async wrapper: resolves the shop's warehouse, loads the tenant's pricelists,
 * and runs the pure core. An optional customerPricelistId (the pricelist bound
 * to the selected POSCustomer) is threaded through so it can take top
 * precedence — still bounded by `allowed`, so an off-tenant id is ignored.
 * Returns { resolved, allowed, warehouseId }.
 */
async function resolveShopPricelist(tenant, tenantId, shopId, customerPricelistId = null) {
  const warehouseId = await resolveShopWarehouse(tenant, tenantId, shopId);
  const pricelists = await Pricelist.find({ tenant: tenantId }).lean();
  const { resolved, allowed } = pickPricelistForShop({
    pricelists, shopId, warehouseId, customerPricelistId,
  });
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
