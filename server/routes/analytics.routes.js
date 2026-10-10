const express = require('express');
const { cacheReport } = require('../middleware/adminReportCache');
const router  = express.Router();
const ctrl    = require('../controllers/analytics.controller');
const { getDashboard, trackPageView, trackDuration, trackConversion } = ctrl;
const { protect, attachTenant, tenantAdminOrSuperAdmin, authorize } = require('../middleware/auth.middleware');

router.get('/dashboard', protect, attachTenant, tenantAdminOrSuperAdmin, cacheReport('ecommerce-dashboard'), getDashboard);

// ── Read side for the admin analytics dashboard ──────────────────────────────
//
// These ten were called by the dashboard from the day the template landed and
// were never registered, so each one 404'd. The aggregation behind them has
// always existed in services/webAnalytics.service.js; only the wiring was
// missing.
//
// Platform staff only. `WebAnalytics` has no tenant field — it records traffic
// to the main drinksharbour.com storefront — so there is nothing to scope by
// tenant, and a tenant admin has no business seeing every other tenant's
// audience. Unlike /dashboard, which is filtered inside the handler, this data
// cannot be narrowed, so the guard is on the route.
const platformAnalytics = [protect, authorize('super_admin', 'admin')];

router.get('/web-report', ...platformAnalytics, cacheReport('web-report'), ctrl.getWebReport);

router.get('/web-overview',     ...platformAnalytics, cacheReport('web-web-overview'), ctrl.getWebOverview);
router.get('/acquisition',      ...platformAnalytics, cacheReport('web-acquisition'), ctrl.getAcquisition);
router.get('/devices',          ...platformAnalytics, cacheReport('web-devices'), ctrl.getDeviceSessions);
router.get('/traffic-sources',  ...platformAnalytics, cacheReport('web-traffic-sources'), ctrl.getTrafficSources);
router.get('/audience',         ...platformAnalytics, cacheReport('web-audience'), ctrl.getAudienceMetrics);
router.get('/conversions',      ...platformAnalytics, cacheReport('web-conversions'), ctrl.getConversionsByLocation);
router.get('/goals',            ...platformAnalytics, cacheReport('web-goals'), ctrl.getGoals);
router.get('/pages',            ...platformAnalytics, cacheReport('web-pages'), ctrl.getPageMetrics);
router.get('/retention',        ...platformAnalytics, cacheReport('web-retention'), ctrl.getAccountRetention);
router.get('/channels',         ...platformAnalytics, cacheReport('web-channels'), ctrl.getWebsiteChannels);

// Public — anonymous storefront tracking, no auth/tenant middleware.
router.post('/track', trackPageView);
router.post('/track/duration', trackDuration);  // sendBeacon always POSTs
router.patch('/track/duration', trackDuration); // fetch fallback uses PATCH
router.post('/track/conversion', trackConversion);

module.exports = router;
