'use strict';

const bannerService = require('../services/banner.service');
const { successResponse, errorResponse } = require('../utils/response');

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
