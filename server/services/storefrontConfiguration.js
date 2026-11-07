'use strict';
const mongoose = require('mongoose');
const Channel = require('../models/StorefrontChannel');
const Tenant = require('../models/Tenant');
const { validateConfiguration } = require('./storefrontChannels');
const { ForbiddenError, ConflictError, ValidationError } = require('../utils/errors');
const { id, objectId } = require('./storefrontPricing');
async function configure(input, { actorId, apply = false }) {
  const config = validateConfiguration(input);
  if (!objectId(actorId)) throw new ValidationError('A platform reviewer ID is required');
  const actor = await require('../models/User').findOne({ _id: actorId, role: 'super_admin', status: 'active' }).lean();
  if (!actor) throw new ForbiddenError('An active platform super admin must review this mapping');
  const tenant = await Tenant.findOne({ _id: config.tenant, status: 'approved', subscriptionStatus: 'active' }).lean();
  const key = await require('../models/ApiKey').findOne({ _id: config.apiKey, tenant: config.tenant, revokedAt: null, expiresAt: { $gt: new Date() } }).lean();
  const location = await require('../models/Warehouse').findOne({ _id: config.warehouse, tenant: config.tenant, isActive: true }).lean();
  if (!tenant || !key || !location || !['storefront:read', 'checkout:write'].every(scope => key.scopes.includes(scope))) throw new ConflictError('Review the active tenant, website key and stock location');
  require('./storefrontGateway').assertConfigured(config.paymentAccount);
  const before = await Channel.findOne({ tenant: config.tenant }).lean();
  if (before && ['warehouse', 'apiKey', 'paymentAccount', 'code'].some(field => id(before[field]) !== id(config[field]))) {
    throw new ConflictError('Existing channel identity is immutable; reconcile open orders and use a reviewed migration');
  }
  const openLegacy = await require('../models/Order').exists({ 'items.tenant': config.tenant, onlineStockVersion: { $ne: 1 },
    status: { $nin: ['delivered', 'cancelled', 'refunded'] } });
  if (!before && openLegacy) throw new ConflictError('Drain and reconcile legacy online/POS orders before changing stock authority');
  const result = { apply, tenant: config.tenant, channel: config.code, warehouse: config.warehouse,
    paymentAccount: config.paymentAccount, returnOrigins: config.returnOrigins, enabled: config.enabled };
  if (!apply) return result;
  await Channel.createIndexes();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const record = await Channel.findOneAndUpdate({ tenant: config.tenant }, { $set: { ...config, configuredBy: actorId } }, { upsert: true, new: true, runValidators: true, session });
      await Tenant.updateOne({ _id: config.tenant }, { $set: { storefrontIntegrationEnabled: true } }, { session });
      await require('../models/AuditLog').create([{ actorUserId: actorId, actorRole: 'super_admin', action: 'STOREFRONT_CHANNEL_CONFIGURE',
        actionCategory: before ? 'update' : 'create', targetType: 'StorefrontChannel', targetId: record._id, targetTenantId: config.tenant,
        justification: 'Operator reviewed separate website API and stock cutover', changes: { before: before || null, after: result } }], { session });
    });
  } finally { await session.endSession(); }
  return result;
}
module.exports = { configure };
