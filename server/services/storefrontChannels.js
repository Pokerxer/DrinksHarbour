'use strict';
const Channel = require('../models/StorefrontChannel');
const Warehouse = require('../models/Warehouse');
const { objectId, id, onlyKeys } = require('./storefrontPricing');
const { ValidationError, ForbiddenError } = require('../utils/errors');
function validateConfiguration(input) {
  onlyKeys(input, ['tenant', 'apiKey', 'warehouse', 'code', 'paymentAccount', 'returnOrigins', 'enabled']);
  if (![input.tenant, input.apiKey, input.warehouse].every(objectId) ||
      !/^[A-Z][A-Z0-9_]{2,39}$/.test(input.code || '') || ['POS', 'DRINKSHARBOUR_NG', 'DRINKSHARBOUR_UK'].includes(input.code) ||
      !/^[A-Z][A-Z0-9_]{1,39}$/.test(input.paymentAccount || '') || typeof input.enabled !== 'boolean') {
    throw new ValidationError('Invalid storefront channel configuration');
  }
  if (!Array.isArray(input.returnOrigins) || !input.returnOrigins.length || input.returnOrigins.length > 10) throw new ValidationError('Configure website return origins');
  for (const origin of input.returnOrigins) {
    let url; try { url = new URL(origin); } catch { throw new ValidationError('Invalid return origin'); }
    if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) throw new ValidationError('Use an exact HTTPS return origin');
  }
  return { ...input, returnOrigins: [...new Set(input.returnOrigins)] };
}
function assertReturnUrl(tenant, value) {
  if (!tenant.storefrontChannel) return;
  let url; try { url = new URL(value); } catch { throw new ValidationError('Invalid return URL'); }
  if (url.username || url.password || !tenant.storefrontChannel.returnOrigins.includes(url.origin)) throw new ValidationError('Return URL does not belong to this website');
}
async function attachChannel(tenant, key) {
  const channel = await Channel.findOne({ tenant: tenant._id }).lean();
  if (!channel) throw new ForbiddenError('Website channel configuration is unavailable');
  if (!channel.enabled || id(channel.apiKey) !== id(key)) throw new ForbiddenError('Website channel is inactive or belongs to another API key');
  const location = await Warehouse.findOne({ _id: channel.warehouse, tenant: tenant._id, isActive: true }).select('_id').lean();
  if (!location) throw new ForbiddenError('Website stock location is unavailable');
  return { ...tenant, storefrontChannel: channel };
}
module.exports = { validateConfiguration, assertReturnUrl, attachChannel };
