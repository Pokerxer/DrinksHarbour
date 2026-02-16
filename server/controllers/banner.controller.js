// controllers/banner.controller.js

const bannerService = require('../services/banner.service');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');

/**
 * @desc    Create new banner
 * @route   POST /api/banners
 * @access  Private/Admin
 */
exports.createBanner = asyncHandler(async (req, res) => {
  const banner = await bannerService.createBanner(req.body, req.user._id);

  successResponse(res, banner, 'Banner created successfully', 201);
});

/**
 * @desc    Get all banners with filtering and pagination
 * @route   GET /api/banners
 * @access  Private/Admin
 */
exports.getAllBanners = asyncHandler(async (req, res) => {
  const result = await bannerService.getAllBanners(req.query);

  successResponse(res, result, 'Banners retrieved successfully');
});

/**
 * @desc    Get banner by ID
 * @route   GET /api/banners/:id
 * @access  Private/Admin
 */
exports.getBannerById = asyncHandler(async (req, res) => {
  const banner = await bannerService.getBannerById(req.params.id);

  successResponse(res, banner, 'Banner retrieved successfully');
});

/**
 * @desc    Get banner by slug
 * @route   GET /api/banners/slug/:slug
 * @access  Public
 */
exports.getBannerBySlug = asyncHandler(async (req, res) => {
  const banner = await bannerService.getBannerBySlug(req.params.slug);

  successResponse(res, banner, 'Banner retrieved successfully');
});

/**
 * @desc    Update banner
 * @route   PUT /api/banners/:id
 * @access  Private/Admin
 */
exports.updateBanner = asyncHandler(async (req, res) => {
  const banner = await bannerService.updateBanner(
    req.params.id,
    req.body,
    req.user._id
  );

  successResponse(res, banner, 'Banner updated successfully');
});

/**
 * @desc    Patch/Partial update banner
 * @route   PATCH /api/banners/:id
 * @access  Private/Admin
 */
exports.patchBanner = asyncHandler(async (req, res) => {
  const banner = await bannerService.updateBanner(
    req.params.id,
    req.body,
    req.user._id
  );

  successResponse(res, banner, 'Banner updated successfully');
});

/**
 * @desc    Delete banner
 * @route   DELETE /api/banners/:id
 * @access  Private/Admin
 */
exports.deleteBanner = asyncHandler(async (req, res) => {
  const result = await bannerService.deleteBanner(req.params.id);

  successResponse(res, result, 'Banner deleted successfully');
});

/**
 * @desc    Archive banner (soft delete)
 * @route   POST /api/banners/:id/archive
 * @access  Private/Admin
 */
exports.archiveBanner = asyncHandler(async (req, res) => {
  const result = await bannerService.archiveBanner(req.params.id, req.user._id);

  successResponse(res, result, 'Banner archived successfully');
});

/**
 * @desc    Get active banners for specific placement
 * @route   GET /api/banners/placement/:placement
 * @access  Public
 */
exports.getActiveBannersForPlacement = asyncHandler(async (req, res) => {
  const { placement } = req.params;
  const { tenant, visibleTo, device } = req.query;

  const banners = await bannerService.getActiveBannersForPlacement(placement, {
    tenant,
    visibleTo,
    device,
  });

  successResponse(res, banners, 'Active banners retrieved successfully');
});

/**
 * @desc    Get banners by type
 * @route   GET /api/banners/type/:type
 * @access  Public
 */
exports.getBannersByType = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { isActive, limit } = req.query;

  const banners = await bannerService.getBannersByType(type, {
    isActive,
    limit: parseInt(limit) || 10,
  });

  successResponse(res, banners, 'Banners retrieved successfully');
});

/**
 * @desc    Track banner impression
 * @route   POST /api/banners/:id/impression
 * @access  Public
 */
exports.trackImpression = asyncHandler(async (req, res) => {
  const result = await bannerService.trackImpression(req.params.id);

  successResponse(res, result, 'Impression tracked successfully');
});

/**
 * @desc    Track banner click
 * @route   POST /api/banners/:id/click
 * @access  Public
 */
exports.trackClick = asyncHandler(async (req, res) => {
  const result = await bannerService.trackClick(req.params.id);

  successResponse(res, result, 'Click tracked successfully');
});

/**
 * @desc    Track banner conversion
 * @route   POST /api/banners/:id/conversion
 * @access  Public
 */
exports.trackConversion = asyncHandler(async (req, res) => {
  const result = await bannerService.trackConversion(req.params.id);

  successResponse(res, result, 'Conversion tracked successfully');
});

/**
 * @desc    Batch track impressions for multiple banners
 * @route   POST /api/banners/batch/impressions
 * @access  Public
 */
exports.batchTrackImpressions = asyncHandler(async (req, res) => {
  const { bannerIds } = req.body;

  if (!Array.isArray(bannerIds) || bannerIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Banner IDs array is required',
    });
  }

  const result = await bannerService.batchTrackImpressions(bannerIds);

  successResponse(res, result, 'Impressions tracked successfully');
});

/**
 * @desc    Update banner status
 * @route   PATCH /api/banners/:id/status
 * @access  Private/Admin
 */
exports.updateBannerStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: 'Status is required',
    });
  }

  const result = await bannerService.updateBannerStatus(
    req.params.id,
    status,
    req.user._id
  );

  successResponse(res, result, 'Banner status updated successfully');
});

/**
 * @desc    Bulk update banner status
 * @route   PATCH /api/banners/bulk/status
 * @access  Private/Admin
 */
exports.bulkUpdateBannerStatus = asyncHandler(async (req, res) => {
  const { bannerIds, status } = req.body;

  if (!Array.isArray(bannerIds) || !status) {
    return res.status(400).json({
      success: false,
      message: 'Banner IDs array and status are required',
    });
  }

  const result = await bannerService.bulkUpdateBannerStatus(
    bannerIds,
    status,
    req.user._id
  );

  successResponse(res, result, 'Banner statuses updated successfully');
});

/**
 * @desc    Update banner display order
 * @route   PATCH /api/banners/order
 * @access  Private/Admin
 */
exports.updateBannerOrder = asyncHandler(async (req, res) => {
  const { orderUpdates } = req.body;

  if (!Array.isArray(orderUpdates)) {
    return res.status(400).json({
      success: false,
      message: 'Order updates array is required',
    });
  }

  const result = await bannerService.updateBannerOrder(orderUpdates, req.user._id);

  successResponse(res, result, 'Banner order updated successfully');
});

/**
 * @desc    Get banner analytics by ID
 * @route   GET /api/banners/:id/analytics
 * @access  Private/Admin
 */
exports.getBannerAnalytics = asyncHandler(async (req, res) => {
  const analytics = await bannerService.getBannerAnalytics(req.params.id);

  successResponse(res, analytics, 'Banner analytics retrieved successfully');
});

/**
 * @desc    Get aggregate analytics for all banners
 * @route   GET /api/banners/analytics/aggregate
 * @access  Private/Admin
 */
exports.getAggregateAnalytics = asyncHandler(async (req, res) => {
  const { status, type, placement, tenant, startDate, endDate } = req.query;

  const analytics = await bannerService.getAggregateAnalytics({
    status,
    type,
    placement,
    tenant,
    startDate,
    endDate,
  });

  successResponse(res, analytics, 'Aggregate analytics retrieved successfully');
});

/**
 * @desc    Clone/duplicate banner
 * @route   POST /api/banners/:id/clone
 * @access  Private/Admin
 */
exports.cloneBanner = asyncHandler(async (req, res) => {
  const banner = await bannerService.cloneBanner(req.params.id, req.user._id);

  successResponse(res, banner, 'Banner cloned successfully', 201);
});

/**
 * @desc    Update scheduled banners status (cron job endpoint)
 * @route   POST /api/banners/cron/update-scheduled
 * @access  Private/Admin (or system cron job)
 */
exports.updateScheduledBannersStatus = asyncHandler(async (req, res) => {
  const result = await bannerService.updateScheduledBannersStatus();

  successResponse(res, result, 'Scheduled banners updated successfully');
});

/**
 * @desc    Toggle banner active status
 * @route   PATCH /api/banners/:id/toggle-active
 * @access  Private/Admin
 */
exports.toggleBannerActive = asyncHandler(async (req, res) => {
  const banner = await bannerService.getBannerById(req.params.id);
  
  const newStatus = !banner.isActive;
  const updatedBanner = await bannerService.updateBanner(
    req.params.id,
    { isActive: newStatus },
    req.user._id
  );

  successResponse(
    res,
    updatedBanner,
    `Banner ${newStatus ? 'activated' : 'deactivated'} successfully`
  );
});

/**
 * @desc    Get banners statistics summary
 * @route   GET /api/banners/stats/summary
 * @access  Private/Admin
 */
exports.getBannersSummary = asyncHandler(async (req, res) => {
  const { tenant } = req.query;

  const result = await bannerService.getAllBanners({
    tenant,
    page: 1,
    limit: 1,
  });

  const summary = {
    total: result.pagination.totalResults,
    stats: result.stats,
  };

  successResponse(res, summary, 'Banner summary retrieved successfully');
});

/**
 * @desc    Validate banner before creation/update
 * @route   POST /api/banners/validate
 * @access  Private/Admin
 */
exports.validateBanner = asyncHandler(async (req, res) => {
  // This is a helper endpoint for frontend validation
  const { title, slug, linkType, targetProduct, targetCategory, targetBrand } = req.body;

  const validationErrors = [];

  // Check slug uniqueness if provided
  if (slug) {
    const Banner = require('../models/Banner');
    const existingBanner = await Banner.findOne({ slug });
    if (existingBanner) {
      validationErrors.push({
        field: 'slug',
        message: 'A banner with this slug already exists',
      });
    }
  }

  // Validate references based on linkType
  if (linkType === 'product' && targetProduct) {
    const Product = require('../models/product');
    const product = await Product.findById(targetProduct);
    if (!product) {
      validationErrors.push({
        field: 'targetProduct',
        message: 'Target product not found',
      });
    }
  }

  if (linkType === 'category' && targetCategory) {
    const Category = require('../models/Category');
    const category = await Category.findById(targetCategory);
    if (!category) {
      validationErrors.push({
        field: 'targetCategory',
        message: 'Target category not found',
      });
    }
  }

  if (linkType === 'brand' && targetBrand) {
    const Brand = require('../models/Brand');
    const brand = await Brand.findById(targetBrand);
    if (!brand) {
      validationErrors.push({
        field: 'targetBrand',
        message: 'Target brand not found',
      });
    }
  }

  if (validationErrors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: validationErrors,
    });
  }

  successResponse(res, { valid: true }, 'Banner data is valid');
});

/**
 * @desc    Get featured banners (high priority, active)
 * @route   GET /api/banners/featured
 * @access  Public
 */
exports.getFeaturedBanners = asyncHandler(async (req, res) => {
  const { limit = 5, placement } = req.query;

  const result = await bannerService.getAllBanners({
    isActive: true,
    status: 'active',
    priority: ['high', 'urgent'],
    placement,
    limit: parseInt(limit),
    sortBy: 'priority',
    order: 'desc',
  });

  successResponse(res, result.banners, 'Featured banners retrieved successfully');
});

/**
 * @desc    Search banners
 * @route   GET /api/banners/search
 * @access  Private/Admin
 */
exports.searchBanners = asyncHandler(async (req, res) => {
  const { q, ...filters } = req.query;

  const result = await bannerService.getAllBanners({
    search: q,
    ...filters,
  });

  successResponse(res, result, 'Search results retrieved successfully');
});

/**
 * @desc    Export banners (CSV/JSON)
 * @route   GET /api/banners/export
 * @access  Private/Admin
 */
exports.exportBanners = asyncHandler(async (req, res) => {
  const { format = 'json', ...filters } = req.query;

  const result = await bannerService.getAllBanners({
    ...filters,
    page: 1,
    limit: 10000, // Export all
  });

  if (format === 'csv') {
    // Convert to CSV
    const fields = [
      'title',
      'type',
      'placement',
      'status',
      'isActive',
      'impressions',
      'clicks',
      'clickThroughRate',
      'conversionCount',
      'conversionRate',
    ];

    const csv = [
      fields.join(','),
      ...result.banners.map(banner =>
        fields.map(field => {
          const value = banner[field];
          return typeof value === 'string' && value.includes(',')
            ? `"${value}"`
            : value;
        }).join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=banners.csv');
    return res.send(csv);
  }

  // JSON format
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=banners.json');
  successResponse(res, result.banners, 'Banners exported successfully');
});

/**
 * @desc    Get banner performance report
 * @route   GET /api/banners/:id/report
 * @access  Private/Admin
 */
exports.getBannerPerformanceReport = asyncHandler(async (req, res) => {
  const banner = await bannerService.getBannerById(req.params.id);
  const analytics = await bannerService.getBannerAnalytics(req.params.id);

  const report = {
    banner: {
      id: banner._id,
      title: banner.title,
      type: banner.type,
      placement: banner.placement,
      status: banner.status,
      isActive: banner.isActive,
    },
    performance: {
      impressions: analytics.impressions,
      clicks: analytics.clicks,
      conversions: analytics.conversionCount,
      clickThroughRate: analytics.clickThroughRate,
      conversionRate: analytics.conversionRate,
      engagementScore: analytics.engagementScore,
      performanceRating: analytics.performanceRating,
    },
    schedule: analytics.schedule,
    recommendations: generateRecommendations(analytics),
  };

  successResponse(res, report, 'Performance report generated successfully');
});

// Helper function for recommendations
function generateRecommendations(analytics) {
  const recommendations = [];

  if (analytics.clickThroughRate < 1) {
    recommendations.push({
      type: 'warning',
      message: 'Low click-through rate. Consider updating the banner image or CTA text.',
    });
  }

  if (analytics.conversionRate < 5 && analytics.clicks > 100) {
    recommendations.push({
      type: 'warning',
      message: 'Low conversion rate despite good traffic. Review the landing page experience.',
    });
  }

  if (analytics.impressions > 10000 && analytics.clicks < 100) {
    recommendations.push({
      type: 'critical',
      message: 'High impressions but very low clicks. Banner may not be engaging enough.',
    });
  }

  if (analytics.performanceRating === 'excellent') {
    recommendations.push({
      type: 'success',
      message: 'Excellent performance! Consider cloning this banner for similar campaigns.',
    });
  }

  if (analytics.daysUntilExpiration !== null && analytics.daysUntilExpiration <= 3) {
    recommendations.push({
      type: 'info',
      message: `Banner expires in ${analytics.daysUntilExpiration} days. Plan a replacement campaign.`,
    });
  }

  return recommendations;
}