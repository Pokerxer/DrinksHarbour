'use strict';
const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticateKey } = require('../services/apiKey.service');
const { listBookings } = require('../services/booking.service');
const SubProduct = require('../models/SubProduct');
// API keys are deliberately accepted only on these explicit read actions.
// They cannot impersonate a JWT user or reach platform/admin endpoints.
const scoped = scope => asyncHandler(async (req, res, next) => {
  const { tenant } = await authenticateKey(req.headers.authorization?.replace(/^Bearer /, ''), scope);
  req.integrationTenant = tenant._id;
  res.set('Cache-Control', 'no-store');
  next();
});
router.get('/inventory', scoped('inventory:read'), asyncHandler(async (req, res) => {
  const rows = await SubProduct.find({ tenant: req.integrationTenant })
    .select('_id product sku totalStock availableStock reservedStock').limit(100).lean();
  res.json({ success: true, data: rows });
}));
router.get('/bookings', scoped('bookings:read'), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await listBookings(req.integrationTenant, req.query) });
}));
module.exports = router;
