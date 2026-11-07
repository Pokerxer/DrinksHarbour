'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveVenueEligibility } = require('../services/venue/eligibility');
const tenant = extra => ({ _id: 'own', status: 'approved', subscriptionStatus: 'active', plan: 'venue', businessCapabilities: ['hospitality'], posSettings: { isBarRestaurant: true }, venueSettings: { identityVersion: 1, publicListed: true, requestBookingsEnabled: true }, ...extra });
const location = { _id: 'loc', tenant: 'own', isActive: true, venueServices: { enabled: true, reviewedAt: new Date(), canonicalCheckoutEnabled: true, capabilities: ['tables', 'tabs', 'preparation'] }, venueStaff: ['staff'] };
const actor = { userId: 'staff', tenantId: 'own', role: 'tenant_staff', permissions: ['pos:sell'], venueDeniedActions: [] };
const check = (t, action = 'session.create', a = actor) => resolveVenueEligibility({ tenant: t, location, actor: a, action });
test('custom_plan_with_table_management_is_eligible', () => assert.equal(check(tenant({ plan: 'custom', customCapabilities: ['table_management'] })).allowed, true));
test('mode_flag_cannot_grant_migration_access', () => assert.equal(check(tenant({ plan: 'starter' })).code, 'PLAN_UPGRADE_REQUIRED'));
test('venue_plan_does_not_change_retail_identity', () => assert.equal(check(tenant({ businessCapabilities: ['retail'] })).allowed, false));
test('unmigrated_pos_preserves_current_gate', () => {
  assert.equal(resolveVenueEligibility({ tenant: { posSettings: { isBarRestaurant: true } }, action: 'legacy.pos' }).allowed, true);
  assert.equal(resolveVenueEligibility({ tenant: {}, action: 'legacy.pos' }).allowed, false);
});
test('subscription_matrix_blocks_new_commitments', () => {
  for (const subscriptionStatus of ['past_due', 'canceled', 'incomplete', 'incomplete_expired']) assert.equal(check(tenant({ subscriptionStatus })).allowed, false);
  assert.equal(check(tenant({ subscriptionStatus: 'trialing', trialEndsAt: '2000-01-01' })).allowed, false);
});
test('venue_explicit_deny_wins_over_grant_and_role', () => assert.equal(check(tenant(), 'session.create', { ...actor, role: 'tenant_owner', venueDeniedActions: ['session.create'] }).code, 'VENUE_PERMISSION_DENIED'));
test('foreign_actor_and_unassigned_staff_are_denied', () => {
  assert.equal(check(tenant(), 'session.create', { ...actor, tenantId: 'other' }).code, 'NOT_FOUND');
  assert.equal(check(tenant(), 'session.create', { ...actor, userId: 'other' }).allowed, false);
});
test('publication_is_independent_and_never_just_plan_name', () => {
  const input = { tenant: tenant({ plan: 'custom', customCapabilities: ['table_management'] }), action: 'public.discover' };
  assert.equal(resolveVenueEligibility(input).allowed, true);
  input.tenant.venueSettings.publicListed = false;
  assert.equal(resolveVenueEligibility(input).allowed, false);
  input.tenant.venueSettings.legacyPublicGrantedAt = new Date();
  assert.equal(resolveVenueEligibility(input).allowed, true);
});
test('unknown_action_and_suspension_fail_closed', () => {
  assert.equal(check(tenant(), 'made-up').allowed, false);
  assert.equal(check(tenant({ status: 'suspended' }), 'bill.read').allowed, false);
});
test('location_services_must_explicitly_enable_the_requested_operation', () => {
  const input = { tenant: tenant(), actor, location: { ...location, venueServices: { ...location.venueServices, capabilities: ['tables'] } }, action: 'session.create' };
  assert.equal(resolveVenueEligibility(input).allowed, false);
  input.action = 'tables.read'; assert.equal(resolveVenueEligibility(input).allowed, true);
  input.action = 'round.fire'; assert.equal(resolveVenueEligibility(input).allowed, false);
});
test('migrated_pos_uses_reviewed_business_identity_instead_of_old_mode_flag', () => {
  const { venueBlocked } = require('../services/posVenue.service');
  let status; const res = { status(value) { status = value; return this; }, json() {} };
  assert.equal(venueBlocked({ method: 'GET', tenant: tenant({ posSettings: { isBarRestaurant: false } }) }, res), false);
  assert.equal(venueBlocked({ method: 'GET', tenant: tenant({ businessCapabilities: ['retail'] }) }, res), true); assert.equal(status, 400);
});
test('assigned hosts can review requests without managing location configuration',()=>{
 assert.equal(check(tenant(),'requests.review').allowed,true);
 assert.equal(check(tenant(),'experience.manage').allowed,false);
 assert.equal(check(tenant(),'requests.review',{...actor,userId:'unassigned'}).allowed,false);
 assert.equal(check(tenant(),'requests.review',{...actor,venueDeniedActions:['requests.review']}).allowed,false);
 assert.equal(check(tenant({subscriptionStatus:'past_due'}),'requests.review').allowed,false);
});
