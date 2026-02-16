// services/banner.service.js

const Banner = require('../models/Banner');
const Product = require('../models/product');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const Tenant = require('../models/tenant');
const { NotFoundError, ValidationError, AuthorizationError } = require('../utils/errors');
const mongoose = require('mongoose');

/**
 * Create a new banner
 */
const createBanner = async (bannerData, userId) => {
  try {
    // Validate referenced entities
    await validateBannerReferences(bannerData);

    // Add creator
    bannerData.createdBy = userId;
    bannerData.updatedBy = userId;

    // Set default values
    if (!bannerData.slug && bannerData.title) {
      bannerData.slug = generateSlugFromTitle(bannerData.title);
    }

    // Validate schedule if provided
    if (bannerData.isScheduled && bannerData.startDate && bannerData.endDate) {
      if (new Date(bannerData.endDate) <= new Date(bannerData.startDate)) {
        throw new ValidationError('End date must be after start date');
      }
    }

    // Auto-set ctaLink based on linkType
    if (bannerData.linkType && !bannerData.ctaLink) {
      bannerData.ctaLink = generateCtaLink(bannerData);
    }

    // Create banner
    const banner = new Banner(bannerData);
    await banner.save();

    // Populate references
    await banner.populate([
      { path: 'targetProduct', select: 'name slug images priceRange averageRating' },
      { path: 'targetCategory', select: 'name slug icon color' },
      { path: 'targetBrand', select: 'name slug logo countryOfOrigin' },
      { path: 'targetCollection', select: 'name slug description' },
      { path: 'tenant', select: 'name slug logo primaryColor' },
      { path: 'createdBy', select: 'firstName lastName email avatar' },
    ]);

    return banner;
  } catch (error) {
    if (error.code === 11000) {
      throw new ValidationError('A banner with this slug already exists');
    }
    throw error;
  }
};

/**
 * Get all banners with filtering, sorting, and pagination
 */
const getAllBanners = async (queryParams = {}) => {
  const {
    page = 1,
    limit = 20,
    sortBy = 'displayOrder',
    order = 'asc',
    
    // Filters
    status,
    type,
    placement,
    isActive,
    isGlobal,
    tenant,
    search,
    priority,
    visibleTo,
    startDate,
    endDate,
    hasAnalytics,
  } = queryParams;

  const skip = (page - 1) * limit;

  // Build query
  const query = {};

  if (status) {
    query.status = Array.isArray(status) ? { $in: status } : status;
  }

  if (type) {
    query.type = Array.isArray(type) ? { $in: type } : type;
  }

  if (placement) {
    query.placement = Array.isArray(placement) ? { $in: placement } : placement;
  }

  if (isActive !== undefined) {
    query.isActive = isActive === 'true' || isActive === true;
  }

  if (isGlobal !== undefined) {
    query.isGlobal = isGlobal === 'true' || isGlobal === true;
  }

  if (tenant) {
    query.tenant = tenant;
  }

  if (priority) {
    query.priority = Array.isArray(priority) ? { $in: priority } : priority;
  }

  if (visibleTo) {
    query.visibleTo = visibleTo;
  }

  // Date range filters
  if (startDate) {
    query.startDate = { $gte: new Date(startDate) };
  }

  if (endDate) {
    query.endDate = { $lte: new Date(endDate) };
  }

  // Analytics filter
  if (hasAnalytics === 'true' || hasAnalytics === true) {
    query.$or = [
      { impressions: { $gt: 0 } },
      { clicks: { $gt: 0 } },
    ];
  }

  if (search) {
    const searchRegex = new RegExp(search, 'i');
    query.$or = [
      { title: searchRegex },
      { subtitle: searchRegex },
      { description: searchRegex },
      { slug: searchRegex },
      { ctaText: searchRegex },
    ];
  }

  // Build sort
  const sortOrder = order === 'asc' ? 1 : -1;
  let sort = {};

  switch (sortBy) {
    case 'displayOrder':
      sort = { displayOrder: sortOrder, priority: -1 };
      break;
    case 'priority':
      sort = { priority: sortOrder, displayOrder: 1 };
      break;
    case 'impressions':
      sort = { impressions: sortOrder };
      break;
    case 'clicks':
      sort = { clicks: sortOrder };
      break;
    case 'ctr':
      sort = { clickThroughRate: sortOrder };
      break;
    case 'created':
      sort = { createdAt: sortOrder };
      break;
    case 'updated':
      sort = { updatedAt: sortOrder };
      break;
    case 'title':
      sort = { title: sortOrder };
      break;
    default:
      sort = { [sortBy]: sortOrder };
  }

  // Execute query
  const [banners, total] = await Promise.all([
    Banner.find(query)
      .populate('targetProduct', 'name slug images priceRange')
      .populate('targetCategory', 'name slug icon color')
      .populate('targetBrand', 'name slug logo')
      .populate('targetCollection', 'name slug')
      .populate('tenant', 'name slug logo primaryColor')
      .populate('createdBy', 'firstName lastName email avatar')
      .populate('updatedBy', 'firstName lastName email avatar')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Banner.countDocuments(query),
  ]);

  // Enrich banners with computed data
  const enrichedBanners = banners.map(banner => enrichBannerData(banner));

  // Calculate pagination
  const totalPages = Math.ceil(total / limit);

  // Get statistics
  const stats = await getBannerStatistics(query);

  return {
    banners: enrichedBanners,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalResults: total,
      resultsPerPage: parseInt(limit),
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
    stats,
  };
};

/**
 * Get banner by ID
 */
const getBannerById = async (bannerId) => {
  if (!mongoose.Types.ObjectId.isValid(bannerId)) {
    throw new ValidationError('Invalid banner ID format');
  }

  const banner = await Banner.findById(bannerId)
    .populate('targetProduct', 'name slug images priceRange averageRating reviewCount')
    .populate('targetCategory', 'name slug icon color description')
    .populate('targetBrand', 'name slug logo countryOfOrigin isPremium')
    .populate('targetCollection', 'name slug description')
    .populate('tenant', 'name slug logo primaryColor city state')
    .populate('createdBy', 'firstName lastName email avatar')
    .populate('updatedBy', 'firstName lastName email avatar')
    .populate('publishedBy', 'firstName lastName email avatar');

  if (!banner) {
    throw new NotFoundError('Banner not found');
  }

  return enrichBannerData(banner.toObject());
};

/**
 * Get banner by slug
 */
const getBannerBySlug = async (slug) => {
  const banner = await Banner.findBySlug(slug);

  if (!banner) {
    throw new NotFoundError('Banner not found');
  }

  return enrichBannerData(banner);
};

/**
 * Update banner
 */
const updateBanner = async (bannerId, updateData, userId) => {
  if (!mongoose.Types.ObjectId.isValid(bannerId)) {
    throw new ValidationError('Invalid banner ID format');
  }

  const banner = await Banner.findById(bannerId);

  if (!banner) {
    throw new NotFoundError('Banner not found');
  }

  // Validate referenced entities
  await validateBannerReferences(updateData);

  // Validate schedule if provided
  if (updateData.isScheduled && updateData.startDate && updateData.endDate) {
    if (new Date(updateData.endDate) <= new Date(updateData.startDate)) {
      throw new ValidationError('End date must be after start date');
    }
  }

  // Update slug if title changed
  if (updateData.title && updateData.title !== banner.title && !updateData.slug) {
    updateData.slug = await generateUniqueSlug(updateData.title, bannerId);
  }

  // Auto-generate ctaLink if linkType changed
  if (updateData.linkType && updateData.linkType !== banner.linkType) {
    updateData.ctaLink = generateCtaLink({ ...banner.toObject(), ...updateData });
  }

  // Update fields
  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined) {
      banner[key] = updateData[key];
    }
  });

  banner.updatedBy = userId;

  await banner.save();

  // Populate references
  await banner.populate([
    { path: 'targetProduct', select: 'name slug images priceRange' },
    { path: 'targetCategory', select: 'name slug icon color' },
    { path: 'targetBrand', select: 'name slug logo' },
    { path: 'targetCollection', select: 'name slug' },
    { path: 'tenant', select: 'name slug logo primaryColor' },
    { path: 'updatedBy', select: 'firstName lastName email avatar' },
  ]);

  return enrichBannerData(banner.toObject());
};

/**
 * Delete banner
 */
const deleteBanner = async (bannerId) => {
  if (!mongoose.Types.ObjectId.isValid(bannerId)) {
    throw new ValidationError('Invalid banner ID format');
  }

  const banner = await Banner.findById(bannerId);

  if (!banner) {
    throw new NotFoundError('Banner not found');
  }

  // Check if banner is currently active
  if (banner.isCurrentlyActive && banner.status === 'active') {
    throw new ValidationError('Cannot delete an active banner. Please deactivate it first.');
  }

  await banner.deleteOne();

  return {
    message: 'Banner deleted successfully',
    banner: {
      _id: banner._id,
      title: banner.title,
      slug: banner.slug,
    },
  };
};

/**
 * Soft delete banner (archive)
 */
const archiveBanner = async (bannerId, userId) => {
  const banner = await Banner.findById(bannerId);

  if (!banner) {
    throw new NotFoundError('Banner not found');
  }

  banner.status = 'archived';
  banner.isActive = false;
  banner.updatedBy = userId;

  await banner.save();

  return {
    message: 'Banner archived successfully',
    banner,
  };
};

/**
 * Get active banners for placement
 */
const getActiveBannersForPlacement = async (placement, options = {}) => {
  const { tenant, visibleTo, device } = options;

  const query = {
    placement,
    isActive: true,
    status: 'active',
  };

  // Tenant filter
  if (tenant) {
    query.$or = [
      { tenant: mongoose.Types.ObjectId(tenant) },
      { isGlobal: true },
    ];
  } else {
    query.isGlobal = true;
  }

  // Visibility filter
  if (visibleTo) {
    query.$or = [
      { visibleTo: 'all' },
      { visibleTo },
    ];
  }

  // Device filter
  if (device) {
    query[`deviceTargeting.${device}`] = true;
  }

  // Schedule filter
  const now = new Date();
  query.$and = [
    {
      $or: [
        { isScheduled: false },
        {
          isScheduled: true,
          $and: [
            {
              $or: [
                { startDate: { $exists: false } },
                { startDate: null },
                { startDate: { $lte: now } },
              ],
            },
            {
              $or: [
                { endDate: { $exists: false } },
                { endDate: null },
                { endDate: { $gte: now } },
              ],
            },
          ],
        },
      ],
    },
  ];

  const banners = await Banner.find(query)
    .populate('targetProduct', 'name slug images priceRange')
    .populate('targetCategory', 'name slug icon color')
    .populate('targetBrand', 'name slug logo')
    .populate('targetCollection', 'name slug')
    .populate('tenant', 'name slug logo')
    .sort({ displayOrder: 1, priority: -1, createdAt: -1 })
    .lean();

  return banners.map(banner => enrichBannerData(banner));
};

/**
 * Get banners by type
 */
const getBannersByType = async (type, options = {}) => {
  const { isActive = true, limit = 10 } = options;

  const query = { type };

  if (isActive !== undefined) {
    query.isActive = isActive;
    query.status = 'active';
  }

  const banners = await Banner.find(query)
    .populate('targetProduct', 'name slug images')
    .populate('targetCategory', 'name slug icon')
    .populate('targetBrand', 'name slug logo')
    .sort({ displayOrder: 1, priority: -1 })
    .limit(limit)
    .lean();

  return banners.map(banner => enrichBannerData(banner));
};

/**
 * Track banner impression
 */
const trackImpression = async (bannerId) => {
  if (!mongoose.Types.ObjectId.isValid(bannerId)) {
    throw new ValidationError('Invalid banner ID format');
  }

  const banner = await Banner.findById(bannerId);

  if (!banner) {
    throw new NotFoundError('Banner not found');
  }

  await banner.incrementImpressions();

  return {
    success: true,
    message: 'Impression tracked successfully',
    data: {
      bannerId: banner._id,
      impressions: banner.impressions,
    },
  };
};

/**
 * Track banner click
 */
const trackClick = async (bannerId) => {
  if (!mongoose.Types.ObjectId.isValid(bannerId)) {
    throw new ValidationError('Invalid banner ID format');
  }

  const banner = await Banner.findById(bannerId);

  if (!banner) {
    throw new NotFoundError('Banner not found');
  }

  await banner.incrementClicks();

  return {
    success: true,
    message: 'Click tracked successfully',
    data: {
      bannerId: banner._id,
      clicks: banner.clicks,
      clickThroughRate: banner.clickThroughRate.toFixed(2) + '%',
    },
  };
};

/**
 * Track banner conversion
 */
const trackConversion = async (bannerId) => {
  if (!mongoose.Types.ObjectId.isValid(bannerId)) {
    throw new ValidationError('Invalid banner ID format');
  }

  const banner = await Banner.findById(bannerId);

  if (!banner) {
    throw new NotFoundError('Banner not found');
  }

  await banner.incrementConversions();

  return {
    success: true,
    message: 'Conversion tracked successfully',
    data: {
      bannerId: banner._id,
      conversionCount: banner.conversionCount,
      conversionRate: banner.conversionRate.toFixed(2) + '%',
    },
  };
};

/**
 * Batch track impressions
 */
const batchTrackImpressions = async (bannerIds) => {
  const validIds = bannerIds.filter(id => mongoose.Types.ObjectId.isValid(id));

  if (validIds.length === 0) {
    throw new ValidationError('No valid banner IDs provided');
  }

  const result = await Banner.updateMany(
    { _id: { $in: validIds } },
    { $inc: { impressions: 1 } }
  );

  return {
    success: true,
    message: 'Impressions tracked successfully',
    data: {
      updated: result.modifiedCount,
    },
  };
};

/**
 * Update banner status
 */
const updateBannerStatus = async (bannerId, status, userId) => {
  if (!mongoose.Types.ObjectId.isValid(bannerId)) {
    throw new ValidationError('Invalid banner ID format');
  }

  const validStatuses = ['draft', 'scheduled', 'active', 'paused', 'expired', 'archived'];
  
  if (!validStatuses.includes(status)) {
    throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const banner = await Banner.findById(bannerId);

  if (!banner) {
    throw new NotFoundError('Banner not found');
  }

  const previousStatus = banner.status;
  banner.status = status;
  banner.updatedBy = userId;

  // Update isActive based on status
  if (status === 'active') {
    banner.isActive = true;
    if (!banner.publishedAt) {
      banner.publishedAt = new Date();
      banner.publishedBy = userId;
    }
  } else if (['paused', 'expired', 'archived'].includes(status)) {
    banner.isActive = false;
  }

  await banner.save();

  return {
    message: `Banner status updated from ${previousStatus} to ${status}`,
    banner: enrichBannerData(banner.toObject()),
  };
};

/**
 * Bulk update banner status
 */
const bulkUpdateBannerStatus = async (bannerIds, status, userId) => {
  const validIds = bannerIds.filter(id => mongoose.Types.ObjectId.isValid(id));

  if (validIds.length === 0) {
    throw new ValidationError('No valid banner IDs provided');
  }

  const updateData = {
    status,
    updatedBy: userId,
  };

  if (status === 'active') {
    updateData.isActive = true;
  } else if (['paused', 'expired', 'archived'].includes(status)) {
    updateData.isActive = false;
  }

  const result = await Banner.updateMany(
    { _id: { $in: validIds } },
    updateData
  );

  return {
    message: `Updated ${result.modifiedCount} banners to ${status}`,
    updated: result.modifiedCount,
  };
};

/**
 * Update banner display order
 */
const updateBannerOrder = async (orderUpdates, userId) => {
  if (!Array.isArray(orderUpdates) || orderUpdates.length === 0) {
    throw new ValidationError('Order updates must be a non-empty array');
  }

  const updates = orderUpdates.map(({ bannerId, displayOrder }) => {
    if (!mongoose.Types.ObjectId.isValid(bannerId)) {
      throw new ValidationError(`Invalid banner ID: ${bannerId}`);
    }

    return Banner.findByIdAndUpdate(
      bannerId,
      {
        displayOrder,
        updatedBy: userId,
      },
      { new: true }
    );
  });

  await Promise.all(updates);

  return {
    success: true,
    message: 'Banner order updated successfully',
    updated: orderUpdates.length,
  };
};

/**
 * Get banner analytics
 */
const getBannerAnalytics = async (bannerId, options = {}) => {
  if (!mongoose.Types.ObjectId.isValid(bannerId)) {
    throw new ValidationError('Invalid banner ID format');
  }

  const banner = await Banner.findById(bannerId);

  if (!banner) {
    throw new NotFoundError('Banner not found');
  }

  const analytics = {
    bannerId: banner._id,
    title: banner.title,
    slug: banner.slug,
    type: banner.type,
    placement: banner.placement,
    status: banner.status,
    isActive: banner.isActive,
    
    // Performance metrics
    impressions: banner.impressions,
    clicks: banner.clicks,
    clickThroughRate: parseFloat(banner.clickThroughRate.toFixed(2)),
    conversionCount: banner.conversionCount,
    conversionRate: parseFloat(banner.conversionRate.toFixed(2)),
    
    // Engagement score (0-100)
    engagementScore: calculateEngagementScore(banner),
    
    // Time metrics
    daysUntilExpiration: banner.daysUntilExpiration,
    isCurrentlyActive: banner.isCurrentlyActive,
    publishedAt: banner.publishedAt,
    createdAt: banner.createdAt,
    
    // Schedule
    schedule: {
      isScheduled: banner.isScheduled,
      startDate: banner.startDate,
      endDate: banner.endDate,
    },
    
    // Performance rating
    performanceRating: calculatePerformanceRating(banner),
  };

  return analytics;
};

/**
 * Get aggregate analytics for all banners
 */
const getAggregateAnalytics = async (filters = {}) => {
  const query = buildAnalyticsQuery(filters);

  const analytics = await Banner.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalBanners: { $sum: 1 },
        activeBanners: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
        },
        totalImpressions: { $sum: '$impressions' },
        totalClicks: { $sum: '$clicks' },
        totalConversions: { $sum: '$conversionCount' },
        avgClickThroughRate: { $avg: '$clickThroughRate' },
        avgConversionRate: { $avg: '$conversionRate' },
      },
    },
    {
      $project: {
        _id: 0,
        totalBanners: 1,
        activeBanners: 1,
        totalImpressions: 1,
        totalClicks: 1,
        totalConversions: 1,
        avgClickThroughRate: { $round: ['$avgClickThroughRate', 2] },
        avgConversionRate: { $round: ['$avgConversionRate', 2] },
        overallCTR: {
          $cond: [
            { $gt: ['$totalImpressions', 0] },
            {
              $round: [
                { $multiply: [{ $divide: ['$totalClicks', '$totalImpressions'] }, 100] },
                2,
              ],
            },
            0,
          ],
        },
        overallConversionRate: {
          $cond: [
            { $gt: ['$totalClicks', 0] },
            {
              $round: [
                { $multiply: [{ $divide: ['$totalConversions', '$totalClicks'] }, 100] },
                2,
              ],
            },
            0,
          ],
        },
      },
    },
  ]);

  // Get breakdown by placement
  const placementBreakdown = await Banner.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$placement',
        count: { $sum: 1 },
        impressions: { $sum: '$impressions' },
        clicks: { $sum: '$clicks' },
        avgCTR: { $avg: '$clickThroughRate' },
      },
    },
    {
      $project: {
        _id: 0,
        placement: '$_id',
        count: 1,
        impressions: 1,
        clicks: 1,
        avgCTR: { $round: ['$avgCTR', 2] },
      },
    },
    { $sort: { impressions: -1 } },
  ]);

  // Get breakdown by type
  const typeBreakdown = await Banner.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        impressions: { $sum: '$impressions' },
        clicks: { $sum: '$clicks' },
      },
    },
    {
      $project: {
        _id: 0,
        type: '$_id',
        count: 1,
        impressions: 1,
        clicks: 1,
      },
    },
    { $sort: { impressions: -1 } },
  ]);

  // Get top performing banners
  const topPerformers = await Banner.find(query)
    .select('title slug impressions clicks clickThroughRate conversionRate')
    .sort({ clicks: -1 })
    .limit(10)
    .lean();

  return {
    summary: analytics[0] || {
      totalBanners: 0,
      activeBanners: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      avgClickThroughRate: 0,
      avgConversionRate: 0,
      overallCTR: 0,
      overallConversionRate: 0,
    },
    breakdown: {
      byPlacement: placementBreakdown,
      byType: typeBreakdown,
    },
    topPerformers,
  };
};

/**
 * Clone/duplicate banner
 */
const cloneBanner = async (bannerId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(bannerId)) {
    throw new ValidationError('Invalid banner ID format');
  }

  const originalBanner = await Banner.findById(bannerId);

  if (!originalBanner) {
    throw new NotFoundError('Banner not found');
  }

  const bannerData = originalBanner.toObject();
  
  // Remove unique fields
  delete bannerData._id;
  delete bannerData.__v;
  delete bannerData.slug;
  delete bannerData.createdAt;
  delete bannerData.updatedAt;
  delete bannerData.publishedAt;
  delete bannerData.publishedBy;

  // Update metadata
  bannerData.title = `${bannerData.title} (Copy)`;
  bannerData.status = 'draft';
  bannerData.isActive = false;
  
  // Reset analytics
  bannerData.impressions = 0;
  bannerData.clicks = 0;
  bannerData.clickThroughRate = 0;
  bannerData.conversionCount = 0;
  bannerData.conversionRate = 0;
  
  // Set creator
  bannerData.createdBy = userId;
  bannerData.updatedBy = userId;

  const newBanner = await createBanner(bannerData, userId);

  return newBanner;
};

/**
 * Update scheduled banners status
 */
const updateScheduledBannersStatus = async () => {
  const now = new Date();

  // Find scheduled banners that should be activated
  const toActivate = await Banner.find({
    status: 'scheduled',
    isScheduled: true,
    startDate: { $lte: now },
    $or: [
      { endDate: { $exists: false } },
      { endDate: null },
      { endDate: { $gte: now } },
    ],
  });

  // Find active banners that should be expired
  const toExpire = await Banner.find({
    status: 'active',
    isScheduled: true,
    endDate: { $lt: now },
  });

  // Activate scheduled banners
  const activated = await Promise.all(
    toActivate.map(banner => {
      banner.status = 'active';
      banner.isActive = true;
      if (!banner.publishedAt) {
        banner.publishedAt = now;
      }
      return banner.save();
    })
  );

  // Expire past banners
  const expired = await Promise.all(
    toExpire.map(banner => {
      banner.status = 'expired';
      banner.isActive = false;
      return banner.save();
    })
  );

  return {
    activated: activated.length,
    expired: expired.length,
    message: `Updated ${activated.length} banners to active and ${expired.length} banners to expired`,
  };
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Validate banner references (product, category, brand, collection, tenant)
 */
async function validateBannerReferences(bannerData) {
  // Validate target product
  if (bannerData.targetProduct) {
    const product = await Product.findById(bannerData.targetProduct);
    if (!product) {
      throw new ValidationError('Target product not found');
    }
  }

  // Validate target category
  if (bannerData.targetCategory) {
    const category = await Category.findById(bannerData.targetCategory);
    if (!category) {
      throw new ValidationError('Target category not found');
    }
  }

  // Validate target brand
  if (bannerData.targetBrand) {
    const brand = await Brand.findById(bannerData.targetBrand);
    if (!brand) {
      throw new ValidationError('Target brand not found');
    }
  }

  // Validate tenant
  if (bannerData.tenant) {
    const tenant = await Tenant.findById(bannerData.tenant);
    if (!tenant) {
      throw new ValidationError('Tenant not found');
    }
  }
}

/**
 * Generate CTA link based on link type and target
 */
function generateCtaLink(bannerData) {
  const { linkType, targetProduct, targetCategory, targetBrand, targetCollection, ctaLink } = bannerData;

  // If manual link provided, use it
  if (ctaLink) {
    return ctaLink;
  }

  switch (linkType) {
    case 'product':
      return targetProduct ? `/products/${targetProduct.slug || targetProduct}` : '/products';
    case 'category':
      return targetCategory ? `/categories/${targetCategory.slug || targetCategory}` : '/categories';
    case 'brand':
      return targetBrand ? `/brands/${targetBrand.slug || targetBrand}` : '/brands';
    case 'collection':
      return targetCollection ? `/collections/${targetCollection.slug || targetCollection}` : '/collections';
    case 'internal':
    case 'page':
      return ctaLink || '/';
    case 'external':
      return ctaLink || '#';
    default:
      return '#';
  }
}

/**
 * Generate slug from title
 */
function generateSlugFromTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate unique slug
 */
async function generateUniqueSlug(title, bannerId = null) {
  const baseSlug = generateSlugFromTitle(title);
  let slug = baseSlug;
  let counter = 1;

  const query = { slug };
  if (bannerId) {
    query._id = { $ne: bannerId };
  }

  while (await Banner.findOne(query)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Enrich banner data with computed fields
 */
function enrichBannerData(banner) {
  const now = new Date();

  return {
    ...banner,
    
    // Status indicators
    isCurrentlyActive: banner.isActive && banner.status === 'active' && 
      (!banner.isScheduled || 
        (!banner.startDate || now >= new Date(banner.startDate)) &&
        (!banner.endDate || now <= new Date(banner.endDate))),
    
    // Time remaining
    daysUntilExpiration: banner.endDate 
      ? Math.max(0, Math.ceil((new Date(banner.endDate) - now) / (1000 * 60 * 60 * 24)))
      : null,
    
    daysUntilStart: banner.startDate && now < new Date(banner.startDate)
      ? Math.ceil((new Date(banner.startDate) - now) / (1000 * 60 * 60 * 24))
      : null,
    
    // Performance metrics
    clickThroughRate: parseFloat((banner.clickThroughRate || 0).toFixed(2)),
    conversionRate: parseFloat((banner.conversionRate || 0).toFixed(2)),
    
    // Engagement score
    engagementScore: calculateEngagementScore(banner),
    
    // Performance rating
    performanceRating: calculatePerformanceRating(banner),
  };
}

/**
 * Calculate engagement score (0-100)
 */
function calculateEngagementScore(banner) {
  const { impressions, clicks, conversionCount } = banner;
  
  if (impressions === 0) return 0;
  
  const ctrScore = Math.min((clicks / impressions) * 500, 50); // Max 50 points
  const conversionScore = clicks > 0 ? Math.min((conversionCount / clicks) * 1000, 50) : 0; // Max 50 points
  
  return Math.round(ctrScore + conversionScore);
}

/**
 * Calculate performance rating
 */
function calculatePerformanceRating(banner) {
  const score = calculateEngagementScore(banner);
  
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'average';
  if (score >= 20) return 'poor';
  return 'very_poor';
}

/**
 * Build analytics query
 */
function buildAnalyticsQuery(filters) {
  const query = {};
  
  if (filters.status) {
    query.status = filters.status;
  }
  
  if (filters.type) {
    query.type = filters.type;
  }
  
  if (filters.placement) {
    query.placement = filters.placement;
  }
  
  if (filters.tenant) {
    query.tenant = mongoose.Types.ObjectId(filters.tenant);
  }
  
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) {
      query.createdAt.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query.createdAt.$lte = new Date(filters.endDate);
    }
  }
  
  return query;
}

/**
 * Get banner statistics
 */
async function getBannerStatistics(query) {
  const stats = await Banner.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
        scheduled: { $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] } },
        paused: { $sum: { $cond: [{ $eq: ['$status', 'paused'] }, 1, 0] } },
        expired: { $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] } },
        archived: { $sum: { $cond: [{ $eq: ['$status', 'archived'] }, 1, 0] } },
        totalImpressions: { $sum: '$impressions' },
        totalClicks: { $sum: '$clicks' },
        totalConversions: { $sum: '$conversionCount' },
      },
    },
  ]);

  return stats[0] || {
    total: 0,
    active: 0,
    draft: 0,
    scheduled: 0,
    paused: 0,
    expired: 0,
    archived: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalConversions: 0,
  };
}

module.exports = {
  createBanner,
  getAllBanners,
  getBannerById,
  getBannerBySlug,
  updateBanner,
  deleteBanner,
  archiveBanner,
  getActiveBannersForPlacement,
  getBannersByType,
  trackImpression,
  trackClick,
  trackConversion,
  batchTrackImpressions,
  updateBannerStatus,
  bulkUpdateBannerStatus,
  updateBannerOrder,
  getBannerAnalytics,
  getAggregateAnalytics,
  cloneBanner,
  updateScheduledBannersStatus,
};