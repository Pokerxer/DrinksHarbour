'use strict';
const { effectivePermissions } = require('../services/effectivePermissions.service');
const { resolveVenueEligibility, id } = require('../services/venue/eligibility');
const { fail } = require('../services/venue/errors');
function venueActor(req) {
  const user = req.user || req.posUser;
  return { userId: id(user), tenantId: id(user?.tenant), role: user?.role,
    permissions: req.posPermissions || effectivePermissions(user || {}), venueDeniedActions: user?.venueDeniedActions || [] };
}
function requireVenueAction(action) {
  return (req, res, next) => {
    try {
      const access = resolveVenueEligibility({ tenant: req.tenant, location: req.venueLocation, actor: venueActor(req), action });
      if (!access.allowed) fail(access.code, `Your ${req.tenant?.plan || 'current'} plan or venue configuration does not allow this action. Upgrade to an eligible plan or review venue settings.`, access.code === 'NOT_FOUND' ? 404 : 403);
      next();
    } catch (error) { next(error); }
  };
}
module.exports = { requireVenueAction, venueActor };
