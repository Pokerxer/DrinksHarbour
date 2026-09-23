const Tenant = require('../../models/Tenant');
const Warehouse = require('../../models/Warehouse');
const Pricelist = require('../../models/Pricelist');
const { pickPricelistForShop } = require('../pricelist.service');
const { NotFoundError } = require('../../utils/errors');
const unavailable = () => {
  throw new NotFoundError('Kiosk unavailable. Please ask a member of staff.');
};
async function loadContext(kiosk, { configuring = false } = {}) {
  if (!kiosk || (!configuring && !kiosk.enabled) || kiosk.mode !== 'STORE_ONLY') unavailable();
  const tenantId = kiosk.tenant;
  const [tenant, location, lists] = await Promise.all([
    Tenant.findOne({ _id: tenantId, status: 'approved' })
      .select('name status subscriptionStatus trialEndsAt posSettings defaultCurrency')
      .lean(),
    Warehouse.findOne({ _id: kiosk.location, tenant: tenantId, isActive: true })
      .select('name isActive isDefault')
      .lean(),
    Pricelist.find({ tenant: tenantId }).lean(),
  ]);
  if (
    !tenant ||
    !location ||
    location.isActive === false ||
    !['active', 'trialing'].includes(tenant.subscriptionStatus)
  )
    unavailable();
  if (
    tenant.subscriptionStatus === 'trialing' &&
    tenant.trialEndsAt &&
    new Date(tenant.trialEndsAt) <= new Date()
  )
    unavailable();
  const retail = kiosk.shopId === 'retail';
  const shop = retail
    ? null
    : tenant.posSettings?.shops?.find((row) => String(row._id) === kiosk.shopId);
  if (!retail && (!shop || shop.active === false)) unavailable();
  const boundLocation = retail ? tenant.posSettings?.retailWarehouse : shop.warehouse;
  if (
    boundLocation
      ? String(boundLocation) !== String(kiosk.location)
      : !retail || !location.isDefault
  )
    unavailable();
  // A default list explicitly bound to another branch must not leak through
  // the legacy resolver's tenant-default fallback.
  const eligible = lists.filter((list) => {
    if (list.customerTags?.length) return false;
    const scoped = list.shops?.length || list.warehouses?.length;
    return (
      !scoped ||
      list.shops?.map(String).includes(kiosk.shopId) ||
      list.warehouses?.map(String).includes(String(kiosk.location))
    );
  });
  const { resolved, allowed } = pickPricelistForShop({
    pricelists: eligible,
    shopId: kiosk.shopId,
    warehouseId: kiosk.location,
  });
  const pricelist = kiosk.pricelist
    ? allowed.find((row) => String(row._id) === String(kiosk.pricelist))
    : resolved;
  if (kiosk.pricelist && !pricelist) unavailable();
  if (pricelist && (pricelist.currency || 'NGN') !== kiosk.currency) unavailable();
  return {
    kiosk,
    tenant,
    location,
    pricelist,
    shopName: retail ? tenant.name : shop.name,
  };
}
module.exports = { loadContext };
