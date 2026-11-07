'use strict';
const { resolveEntitlements } = require('../entitlements.service');
const COSTING_ACTIONS = { 'servings.write': ['experience.manage','venue:servings_write'], 'production.write': ['round.fire','venue:production_write'], 'inventory.count': ['round.fire','venue:inventory_count'], 'profitability.read': ['experience.read','venue:profitability_read'], 'costs.review': ['bill.reconcile','venue:costs_review'] };
const ACTIONS = [...Object.keys(COSTING_ACTIONS), 'legacy.pos', 'tables.read', 'tables.write', 'tabs.write', 'preparation.read', 'preparation.write', 'preparation.advance',
  'courses.write', 'stations.read', 'stations.write',
  'bookings.read', 'bookings.write', 'experience.read', 'experience.manage', 'requests.review', 'session.create', 'lines.write', 'round.fire', 'bill.read', 'bill.freeze', 'collection.write', 'bill.reconcile', 'bill.close', 'public.discover', 'public.request', 'recipes.read', 'recipes.write', 'stock.open',
  // S6 floor transfers & parties: visit/table moves and releases ride
  // 'transfers.write'; joins/leaves and bill consolidation ride 'parties.write'
  // (consolidation adds the in-service manager gate, per design §2).
  'transfers.write', 'parties.write',
  // Phase-4 E1: events.read/events.write own the occurrence calendar. Like S3's
  // stations.* → preparation mapping below, the actions ride a location capability —
  // 'events' (added to the Warehouse venueServices.capabilities enum) — so a location
  // that does not run events is VENUE_NOT_CONFIGURED for them.
  'events.read', 'events.write',
  // Phase-4 E2: guest-list management + the door. guestlists.read/write share the
  // 'events' capability (guest lists are event-day work on the occurrence calendar);
  // door.scan is the door-role action — assignment to the occurrence is enforced at
  // the service level (occurrence.doorStaffIds), which the ladder cannot see.
  'guestlists.read', 'guestlists.write', 'door.scan',
  // Phase-4 E3: waitlists. waitlists.read/write ride the 'tables' capability — a
  // waitlist OFFER is a table promise (the hold claims real table capacity through
  // the Phase-2 claim machinery), so a location without table capacity management
  // cannot run a waitlist.
  'waitlists.read', 'waitlists.write',
  // Phase-4 E4: VIP/table packages. packages.read/write ride the 'tables'
  // capability (a package IS a table-promise + inclusion offer — the E3
  // waitlists precedent; admission inclusions redeem through E2's 'events'
  // door ledger, which has its own action).
  'packages.read', 'packages.write'];
const id = value => value == null ? '' : String(value._id || value);
function resolveVenueEligibility({ tenant, location = null, actor = null, action, now = new Date() }) {
  const entitlements = resolveEntitlements(tenant, now);
  const reply = (allowed, code = 'OK') => ({ allowed, code, bookingMode: allowed && action === 'public.request' ? 'request' : 'disabled', capabilities: entitlements.capabilities });
  if (!ACTIONS.includes(action)) return reply(false, 'VENUE_UNKNOWN_ACTION');
  if (action === 'legacy.pos') return reply(tenant?.posSettings?.isBarRestaurant === true, 'VENUE_MODE_DISABLED');
  if (!tenant || tenant.status !== 'approved' || tenant.isActive === false) return reply(false, 'VENUE_DISABLED');
  if (actor && id(actor.tenantId) !== id(tenant)) return reply(false, 'NOT_FOUND');
  if (actor?.venueDeniedActions?.includes(action)) return reply(false, 'VENUE_PERMISSION_DENIED');
  if (COSTING_ACTIONS[action]) {
    const [baseAction, grant] = COSTING_ACTIONS[action];
    if (!actor || !['tenant_owner','tenant_admin'].includes(actor.role) || !actor.permissions?.includes(grant)) return reply(false, 'VENUE_PERMISSION_DENIED');
    if (actor.venueDeniedActions?.includes(baseAction)) return reply(false, 'VENUE_PERMISSION_DENIED');
    return resolveVenueEligibility({ tenant, location, actor, action: baseAction, now });
  }
  const settings = tenant.venueSettings || {};
  const hospitality = settings.identityVersion === 1
    ? tenant.businessCapabilities?.includes('hospitality')
    : ['Restaurant', 'Bar / Lounge', 'Nightclub / Club'].includes(tenant.businessType) || tenant.posSettings?.isBarRestaurant === true || !!settings.legacyPublicGrantedAt || (action.startsWith('bookings.') && entitlements.capabilities.includes('table_management'));
  if (!hospitality) return reply(false, 'VENUE_NOT_CONFIGURED');
  if (!entitlements.capabilities.includes('table_management')) return reply(false, 'PLAN_UPGRADE_REQUIRED');
  const read = action.endsWith('.read') || action === 'public.discover';
  if (!read && !entitlements.writesAllowed) return reply(false, 'SUBSCRIPTION_READ_ONLY');
  if (!['active', 'trialing', 'past_due'].includes(tenant.subscriptionStatus)) return reply(false, 'SUBSCRIPTION_READ_ONLY');
  if (action.startsWith('public.')) {
    if (tenant.subscriptionStatus !== 'active') return reply(false, 'VENUE_NOT_PUBLIC');
    if (!settings.publicListed && !settings.legacyPublicGrantedAt) return reply(false, 'VENUE_NOT_PUBLIC');
    if (action === 'public.request' && !settings.requestBookingsEnabled && !settings.legacyPublicGrantedAt) return reply(false, 'VENUE_NOT_CONFIGURED');
    return reply(true);
  }
  if (action.startsWith('experience.') || action === 'requests.review') {
    if (!location || id(location.tenant) !== id(tenant) || location.isActive === false) return reply(false, 'NOT_FOUND');
    const manager = ['tenant_owner', 'tenant_admin'].includes(actor?.role);
    const assigned = location.venueStaff?.some(user => id(user) === id(actor?.userId));
    return reply(manager || (['experience.read','requests.review'].includes(action) && assigned && actor?.permissions?.includes('pos:sell')), 'VENUE_PERMISSION_DENIED');
  }
  if (action.startsWith('bookings.')) {
    return reply(!!actor && ['tenant_owner', 'tenant_admin'].includes(actor.role), 'VENUE_PERMISSION_DENIED');
  }
  if (!location || id(location.tenant) !== id(tenant) || location.isActive === false) return reply(false, 'NOT_FOUND');
  if (!location.venueServices?.enabled || !location.venueServices.reviewedAt || !location.venueServices.canonicalCheckoutEnabled) return reply(false, 'VENUE_NOT_CONFIGURED');
  const services = location.venueServices.capabilities || [];
  // S3: preparation.advance is a NEW action, distinct from the S1-era
  // preparation.read/write config actions — item advancement owns the
  // preparation STATE LEDGER, not the station config (design §2). stations.*
  // are the S3 station-config actions; courses.write is tab-level grouping.
  const required = action === 'session.create' ? ['tables', 'tabs']
    : action.startsWith('tables.') ? ['tables']
    : action.startsWith('preparation.') || action === 'round.fire' || action.startsWith('stations.') ? ['preparation']
    // E1: occurrence calendar work requires the location's 'events' capability.
    // E2: guest lists and door scans are event-day work on the same calendar —
    // they ride 'events' too (assignment scoping lives in the services).
    // E3: waitlist work is table-promise work → 'tables' (see ACTIONS comment).
    // E4: packages are table-promise work with tracked inclusions → 'tables'
    // (see the ACTIONS comment above).
    : action.startsWith('events.') || action.startsWith('guestlists.') || action === 'door.scan' ? ['events']
    : action.startsWith('waitlists.') || action.startsWith('packages.') ? ['tables'] : ['tabs'];
  if (required.some(capability => !services.includes(capability))) return reply(false, 'VENUE_NOT_CONFIGURED');
  if (!actor) return reply(false, 'VENUE_PERMISSION_DENIED');
  const manager = ['tenant_owner', 'tenant_admin'].includes(actor.role);
  if (!manager && !location.venueStaff?.some(user => id(user) === id(actor.userId))) return reply(false, 'VENUE_PERMISSION_DENIED');
  if (!manager && !actor.permissions?.includes('pos:sell')) return reply(false, 'VENUE_PERMISSION_DENIED');
  return reply(true);
}
module.exports = { ACTIONS, resolveVenueEligibility, id };
