'use strict';
const { AsyncLocalStorage } = require('node:async_hooks');
const { ValidationError } = require('../utils/errors');
const storage = new AsyncLocalStorage();
const enabled = () => process.env.MARKET_FOUNDATIONS_ENABLED === 'true';
function normalizeMarket(code = 'NG') {
  if (typeof code !== 'string' || !/^[A-Z]{2}$/.test(code)) throw new ValidationError('Use an ISO shopping market code');
  return code;
}
const currentMarket = () => storage.getStore()?.market || 'NG';
const publicScope = () => storage.getStore()?.public === true;
const marketplaceStock = () => storage.getStore()?.marketplaceStock === true;
const runMarket = (code, fn, options = {}) => storage.run({ market: normalizeMarket(code), ...options }, fn);
function handler(fn) {
  return (req, res, next) => {
    const useMarketPolicy = enabled();
    try {
      const market = useMarketPolicy ? normalizeMarket(req.headers?.['x-market-code'] || 'NG') : 'NG';
      const tenantSite = req.headers?.['x-is-tenant-site'] === 'true';
      if (useMarketPolicy) res.vary('x-market-code');
      if (useMarketPolicy || req.method === 'GET') res.set('Cache-Control', 'private, no-store');
      return runMarket(market, () => fn(req, res, next), { public: true, marketplaceStock: !tenantSite });
    } catch (error) { next(error); }
  };
}
module.exports = { enabled, normalizeMarket, currentMarket, publicScope, marketplaceStock, runMarket, handler };
