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
router.use(allowBillingWrites, protect);
// Platform operation has no tenant requirement.
router.post('/admin/sync-commission', authorize('super_admin', 'admin'), ctrl.syncCommission);
router.use(authorize('super_admin', 'admin', 'tenant_owner', 'tenant_admin', 'tenant_staff'));
router.use(attachTenant, requireTenant);
router.get('/status', ctrl.getStatus);
const manageBilling = authorize('super_admin', 'admin', 'tenant_owner', 'tenant_admin');
router.post('/subscribe', manageBilling, ctrl.subscribe);
router.post('/cancel', manageBilling, ctrl.cancel);
router.post('/manage', manageBilling, ctrl.manageSubscription);
router.get('/change-plan', require('../utils/asyncHandler')(async (req, res) => {
  const pending = await require('../models/BillingTransition').findOne({ tenant: req.tenant._id, state: { $ne: 'complete' } })
    .select('targetPlan effectiveAt state reason').lean();
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: pending });
}));
router.post('/change-plan', manageBilling, require('../utils/asyncHandler')(async (req, res) => {
  const data = await require('../services/billingLock.service').withBillingLock(req.tenant._id,
    tenant => require('../services/planTransition.service').schedulePlanChange(tenant, req.body.planKey));
  res.json({ success: true, data });
}));
router.post('/renew', manageBilling, require('../utils/asyncHandler')(async (req, res) => {
  await require('../services/billingLock.service').withBillingLock(req.tenant._id,
    tenant => require('../services/billingReconciliation.service').setRenewal(tenant, true));
  res.json({ success: true });
}));

// Add-ons: extra shop / extra warehouse, one unit per call.
router.post('/add-ons', manageBilling, ctrl.subscribeAddOn);
router.delete('/add-ons/:addOnType', manageBilling, ctrl.cancelAddOn);



module.exports = router;
