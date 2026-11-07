'use strict';
// A single server-owned classification source for ledger and venue reports.
const { id } = require('./eligibility');
async function approvedCostAccountRoles({
  tenantId,
  locationId = null,
  accounts = null,
  mongoSession = null,
}) {
  const locations = await require('../../models/Warehouse')
    .find({
      tenant: tenantId,
      ...(locationId ? { _id: locationId } : {}),
      'venueServices.catalogCosting.policy.state': 'approved',
    })
    .session(mongoSession)
    .lean();
  const chart =
    accounts ||
    (await require('../../models/Account')
      .find({ tenant: tenantId })
      .session(mongoSession)
      .lean());
  const policies = locations.map((location) => ({
    locationId: id(location),
    ...location.venueServices.catalogCosting.policy,
  }));
  const reviewers = await require('../../models/User')
    .find({
      tenant: tenantId,
      _id: { $in: policies.map((policy) => policy.approvedBy).filter(Boolean) },
      role: { $in: ['tenant_owner', 'tenant_admin'] },
    })
    .select('_id')
    .session(mongoSession)
    .lean();
  const roleTypes = {
    rawInventory: 'asset',
    preparedInventory: 'asset',
    issuedService: 'asset',
    cogs: 'expense',
    waste: 'expense',
  };
  const approved = policies.filter(
    (policy) =>
      Number.isSafeInteger(policy.version) &&
      policy.version > 0 &&
      policy.approvedAt &&
      policy.currency === 'NGN' &&
      policy.recognitionTiming === 'canonical_sale' &&
      reviewers.some((reviewer) => id(reviewer) === id(policy.approvedBy)) &&
      new Set(
        Object.values(roleTypes).map(
          (_, index) => policy.accounts?.[Object.keys(roleTypes)[index]],
        ),
      ).size === 5 &&
      Object.entries(roleTypes).every(([role, type]) =>
        chart.some(
          (account) =>
            account.code === policy.accounts?.[role] &&
            account.type === type &&
            account.isActive !== false,
        ),
      ),
  );
  return {
    costAccountCodes: [
      ...new Set(approved.map((policy) => policy.accounts.cogs)),
    ],
    policies: approved,
  };
}
module.exports = { approvedCostAccountRoles };
