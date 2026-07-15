'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/banner.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const adminOnly = [protect, authorize('super_admin', 'tenant_admin', 'admin')];

// ── Public storefront endpoints ──────────────────────────────────────────────
// Declared before the generic /:id routes so their static prefixes win.
router.get('/placement/:placement', ctrl.getBannersByPlacement);
router.post('/:id/impression', ctrl.trackImpression);
router.post('/:id/click', ctrl.trackClick);

// ── Admin bulk (two-segment static path, must precede /:id/status) ────────────
router.patch('/bulk/status', adminOnly, ctrl.bulkUpdateStatus);

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
