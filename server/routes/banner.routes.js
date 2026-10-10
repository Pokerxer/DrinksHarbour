'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/banner.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Banner really is tenant-scoped (a `tenant` ref plus a
// {tenant, placement, isActive} index) and plan-gated, so tenant roles keep
// write access here — unlike the platform taxonomy. tenant_owner, the role
// that actually owns the tenant, was omitted by mistake.
const { resolveTenantContext, requireOwnTenant } = require('../middleware/tenant.middleware');
const { requirePlan } = require('../middleware/plan.middleware');
const tenantAccess = (req, res, next) => ['super_admin', 'admin'].includes(req.user.role) ? next() : requireOwnTenant(req, res, next);
const adminOnly = [protect, resolveTenantContext, tenantAccess, requirePlan('starter'), authorize('super_admin', 'admin', 'tenant_owner', 'tenant_admin')];

// ── Public storefront endpoints ──────────────────────────────────────────────
// Declared before the generic /:id routes so their static prefixes win.
// Public context resolution does not authenticate or authorize visitors.
const resolvePublicTenant = (req, res, next) => resolveTenantContext(req, res, next);
router.get('/placement/:placement', resolvePublicTenant, ctrl.getBannersByPlacement);
router.post('/:id/impression', resolvePublicTenant, ctrl.trackImpression);
router.post('/:id/click', resolvePublicTenant, ctrl.trackClick);
router.post('/:id/conversion', resolvePublicTenant, ctrl.trackConversion);

// ── Entity banner tracking (brand / category / subcategory hero banners) ───
router.post('/entity/:type/:id/impression', ctrl.trackEntityImpression);
router.post('/entity/:type/:id/click', ctrl.trackEntityClick);

// ── Admin bulk (two-segment static path, must precede /:id/status) ────────────
router.patch('/bulk/status', adminOnly, ctrl.bulkUpdateStatus);

// ── Admin analytics (static paths — must precede /:id) ───────────────────────
router.get('/analytics/overview', adminOnly, ctrl.getAnalyticsOverview);
router.get('/analytics/entity', adminOnly, ctrl.getEntityAnalytics);

// ── Admin collection ──────────────────────────────────────────────────────────
router.get('/', adminOnly, ctrl.listBanners);
router.post('/', adminOnly, ctrl.createBanner);

// ── Admin per-banner sub-resources (before the bare /:id) ─────────────────────
router.get('/:id/analytics', adminOnly, ctrl.getBannerAnalytics);
router.patch('/:id/status', adminOnly, ctrl.setBannerStatus);
router.patch('/:id/toggle-active', adminOnly, ctrl.toggleBannerActive);
router.post('/:id/clone', adminOnly, ctrl.cloneBanner);

// ── Admin per-banner ──────────────────────────────────────────────────────────
router.get('/:id', adminOnly, ctrl.getBanner);
router.put('/:id', adminOnly, ctrl.updateBanner);
router.patch('/:id', adminOnly, ctrl.updateBanner);
router.delete('/:id', adminOnly, ctrl.deleteBanner);

module.exports = router;
