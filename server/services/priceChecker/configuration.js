const Kiosk = require('../../models/PriceCheckerKiosk');
const Tenant = require('../../models/Tenant');
const Warehouse = require('../../models/Warehouse');
const Pricelist = require('../../models/Pricelist');
const { validateKiosk, defaults, id } = require('./validation');
const { loadContext } = require('./context');
const { NotFoundError, ConflictError } = require('../../utils/errors');
async function getKiosk(tenant, kioskId) {
  const kiosk = await Kiosk.findOne({ _id: id(kioskId), tenant }).lean();
  if (!kiosk) throw new NotFoundError('Kiosk not found.');
  return kiosk;
}
async function saveKiosk(tenant, input, kioskId) {
  const values = validateKiosk(input, !!kioskId);
  const old = kioskId ? await getKiosk(tenant, kioskId) : null;
  const next = {
    enabled: true,
    currency: 'NGN',
    mode: 'STORE_ONLY',
    ...old,
    ...values,
    tenant,
    settings: { ...defaults, ...old?.settings, ...values.settings },
  };
  // Disabling must remain possible even when the branch/subscription is gone.
  if (!(kioskId && Object.keys(values).length === 1 && values.enabled === false))
    await loadContext(next, { configuring: true });
  try {
    if (!old) return (await Kiosk.create(next)).toObject();
    const { _id, __v, createdAt, updatedAt, version, ...fields } = next;
    const result = await Kiosk.findOneAndUpdate(
      { _id: old._id, tenant, version: old.version },
      { $set: fields, $inc: { version: 1 } },
      { new: true, runValidators: true }
    ).lean();
    if (!result) throw new ConflictError('Kiosk changed. Refresh and try again.');
    return result;
  } catch (error) {
    if (error.code === 11000)
      throw new ConflictError('The kiosk URL or internal ID is already in use.');
    throw error;
  }
}
async function options(tenantId) {
  const [tenant, locations, pricelists] = await Promise.all([
    Tenant.findOne({ _id: tenantId })
      .select('name posSettings.shops posSettings.retailWarehouse defaultCurrency')
      .lean(),
    Warehouse.find({ tenant: tenantId, isActive: true }).select('_id name isDefault').lean(),
    Pricelist.find({ tenant: tenantId, customerTags: { $in: [[], null] } })
      .select('_id name currency shops warehouses isDefault isSelectable')
      .lean(),
  ]);
  if (!tenant) throw new NotFoundError('Tenant not found.');
  return {
    tenantName: tenant.name,
    currency: tenant.defaultCurrency || 'NGN',
    defaults,
    locations,
    pricelists,
    shops: [
      {
        _id: 'retail',
        name: `${tenant.name} — Retail`,
        location:
          tenant.posSettings?.retailWarehouse || locations.find((row) => row.isDefault)?._id || '',
      },
      ...(tenant.posSettings?.shops || [])
        .filter((row) => row.active !== false)
        .map((row) => ({
          _id: String(row._id),
          name: row.name,
          location: row.warehouse,
        })),
    ],
  };
}
module.exports = { getKiosk, saveKiosk, options };
