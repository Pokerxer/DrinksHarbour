'use strict';
const Tenant = require('../../models/Tenant'); const User = require('../../models/User');
const { resolveVenueLocation } = require('./locations'); const { resolveVenueEligibility, id } = require('./eligibility');
const { requireId, fail } = require('./errors');
async function loadVenueContext({ tenantId, locationId, actor, action, visit = null, mongoSession = null }) {
  requireId(tenantId); requireId(id(actor?.userId));
  if (id(actor?.tenantId) !== tenantId) fail('NOT_FOUND', 'Tenant not found', 404);
  const user = await User.findOne({ _id: actor.userId, tenant: tenantId, status: 'active' }).session(mongoSession).lean();
  const tenant = await Tenant.findOne({ _id: tenantId }).session(mongoSession).lean();
  if (!user || !tenant) fail('NOT_FOUND', 'Tenant user not found', 404);
  const currentActor = { ...actor, role: user.role, venueDeniedActions: user.venueDeniedActions || [], permissions: user.posPermissions || (actor.permissions || []).filter(permission => !permission.startsWith('venue:')) };
  const location = await resolveVenueLocation({ tenantId, locationId, actor: currentActor, mongoSession });
  const access = resolveVenueEligibility({ tenant, location, actor: currentActor, action });
  const recovering = !access.allowed && require('./subscription').authorizeVenueRecovery({ actor: currentActor, tenant, session: visit, command: action }).allowed;
  if (!access.allowed && !recovering) fail(access.code, 'Venue action is not available', access.code === 'NOT_FOUND' ? 404 : 403);
  return { tenant, location, actor: currentActor };
}
module.exports = { loadVenueContext };
