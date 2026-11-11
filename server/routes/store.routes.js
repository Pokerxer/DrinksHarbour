// routes/store.routes.js
//
// Public storefront directory used by the platform "vendors" pages.
//
//   GET   /api/stores                     — paginated, searchable directory
//   GET   /api/stores/:slug               — single storefront + its products
//   GET   /api/stores/:slug/reviews       — public approved seller ratings
//   POST  /api/stores/:slug/reviews       — customer rates a seller (verified purchase)
//   PATCH /api/stores/reviews/:id/status  — super-admin moderation

const express = require('express');
const router = express.Router();
const storeController = require('../controllers/store.controller');
const tenantReviewController = require('../controllers/tenantReview.controller');
const { protect, superAdminOnly } = require('../middleware/auth.middleware');

router.get('/', storeController.getStores);
router.get('/:slug', storeController.getStoreBySlug);

// Seller ratings — declared AFTER the literal routes above so /:slug can never
// shadow them, and BEFORE /:slug only where paths actually collide (they don't:
// /:slug is one segment, /:slug/reviews is two).
router.get('/:slug/reviews', tenantReviewController.getStoreReviews);
router.post('/:slug/reviews', protect, tenantReviewController.createStoreReview);

// Moderation is platform-level: ratings are shown on public storefronts, so a
// tenant admin must not be able to approve their own store's reviews.
router.patch('/reviews/:id/status', protect, superAdminOnly, tenantReviewController.moderateStoreReview);

module.exports = router;
