'use strict';

const Warehouse = require('../models/Warehouse');
const { id } = require('./storefrontPricing');
const { selection } = require('./marketplaceWarehouseStock');

const defaultWarehouseField = 'warehouseSettings.defaultWarehouse';

async function resolveDefaults(tenants, session = null) {
  if (!tenants.length) return new Map();
  const configured = tenants.flatMap(tenant => {
    const warehouse = tenant.warehouseSettings?.defaultWarehouse;
    return warehouse ? [warehouse] : [];
  });
  const rows = await Warehouse.find({
    tenant: { $in: tenants.map(tenant => tenant._id) },
    isActive: true,
    $or: [{ _id: { $in: configured } }, { isDefault: true }],
  }).select('_id tenant isDefault').sort('_id').session(session).lean();

  const defaults = new Map();
  for (const tenant of tenants) {
    const configuredId = id(tenant.warehouseSettings?.defaultWarehouse);
    const warehouse = rows.find(row => id(row.tenant) === id(tenant) &&
      (configuredId ? id(row) === configuredId : row.isDefault === true));
    if (warehouse) defaults.set(id(tenant), warehouse._id);
  }
  return defaults;
}

/**
 * Checkout's reservation warehouse: the configured/default-flagged location
 * first, then — for tenants that only used the marketplace-warehouse picker —
 * the first ACTIVE warehouse in their `marketplaceWarehouses` selection.
 * Reservation must not dead-end on `checkout_warehouse_unavailable` while the
 * picker configuration is valid and stocked (2026-11-14 report); that answer
 * is reserved for tenants with NEITHER a default NOR an active selection.
 */
async function resolveCheckoutDefault(tenant, session = null) {
  const [configured] = (await resolveDefaults([tenant], session)).values();
  if (configured) return configured;
  const selected = selection(tenant);
  if (!selected.length) return null;
  const row = await Warehouse.findOne({
    _id: { $in: selected },
    tenant: tenant._id,
    isActive: true,
  }).select('_id').sort('_id').session(session).lean();
  return row?._id ?? null;
}

module.exports = { resolveDefaults, resolveCheckoutDefault, defaultWarehouseField };
