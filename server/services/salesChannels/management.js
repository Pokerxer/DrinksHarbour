'use strict';
const mongoose = require('mongoose');
const { isDeepStrictEqual } = require('node:util');
const Channel = require('../../models/SalesChannel');
const { validateChannel, objectId, keys } = require('./validation');
const { configuration, assertDirectIdentity } = require('./index');
const { resolveCountry } = require('../country');
const { ForbiddenError, ValidationError, ConflictError, NotFoundError } = require('../../utils/errors');
const identityFields = ['tenant', 'code', 'kind', 'market', 'storefrontChannel', 'apiKey', 'location'];
function actorAuthority(actor, reason) {
  if (actor?.role !== 'super_admin' || !actor._id) throw new ForbiddenError('Super-admin review authority required');
  if (typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 1000) throw new ValidationError('A review reason of 5–1000 characters is required');
}
async function assertConfiguration(config) {
  const country = await resolveCountry(config.market, { requireActive: config.active });
  if (country.currency !== config.currency) throw new ValidationError('Channel currency must match country configuration');
  const capability = ['pos', 'venue'].includes(config.kind) ? 'erm' : config.kind;
  if (config.active && country.capabilities?.[capability] !== true) throw new ConflictError('Country channel capability is inactive');
  if (config.tenant && !(await require('../../models/Tenant').exists({ _id: config.tenant }))) throw new NotFoundError('Channel tenant not found');
  if (config.location && !(await require('../../models/Warehouse').exists({ _id: config.location, tenant: config.tenant, ...(config.active ? { isActive: true } : {}) }))) throw new ConflictError('Channel location does not belong to tenant or is inactive');
  if (config.kind === 'storefront') {
    const direct = await require('../../models/StorefrontChannel').findOne({ _id: config.storefrontChannel, tenant: config.tenant }).lean();
    assertDirectIdentity(config, direct && { ...direct, enabled: config.active ? direct.enabled : true });
    if (config.active && !(await require('../../models/ApiKey').exists({ _id: config.apiKey, tenant: config.tenant, revokedAt: null, expiresAt: { $gt: new Date() }, scopes: { $all: ['storefront:read', 'checkout:write'] } }))) throw new ConflictError('Reviewed website API key is inactive or lacks scope');
  }
}
async function saveChannel(input, actor, id) {
  keys(input, ['configuration', 'reason', 'expectedVersion']); actorAuthority(actor, input.reason);
  const config = validateChannel(input.configuration);
  if (id && (!objectId(id) || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1)) throw new ValidationError('Valid channel ID and expectedVersion required');
  if (!id && input.expectedVersion !== undefined) throw new ValidationError('New channels cannot specify expectedVersion');
  await require('../marketIndexReadiness').assertUniqueIndexes(Channel, [{ tenant: 1, kind: 1, market: 1 }, { code: 1 }], 'CHANNEL_INDEXES_REQUIRED');
  const session = await mongoose.startSession(); let result;
  try {
    await session.withTransaction(async () => {
      const before = id ? await Channel.findOne({ _id: id }).session(session).lean() : null;
      if (id && !before) throw new NotFoundError('Sales channel not found');
      if (before && (before.version !== input.expectedVersion || identityFields.some(key => (configuration(before)[key] ?? null) !== (config[key] ?? null)))) throw new ConflictError('Channel changed or identity reassignment requires a reviewed migration');
      // Only an exact active -> inactive transition may bypass withdrawn readiness.
      // Compare every submitted term against the transaction's versioned record.
      const pauseOnly = before?.active === true && config.active === false && isDeepStrictEqual({ ...configuration(before), active: false }, config);
      if (!pauseOnly) await assertConfiguration(config);
      const state = { ...config, reviewedBy: actor._id, reviewReason: input.reason.trim(), version: before ? before.version + 1 : 1 };
      const changes = { $set: state };
      // PUT replaces the optional account list as well as required configuration.
      if (config.allowedPaymentOwners === undefined) changes.$unset = { allowedPaymentOwners: 1 };
      const row = before ? await Channel.findOneAndUpdate({ _id: id, version: input.expectedVersion }, changes, { returnDocument: 'after', runValidators: true, session }) : (await Channel.create([state], { session }))[0];
      if (!row) throw new ConflictError('Channel changed; reload before saving');
      result = row.toObject();
      await require('../../models/AuditLog').create([{ actorUserId: actor._id, actorRole: actor.role, action: 'SALES_CHANNEL_CONFIGURE', actionCategory: before ? 'update' : 'create', targetType: 'SalesChannel', targetId: row._id, targetTenantId: row.tenant, justification: input.reason.trim(), changes: { before, after: result } }], { session });
    });
  } catch (error) { if (error.code === 11000) throw new ConflictError('Channel identity already exists'); throw error; }
  finally { await session.endSession(); }
  return result;
}
function channelView(row, full) {
  const dto = { _id: String(row._id), version: row.version, ...configuration(row), updatedAt: row.updatedAt };
  if (!full) { delete dto.allowedPaymentOwners; delete dto.apiKey; delete dto.storefrontChannel; dto.paymentOwner = { type: row.paymentOwner.type, reference: row.paymentOwner.reference, provider: row.paymentOwner.provider }; }
  return dto;
}
async function listChannels(actor) {
  const full = ['super_admin', 'admin'].includes(actor?.role) && !actor.tenant;
  if (!full && (!['tenant_owner', 'tenant_admin'].includes(actor?.role) || !actor.tenant)) throw new ForbiddenError('Channel configuration access denied');
  const rows = await Channel.find(full ? {} : { tenant: actor.tenant }).sort({ market: 1, kind: 1 }).limit(200).lean();
  return rows.map(row => channelView(row, full));
}
module.exports = { saveChannel, listChannels, channelView, assertConfiguration };
