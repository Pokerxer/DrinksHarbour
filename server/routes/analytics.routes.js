const express = require('express');
const router  = express.Router();
const { getDashboard } = require('../controllers/analytics.controller');
const { protect, attachTenant, tenantAdminOrSuperAdmin } = require('../middleware/auth.middleware');
const webAnalyticsController = require('../controllers/webAnalytics.controller');

// Existing dashboard route
router.get('/dashboard', protect, attachTenant, tenantAdminOrSuperAdmin, getDashboard);

// Public tracking routes (no auth)
router.post('/track', webAnalyticsController.trackPageView);
router.patch('/track/duration', webAnalyticsController.updateDuration);

// Protected admin read routes
router.get('/web-overview',    protect, attachTenant, tenantAdminOrSuperAdmin, webAnalyticsController.getOverview);
router.get('/acquisition',     protect, attachTenant, tenantAdminOrSuperAdmin, webAnalyticsController.getAcquisition);
router.get('/devices',         protect, attachTenant, tenantAdminOrSuperAdmin, webAnalyticsController.getDevices);
router.get('/traffic-sources', protect, attachTenant, tenantAdminOrSuperAdmin, webAnalyticsController.getTrafficSources);
router.get('/audience',        protect, attachTenant, tenantAdminOrSuperAdmin, webAnalyticsController.getAudience);
router.get('/conversions',     protect, attachTenant, tenantAdminOrSuperAdmin, webAnalyticsController.getConversions);
router.get('/goals',           protect, attachTenant, tenantAdminOrSuperAdmin, webAnalyticsController.getGoals);
router.get('/pages',           protect, attachTenant, tenantAdminOrSuperAdmin, webAnalyticsController.getPages);
router.get('/retention',       protect, attachTenant, tenantAdminOrSuperAdmin, webAnalyticsController.getRetention);
router.get('/channels',        protect, attachTenant, tenantAdminOrSuperAdmin, webAnalyticsController.getChannels);

module.exports = router;
