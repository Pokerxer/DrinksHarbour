// services/promotion.service.js

const mongoose = require('mongoose');
const Promotion = require('../models/Promotion');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const { NotFoundError, ValidationError } = require('../utils/errors');

const { ObjectId } = mongoose.Types;

// ════════════════════════════════════════════════════════════════════════════
// CREATE PROMOTION
// ════════════════════════════════════════════════════════════════════════════
const createPromotion = async (data, userId, tenantId) => {
  const {
    name,
    description,
    code,
    type = 'percentage_discount',
    discountValue,
    discountType = 'percentage',
    maxDiscountAmount,
    minPurchaseAmount,
    minQuantity,
    // Buy X Get Y
    buyQuantity,
    getQuantity,
    getDiscountPercentage,
    // Bundle
    bundleItems,
    bundlePrice,
    // Targeting
    applyTo = 'all',
    subProducts,
    sizes,
    sizeNames,
    categories,
    brands,
    excludedSubProducts,
    excludedSizes,
    // Scheduling
    startDate,
    endDate,
    isScheduled,
    recurringSchedule,
    // Usage limits
    usageLimit,
    usageLimitPerCustomer,
    remainingQuantity,
    // Customer targeting
    customerEligibility,
    loyaltyTiers,
    specificCustomers,
    // Stacking
    stackable,
    stackableWith,
    excludeFromStacking,
    priority,
    // Display
    displayBanner,
    badge,
    showCountdown,
    showRemainingStock,
    highlightOnProductPage,
    // Status
    status = 'draft',
    isActive = false,
    autoActivate,
    autoDeactivate,
    // Metadata
    notes,
    tags,
  } = data;

  if (!name) {
    throw new ValidationError('Promotion name is required');
  }

  if (!type) {
    throw new ValidationError('Promotion type is required');
  }

  // Validate discount value for discount types
  if (['percentage_discount', 'fixed_discount'].includes(type) && !discountValue) {
    throw new ValidationError('Discount value is required for discount promotions');
  }

  // Validate bundle items for bundle type
  if (type === 'bundle' && (!bundleItems || bundleItems.length === 0)) {
    throw new ValidationError('Bundle items are required for bundle promotions');
  }

  // Check for duplicate code if provided
  if (code) {
    const existingCode = await Promotion.findOne({
      tenant: tenantId,
      code: code.toUpperCase(),
    });
    if (existingCode) {
      throw new ValidationError(`Promotion code "${code}" already exists`);
    }
  }

  // Validate subProducts if targeting specific products
  if (applyTo === 'specific_products' && subProducts?.length > 0) {
    const validSubProducts = await SubProduct.find({
      _id: { $in: subProducts },
      tenant: tenantId,
    }).select('_id');

    if (validSubProducts.length !== subProducts.length) {
      throw new ValidationError('One or more SubProducts not found or do not belong to this tenant');
    }
  }

  // Validate sizes if provided
  if (sizes?.length > 0) {
    const validSizes = await Size.find({
      _id: { $in: sizes },
    }).select('_id');

    if (validSizes.length !== sizes.length) {
      throw new ValidationError('One or more Sizes not found');
    }
  }

  const promotion = await Promotion.create({
    tenant: tenantId,
    name,
    description,
    code: code ? code.toUpperCase() : undefined,
    type,
    discountValue,
    discountType,
    maxDiscountAmount,
    minPurchaseAmount,
    minQuantity,
    buyQuantity,
    getQuantity,
    getDiscountPercentage,
    bundleItems,
    bundlePrice,
    applyTo,
    subProducts,
    sizes,
    sizeNames,
    categories,
    brands,
    excludedSubProducts,
    excludedSizes,
    startDate: startDate || new Date(),
    endDate,
    isScheduled,
    recurringSchedule,
    usageLimit,
    usageLimitPerCustomer,
    remainingQuantity,
    customerEligibility,
    loyaltyTiers,
    specificCustomers,
    stackable,
    stackableWith,
    excludeFromStacking,
    priority,
    displayBanner,
    badge,
    showCountdown,
    showRemainingStock,
    highlightOnProductPage,
    status,
    isActive,
    autoActivate,
    autoDeactivate,
    notes,
    tags,
    createdBy: userId,
  });

  console.log(`✅ Promotion created: ${name} (${type})`);
  return promotion;
};

// ════════════════════════════════════════════════════════════════════════════
// GET ALL PROMOTIONS
// ════════════════════════════════════════════════════════════════════════════
const getPromotions = async (tenantId, options = {}) => {
  const {
    type,
    status,
    isActive,
    applyTo,
    search,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const query = { tenant: tenantId };

  if (type) query.type = type;
  if (status) query.status = status;
  if (isActive !== undefined) query.isActive = isActive;
  if (applyTo) query.applyTo = applyTo;

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [promotions, total] = await Promise.all([
    Promotion.find(query)
      .populate('subProducts', 'sku product')
      .populate('sizes', 'size volume')
      .populate('categories', 'name slug')
      .populate('brands', 'name slug')
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Promotion.countDocuments(query),
  ]);

  return {
    promotions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// ════════════════════════════════════════════════════════════════════════════
// GET PROMOTION BY ID
// ════════════════════════════════════════════════════════════════════════════
const getPromotionById = async (promotionId, tenantId) => {
  const promotion = await Promotion.findOne({
    _id: promotionId,
    tenant: tenantId,
  })
    .populate({
      path: 'subProducts',
      select: 'sku sellingPrice costPrice totalStock product',
      populate: {
        path: 'product',
        select: 'name slug images',
      },
    })
    .populate('sizes', 'size volume sellingPrice sku')
    .populate('categories', 'name slug')
    .populate('brands', 'name slug logo')
    .populate('bundleItems.subProduct', 'sku product')
    .populate('bundleItems.size', 'size volume')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .lean();

  if (!promotion) {
    throw new NotFoundError('Promotion not found');
  }

  return promotion;
};

// ════════════════════════════════════════════════════════════════════════════
// GET PROMOTION BY CODE
// ════════════════════════════════════════════════════════════════════════════
const getPromotionByCode = async (code, tenantId) => {
  const promotion = await Promotion.findByCode(tenantId, code);

  if (!promotion) {
    throw new NotFoundError('Promotion code not found or not active');
  }

  return promotion;
};

// ════════════════════════════════════════════════════════════════════════════
// UPDATE PROMOTION
// ════════════════════════════════════════════════════════════════════════════
const updatePromotion = async (promotionId, data, tenantId, userId) => {
  const promotion = await Promotion.findOne({
    _id: promotionId,
    tenant: tenantId,
  });

  if (!promotion) {
    throw new NotFoundError('Promotion not found');
  }

  // Validate code uniqueness if changing
  if (data.code && data.code.toUpperCase() !== promotion.code) {
    const existingCode = await Promotion.findOne({
      tenant: tenantId,
      code: data.code.toUpperCase(),
      _id: { $ne: promotionId },
    });
    if (existingCode) {
      throw new ValidationError(`Promotion code "${data.code}" already exists`);
    }
  }

  const allowedFields = [
    'name',
    'description',
    'code',
    'type',
    'discountValue',
    'discountType',
    'maxDiscountAmount',
    'minPurchaseAmount',
    'minQuantity',
    'buyQuantity',
    'getQuantity',
    'getDiscountPercentage',
    'bundleItems',
    'bundlePrice',
    'applyTo',
    'subProducts',
    'sizes',
    'sizeNames',
    'categories',
    'brands',
    'excludedSubProducts',
    'excludedSizes',
    'startDate',
    'endDate',
    'isScheduled',
    'recurringSchedule',
    'usageLimit',
    'usageLimitPerCustomer',
    'remainingQuantity',
    'customerEligibility',
    'loyaltyTiers',
    'specificCustomers',
    'stackable',
    'stackableWith',
    'excludeFromStacking',
    'priority',
    'displayBanner',
    'badge',
    'showCountdown',
    'showRemainingStock',
    'highlightOnProductPage',
    'status',
    'isActive',
    'autoActivate',
    'autoDeactivate',
    'notes',
    'tags',
  ];

  allowedFields.forEach((field) => {
    if (data[field] !== undefined) {
      if (field === 'code') {
        promotion[field] = data[field] ? data[field].toUpperCase() : undefined;
      } else {
        promotion[field] = data[field];
      }
    }
  });

  promotion.updatedBy = userId;
  await promotion.save();

  console.log(`✅ Promotion updated: ${promotion.name}`);
  return promotion;
};

// ════════════════════════════════════════════════════════════════════════════
// DELETE PROMOTION
// ════════════════════════════════════════════════════════════════════════════
const deletePromotion = async (promotionId, tenantId) => {
  const promotion = await Promotion.findOne({
    _id: promotionId,
    tenant: tenantId,
  });

  if (!promotion) {
    throw new NotFoundError('Promotion not found');
  }

  await Promotion.findByIdAndDelete(promotionId);

  console.log(`✅ Promotion deleted: ${promotion.name}`);
  return { success: true, message: 'Promotion deleted successfully' };
};

// ════════════════════════════════════════════════════════════════════════════
// ACTIVATE PROMOTION
// ════════════════════════════════════════════════════════════════════════════
const activatePromotion = async (promotionId, tenantId, userId) => {
  const promotion = await Promotion.findOne({
    _id: promotionId,
    tenant: tenantId,
  });

  if (!promotion) {
    throw new NotFoundError('Promotion not found');
  }

  promotion.isActive = true;
  promotion.status = 'active';
  promotion.updatedBy = userId;
  await promotion.save();

  console.log(`✅ Promotion activated: ${promotion.name}`);
  return promotion;
};

// ════════════════════════════════════════════════════════════════════════════
// DEACTIVATE PROMOTION
// ════════════════════════════════════════════════════════════════════════════
const deactivatePromotion = async (promotionId, tenantId, userId) => {
  const promotion = await Promotion.findOne({
    _id: promotionId,
    tenant: tenantId,
  });

  if (!promotion) {
    throw new NotFoundError('Promotion not found');
  }

  promotion.isActive = false;
  promotion.status = 'paused';
  promotion.updatedBy = userId;
  await promotion.save();

  console.log(`✅ Promotion deactivated: ${promotion.name}`);
  return promotion;
};

// ════════════════════════════════════════════════════════════════════════════
// GET ACTIVE PROMOTIONS FOR SUBPRODUCT
// ════════════════════════════════════════════════════════════════════════════
const getActivePromotionsForSubProduct = async (subProductId, tenantId, sizeId = null) => {
  const now = new Date();

  // Find all active promotions that could apply
  const promotions = await Promotion.find({
    tenant: tenantId,
    status: 'active',
    isActive: true,
    startDate: { $lte: now },
    $or: [
      { endDate: null },
      { endDate: { $gt: now } },
    ],
    $and: [
      {
        $or: [
          { applyTo: 'all' },
          { subProducts: subProductId },
        ],
      },
      {
        $or: [
          { excludedSubProducts: { $size: 0 } },
          { excludedSubProducts: { $exists: false } },
          { excludedSubProducts: { $ne: subProductId } },
        ],
      },
    ],
  })
    .sort({ priority: -1 })
    .lean();

  // Filter by size if provided
  if (sizeId) {
    return promotions.filter((promo) => {
      // If no specific sizes defined, promotion applies to all sizes
      if (!promo.sizes || promo.sizes.length === 0) return true;
      // Check if size is in the promotion's size list
      return promo.sizes.some((s) => s.toString() === sizeId.toString());
    });
  }

  return promotions;
};

// ════════════════════════════════════════════════════════════════════════════
// APPLY PROMOTION TO SUBPRODUCTS
// ════════════════════════════════════════════════════════════════════════════
const applyPromotionToSubProducts = async (promotionId, subProductIds, tenantId, userId) => {
  const promotion = await Promotion.findOne({
    _id: promotionId,
    tenant: tenantId,
  });

  if (!promotion) {
    throw new NotFoundError('Promotion not found');
  }

  // Validate all subProducts belong to tenant
  const validSubProducts = await SubProduct.find({
    _id: { $in: subProductIds },
    tenant: tenantId,
  }).select('_id');

  if (validSubProducts.length !== subProductIds.length) {
    throw new ValidationError('One or more SubProducts not found or do not belong to this tenant');
  }

  // Add subProducts to promotion
  const existingIds = promotion.subProducts.map((id) => id.toString());
  const newIds = subProductIds.filter((id) => !existingIds.includes(id.toString()));

  promotion.subProducts = [...promotion.subProducts, ...newIds.map((id) => new ObjectId(id))];
  promotion.applyTo = 'specific_products';
  promotion.updatedBy = userId;
  await promotion.save();

  console.log(`✅ Promotion applied to ${newIds.length} new SubProducts`);
  return promotion;
};

// ════════════════════════════════════════════════════════════════════════════
// REMOVE SUBPRODUCTS FROM PROMOTION
// ════════════════════════════════════════════════════════════════════════════
const removeSubProductsFromPromotion = async (promotionId, subProductIds, tenantId, userId) => {
  const promotion = await Promotion.findOne({
    _id: promotionId,
    tenant: tenantId,
  });

  if (!promotion) {
    throw new NotFoundError('Promotion not found');
  }

  promotion.subProducts = promotion.subProducts.filter(
    (id) => !subProductIds.includes(id.toString())
  );
  promotion.updatedBy = userId;
  await promotion.save();

  console.log(`✅ Removed ${subProductIds.length} SubProducts from promotion`);
  return promotion;
};

// ════════════════════════════════════════════════════════════════════════════
// APPLY PROMOTION TO SIZES
// ════════════════════════════════════════════════════════════════════════════
const applyPromotionToSizes = async (promotionId, sizeIds, tenantId, userId) => {
  const promotion = await Promotion.findOne({
    _id: promotionId,
    tenant: tenantId,
  });

  if (!promotion) {
    throw new NotFoundError('Promotion not found');
  }

  // Validate sizes exist
  const validSizes = await Size.find({
    _id: { $in: sizeIds },
  }).select('_id size');

  if (validSizes.length !== sizeIds.length) {
    throw new ValidationError('One or more Sizes not found');
  }

  // Add sizes to promotion
  const existingIds = promotion.sizes.map((id) => id.toString());
  const newIds = sizeIds.filter((id) => !existingIds.includes(id.toString()));

  promotion.sizes = [...promotion.sizes, ...newIds.map((id) => new ObjectId(id))];

  // Also add size names for easier matching
  const sizeNames = validSizes.map((s) => s.size);
  const existingSizeNames = promotion.sizeNames || [];
  promotion.sizeNames = [...new Set([...existingSizeNames, ...sizeNames])];

  promotion.updatedBy = userId;
  await promotion.save();

  console.log(`✅ Promotion applied to ${newIds.length} new Sizes`);
  return promotion;
};

// ════════════════════════════════════════════════════════════════════════════
// CALCULATE DISCOUNT FOR CART ITEM
// ════════════════════════════════════════════════════════════════════════════
const calculateDiscountForItem = async (
  tenantId,
  subProductId,
  sizeId,
  originalPrice,
  quantity,
  customerId = null
) => {
  const promotions = await getActivePromotionsForSubProduct(subProductId, tenantId, sizeId);

  if (promotions.length === 0) {
    return {
      originalPrice,
      finalPrice: originalPrice,
      discount: 0,
      appliedPromotions: [],
    };
  }

  let totalDiscount = 0;
  const appliedPromotions = [];

  // Get the best non-stackable promotion
  const nonStackablePromotions = promotions.filter((p) => !p.stackable);
  const stackablePromotions = promotions.filter((p) => p.stackable);

  // Apply best non-stackable promotion first
  if (nonStackablePromotions.length > 0) {
    const bestPromo = nonStackablePromotions[0]; // Already sorted by priority
    const promoDiscount = calculatePromotionDiscount(bestPromo, originalPrice, quantity);
    if (promoDiscount > 0) {
      totalDiscount = promoDiscount;
      appliedPromotions.push({
        promotionId: bestPromo._id,
        name: bestPromo.name,
        type: bestPromo.type,
        discount: promoDiscount,
      });
    }
  }

  // Apply stackable promotions
  let remainingPrice = originalPrice - totalDiscount;
  for (const promo of stackablePromotions) {
    const promoDiscount = calculatePromotionDiscount(promo, remainingPrice, quantity);
    if (promoDiscount > 0) {
      totalDiscount += promoDiscount;
      remainingPrice -= promoDiscount;
      appliedPromotions.push({
        promotionId: promo._id,
        name: promo.name,
        type: promo.type,
        discount: promoDiscount,
      });
    }
  }

  return {
    originalPrice,
    finalPrice: Math.max(0, originalPrice - totalDiscount),
    discount: totalDiscount,
    appliedPromotions,
  };
};

// Helper function to calculate discount for a promotion
const calculatePromotionDiscount = (promotion, price, quantity) => {
  let discount = 0;

  switch (promotion.type) {
    case 'percentage_discount':
    case 'flash_sale':
    case 'seasonal':
    case 'clearance':
    case 'first_purchase':
    case 'loyalty':
      discount = price * (promotion.discountValue / 100);
      break;

    case 'fixed_discount':
      discount = promotion.discountValue;
      break;

    case 'buy_x_get_y':
      const buyQty = promotion.buyQuantity || 1;
      const getQty = promotion.getQuantity || 1;
      const getDiscount = promotion.getDiscountPercentage || 100;
      const freeItems = Math.floor(quantity / buyQty) * getQty;
      const pricePerItem = price / quantity;
      discount = pricePerItem * freeItems * (getDiscount / 100);
      break;

    default:
      if (promotion.discountValue) {
        if (promotion.discountType === 'percentage') {
          discount = price * (promotion.discountValue / 100);
        } else {
          discount = promotion.discountValue;
        }
      }
  }

  // Apply max discount cap
  if (promotion.maxDiscountAmount && discount > promotion.maxDiscountAmount) {
    discount = promotion.maxDiscountAmount;
  }

  return Math.min(discount, price);
};

// ════════════════════════════════════════════════════════════════════════════
// INCREMENT USAGE COUNT
// ════════════════════════════════════════════════════════════════════════════
const incrementUsage = async (promotionId, tenantId, amount = 1) => {
  const promotion = await Promotion.findOne({
    _id: promotionId,
    tenant: tenantId,
  });

  if (!promotion) {
    throw new NotFoundError('Promotion not found');
  }

  promotion.currentUsageCount += amount;

  if (promotion.remainingQuantity !== undefined) {
    promotion.remainingQuantity = Math.max(0, promotion.remainingQuantity - amount);
  }

  // Check if usage limit reached
  if (promotion.usageLimit && promotion.currentUsageCount >= promotion.usageLimit) {
    promotion.status = 'expired';
    promotion.isActive = false;
  }

  await promotion.save();
  return promotion;
};

// ════════════════════════════════════════════════════════════════════════════
// UPDATE ANALYTICS
// ════════════════════════════════════════════════════════════════════════════
const updateAnalytics = async (promotionId, tenantId, analytics) => {
  const promotion = await Promotion.findOne({
    _id: promotionId,
    tenant: tenantId,
  });

  if (!promotion) {
    throw new NotFoundError('Promotion not found');
  }

  const { views, clicks, conversions, revenue, totalDiscount } = analytics;

  if (views) promotion.analytics.views += views;
  if (clicks) promotion.analytics.clicks += clicks;
  if (conversions) {
    promotion.analytics.conversions += conversions;
    // Recalculate average order value
    if (revenue) {
      const totalRevenue = promotion.analytics.revenue + revenue;
      const totalConversions = promotion.analytics.conversions;
      promotion.analytics.averageOrderValue = totalRevenue / totalConversions;
    }
  }
  if (revenue) promotion.analytics.revenue += revenue;
  if (totalDiscount) promotion.analytics.totalDiscount += totalDiscount;

  await promotion.save();
  return promotion;
};

// ════════════════════════════════════════════════════════════════════════════
// GET PROMOTION STATS
// ════════════════════════════════════════════════════════════════════════════
const getPromotionStats = async (tenantId) => {
  const now = new Date();

  const [
    totalPromotions,
    activePromotions,
    scheduledPromotions,
    expiredPromotions,
    topPerformers,
  ] = await Promise.all([
    Promotion.countDocuments({ tenant: tenantId }),
    Promotion.countDocuments({
      tenant: tenantId,
      status: 'active',
      isActive: true,
    }),
    Promotion.countDocuments({
      tenant: tenantId,
      status: 'scheduled',
      startDate: { $gt: now },
    }),
    Promotion.countDocuments({
      tenant: tenantId,
      status: 'expired',
    }),
    Promotion.find({ tenant: tenantId, 'analytics.conversions': { $gt: 0 } })
      .sort({ 'analytics.conversions': -1 })
      .limit(5)
      .select('name type analytics')
      .lean(),
  ]);

  // Calculate total revenue and discount from all promotions
  const aggregatedStats = await Promotion.aggregate([
    { $match: { tenant: new ObjectId(tenantId) } },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$analytics.revenue' },
        totalDiscount: { $sum: '$analytics.totalDiscount' },
        totalConversions: { $sum: '$analytics.conversions' },
        totalViews: { $sum: '$analytics.views' },
      },
    },
  ]);

  const stats = aggregatedStats[0] || {
    totalRevenue: 0,
    totalDiscount: 0,
    totalConversions: 0,
    totalViews: 0,
  };

  return {
    counts: {
      total: totalPromotions,
      active: activePromotions,
      scheduled: scheduledPromotions,
      expired: expiredPromotions,
    },
    performance: {
      totalRevenue: stats.totalRevenue,
      totalDiscount: stats.totalDiscount,
      totalConversions: stats.totalConversions,
      totalViews: stats.totalViews,
      conversionRate: stats.totalViews > 0
        ? ((stats.totalConversions / stats.totalViews) * 100).toFixed(2)
        : 0,
    },
    topPerformers,
  };
};

// ════════════════════════════════════════════════════════════════════════════
// DUPLICATE PROMOTION
// ════════════════════════════════════════════════════════════════════════════
const duplicatePromotion = async (promotionId, tenantId, userId) => {
  const original = await Promotion.findOne({
    _id: promotionId,
    tenant: tenantId,
  }).lean();

  if (!original) {
    throw new NotFoundError('Promotion not found');
  }

  // Remove fields that shouldn't be duplicated
  const { _id, createdAt, updatedAt, currentUsageCount, analytics, code, slug, ...duplicateData } = original;

  const duplicate = await Promotion.create({
    ...duplicateData,
    name: `${original.name} (Copy)`,
    status: 'draft',
    isActive: false,
    currentUsageCount: 0,
    analytics: {
      views: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0,
      averageOrderValue: 0,
      totalDiscount: 0,
    },
    createdBy: userId,
  });

  console.log(`✅ Promotion duplicated: ${duplicate.name}`);
  return duplicate;
};

module.exports = {
  createPromotion,
  getPromotions,
  getPromotionById,
  getPromotionByCode,
  updatePromotion,
  deletePromotion,
  activatePromotion,
  deactivatePromotion,
  getActivePromotionsForSubProduct,
  applyPromotionToSubProducts,
  removeSubProductsFromPromotion,
  applyPromotionToSizes,
  calculateDiscountForItem,
  incrementUsage,
  updateAnalytics,
  getPromotionStats,
  duplicatePromotion,
};
