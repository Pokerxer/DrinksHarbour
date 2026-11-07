'use strict';
const { fail } = require('./errors');
async function requireCostingPolicy({
  tenantId,
  locationId,
  mongoSession = null,
  forRecognition = false,
}) {
  const tenant = await require('../../models/Tenant')
    .findOne({ _id: tenantId })
    .session(mongoSession)
    .lean();
  const location = await require('../../models/Warehouse')
    .findOne({ _id: locationId, tenant: tenantId })
    .session(mongoSession)
    .lean();
  if (!tenant || !location)
    fail('NOT_FOUND', 'Costing location not found', 404);
  if (
    tenant.status !== 'approved' ||
    tenant.isActive === false ||
    location.isActive === false
  )
    fail('VENUE_DISABLED', 'Costing unavailable', 403);
  const configuration = location.venueServices?.catalogCosting;
  const policy = configuration?.policy;
  if (
    !forRecognition &&
    (process.env.VENUE_ACTUAL_COSTING_ENABLED !== 'true' ||
    configuration?.actualCostingEnabled !== true)
  )
    fail('COSTING_NOT_CONFIGURED', 'Actual costing is inactive', 503);
  await require('./costing-indexes').assertCostingIndexes(
    require('mongoose').connection.db,
  );
  if (
    policy?.state !== 'approved' ||
    !Number.isSafeInteger(policy.version) ||
    policy.version < 1 ||
    !policy.approvedBy ||
    !policy.approvedAt ||
    policy.currency !== 'NGN' ||
    policy.recognitionTiming !== 'canonical_sale'
  )
    fail(
      'COST_POLICY_REQUIRED',
      'Reviewed costing accounts and timing required',
      503,
    );
  if (
    tenant.venueSettings?.accountingClosedThrough &&
    new Date() <= new Date(tenant.venueSettings.accountingClosedThrough)
  )
    fail('ACCOUNTING_PERIOD_CLOSED');
  const roles = {
    rawInventory: 'asset',
    preparedInventory: 'asset',
    issuedService: 'asset',
    cogs: 'expense',
    waste: 'expense',
  };
  const codes = Object.keys(roles).map((role) => policy.accounts?.[role]);
  if (
    codes.some((code) => typeof code !== 'string' || !code) ||
    new Set(codes).size !== codes.length
  )
    fail(
      'COST_POLICY_REQUIRED',
      'Distinct reviewed account roles required',
      503,
    );
  const accounts = await require('../../models/Account')
    .find({ tenant: tenantId, code: { $in: codes }, isActive: true })
    .session(mongoSession)
    .lean();
  if (
    Object.entries(roles).some(
      ([role, type]) =>
        !accounts.some(
          (account) =>
            account.code === policy.accounts[role] && account.type === type,
        ),
    )
  )
    fail(
      'COST_POLICY_REQUIRED',
      'Reviewed active costing accounts required',
      503,
    );
  const reviewer = await require('../../models/User')
    .exists({
      _id: policy.approvedBy,
      tenant: tenantId,
      status: 'active',
      role: { $in: ['tenant_owner', 'tenant_admin'] },
    })
    .session(mongoSession);
  if (!reviewer && !forRecognition)
    fail(
      'COST_POLICY_REQUIRED',
      'Current accountable costing reviewer required',
      503,
    );
  return {
    policy,
    tenant,
    location,
    valuationMethod: tenant.warehouseSettings?.valuationMethod || 'fifo',
  };
}
module.exports = { requireCostingPolicy };
