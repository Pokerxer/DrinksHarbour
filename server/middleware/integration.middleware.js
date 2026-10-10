'use strict';
const asyncHandler = require('../utils/asyncHandler');
const keys = require('../services/apiKey.service');
const { UnauthorizedError } = require('../utils/errors');
const scoped = scope => asyncHandler(async (req, res, next) => {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
  if (!match) throw new UnauthorizedError('Provide a Bearer API key');
  req.integration = await keys.authenticateKey(match[1], scope);
  next();
});
// Concrete exports let the route-guard audit verify identity, not a name.
module.exports = { requireStorefrontKey: scoped('storefront:read'), requireCheckoutKey: scoped('checkout:write') };
