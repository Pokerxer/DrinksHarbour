'use strict';
const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { requireStorefrontKey, requireCheckoutKey } = require('../middleware/integration.middleware');
const catalog = require('../services/storefrontCatalog.service');
const banners = require('../services/storefrontBanners.service');
const cart = require('../services/storefrontCart.service');
const checkout = require('../services/storefrontCheckout.service');
const settlement = require('../services/storefrontSettlement');
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.use('/customers', require('./tenantCustomer.routes'));
router.get('/store', requireStorefrontKey, (req, res) => {
  res.json({ success: true, data: catalog.publicStore(req.integration.tenant) });
});
router.get('/banners', requireStorefrontKey, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await banners.listBanners(req.integration.tenant, req.query) });
}));
router.get('/products', requireStorefrontKey, asyncHandler(async (req, res) => {
  res.json({ success: true, ...await catalog.listProducts(req.integration.tenant, req.query) });
}));
router.get('/products/:id', requireStorefrontKey, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await catalog.getProduct(req.integration.tenant, req.params.id) });
}));
router.post('/cart/quote', requireCheckoutKey, asyncHandler(async (req, res) => {
  res.json({ success: true, data: cart.publicQuote(await cart.quoteCart(req.integration.tenant, req.body)) });
}));
router.post('/checkout', requireCheckoutKey, asyncHandler(async (req, res) => {
  const data = await checkout.createCheckout(req.integration.tenant, req.integration.key, req.body, req.headers['idempotency-key']);
  res.set('Location', `/api/integrations/v1/checkout/${data.id}`);
  res.status(['initializing', 'pending', 'uncertain'].includes(data.status) ? 202 : data.replayed ? 200 : 201).json({ success: true, data });
}));
router.get('/checkout/:id', requireCheckoutKey, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await checkout.getCheckout(req.integration.tenant, req.integration.key, req.params.id) });
}));
router.post('/checkout/:id/verify', requireCheckoutKey, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await checkout.verifyCheckout(req.integration.tenant, req.integration.key, req.params.id) });
}));
router.post('/checkout/:id/cancel', requireCheckoutKey, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await settlement.cancelCheckout(req.integration.tenant, req.integration.key, req.params.id) });
}));
router.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  if (status === 429) res.set('Retry-After', String(60 - Math.floor(Date.now() / 1000) % 60));
  const codes = { 400: 'invalid_request', 401: 'invalid_api_key', 403: 'access_denied', 404: 'not_found',
    409: 'conflict', 429: 'rate_limited', 502: 'payment_unavailable', 503: 'service_unavailable' };
  res.status(status).json({ success: false, code: codes[status] || 'internal_error',
    message: status < 500 || err.expose ? err.message : 'Unable to process request' });
});
module.exports = router;
