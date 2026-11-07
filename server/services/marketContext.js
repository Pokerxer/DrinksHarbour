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
const runMarket = (code, fn, options = {}) => storage.run({ market: normalizeMarket(code), ...options }, fn);
function handler(fn) {
  return (req, res, next) => {
    if (!enabled()) return fn(req, res, next);
    try {
      const market = normalizeMarket(req.headers?.['x-market-code'] || 'NG');
      res.set('Cache-Control', 'private, no-store'); res.vary('x-market-code');
      return runMarket(market, () => fn(req, res, next), { public: true });
    } catch (error) { next(error); }
  };
}
module.exports = { enabled, normalizeMarket, currentMarket, publicScope, runMarket, handler };
