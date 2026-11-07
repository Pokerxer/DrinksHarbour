'use strict';
const { fail } = require('./errors'); const { id } = require('./eligibility');
async function assertLegacySaleAllowed({ tenant, locationId, heldOrderId, tableId }) {
  if (tenant?.venueSettings?.identityVersion !== 1) return;
  if (heldOrderId) {
    const hold = await require('../../models/Order').findOne({ _id: heldOrderId, tenant: tenant._id }).select('venueServiceSession').lean();
    if (hold?.venueServiceSession) fail('VENUE_CANONICAL_CHECKOUT_REQUIRED', 'Use canonical visit checkout instead of a separate sale');
  }
  if (tableId && !locationId) {
    const table = await require('../../models/POSTable').findOne({ _id: tableId, tenant: tenant._id }).select('location').lean(); locationId = table?.location;
  }
  if (locationId) {
    const location = await require('../../models/Warehouse').findOne({ _id: locationId, tenant: tenant._id }).select('venueServices').lean();
    if (location?.venueServices?.canonicalCheckoutEnabled) fail('VENUE_CANONICAL_CHECKOUT_REQUIRED', 'This canonical venue terminal requires a visit binding; refresh');
  }
}
function rejectCanonicalOrder(order) { if (order?.venueIdentityVersion === 1 || order?.venueServiceSession || order?.venueBillForSession) fail('VENUE_CANONICAL_CHECKOUT_REQUIRED', 'Use the canonical venue command or audited reconciliation support'); }
async function actorFor(tenantId, actorId) {
  const user = await require('../../models/User').findOne({ _id: actorId, tenant: tenantId, status: 'active' }).lean();
  if (!user) fail('NOT_FOUND', 'Tenant user not found', 404);
  return { userId: id(user), tenantId: id(user.tenant), role: user.role, permissions: user.posPermissions || [], venueDeniedActions: user.venueDeniedActions || [] };
}
module.exports = { assertLegacySaleAllowed, rejectCanonicalOrder, actorFor };
