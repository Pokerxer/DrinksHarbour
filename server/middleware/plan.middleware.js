'use strict';

const SubProduct = require('../models/SubProduct');
const User = require('../models/User');
const { getPlanConfig, isPlanAtLeast } = require('../config/erm-plans');
const { ForbiddenError } = require('../utils/errors');

function requirePlan(minPlan) {
  return (req, res, next) => {
    const tenantPlan = req.tenant?.plan ?? 'free_trial';
    if (!isPlanAtLeast(tenantPlan, minPlan)) {
      throw new ForbiddenError(
        `This feature requires the ${minPlan} plan or above. You are on the ${tenantPlan} plan.`
      );
    }
    next();
  };
}

async function checkSkuLimit(req, res, next) {
  try {
    const tenant = req.tenant;
    if (!tenant) return next();
    const plan = getPlanConfig(tenant.plan);
    if (plan.skuLimit === Infinity) return next();
    const count = await SubProduct.countDocuments({ tenant: tenant._id });
    if (count >= plan.skuLimit) {
      throw new ForbiddenError(
        `SKU limit reached (${plan.skuLimit} on ${plan.label} plan). Upgrade to add more products.`
      );
    }
    next();
  } catch (err) {
    next(err);
  }
}

async function checkStaffLimit(req, res, next) {
  try {
    const tenant = req.tenant;
    if (!tenant) return next();
    const plan = getPlanConfig(tenant.plan);
    if (plan.staffLimit === Infinity) return next();
    const count = await User.countDocuments({
      tenant: tenant._id,
      role: { $in: ['tenant_owner', 'tenant_admin', 'tenant_staff'] },
    });
    if (count >= plan.staffLimit) {
      throw new ForbiddenError(
        `Staff limit reached (${plan.staffLimit} on ${plan.label} plan). Upgrade to add more staff.`
      );
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requirePlan, checkSkuLimit, checkStaffLimit };
