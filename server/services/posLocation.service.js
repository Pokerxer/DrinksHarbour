const Warehouse = require('../models/Warehouse');
const { ValidationError } = require('../utils/errors');

async function requirePOSLocation(tenantId, warehouseId) {
  if (!warehouseId) throw new ValidationError('Select a stock location for this POS before selling.');
  const id = warehouseId._id || warehouseId;
  const location = await Warehouse.findOne({
    _id: id, tenant: tenantId, isActive: true, posEnabled: { $ne: false },
  }).select('_id').lean();
  if (!location) throw new ValidationError('POS stock location is unavailable or does not allow POS sales.');
  return location._id;
}

async function resolveShopWarehouse(tenant, tenantId, shopId) {
  const builtIn = !shopId || String(shopId) === 'retail';
  if (!builtIn) {
    const shops = tenant?.posSettings?.shops;
    const shop = Array.isArray(shops)
      ? shops.find(row => String(row._id) === String(shopId))
      : shops?.id?.(shopId);
    if (!shop || shop.active === false) throw new ValidationError('POS is missing or inactive.');
    return requirePOSLocation(tenantId, shop.warehouse);
  }
  if (tenant?.posSettings?.retailWarehouse) {
    return requirePOSLocation(tenantId, tenant.posSettings.retailWarehouse);
  }
  const location = await Warehouse.findOne({
    tenant: tenantId, isDefault: true, isActive: true, posEnabled: { $ne: false },
  }).select('_id').lean();
  if (!location) throw new ValidationError('Set an active default stock location with POS sales enabled.');
  return location._id;
}

module.exports = { requirePOSLocation, resolveShopWarehouse };
