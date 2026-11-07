'use strict';
const Warehouse = require('../../models/Warehouse');
const { requireId, fail } = require('./errors'); const { id } = require('./eligibility');
async function resolveVenueLocation({ tenantId, locationId, actor, mongoSession = null }) {
  requireId(tenantId); requireId(locationId);
  if (id(actor?.tenantId) !== tenantId) fail('NOT_FOUND', 'Tenant location not found', 404);
  const row = await Warehouse.findOne({ _id: locationId, tenant: tenantId, isActive: true }).session(mongoSession).lean();
  if (!row) fail('NOT_FOUND', 'Venue location not found', 404);
  if (!['tenant_owner', 'tenant_admin'].includes(actor.role) && !row.venueStaff?.some(user => id(user) === id(actor.userId))) fail('VENUE_PERMISSION_DENIED', 'Location assignment required', 403);
  return row;
}
function resolveLegacyLocation({ tenantId, resource, approvedMapping }) {
  if (id(resource.tenant) !== tenantId) return { locationId: null, reason: 'needs_review' };
  if (resource.location) return { locationId: id(resource.location), reason: 'explicit' };
  if (approvedMapping && id(approvedMapping.tenant) === tenantId && id(approvedMapping.resourceId) === id(resource)) return { locationId: id(approvedMapping.locationId), reason: 'approved_mapping' };
  return { locationId: null, reason: 'needs_review' };
}
module.exports = { resolveVenueLocation, resolveLegacyLocation };
