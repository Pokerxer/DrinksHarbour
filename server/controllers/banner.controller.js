'use strict';

const bannerService = require('../services/banner.service');
const { successResponse, errorResponse } = require('../utils/response');

// Map a thrown service error to its HTTP status. Typed AppErrors (ValidationError,
// NotFoundError, …) carry a statusCode; anything else is a 500.
function fail(res, err, fallbackMsg) {
  const code = err && err.statusCode ? err.statusCode : 500;
  return errorResponse(res, err?.message || fallbackMsg, code, err);
}

const userId = (req) => req.user?._id;

/**
 * GET /api/banners/placement/:placement
 * Public — storefront banner lookup for a given placement slot.
 */
exports.getBannersByPlacement = async (req, res) => {
  try {
    const { placement } = req.params;
    const { limit, type } = req.query;

    let banners = await bannerService.getActiveBannersForPlacement(placement, {
      tenant: req.tenant?._id,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    if (type) banners = banners.filter((b) => b.type === type);

    return successResponse(res, banners, 'Banners fetched');
  } catch (err) {
    return errorResponse(res, 'Failed to fetch banners', 500, err);
  }
};

/**
 * GET /api/banners
 * Admin — paginated + filtered list ({ banners, pagination, stats }).
 */
exports.listBanners = async (req, res) => {
  try {
    const data = await bannerService.getAllBanners(req.query);
    return successResponse(res, data, 'Banners fetched');
  } catch (err) {
    return fail(res, err, 'Failed to fetch banners');
  }
};

/**
 * POST /api/banners
 * Admin — create a banner.
 */
exports.createBanner = async (req, res) => {
  try {
    const banner = await bannerService.createBanner(req.body, userId(req));
    return successResponse(res, banner, 'Banner created', 201);
  } catch (err) {
    return fail(res, err, 'Failed to create banner');
  }
};

/**
 * GET /api/banners/:id
 * Admin — single banner detail.
 */
exports.getBanner = async (req, res) => {
  try {
    const banner = await bannerService.getBannerById(req.params.id);
    return successResponse(res, banner, 'Banner fetched');
  } catch (err) {
    return fail(res, err, 'Failed to fetch banner');
  }
};

/**
 * PUT|PATCH /api/banners/:id
 * Admin — update a banner.
 */
exports.updateBanner = async (req, res) => {
  try {
    const banner = await bannerService.updateBanner(req.params.id, req.body, userId(req));
    return successResponse(res, banner, 'Banner updated');
  } catch (err) {
    return fail(res, err, 'Failed to update banner');
  }
};

/**
 * DELETE /api/banners/:id
 * Admin — delete a banner.
 */
exports.deleteBanner = async (req, res) => {
  try {
    const result = await bannerService.deleteBanner(req.params.id);
    return successResponse(res, result, 'Banner deleted');
  } catch (err) {
    return fail(res, err, 'Failed to delete banner');
  }
};

/**
 * PATCH /api/banners/:id/status
 * Admin — set a single banner's status.
 */
exports.setBannerStatus = async (req, res) => {
  try {
    const banner = await bannerService.updateBannerStatus(req.params.id, req.body.status, userId(req));
    return successResponse(res, banner, 'Banner status updated');
  } catch (err) {
    return fail(res, err, 'Failed to update banner status');
  }
};

/**
 * PATCH /api/banners/:id/toggle-active
 * Admin — flip the isActive flag.
 */
exports.toggleBannerActive = async (req, res) => {
  try {
    const current = await bannerService.getBannerById(req.params.id);
    const banner = await bannerService.updateBanner(
      req.params.id,
      { isActive: !current.isActive },
      userId(req)
    );
    return successResponse(res, banner, 'Banner active state toggled');
  } catch (err) {
    return fail(res, err, 'Failed to toggle banner');
  }
};

/**
 * PATCH /api/banners/bulk/status
 * Admin — set status on many banners at once.
 */
exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { bannerIds, status } = req.body;
    const result = await bannerService.bulkUpdateBannerStatus(bannerIds, status, userId(req));
    return successResponse(res, result, 'Banners updated');
  } catch (err) {
    return fail(res, err, 'Failed to bulk update banners');
  }
};

/**
 * POST /api/banners/:id/clone
 * Admin — duplicate a banner as a draft.
 */
exports.cloneBanner = async (req, res) => {
  try {
    const banner = await bannerService.cloneBanner(req.params.id, userId(req));
    return successResponse(res, banner, 'Banner cloned', 201);
  } catch (err) {
    return fail(res, err, 'Failed to clone banner');
  }
};

/**
 * GET /api/banners/:id/analytics
 * Admin — impressions/clicks/CTR analytics for a banner.
 */
exports.getBannerAnalytics = async (req, res) => {
  try {
    const analytics = await bannerService.getBannerAnalytics(req.params.id, req.query);
    return successResponse(res, analytics, 'Banner analytics fetched');
  } catch (err) {
    return fail(res, err, 'Failed to fetch banner analytics');
  }
};

/**
 * POST /api/banners/:id/impression
 * Public — record an impression (fire-and-forget from the storefront).
 */
exports.trackImpression = async (req, res) => {
  try {
    await bannerService.trackImpression(req.params.id);
    return successResponse(res, null, 'Impression tracked');
  } catch (err) {
    // Never surface tracking failures to the storefront as an error.
    return successResponse(res, null, 'Impression ignored');
  }
};

/**
 * POST /api/banners/:id/click
 * Public — record a click (fire-and-forget from the storefront).
 */
exports.trackClick = async (req, res) => {
  try {
    await bannerService.trackClick(req.params.id);
    return successResponse(res, null, 'Click tracked');
  } catch (err) {
    return successResponse(res, null, 'Click ignored');
  }
};
