'use strict';
const { id, resolveVenueEligibility } = require('./eligibility'); const { fail } = require('./errors');
async function getVenueReadiness({ tenantId, actor }) {
  if (id(actor.tenantId) !== tenantId || !['tenant_owner', 'tenant_admin'].includes(actor.role)) fail('NOT_FOUND', 'Tenant not found', 404);
  const tenant = await require('../../models/Tenant').findOne({ _id: tenantId }).lean();
  if (!tenant) fail('NOT_FOUND', 'Tenant not found', 404);
  const rows = await require('../../models/Warehouse').find({ tenant: tenantId, isActive: true }).lean();
  const tables = await require('../../models/POSTable').find({ tenant: tenantId, location: { $in: rows.map(row => row._id) }, status: 'available', currentTabId: null }).select('_id name location venueVersion').lean();
  const locations = rows.map(location => ({ id: id(location), name: location.name, reviewed: !!location.venueServices?.reviewedAt, canonicalCheckoutEnabled: location.venueServices?.canonicalCheckoutEnabled === true,
    tables: tables.filter(table => id(table.location) === id(location)).map(table => ({ id: id(table), name: table.name, version: table.venueVersion || 0 })),
    actions: Object.fromEntries(['session.create', 'lines.write', 'bill.read', 'collection.write'].map(action => [action, resolveVenueEligibility({ tenant, location, actor, action }).allowed])) }));
  return { identityVersion: tenant.venueSettings?.identityVersion || 0, locations, blockers: locations.filter(l => !l.reviewed).map(l => `LOCATION_REVIEW_REQUIRED:${l.id}`),
    collectionMode: locations.some(l => l.canonicalCheckoutEnabled) ? 'canonical' : 'legacy', supportedTenders: ['paystack', 'cash_direct_pos_only'] };
}
module.exports = { getVenueReadiness };
