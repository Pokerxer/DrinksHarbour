'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Usage counts for GET /api/erm/status, cached per tenant for a few seconds.
//
// WHY THIS EXISTS. The admin's root layout fetches /api/erm/status on EVERY
// render, server-side, to decide whether to show the read-only banner — and for
// a healthy tenant that banner renders nothing at all. `getStatus` ran four
// countDocuments to build the usage meters, so every page view of every screen
// paid for four collection counts in order to display nothing.
//
// WHAT IS AND IS NOT CACHED, WHICH IS THE WHOLE DESIGN.
//
// Cached: the three collection counts (SKUs, staff, warehouses). They are the
// cost, they are only ever *reported*, and being a few seconds stale on a usage
// meter is invisible.
//
// NOT cached: anything that decides what a tenant may do. `plan`,
// `subscriptionStatus`, `trialEndsAt`, `writesAllowed`, `entitlementReason` and
// `entitlementMessage` are all derived in the controller from the `req.tenant`
// document that `attachTenant` loads fresh on every request. So the banner —
// the reason the layout calls this endpoint in the first place — is never
// stale, and a tenant who pays sees the read-only notice disappear on their
// next page load rather than up to a TTL later. Caching the whole response
// would have traded a real correctness property for the same saving.
//
// Also NOT cached: the limit gates. `checkSkuLimit`, `checkStaffLimit` and
// `checkWarehouseLimit` in middleware/plan.middleware.js each run their own
// live count, and must keep doing so — enforcing a quota against a count that
// may be seconds old is how a tenant gets one more SKU than they bought. This
// cache is for reporting only. (Those gates DO invalidate on the way past, so
// the meters move as soon as something is created.)
//
// Shops are not here: they live as a subdocument array on the tenant document
// that is already in memory, so counting them is free. See `countedShops`.
// ─────────────────────────────────────────────────────────────────────────────

const SubProduct = require('../models/SubProduct');
const User = require('../models/User');
const Warehouse = require('../models/Warehouse');

/**
 * Short enough that nobody reasons about staleness, long enough to collapse a
 * burst of page renders into one read. A tenant clicking around the admin
 * generates several layout renders a second; this turns those into one count
 * per tenant per TTL.
 */
const USAGE_TTL_MS = 45_000;

/** Roles that occupy a plan seat. Must match `checkStaffLimit`. */
const STAFF_ROLES = ['tenant_owner', 'tenant_admin', 'tenant_staff'];

/** tenantId → { expiresAt, counts } */
const cache = new Map();

function keyOf(tenantId) {
  return String(tenantId);
}

/**
 * Live counts, no cache. Exported so a caller that genuinely needs the truth
 * can ask for it without going near the cache.
 *
 * Every row counts — archived SKUs, inactive warehouses — EXCEPT staff whose
 * account is `deleted` (README §5, "staff seats": deleting a member returns
 * their seat; deactivating them does not). The billing screen and the gates
 * count the same set, which is the failure this whole file is arranged to
 * avoid.
 */
async function countUsage(tenantId) {
  const [skus, staff, warehouses] = await Promise.all([
    SubProduct.countDocuments({ tenant: tenantId }),
    User.countDocuments({
      tenant: tenantId,
      role: { $in: STAFF_ROLES },
      status: { $ne: 'deleted' },
    }),
    Warehouse.countDocuments({ tenant: tenantId }),
  ]);
  return { skus, staff, warehouses };
}

/**
 * Counts for this tenant, from cache when fresh.
 *
 * `now` is injected rather than read from the clock so expiry is testable
 * without freezing time globally — the same reason `resolveEntitlements` takes
 * one.
 */
async function getUsage(tenantId, now = Date.now()) {
  const key = keyOf(tenantId);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.counts;

  const counts = await countUsage(tenantId);
  cache.set(key, { expiresAt: now + USAGE_TTL_MS, counts });
  return counts;
}

/**
 * Forget this tenant's counts.
 *
 * Called from the limit gates, which is deliberate and is the only invalidation
 * hook there is: those gates are mounted on every door that creates a counted
 * row (that was the point of README §5a), so "a gate just ran" is a reliable
 * proxy for "a row is about to appear". Sprinkling invalidate() calls through
 * six controllers would drift the moment a seventh door opened.
 *
 * It is fine that the gate runs BEFORE the row is created and the request may
 * then fail: the cost of a needless invalidation is one recount.
 */
function invalidateUsage(tenantId) {
  if (!tenantId) return;
  cache.delete(keyOf(tenantId));
}

/** Drop everything. For tests, and for a process that wants a clean slate. */
function clearUsageCache() {
  cache.clear();
}

/** Entries currently held. For tests and for the measurement script. */
function usageCacheSize() {
  return cache.size;
}

module.exports = {
  USAGE_TTL_MS,
  STAFF_ROLES,
  countUsage,
  getUsage,
  invalidateUsage,
  clearUsageCache,
  usageCacheSize,
};
