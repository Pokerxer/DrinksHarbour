'use strict';
const COMMAND = Symbol('venueCommand'); const AUTH = Symbol('venueRecovery');
const { authorizeVenueRecovery } = require('../services/venue/subscription');
function markVenueCommand(command) { return (req, res, next) => { req[COMMAND] = command; next(); }; }
async function authorizePOSVenueRecovery(req, tenant) {
  if (!req[COMMAND] || !/^[a-f\d]{24}$/i.test(req.params.id || '')) return false;
  const user = await require('../models/User').findOne({ _id: req.user._id, tenant: req.user.tenant, status: 'active' }).lean();
  const visit = await require('../models/VenueServiceSession').findOne({ _id: req.params.id, tenant: req.user.tenant }).lean();
  if (!user || !visit) return false;
  const actor = { userId: String(user._id), tenantId: String(user.tenant), role: user.role, venueDeniedActions: user.venueDeniedActions || [] };
  const access = authorizeVenueRecovery({ actor, tenant, session: visit, command: req[COMMAND] });
  if (!access.allowed) return false;
  const location = await require('../models/Warehouse').findOne({ _id: visit.location, tenant: user.tenant, isActive: true }).lean();
  if (!location || (!['tenant_owner', 'tenant_admin'].includes(user.role) && (!location.venueStaff?.some(id => String(id) === String(user._id)) || !user.posPermissions?.includes('pos:sell')))) return false;
  req[AUTH] = access; return true;
}
function isVenueRecoveryAuthorized(req) { return !!req[AUTH]?.allowed && req[AUTH].command === req[COMMAND] && req[AUTH].sessionId === req.params.id && req[AUTH].tenantId === String(req.user?.tenant?._id || req.user?.tenant); }
async function prepareVenueRecovery(req, res, next) {
  try {
    if (req[COMMAND] && req.user?.tenant) {
      const tenant = await require('../models/Tenant').findOne({ _id: req.user.tenant }).lean();
      if (tenant) await authorizePOSVenueRecovery(req, tenant);
    }
    next();
  } catch (error) { next(error); }
}
module.exports = { markVenueCommand, prepareVenueRecovery, isVenueRecoveryAuthorized, authorizePOSVenueRecovery };
