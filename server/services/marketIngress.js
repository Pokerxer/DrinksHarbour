'use strict';
const context = require('./marketContext');
const { ValidationError, ForbiddenError } = require('../utils/errors');
// Supply-category mapping is registry-owned (config/marketCategories.js):
// looked-up typing stays behavior-identical, and a new vertical is a config
// addition — not a fork of the catalogue engines.
const registry = require('../config/marketCategories');
const giftTypes = registry.typesByCategory.gift;
const foodTypes = registry.typesByCategory.food;
async function assertNewCollection(currency = 'NGN') {
  if (!context.enabled()) return;
  const country = await require('./country').resolveCountry(context.currentMarket());
  if (country.capabilities?.marketplace !== true) throw new ForbiddenError('Marketplace collection is unavailable in this country');
  if (country.currency !== currency) throw new ForbiddenError('Collection currency does not match the configured country');
}
function categoryFor(product) {
  return registry.categoryFor(product);
}
async function assertOffer({ tenant, product, market = context.currentMarket(), channel = 'marketplace' }) {
  if (!context.enabled()) return { legacy: true };
  return require('./marketPolicy').assertMarketAccess({ tenant: tenant?._id || tenant, market, category: categoryFor(product), channel });
}
async function snapshot({ tenant, kind = 'marketplace', market = context.currentMarket(), currency = 'NGN', storefrontChannel, provider, account }) {
  if (!context.enabled()) return undefined;
  return require('./salesChannels').resolveChannelSnapshot({ tenant, kind, market, currency, storefrontChannel, provider, account });
}
async function assertLines(items, products, tenants, options = {}) {
  if (!context.enabled()) return;
  for (const item of items) {
    const tenant = tenants.find(t => String(t._id) === String(item.tenant));
    const product = products.find(p => String(p._id) === String(item.product));
    if (!tenant || !product) throw new ForbiddenError('Sale authority is unavailable');
    await assertOffer({ tenant, product, ...options });
  }
}
module.exports = { categoryFor, giftTypes, foodTypes, assertOffer, assertLines, snapshot, assertNewCollection };
