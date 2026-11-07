'use strict';
const express = require('express'); const asyncHandler = require('../utils/asyncHandler');
const { protect, attachTenant, requireOwnTenant, tenantAdminOrSuperAdmin, authorize } = require('../middleware/auth.middleware');
const { protectPOS, requirePOSPermission } = require('../middleware/pos.middleware');
const { markVenueCommand, prepareVenueRecovery } = require('../middleware/venue-recovery.middleware');
const { staffCommands, staffConfigurations } = require('../middleware/venue-rate-limit.middleware');
const costing = require('../controllers/venue/catalog-costing.controller');
const ctrl = require('../controllers/venue/service-sessions.controller');
const recipes = require('../controllers/venue/recipes.controller');
const pourStock = require('../controllers/venue/pour-stock.controller');
const presets = require('../controllers/venue/presets.controller');
const stations = require('../controllers/venue/stations.controller');
const events = require('../controllers/venue/events.controller');
const guestlists = require('../controllers/venue/guestlists.controller');
const waitlist = require('../controllers/venue/waitlist.controller');
const admissions = require('../controllers/venue/admissions.controller');
const hostAlerts = require('../controllers/venue/host-alerts.controller');
const packages = require('../controllers/venue/packages.controller');
const preparation = require('../controllers/venue/preparation.controller');
const printJobs = require('../controllers/venue/print-jobs.controller');
const { requireBridgeToken } = require('../middleware/venue-bridge.middleware');
// State-changing venue commands are POS-adjacent traffic — 300 per user per
// 15 min tolerates a full evening rush (see middleware/venue-rate-limit.middleware.js).
const COMMAND_LIMITERS = {
  'servings.write': staffConfigurations, 'production.write': staffCommands, 'inventory.count': staffConfigurations, 'costs.review': staffConfigurations, 'profitability.read': staffCommands,
  'session.create': staffCommands, 'lines.write': staffCommands, 'bill.freeze': staffCommands,
  'collection.write': staffCommands, 'bill.reconcile': staffCommands, 'bill.close': staffCommands,
  'recipes.write': staffCommands, 'stock.open': staffCommands,
  // S3: course fire rides the same wiring as the POS fire dispatch (a course
  // fire IS a round fire — the service enforces 'round.fire' internally);
  // hold/set and preparation advancement are staff commands too.
  'round.fire': staffCommands, 'courses.write': staffCommands, 'preparation.advance': staffCommands,
  // S3 preset config is back-office editing, not POS-adjacent traffic → 60/15min bucket.
  'presets.write': staffConfigurations,
  'stations.write': staffConfigurations,
  // Phase-4 E1: occurrence scheduling is back-office planning, not POS-adjacent
  // traffic — events.write rides the same 60/15min configuration bucket as presets.
  'events.write': staffConfigurations,
  // Phase-4 E2: guest-list approvals/adds and door scans are command-rate traffic.
  // Approving a queue and door scans happen live during the event (like POS
  // commands), so they ride staffCommands (300/15min), NOT the configuration bucket.
  'guestlists.write': staffCommands, 'door.scan': staffCommands,
  // Phase-4 E3: waitlist commands (join/offer/accept/decline) are live floor
  // work on a queue with real-time acceptance deadlines — the staffCommands
  // bucket (guestlists.write precedent), not the configuration bucket.
  'waitlists.write': staffCommands,
  // Phase-4 E4: package DEFINITIONS are back-office catalog work → the
  // staffConfigurations bucket (presets.write precedent). Commitments and
  // component serves are moment-of-sale floor commands → staffCommands.
  'packages.write': staffConfigurations,
  // A DIFFERENT route action carries the floor commands onto that bucket —
  // an eligibility ACTION per action is not needed (the services check
  // 'packages.write' internally; the route action keys only the limiter).
  'packages.floor': staffCommands,
  // S4: reprint is a staff command on the print-job ledger (preparation.write
  // is the S1-era write action; ledger state itself is bridge/ack-only).
  'preparation.write': staffCommands,
  // S6 floor transfers & parties: visit moves/releases and join/leave/consolidate
  // are staff commands on the same write-command precedent (staffCommands).
  'transfers.write': staffCommands, 'parties.write': staffCommands,
};
function createVenueRouter(pos = false) {
  const router = express.Router();
  function route(method, path, action, handler) {
    const middlewares = [markVenueCommand(action), pos ? protectPOS : protect, prepareVenueRecovery, attachTenant, requireOwnTenant];
    middlewares.push(pos ? requirePOSPermission('pos:sell') : tenantAdminOrSuperAdmin);
    if (COMMAND_LIMITERS[action]) middlewares.push(COMMAND_LIMITERS[action]);
    router[method](path, ...middlewares, asyncHandler(handler));
  }
  route('get', '/locations/:locationId/ingredient-profiles', 'recipes.read', costing.ingredientProfiles);
  route('get', '/locations/:locationId/ingredient-candidates', 'experience.manage', costing.ingredientCandidates);
  route('post', '/locations/:locationId/ingredient-profiles', 'recipes.write', costing.createIngredientProfile);
  route('get', '/locations/:locationId/menu', 'experience.read', costing.menu);
  route('get', '/locations/:locationId/catalog-costing', 'experience.manage', costing.readiness);
  route('get', '/locations/:locationId/servings', 'servings.write', costing.servings);
  route('post', '/locations/:locationId/servings', 'servings.write', costing.saveServing);
  route('patch', '/locations/:locationId/servings/:sizeId', 'servings.write', costing.saveServing);
  route('get', '/locations/:locationId/production', 'production.write', costing.production);
  route('post', '/locations/:locationId/production', 'production.write', costing.createProduction);
  route('post', '/locations/:locationId/production/:id/reserve', 'production.write', costing.reserveProduction);
  route('post', '/locations/:locationId/production/:id/complete', 'production.write', costing.completeProduction);
  route('post', '/locations/:locationId/production/:id/cancel', 'production.write', costing.cancelProduction);
  route('post', '/locations/:locationId/inventory-counts', 'inventory.count', costing.createCount);
  route('post', '/locations/:locationId/inventory-counts/:id/complete', 'inventory.count', costing.completeCount);
  route('get', '/locations/:locationId/cost-sources', 'costs.review', costing.receiptSources);
  route('post', '/locations/:locationId/cost-sources/:id/link', 'costs.review', costing.linkReceiptValue);
  route('get', '/locations/:locationId/cost-cases', 'costs.review', costing.costCases);
  route('post', '/locations/:locationId/cost-cases/:id/resolve', 'costs.review', costing.resolveCostCase);
  route('get', '/locations/:locationId/reports/margins', 'profitability.read', costing.margins);
  route('get', '/locations/:locationId/reports/usage-variance', 'profitability.read', costing.variance);
  route('get', '/location-mode', 'location-mode', ctrl.locationMode);
  // Read-only discovery of already-authorised obligations after a plan downgrade.
  // Each result is checked through bill.read; no broad billing-write exemption.
  if(!pos)router.get('/open-visits',protect,authorize('tenant_owner','tenant_admin'),asyncHandler(ctrl.openVisits));
  route('get', '/readiness', 'readiness', ctrl.readiness);
  route('post', '/service-sessions', 'session.create', ctrl.create);
  route('post', '/service-sessions/:id/fire', 'round.fire', ctrl.courseFire);
  route('put', '/service-sessions/:id/lines', 'lines.write', ctrl.lines);
  route('get', '/service-sessions/:id/bill', 'bill.read', ctrl.bill);
  route('post', '/service-sessions/:id/bill', 'bill.freeze', ctrl.freeze);
  route('post', '/service-sessions/:id/collections', 'collection.write', ctrl.collect);
  // S5 gratuity allocations: receipt-anchored records, never money movement.
  // Write rides 'collection.write' (the Batch-2 money-command action — same
  // eligibility class as payer reservations, with the staffCommands limiter and
  // Idempotency-Key); the read rides 'bill.read' — the weakest sufficient
  // existing action for bill-anchored financial records (no limiter).
  route('post', '/service-sessions/:id/gratuity-allocations', 'collection.write', ctrl.gratuityAllocate);
  route('get', '/service-sessions/:id/gratuity-allocations', 'bill.read', ctrl.gratuityList);
  route('post', '/service-sessions/:id/reconcile', 'bill.reconcile', ctrl.reconcile);
  route('post', '/service-sessions/:id/close', 'bill.close', ctrl.close);
  // S6 floor transfers & parties: whole-visit moves/releases ride 'transfers.write';
  // join/leave/consolidate ride 'parties.write' (consolidation adds the in-service
  // manager gate). All ride runVenueOperation idempotency via the Idempotency-Key.
  route('post', '/service-sessions/:id/move', 'transfers.write', ctrl.move);
  route('post', '/service-sessions/:id/release-table', 'transfers.write', ctrl.releaseTable);
  // S6 Task 3: selected-line moves ride 'transfers.write' too (a floor transfer of
  // PART of a tab — same staff-command class, Idempotency-Key, limiter).
  route('post', '/service-sessions/:id/move-lines', 'transfers.write', ctrl.moveLines);
  route('post', '/service-sessions/:id/join', 'parties.write', ctrl.join);
  route('post', '/service-sessions/:id/leave-party', 'parties.write', ctrl.leaveParty);
  route('post', '/service-sessions/:id/consolidate', 'parties.write', ctrl.consolidate);
  // S2 recipes: tenant-global recipes edited inside a location workspace — the
  // locationId is only the eligibility/context anchor.
  route('get', '/locations/:locationId/recipes', 'recipes.read', recipes.list);
  route('put', '/locations/:locationId/recipes/:subProductId', 'recipes.write', recipes.save);
  // S2 opened-bottle stock: opening is explicit (never implicit in pours); pours are
  // bar-side bottle management aside from line-linked consumption at fire (Task 5).
  route('post', '/locations/:locationId/opened-bottles', 'stock.open', pourStock.open);
  route('post', '/locations/:locationId/opened-bottles/:openedBottleId/pours', 'stock.open', pourStock.pour);
  // S2 waste ledger: read-only listing (recording happens through the opened-bottle
  // waste coordination — no POST waste route in S2, corrections UI is S3).
  route('get', '/locations/:locationId/waste', 'stock.open', pourStock.list);
  // S3 service presets: location service policy config. Route actions presets.read/
  // presets.write; eligibility is enforced inside the service via the EXISTING
  // experience.read/experience.manage actions (no new ACTIONS in Task 2).
  route('get', '/locations/:locationId/service-presets', 'presets.read', presets.list);
  route('post', '/locations/:locationId/service-presets', 'presets.write', presets.create);
  route('patch', '/locations/:locationId/service-presets/:presetId', 'presets.write', presets.update);
  // S3 station config: routing targets for fired preparation items. stations.write
  // is back-office editing → the staffConfigurations bucket, like presets.write.
  route('get', '/locations/:locationId/stations', 'stations.read', stations.list);
  route('post', '/locations/:locationId/stations', 'stations.write', stations.create);
  route('patch', '/locations/:locationId/stations/:stationId', 'stations.write', stations.update);
  // Phase-4 E1 event occurrences: versioned occurrence calendar for clubs/lounges.
  // events.write is back-office scheduling (not POS-adjacent traffic) → the
  // staffConfigurations bucket, exactly like presets.write/stations.write.
  route('get', '/locations/:locationId/events', 'events.read', events.list);
  route('get', '/locations/:locationId/events/:occurrenceId', 'events.read', events.get);
  route('post', '/locations/:locationId/events', 'events.write', events.create);
  route('patch', '/locations/:locationId/events/:occurrenceId', 'events.write', events.update);
  route('post', '/locations/:locationId/events/:occurrenceId/cancel', 'events.write', events.cancel);
  // Phase-4 E2 door + admissions: door-staff assignment is occurrence configuration
  // (events.write, configuration bucket); entitlement issuance rides 'guestlists.write';
  // door scans are POS-adjacent live traffic — 'door.scan' + the staffCommands bucket.
  // Scan responses carry MINIMUM details only (name/partySize/result — see admissions.js).
  route('post', '/locations/:locationId/events/:occurrenceId/door-staff', 'events.write', admissions.assignDoorStaff);
  route('get', '/locations/:locationId/door/occurrences', 'door.scan', admissions.doorOccurrences);
  route('post', '/locations/:locationId/events/:occurrenceId/entitlements', 'guestlists.write', admissions.issue);
  route('get', '/locations/:locationId/events/:occurrenceId/redemptions', 'door.scan', admissions.listRedemptions);
  route('post', '/locations/:locationId/events/:occurrenceId/redeem', 'door.scan', admissions.redeem);
  route('post', '/locations/:locationId/events/:occurrenceId/redeem-reentry', 'door.scan', admissions.redeemReEntry);
  // VIP host alerts: the host-floor read is guest-list-scope staff info (permitted
  // info only — no spend, no restrictedNote); no limiter, like every staff read.
  route('get', '/locations/:locationId/events/:occurrenceId/host-alerts', 'guestlists.read', hostAlerts.list);
  // Phase-4 E2 guest lists: management commands ride 'guestlists.write' (staffCommands
  // bucket — live event-day work); the queue listing rides 'guestlists.read'. Door-staff
  // assignment is occurrence configuration → 'events.write' (staffConfigurations).
  route('get', '/locations/:locationId/guest-lists', 'guestlists.read', guestlists.list);
  route('post', '/locations/:locationId/guest-lists', 'guestlists.write', guestlists.create);
  route('post', '/locations/:locationId/guest-lists/:guestListId/approve', 'guestlists.write', guestlists.approve);
  route('post', '/locations/:locationId/guest-lists/:guestListId/deny', 'guestlists.write', guestlists.deny);
  route('post', '/locations/:locationId/guest-lists/:guestListId/cancel', 'guestlists.write', guestlists.cancel);
  route('post', '/locations/:locationId/guest-lists/:guestListId/flag-vip', 'guestlists.write', guestlists.flagVip);
  route('post', '/locations/:locationId/guest-lists/:guestListId/assign-staff', 'guestlists.write', guestlists.assignStaff);
  route('post', '/locations/:locationId/guest-lists/:guestListId/assign-promoter', 'guestlists.write', guestlists.assignPromoter);
  // Phase-4 E3 waitlists: the queue CRUD rides 'waitlists.write'/'waitlists.read'
  // (staffCommands bucket — live floor work). The 12 §5 offer/accept/decline
  // commands address the ENTRY (no location in the URL — the location comes from
  // the entry row service-side); PATCH is the edit/cancel command.
  route('get', '/locations/:locationId/waitlist', 'waitlists.read', waitlist.list);
  route('post', '/locations/:locationId/waitlist', 'waitlists.write', waitlist.create);
  route('patch', '/locations/:locationId/waitlist/:entryId', 'waitlists.write', waitlist.patch);
  route('post', '/waitlist/:id/offer', 'waitlists.write', waitlist.offer);
  route('post', '/waitlist/:id/accept', 'waitlists.write', waitlist.accept);
  route('post', '/waitlist/:id/decline', 'waitlists.write', waitlist.decline);
  // Phase-4 E4 packages: definitions + quotes are back-office catalog work
  // ('packages.read' has no limiter, like every staff read; 'packages.write'
  // → the staffConfigurations bucket). Commitments (commit/release/upgrade/
  // redeem) are live floor-sale commands → 'packages.floor' with the
  // staffCommands bucket; component serves mirror the bar's pour traffic.
  route('get', '/locations/:locationId/packages', 'packages.read', packages.list);
  route('post', '/locations/:locationId/packages', 'packages.write', packages.create);
  route('patch', '/locations/:locationId/packages/:packageId', 'packages.write', packages.update);
  route('get', '/locations/:locationId/packages/:packageId/quote', 'packages.read', packages.quote);
  route('get', '/locations/:locationId/package-commitments', 'packages.read', packages.listCommitments);
  route('post', '/locations/:locationId/package-commitments', 'packages.floor', packages.commit);
  route('post', '/locations/:locationId/package-commitments/:commitmentId/release', 'packages.floor', packages.release);
  route('post', '/locations/:locationId/package-commitments/:commitmentId/upgrade', 'packages.floor', packages.upgrade);
  route('post', '/locations/:locationId/package-commitments/:commitmentId/redeem', 'packages.floor', packages.redeemComponent);
  // S4 device bridge registration: stations.write mints a pull token, returns it
  // ONCE (only the sha-256 hash is stored on the location profile); revoke clears.
  route('post', '/locations/:locationId/device-bridge/register', 'stations.write', stations.registerBridge);
  route('post', '/locations/:locationId/device-bridge/revoke', 'stations.write', stations.revokeBridge);
  // S3 courses: fire reuses the round.fire path (filtered); hold/release and the
  // ordered registry replacement are courses.write.
  route('post', '/service-sessions/:id/courses/:courseId/fire', 'round.fire', ctrl.courseFire);
  route('post', '/service-sessions/:id/courses/:courseId/hold', 'courses.write', ctrl.courseHold);
  route('put', '/service-sessions/:id/courses', 'courses.write', ctrl.coursesSet);
  // S3 preparation advancement: append-only state ledger, station-scoped.
  route('post', '/preparation/:itemId/advance', 'preparation.advance', preparation.advance);
  // S3 Task 5: kitchen read surface — venue-scoped variant of the POS kitchen
  // board (extend, don't fork). Staff viewing via 'preparation.read', enforced
  // in the service; no limiter, like every other staff read.
  route('get', '/service-sessions/:id/preparation', 'preparation.read', preparation.list);
  // S4 print jobs: staff read surface + reprint (a ledger operation, not a
  // re-fire — zero new consumption events). Bridge/device delivery lives on
  // the dedicated token endpoints below, never on these staff routes.
  route('get', '/service-sessions/:id/print-jobs', 'preparation.read', printJobs.staffList);
  route('post', '/service-sessions/:id/print-jobs/:jobId/reprint', 'preparation.write', printJobs.staffReprint);
  // S4 device bridge — PULL-ONLY endpoints for registered bridge devices.
  // Auth is the DEDICATED bridge-token middleware (Bearer token minted by the
  // register route above; sha-256 hash on the location profile; timing-safe
  // compare), NOT the staff JWT chain: 401 wrong/missing/revoked token, 404
  // wrong location, 400 missing deviceId. The server never connects outward —
  // the bridge polls; no tenant-supplied URL is ever dialed (10 §5).
  router.get('/devices/bridge/:locationId/pending', requireBridgeToken, asyncHandler(printJobs.bridgePending));
  router.post('/devices/bridge/:locationId/ack', requireBridgeToken, asyncHandler(printJobs.bridgeAck));
  return router;
}
module.exports = createVenueRouter();
module.exports.createPosRouter = () => createVenueRouter(true);
