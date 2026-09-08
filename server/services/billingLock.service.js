'use strict';
const crypto = require('node:crypto');
const Tenant = require('../models/Tenant');
const { ConflictError } = require('../utils/errors');
// A crashed provider mutation must be reconciled before its lock is cleared.
async function withBillingLock(tenantId, action) {
  const lock = crypto.randomUUID();
  const tenant = await Tenant.findOneAndUpdate({ _id: tenantId, billingMutationLock: null },
    { $set: { billingMutationLock: lock }, $inc: { billingRevision: 1 } }, { new: true });
  if (!tenant) throw new ConflictError('Billing update is already running or needs reconciliation');
  try { return await action(tenant); }
  finally { await Tenant.updateOne({ _id: tenantId, billingMutationLock: lock }, { $unset: { billingMutationLock: 1 } }); }
}
module.exports = { withBillingLock };
