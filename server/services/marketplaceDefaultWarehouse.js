'use strict';

const Warehouse = require('../models/Warehouse');
const { id } = require('./storefrontPricing');

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

module.exports = { resolveDefaults, defaultWarehouseField };
