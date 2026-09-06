'use strict';

const express = require('express');
const router = express.Router();
const {
  protect,
  attachTenant,
  requireTenant,
  authorize,
  allowBillingWrites,
} = require('../middleware/auth.middleware');
const ctrl = require('../controllers/erm.controller');

// Public
router.get('/plans', ctrl.getPlans);

// Paystack webhook — no auth; the signature IS the authentication.
//
// The raw bytes arrive on `req.rawBody` from the `verify` hook on
// express.json() in server.js. They cannot be captured here: that global
// parser runs first and sets `req._body`, so an `express.raw()` mounted on
// this route returns without producing a Buffer — which is exactly how the
// signature check ended up hashing a re-serialised body instead.
router.post('/webhook', ctrl.webhook);

// Tenant-authenticated.
//
// allowBillingWrites runs FIRST and on purpose: a past_due or expired-trial
// tenant is read-only everywhere else, and if that applied here too the only
// route back to paying would be shut. This is the one router exempt from it.
router.use(allowBillingWrites, protect, attachTenant, requireTenant);
router.get('/status', ctrl.getStatus);
router.post('/subscribe', ctrl.subscribe);
router.post('/cancel', ctrl.cancel);

// Add-ons: extra shop / extra warehouse, one unit per call.
router.post('/add-ons', ctrl.subscribeAddOn);
router.delete('/add-ons/:addOnType', ctrl.cancelAddOn);

// Super admin
router.post('/admin/sync-commission', authorize('super_admin', 'admin'), ctrl.syncCommission);

module.exports = router;
