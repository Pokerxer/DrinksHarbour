'use strict';
const context = require('./marketContext');
const { ConflictError, ForbiddenError } = require('../utils/errors');
async function collectionSnapshot(provider, currency = 'NGN') {
  if (!context.enabled()) return undefined;
  await require('./marketIngress').assertNewCollection(currency);
  return require('./salesChannels').resolveChannelSnapshot({ kind: 'marketplace', market: context.currentMarket(), currency, provider, account: 'platform' });
}
async function directSnapshot(tenant) {
  if (!context.enabled()) return undefined;
  const direct = tenant?.storefrontChannel;
  if (!direct) throw new ForbiddenError('Reviewed direct website mapping is required');
  const row = await require('../models/SalesChannel').findOne({ tenant: tenant._id, kind: 'storefront', storefrontChannel: direct._id }).lean();
  if (!row) throw new ForbiddenError('Reviewed direct website terms are unavailable');
  return require('./salesChannels').resolveChannelSnapshot({ tenant, kind:'storefront', market:row.market, currency:'NGN', storefrontChannel:direct, provider:'paystack', account:direct.paymentAccount });
}
function canonical(value) {
  if (value && typeof value.toObject === 'function') return canonical(value.toObject());
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}
function assertBinding(receipt, order) {
  if (!receipt || !order) throw new ConflictError('Payment receipt has no reviewed channel binding; reconciliation required');
  const fields = ['code','kind','market','currency','configVersion','countryVersion','legalOwner','paymentOwner','pricingPolicy'];
  const binding = value => JSON.stringify(canonical(Object.fromEntries(fields.filter(key=>value[key]!==undefined).map(key=>[key,value[key]]))));
  if (binding(receipt) !== binding(order)) throw new ConflictError('Payment receipt channel differs from order; reconciliation required');
}
async function directOfferStages(tenant) {
  const snapshot = await directSnapshot(tenant);
  if (!snapshot) return [];
  return require('./marketCatalog').offerStages(await require('./marketCatalog').eligibleGroups({market:snapshot.market,channel:'storefront'}));
}
module.exports = { collectionSnapshot, directSnapshot, assertBinding, directOfferStages };
