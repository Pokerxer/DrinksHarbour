const express = require('express');
const router  = express.Router();
const { getDashboard, trackPageView, trackDuration } = require('../controllers/analytics.controller');
const { protect, attachTenant, tenantAdminOrSuperAdmin } = require('../middleware/auth.middleware');

router.get('/dashboard', protect, attachTenant, tenantAdminOrSuperAdmin, getDashboard);

// Public — anonymous storefront tracking, no auth/tenant middleware.
router.post('/track', trackPageView);
router.post('/track/duration', trackDuration);  // sendBeacon always POSTs
router.patch('/track/duration', trackDuration); // fetch fallback uses PATCH

module.exports = router;
