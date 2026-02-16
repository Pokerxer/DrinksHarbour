// routes/product.routes.js

const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/banner.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { body, param, query } = require('express-validator');

// ============================================================
// VALIDATION RULES
// ============================================================

const createBannerValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters'),
  
  body('subtitle')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Subtitle cannot exceed 200 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  
  body('image.url')
    .notEmpty()
    .withMessage('Image URL is required')
    .isURL()
    .withMessage('Invalid image URL'),
  
  body('type')
    .isIn(['hero', 'promotional', 'category', 'product', 'seasonal', 'announcement', 'custom'])
    .withMessage('Invalid banner type'),
  
  body('placement')
    .isIn(['home_hero', 'home_secondary', 'category_top', 'product_page', 'checkout', 'sidebar', 'footer', 'popup', 'header'])
    .withMessage('Invalid placement'),
  
  body('linkType')
    .optional()
    .isIn(['internal', 'external', 'product', 'category', 'brand', 'collection', 'page'])
    .withMessage('Invalid link type'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority'),
  
  body('displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer'),
  
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
];

const updateBannerValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters'),
  
  body('subtitle')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Subtitle cannot exceed 200 characters'),
  
  body('type')
    .optional()
    .isIn(['hero', 'promotional', 'category', 'product', 'seasonal', 'announcement', 'custom'])
    .withMessage('Invalid banner type'),
  
  body('placement')
    .optional()
    .isIn(['home_hero', 'home_secondary', 'category_top', 'product_page', 'checkout', 'sidebar', 'footer', 'popup', 'header'])
    .withMessage('Invalid placement'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority'),
];

const statusValidation = [
  body('status')
    .isIn(['draft', 'scheduled', 'active', 'paused', 'expired', 'archived'])
    .withMessage('Invalid status'),
];

const bulkStatusValidation = [
  body('bannerIds')
    .isArray({ min: 1 })
    .withMessage('Banner IDs array is required'),
  body('bannerIds.*')
    .isMongoId()
    .withMessage('Invalid banner ID'),
  body('status')
    .isIn(['draft', 'scheduled', 'active', 'paused', 'expired', 'archived'])
    .withMessage('Invalid status'),
];

const orderValidation = [
  body('orderUpdates')
    .isArray({ min: 1 })
    .withMessage('Order updates must be an array with at least one item'),
  body('orderUpdates.*.bannerId')
    .isMongoId()
    .withMessage('Invalid banner ID'),
  body('orderUpdates.*.displayOrder')
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer'),
];

const batchImpressionsValidation = [
  body('bannerIds')
    .isArray({ min: 1 })
    .withMessage('Banner IDs array is required'),
  body('bannerIds.*')
    .isMongoId()
    .withMessage('Invalid banner ID'),
];

const placementParamValidation = [
  param('placement')
    .isIn(['home_hero', 'home_secondary', 'category_top', 'product_page', 'checkout', 'sidebar', 'footer', 'popup', 'header'])
    .withMessage('Invalid placement'),
];

const typeParamValidation = [
  param('type')
    .isIn(['hero', 'promotional', 'category', 'product', 'seasonal', 'announcement', 'custom'])
    .withMessage('Invalid banner type'),
];

const mongoIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid banner ID'),
];

const slugValidation = [
  param('slug')
    .notEmpty()
    .withMessage('Slug is required')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Invalid slug format'),
];

// ============================================================
// PUBLIC ROUTES
// ============================================================

/**
 * Get active banners for specific placement
 * @example GET /api/banners/placement/home_hero?device=mobile&visibleTo=guests
 */
router.get(
  '/placement/:placement',
  placementParamValidation,
  bannerController.getActiveBannersForPlacement
);

/**
 * Get banners by type
 * @example GET /api/banners/type/promotional?limit=5
 */
router.get(
  '/type/:type',
  typeParamValidation,
  validate,
  bannerController.getBannersByType
);

/**
 * Get banner by slug
 * @example GET /api/banners/slug/summer-beer-sale
 */
router.get(
  '/slug/:slug',
  slugValidation,
  validate,
  bannerController.getBannerBySlug
);

/**
 * Get featured banners
 * @example GET /api/banners/featured?limit=3&placement=home_hero
 */
router.get(
  '/featured',
  bannerController.getFeaturedBanners
);

/**
 * Track banner impression
 * @example POST /api/banners/123abc/impression
 */
router.post(
  '/:id/impression',
  mongoIdValidation,
  validate,
  bannerController.trackImpression
);

/**
 * Track banner click
 * @example POST /api/banners/123abc/click
 */
router.post(
  '/:id/click',
  mongoIdValidation,
  validate,
  bannerController.trackClick
);

/**
 * Track banner conversion
 * @example POST /api/banners/123abc/conversion
 */
router.post(
  '/:id/conversion',
  mongoIdValidation,
  validate,
  bannerController.trackConversion
);

/**
 * Batch track impressions
 * @example POST /api/banners/batch/impressions
 * @body { bannerIds: ['id1', 'id2', 'id3'] }
 */
router.post(
  '/batch/impressions',
  batchImpressionsValidation,
  validate,
  bannerController.batchTrackImpressions
);

// ============================================================
// PROTECTED ROUTES (Admin/Tenant Admin)
// ============================================================

router.use(protect);
router.use(authorize('super_admin', 'tenant_admin', 'admin'));

/**
 * Get all banners with filters
 * @example GET /api/banners?page=1&limit=20&status=active&type=promotional
 */
router.get(
  '/',
  bannerController.getAllBanners
);

/**
 * Search banners
 * @example GET /api/banners/search?q=beer&placement=home_hero
 */
router.get(
  '/search',
  bannerController.searchBanners
);

/**
 * Get banners summary statistics
 * @example GET /api/banners/stats/summary
 */
router.get(
  '/stats/summary',
  bannerController.getBannersSummary
);

/**
 * Get aggregate analytics
 * @example GET /api/banners/analytics/aggregate?startDate=2026-01-01&endDate=2026-12-31
 */
router.get(
  '/analytics/aggregate',
  bannerController.getAggregateAnalytics
);

/**
 * Export banners
 * @example GET /api/banners/export?format=csv&status=active
 */
router.get(
  '/export',
  bannerController.exportBanners
);

/**
 * Create new banner
 * @example POST /api/banners
 */
router.post(
  '/',
  createBannerValidation,
  validate,
  bannerController.createBanner
);

/**
 * Validate banner data
 * @example POST /api/banners/validate
 */
router.post(
  '/validate',
  bannerController.validateBanner
);

/**
 * Update banner display order
 * @example PATCH /api/banners/order
 * @body { orderUpdates: [{ bannerId: 'id1', displayOrder: 1 }] }
 */
router.patch(
  '/order',
  orderValidation,
  validate,
  bannerController.updateBannerOrder
);

/**
 * Bulk update banner status
 * @example PATCH /api/banners/bulk/status
 * @body { bannerIds: ['id1', 'id2'], status: 'active' }
 */
router.patch(
  '/bulk/status',
  bulkStatusValidation,
  validate,
  bannerController.bulkUpdateBannerStatus
);

/**
 * Update scheduled banners (cron job)
 * @example POST /api/banners/cron/update-scheduled
 */
router.post(
  '/cron/update-scheduled',
  bannerController.updateScheduledBannersStatus
);

/**
 * Get banner by ID
 * @example GET /api/banners/123abc
 */
router.get(
  '/:id',
  mongoIdValidation,
  validate,
  bannerController.getBannerById
);

/**
 * Update banner (full update)
 * @example PUT /api/banners/123abc
 */
router.put(
  '/:id',
  mongoIdValidation,
  updateBannerValidation,
  validate,
  bannerController.updateBanner
);

/**
 * Patch banner (partial update)
 * @example PATCH /api/banners/123abc
 */
router.patch(
  '/:id',
  mongoIdValidation,
  updateBannerValidation,
  validate,
  bannerController.patchBanner
);

/**
 * Delete banner
 * @example DELETE /api/banners/123abc
 */
router.delete(
  '/:id',
  mongoIdValidation,
  validate,
  bannerController.deleteBanner
);

/**
 * Archive banner
 * @example POST /api/banners/123abc/archive
 */
router.post(
  '/:id/archive',
  mongoIdValidation,
  validate,
  bannerController.archiveBanner
);

/**
 * Update banner status
 * @example PATCH /api/banners/123abc/status
 * @body { status: 'active' }
 */
router.patch(
  '/:id/status',
  mongoIdValidation,
  statusValidation,
  validate,
  bannerController.updateBannerStatus
);

/**
 * Toggle banner active status
 * @example PATCH /api/banners/123abc/toggle-active
 */
router.patch(
  '/:id/toggle-active',
  mongoIdValidation,
  validate,
  bannerController.toggleBannerActive
);

/**
 * Get banner analytics
 * @example GET /api/banners/123abc/analytics
 */
router.get(
  '/:id/analytics',
  mongoIdValidation,
  validate,
  bannerController.getBannerAnalytics
);

/**
 * Get banner performance report
 * @example GET /api/banners/123abc/report
 */
router.get(
  '/:id/report',
  mongoIdValidation,
  validate,
  bannerController.getBannerPerformanceReport
);

/**
 * Clone banner
 * @example POST /api/banners/123abc/clone
 */
router.post(
  '/:id/clone',
  mongoIdValidation,
  validate,
  bannerController.cloneBanner
);

module.exports = router;