'use strict';
const { getPlanCapabilities } = require('../../config/erm-plans'); const { id } = require('./eligibility');
const RECOVERY_COMMANDS = ['bill.read', 'bill.freeze', 'collection.write', 'bill.reconcile', 'bill.close'];
function hasPaidVenue(tenant) { return (tenant.plan === 'custom' && tenant.customCapabilities?.length ? tenant.customCapabilities : getPlanCapabilities(tenant.plan)).includes('table_management'); }
function boundaryUpdate(previous, changes, now = new Date()) {
  const next = { ...(previous.toObject?.() || previous), ...changes };
  const current = previous.venueSubscriptionReadOnlySince || null;
  const writable = ['active', 'trialing'].includes(next.subscriptionStatus) && !(next.subscriptionStatus === 'trialing' && next.trialEndsAt && new Date(next.trialEndsAt) <= now) && hasPaidVenue(next);
  return { venueSubscriptionReadOnlySince: writable ? null : current || (next.subscriptionStatus === 'trialing' && next.trialEndsAt ? new Date(next.trialEndsAt) : now) };
}
function authorizeVenueRecovery({ actor, tenant, session, command, now = new Date() }) {
  const boundary = tenant.venueSubscriptionReadOnlySince || (tenant.subscriptionStatus === 'trialing' && tenant.trialEndsAt && new Date(tenant.trialEndsAt) <= now ? tenant.trialEndsAt : null);
  const allowed = RECOVERY_COMMANDS.includes(command) && tenant.status === 'approved' && tenant.isActive !== false && id(actor?.tenantId) === id(tenant) && id(session?.tenant) === id(tenant)
    && !actor.venueDeniedActions?.includes(command) && !!boundary && new Date(boundary) <= now && new Date(session.openedAt) < new Date(boundary)
    && session.entitlementAtOpen?.writesAllowed === true && session.entitlementAtOpen.capabilities?.includes('table_management');
  return { allowed: !!allowed, command, sessionId: id(session), tenantId: id(tenant) };
}
async function recordVenueBoundary(previous, changes, now = new Date()) {
  if (previous?.venueSettings?.identityVersion !== 1) return;
  const update = boundaryUpdate(previous, changes, now);
  await require('../../models/Tenant').updateOne({ _id: previous._id, ...(update.venueSubscriptionReadOnlySince ? { $or: [{ venueSubscriptionReadOnlySince: null }, { venueSubscriptionReadOnlySince: { $gt: update.venueSubscriptionReadOnlySince } }] } : {}) }, { $set: update });
}
module.exports = { RECOVERY_COMMANDS, boundaryUpdate, authorizeVenueRecovery, recordVenueBoundary };
