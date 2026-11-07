'use strict';
const Channel = require('../../models/SalesChannel');
const { resolveCountry } = require('../country');
const { ForbiddenError, ValidationError, ConflictError } = require('../../utils/errors');
const { validateChannel, FIELDS, KINDS, objectId } = require('./validation');
const id = value => value == null ? null : String(value._id || value);
function freeze(value) {
  Object.values(value).forEach(child => { if (child && typeof child === 'object') freeze(child); });
  return Object.freeze(value);
}
function assertDirectIdentity(config, direct) {
  if (!direct || direct.enabled !== true || id(direct._id) !== id(config.storefrontChannel) || id(direct.tenant) !== id(config.tenant) ||
    id(direct.apiKey) !== id(config.apiKey) || id(direct.warehouse) !== id(config.location) || direct.code !== config.code || direct.paymentAccount !== config.paymentOwner.account) {
    throw new ConflictError('Reviewed storefront mapping identity does not match saved channel terms');
  }
}
function configuration(row) {
  return Object.fromEntries(FIELDS.filter(key => row[key] !== undefined).map(key => [key, ['tenant', 'storefrontChannel', 'apiKey', 'location'].includes(key) ? id(row[key]) : row[key]]));
}
async function resolveChannelSnapshot({ tenant, kind, market = 'NG', currency = 'NGN', storefrontChannel, provider, account }) {
  const tenantId = id(tenant);
  if (!KINDS.includes(kind) || (kind !== 'marketplace' && !objectId(tenantId))) throw new ValidationError('Valid server channel authority required');
  const country = await resolveCountry(market);
  if (country.currency !== currency) throw new ForbiddenError('Channel currency is unavailable in this market');
  const capability = ['pos', 'venue'].includes(kind) ? 'erm' : kind;
  if (country.capabilities?.[capability] !== true) throw new ForbiddenError('Channel capability is unavailable in this market');
  const row = await Channel.findOne({ tenant: kind === 'marketplace' ? null : tenantId, kind, market: country.code }).lean();
  if (!row) throw new ForbiddenError('Reviewed channel configuration is unavailable');
  if (row.active !== true) throw new ForbiddenError('Sales channel is inactive');
  const config = validateChannel(configuration(row));
  if (config.currency !== currency) throw new ForbiddenError('Configured channel currency does not match');
  if (kind === 'storefront') assertDirectIdentity(config, storefrontChannel);
  const selected = provider === undefined && account === undefined ? config.paymentOwner : [config.paymentOwner, ...(config.allowedPaymentOwners || [])].find(entry => entry.provider === provider && entry.account === account);
  if (!selected) throw new ForbiddenError('Selected provider/account has no reviewed channel ownership');
  return freeze({ version: 1, salesChannelId: id(row._id), configVersion: row.version, countryVersion: country.version,
    ...Object.fromEntries(Object.entries(configuration(config)).filter(([key]) => !['active', 'allowedPaymentOwners'].includes(key))), paymentOwner: structuredClone(selected) });
}
module.exports = { resolveChannelSnapshot, assertDirectIdentity, configuration };
