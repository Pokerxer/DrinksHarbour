'use strict';

const express = require('express');
const router = express.Router();
const { protect, attachTenant, requireTenant, authorize } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/erm.controller');

// Public
router.get('/plans', ctrl.getPlans);

// Paystack webhook — raw body, no auth
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  if (Buffer.isBuffer(req.body)) req.body = JSON.parse(req.body.toString());
  next();
}, ctrl.webhook);

// Tenant-authenticated
router.use(protect, attachTenant, requireTenant);
router.get('/status', ctrl.getStatus);
router.post('/subscribe', ctrl.subscribe);
router.post('/cancel', ctrl.cancel);

// Super admin
router.post('/admin/sync-commission', authorize('super_admin', 'admin'), ctrl.syncCommission);

module.exports = router;
