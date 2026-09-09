'use strict';

const SubProduct = require('../models/SubProduct');
const User = require('../models/User');
const Warehouse = require('../models/Warehouse');
const Tenant = require('../models/Tenant');
const {
  getPlanConfig,
  isPlanAtLeast,
  cheapestPlanWith,
  addOnAllowance,
  getAddOnConfig,
  countedShops,
  ERM_PLANS,
} = require('../config/erm-plans');
const { resolveEntitlements, readOnlyMessage } = require('../services/entitlements.service');
const { invalidateUsage } = require('../services/ermUsage.service');
const { ForbiddenError } = require('../utils/errors');

/**
 * Platform staff have no tenant, so they have no plan — and a plan gate that
 * does not know that reads their undefined plan as free_trial and locks the
 * platform team out of the very modules they administer.
 */
const PLATFORM_ROLES = ['super_admin', 'admin'];

function isPlatformUser(req) {
  return PLATFORM_ROLES.includes(req.user?.role);
}

/**
 * Ordinal plan gate. Kept for callers that genuinely want "this rung or
 * higher"; prefer requireCapability for features, because the feature matrix
 * is not a ladder (see config/erm-plans.js).
 */
function requirePlan(minPlan) {
  return (req, res, next) => {
    if (isPlatformUser(req)) return next();
    const tenantPlan = req.tenant?.plan ?? 'free_trial';
    if (!isPlanAtLeast(tenantPlan, minPlan)) {
      return next(new ForbiddenError(
        `This feature requires the ${minPlan} plan or above. You are on the ${tenantPlan} plan.`
      ));
    }
    next();
  };
}

/**
 * Capability gate — the one to reach for.
 *
 * Passing several capabilities means ANY of them suffices, which is what the
 * tiered rows of the pricing table need: `/point-of-sale` requires
 * ('pos_single','pos_multi','pos_realtime') because Pro's comparison row says
 * single-outlet POS is false — it has the multi-outlet one instead. Requiring
 * pos_single alone would 403 every Pro tenant.
 *
 * Also refuses WRITES for a tenant in dunning even when the capability is
 * held; resolveEntitlements owns that rule.
 */
const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

function requireCapability(...required) {
  return (req, res, next) => {
    if (isPlatformUser(req)) return next();

    const entitlements = resolveEntitlements(req.tenant);
    const held = required.some((cap) => entitlements.capabilities.includes(cap));

    if (!held) {
      const upgradeTo = cheapestPlanWith(required[0]);
      const upgradeLabel = upgradeTo ? ERM_PLANS[upgradeTo].label : null;
      const err = new ForbiddenError(
        upgradeLabel
          ? `Your ${getPlanConfig(entitlements.plan).label} plan does not include this feature. Upgrade to ${upgradeLabel} to unlock it.`
          : `Your ${getPlanConfig(entitlements.plan).label} plan does not include this feature.`
      );
      // Shape the client's upgrade prompt without it having to parse prose.
      err.code = 'PLAN_UPGRADE_REQUIRED';
      err.details = {
        requiredCapabilities: required,
        currentPlan: entitlements.plan,
        upgradeTo,
        reason: entitlements.reason,
      };
      return next(err);
    }

    if (!entitlements.writesAllowed && WRITE_METHODS.includes(req.method)) {
      // Shared with assertWritesAllowed — see readOnlyMessage. These two used to
      // be separate literals and had already drifted apart by a clause.
      const err = new ForbiddenError(readOnlyMessage(entitlements.reason));
      err.code = 'SUBSCRIPTION_READ_ONLY';
      err.details = { reason: entitlements.reason, currentPlan: entitlements.plan };
      return next(err);
    }

    next();
  };
}

/**
 * How many more SKUs this tenant may create. `null` means unlimited.
 *
 * Exported because bulk creation cannot be decided by a middleware: a CSV
 * import knows how many rows it has but not how many of them turn into NEW
 * SubProducts until it is halfway through processing them. Those callers take
 * the budget and spend it as they go — see subProductImport.service.js — rather
 * than refusing the whole request on an upper bound that is usually wrong.
 */
async function skuBudgetFor(tenantOrId) {
  if (!tenantOrId) return null;

  // Accepts a resolved tenant document OR a bare id. The id form matters: a
  // controller may hold `req.user.tenant` while `req.tenant` is unset, and
  // reading `.plan` off an ObjectId yields undefined — which getPlanConfig
  // resolves to free_trial, silently applying the wrong (tighter) limit. Load
  // the document rather than guess.
  const tenantId = tenantOrId._id ?? tenantOrId;
  let planKey = tenantOrId.plan;
  if (!planKey) {
    const doc = await Tenant.findById(tenantId).select('plan').lean();
    if (!doc) return null;
    planKey = doc.plan;
  }

  const plan = getPlanConfig(planKey);
  if (plan.skuLimit === Infinity) return null;
  const count = await SubProduct.countDocuments({ tenant: tenantId });
  return Math.max(0, plan.skuLimit - count);
}

/**
 * SKU gate for a route that creates a KNOWN number of SubProducts.
 *
 * `countRequested(req)` says how many; it defaults to one, which is what
 * `POST /api/subproducts` does and is the behaviour this gate has always had
 * (`count >= limit` and `count + 1 > limit` refuse in exactly the same cases).
 *
 * WHY IT IS A FACTORY NOW. `checkSkuLimit` was mounted on exactly one route
 * while three other doors created SubProducts with no gate at all — `POST
 * /bulk`, `POST /:id/duplicate` and the CSV import. A limit with one guarded
 * door and three unguarded ones is not a limit. `/bulk` in particular takes a
 * `productIds[]` array, so gating it "one more?" would let a tenant one SKU
 * under their cap create five hundred.
 */
function checkSkuLimitFor(countRequested = () => 1) {
  return async (req, res, next) => {
    try {
      const tenant = req.tenant;
      if (!tenant) return next();

      // This gate stands in front of a door that is about to create SKUs, so
      // the reported usage is about to be wrong. Dropping it here — rather than
      // from six controllers — is what keeps the billing screen's meters honest
      // without a hook that drifts the moment a seventh door opens. See
      // services/ermUsage.service.js. Before the Infinity early-return, because
      // an unlimited plan still has a meter.
      invalidateUsage(tenant._id);

      const plan = getPlanConfig(tenant.plan);
      if (plan.skuLimit === Infinity) return next();

      const wanted = Math.max(1, Number(countRequested(req)) || 1);
      const count = await SubProduct.countDocuments({ tenant: tenant._id });

      if (count + wanted > plan.skuLimit) {
        const err = new ForbiddenError(
          wanted === 1
            ? `SKU limit reached (${plan.skuLimit} on ${plan.label} plan). Upgrade to add more products.`
            : `That would take you to ${count + wanted} SKUs, over the ${plan.skuLimit} allowed on the ${plan.label} plan. Upgrade to add more products.`
        );
        err.code = 'SKU_LIMIT_REACHED';
        err.details = {
          used: count,
          limit: plan.skuLimit,
          requested: wanted,
          currentPlan: tenant.plan,
        };
        throw err;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** The one-more-SKU gate. Unchanged in behaviour; see checkSkuLimitFor. */
const checkSkuLimit = checkSkuLimitFor();

async function checkStaffLimit(req, res, next) {
  try {
    const tenant = req.tenant;
    if (!tenant) return next();
    invalidateUsage(tenant._id); // a seat is about to be taken — see checkSkuLimitFor
    const plan = getPlanConfig(tenant.plan);
    if (plan.staffLimit === Infinity) return next();
    const count = await User.countDocuments({
      tenant: tenant._id,
      role: { $in: ['tenant_owner', 'tenant_admin', 'tenant_staff'] },
      // Staff seat rule (README §5): a DELETED member returns their seat, so a
      // starter tenant who removes their one staff member can replace them. This
      // is the only limit with a status filter — SKUs and warehouses still count
      // every row, because (unlike a user) there is no way to flag one as gone.
      status: { $ne: 'deleted' },
    });
    if (count >= plan.staffLimit) {
      const err = new ForbiddenError(
        `Staff limit reached (${plan.staffLimit} on ${plan.label} plan). Upgrade to add more staff.`
      );
      // Carries a code for the same reason the other gates do: without one the
      // admin client sees an anonymous 403 and cannot tell a plan limit from a
      // permissions failure. server.js serialises it.
      err.code = 'STAFF_LIMIT_REACHED';
      err.details = { used: count, limit: plan.staffLimit, currentPlan: tenant.plan };
      throw err;
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Add-on quotas. The pricing page sells "extra shop +₦12,000/mo, extra
 * warehouse +₦20,000/mo — first of each is free", and Tenant.addOns[] exists
 * to record what was bought, but nothing counted against it: both were
 * unbounded. One free, plus however many the tenant is paying for.
 *
 * Plans that cannot buy add-ons (free_trial → growth) get the one free unit
 * and no more.
 *
 * The arithmetic itself is `addOnAllowance` in config/erm-plans.js, because
 * GET /api/erm/status has to report the same number this gate enforces — two
 * copies of it would drift and the billing screen would promise a slot the
 * middleware then refuses.
 */
function checkAddOnLimit(type, countDocs) {
  return async (req, res, next) => {
    try {
      if (isPlatformUser(req)) return next();
      const tenant = req.tenant;
      if (!tenant) return next();
      invalidateUsage(tenant._id); // see checkSkuLimitFor

      const plan = getPlanConfig(tenant.plan);
      const allowance = addOnAllowance(tenant, type);
      const count = await countDocs(tenant);

      if (count >= allowance) {
        const noun = getAddOnConfig(type)?.noun ?? 'unit';
        const err = new ForbiddenError(
          plan.addOnsAllowed
            ? `You have used all ${allowance} of your ${noun} slots. Add an extra ${noun} add-on to create another.`
            : `The ${plan.label} plan includes ${allowance} ${noun}${allowance === 1 ? '' : 's'}. Upgrade to Pro or above to add more.`
        );
        err.code = 'ADD_ON_LIMIT_REACHED';
        err.details = { addOn: type, used: count, allowance, currentPlan: tenant.plan };
        throw err;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

const checkWarehouseLimit = checkAddOnLimit('extra_warehouse', (tenant) =>
  Warehouse.countDocuments({ tenant: tenant._id })
);

/**
 * POS shops live as a subdocument array on the tenant, not their own model.
 *
 * Counted by `countedShops`, which counts EVERY row — see README §5. This used
 * to filter on `active !== false` and was the only one of the four sold limits
 * that let a tenant free a slot by deactivating rather than deleting.
 */
const checkShopLimit = checkAddOnLimit('extra_shop', async (tenant) => countedShops(tenant));

module.exports = {
  requirePlan,
  requireCapability,
  checkSkuLimit,
  checkSkuLimitFor,
  skuBudgetFor,
  checkStaffLimit,
  checkWarehouseLimit,
  checkShopLimit,
};
