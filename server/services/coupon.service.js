// services/coupon.service.js

const Coupon = require('../models/Coupon');
const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const Order = require('../models/Order');
const Tenant = require('../models/tenant');
const { NotFoundError, ValidationError, AuthorizationError } = require('../utils/errors');
const mongoose = require('mongoose');

/**
 * Create a new coupon
 */
const createCoupon = async (couponData, userId) => {
  try {
    // Validate code uniqueness
    if (couponData.code) {
      const existingCoupon = await Coupon.findOne({ 
        code: couponData.code.toUpperCase() 
      });
      
      if (existingCoupon) {
        throw new ValidationError('Coupon code already exists');
      }
    }

    // Validate dates
    if (new Date(couponData.endDate) <= new Date(couponData.startDate)) {
      throw new ValidationError('End date must be after start date');
    }

    // Validate discount value
    if (couponData.discountType === 'percentage' && couponData.discountValue > 100) {
      throw new ValidationError('Percentage discount cannot exceed 100%');
    }

    // Validate references
    await validateCouponReferences(couponData);

    // Add creator
    couponData.createdBy = userId;
    couponData.updatedBy = userId;

    // Ensure code is uppercase
    if (couponData.code) {
      couponData.code = couponData.code.toUpperCase();
    }

    // Create coupon
    const coupon = await Coupon.create(couponData);

    // Populate references
    await coupon.populate([
      { path: 'includedProducts', select: 'name slug images priceRange' },
      { path: 'includedCategories', select: 'name slug icon' },
      { path: 'includedBrands', select: 'name slug logo' },
      { path: 'tenant', select: 'name slug logo' },
      { path: 'createdBy', select: 'firstName lastName email' },
    ]);

    return coupon;
  } catch (error) {
    if (error.code === 11000) {
      throw new ValidationError('Coupon code already exists');
    }
    throw error;
  }
};

/**
 * Get all coupons with filtering and pagination
 */
const getAllCoupons = async (queryParams = {}) => {
  const {
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    order = 'desc',
    
    // Filters
    status,
    discountType,
    isActive,
    isGlobal,
    tenant,
    search,
    applicableTo,
    startDateAfter,
    endDateBefore,
    autoApply,
  } = queryParams;

  const skip = (page - 1) * limit;

  // Build query
  const query = {};

  if (status) {
    query.status = Array.isArray(status) ? { $in: status } : status;
  }

  if (discountType) {
    query.discountType = Array.isArray(discountType) ? { $in: discountType } : discountType;
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

  if (applicableTo) {
    query.applicableTo = applicableTo;
  }

  if (autoApply !== undefined) {
    query.autoApply = autoApply === 'true' || autoApply === true;
  }

  if (search) {
    const searchRegex = new RegExp(search, 'i');
    query.$or = [
      { code: searchRegex },
      { name: searchRegex },
      { description: searchRegex },
    ];
  }

  // Date filters
  if (startDateAfter) {
    query.startDate = { $gte: new Date(startDateAfter) };
  }

  if (endDateBefore) {
    query.endDate = { $lte: new Date(endDateBefore) };
  }

  // Build sort
  const sortOrder = order === 'asc' ? 1 : -1;
  const sort = { [sortBy]: sortOrder };

  // Execute query
  const [coupons, total] = await Promise.all([
    Coupon.find(query)
      .populate('includedProducts', 'name slug')
      .populate('includedCategories', 'name slug')
      .populate('includedBrands', 'name slug')
      .populate('tenant', 'name slug logo')
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Coupon.countDocuments(query),
  ]);

  // Enrich coupons
  const enrichedCoupons = coupons.map(coupon => enrichCouponData(coupon));

  // Calculate pagination
  const totalPages = Math.ceil(total / limit);

  // Get statistics
  const stats = await getCouponStatistics(query);

  return {
    coupons: enrichedCoupons,
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
 * Get coupon by ID
 */
const getCouponById = async (couponId) => {
  if (!mongoose.Types.ObjectId.isValid(couponId)) {
    throw new ValidationError('Invalid coupon ID format');
  }

  const coupon = await Coupon.findById(couponId)
    .populate('includedProducts', 'name slug images priceRange')
    .populate('excludedProducts', 'name slug')
    .populate('includedCategories', 'name slug icon')
    .populate('excludedCategories', 'name slug')
    .populate('includedBrands', 'name slug logo')
    .populate('excludedBrands', 'name slug')
    .populate('tenant', 'name slug logo city state')
    .populate('allowedTenants', 'name slug')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')
    .lean();

  if (!coupon) {
    throw new NotFoundError('Coupon not found');
  }

  return enrichCouponData(coupon);
};

/**
 * Get coupon by code
 */
const getCouponByCode = async (code) => {
  const coupon = await Coupon.findOne({ code: code.toUpperCase() })
    .populate('includedProducts', 'name slug images')
    .populate('includedCategories', 'name slug')
    .populate('includedBrands', 'name slug')
    .populate('tenant', 'name slug')
    .lean();

  if (!coupon) {
    throw new NotFoundError('Coupon not found');
  }

  return enrichCouponData(coupon);
};

/**
 * Validate coupon for user
 */
const validateCoupon = async (code, userId, cartData = {}) => {
  const { items = [], subtotal = 0, tenant = null } = cartData;

  // Find coupon
  const coupon = await Coupon.findValidCoupon(code, userId);

  if (!coupon) {
    throw new ValidationError('Invalid or expired coupon code');
  }

  // Check tenant restriction
  if (tenant && coupon.tenant && coupon.tenant.toString() !== tenant.toString() && !coupon.isGlobal) {
    throw new ValidationError('This coupon is not valid for this store');
  }

  // Check user eligibility
  if (userId) {
    const eligibility = await coupon.canBeUsedBy(userId);
    if (!eligibility.canUse) {
      throw new ValidationError(eligibility.reason);
    }
  }

  // Check minimum purchase amount
  if (coupon.minimumPurchaseAmount && subtotal < coupon.minimumPurchaseAmount) {
    throw new ValidationError(
      `Minimum purchase amount of ${getCurrencySymbol(coupon.currency)}${coupon.minimumPurchaseAmount} required`
    );
  }

  // Check maximum purchase amount
  if (coupon.maximumPurchaseAmount && subtotal > coupon.maximumPurchaseAmount) {
    throw new ValidationError(
      `Maximum purchase amount of ${getCurrencySymbol(coupon.currency)}${coupon.maximumPurchaseAmount} exceeded`
    );
  }

  // Check minimum items
  if (coupon.minimumItems && items.length < coupon.minimumItems) {
    throw new ValidationError(
      `Minimum of ${coupon.minimumItems} items required in cart`
    );
  }

  // Check maximum items
  if (coupon.maximumItems && items.length > coupon.maximumItems) {
    throw new ValidationError(
      `Maximum of ${coupon.maximumItems} items allowed`
    );
  }

  // Check product/category/brand restrictions
  if (items.length > 0 && coupon.applicableTo !== 'all') {
    const isApplicable = await checkProductApplicability(coupon, items);
    if (!isApplicable) {
      throw new ValidationError('This coupon is not applicable to items in your cart');
    }
  }

  // Calculate discount
  const discount = coupon.calculateDiscount(subtotal, items);

  return {
    valid: true,
    coupon: {
      _id: coupon._id,
      code: coupon.code,
      name: coupon.name,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    },
    discount,
    message: `Coupon applied! You save ${getCurrencySymbol(coupon.currency)}${discount.toFixed(2)}`,
  };
};

/**
 * Apply coupon to order
 */
const applyCoupon = async (code, userId, orderData) => {
  // Validate coupon
  const validation = await validateCoupon(code, userId, orderData);

  if (!validation.valid) {
    throw new ValidationError('Coupon cannot be applied');
  }

  const coupon = await Coupon.findOne({ code: code.toUpperCase() });

  // Record usage (will be finalized when order is completed)
  return {
    coupon: {
      _id: coupon._id,
      code: coupon.code,
      name: coupon.name,
    },
    discount: validation.discount,
    finalAmount: orderData.subtotal - validation.discount,
  };
};

/**
 * Record coupon usage (after order completion)
 */
const recordCouponUsage = async (couponId, userId, orderAmount, discountApplied, orderId) => {
  const coupon = await Coupon.findById(couponId);

  if (!coupon) {
    throw new NotFoundError('Coupon not found');
  }

  await coupon.recordUsage(userId, orderAmount, discountApplied, orderId);

  return {
    message: 'Coupon usage recorded',
    coupon: {
      _id: coupon._id,
      code: coupon.code,
      timesUsed: coupon.timesUsed,
      remainingUses: coupon.remainingUses,
    },
  };
};

/**
 * Update coupon
 */
const updateCoupon = async (couponId, updateData, userId) => {
  if (!mongoose.Types.ObjectId.isValid(couponId)) {
    throw new ValidationError('Invalid coupon ID format');
  }

  const coupon = await Coupon.findById(couponId);

  if (!coupon) {
    throw new NotFoundError('Coupon not found');
  }

  // Validate code if being updated
  if (updateData.code && updateData.code !== coupon.code) {
    const existingCoupon = await Coupon.findOne({
      code: updateData.code.toUpperCase(),
      _id: { $ne: couponId },
    });

    if (existingCoupon) {
      throw new ValidationError('Coupon code already exists');
    }

    updateData.code = updateData.code.toUpperCase();
  }

  // Validate dates
  if (updateData.startDate || updateData.endDate) {
    const startDate = updateData.startDate ? new Date(updateData.startDate) : coupon.startDate;
    const endDate = updateData.endDate ? new Date(updateData.endDate) : coupon.endDate;

    if (endDate <= startDate) {
      throw new ValidationError('End date must be after start date');
    }
  }

  // Validate references
  await validateCouponReferences(updateData);

  // Update fields
  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined) {
      coupon[key] = updateData[key];
    }
  });

  coupon.updatedBy = userId;

  await coupon.save();

  // Populate and return
  await coupon.populate([
    { path: 'includedProducts', select: 'name slug' },
    { path: 'includedCategories', select: 'name slug' },
    { path: 'includedBrands', select: 'name slug' },
    { path: 'tenant', select: 'name slug' },
    { path: 'updatedBy', select: 'firstName lastName email' },
  ]);

  return enrichCouponData(coupon.toObject());
};

/**
 * Delete coupon
 */
const deleteCoupon = async (couponId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(couponId)) {
    throw new ValidationError('Invalid coupon ID format');
  }

  const coupon = await Coupon.findById(couponId);

  if (!coupon) {
    throw new NotFoundError('Coupon not found');
  }

  // Check if coupon has been used
  if (coupon.timesUsed > 0) {
    // Soft delete
    coupon.status = 'inactive';
    coupon.isActive = false;
    coupon.deletedAt = new Date();
    coupon.deletedBy = userId;
    await coupon.save();

    return {
      message: 'Coupon deactivated (has usage history)',
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        status: coupon.status,
      },
    };
  }

  // Hard delete if never used
  await coupon.deleteOne();

  return {
    message: 'Coupon deleted successfully',
    coupon: {
      _id: coupon._id,
      code: coupon.code,
    },
  };
};

/**
 * Activate/Deactivate coupon
 */
const toggleCouponStatus = async (couponId, userId) => {
  const coupon = await Coupon.findById(couponId);

  if (!coupon) {
    throw new NotFoundError('Coupon not found');
  }

  coupon.isActive = !coupon.isActive;
  coupon.status = coupon.isActive ? 'active' : 'inactive';
  coupon.updatedBy = userId;

  await coupon.save();

  return {
    message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
    coupon: {
      _id: coupon._id,
      code: coupon.code,
      isActive: coupon.isActive,
      status: coupon.status,
    },
  };
};

/**
 * Get coupon analytics
 */
const getCouponAnalytics = async (couponId) => {
  const coupon = await Coupon.findById(couponId).lean();

  if (!coupon) {
    throw new NotFoundError('Coupon not found');
  }

  const analytics = {
    couponId: coupon._id,
    code: coupon.code,
    name: coupon.name,
    
    usage: {
      timesUsed: coupon.timesUsed,
      usageLimit: coupon.usageLimit || 'Unlimited',
      remainingUses: coupon.usageLimit ? coupon.usageLimit - coupon.timesUsed : 'Unlimited',
      usagePercentage: coupon.usageLimit ? (coupon.timesUsed / coupon.usageLimit * 100).toFixed(2) : 0,
    },
    
    financial: {
      totalDiscountGiven: coupon.totalDiscountGiven || 0,
      totalRevenue: coupon.totalRevenue || 0,
      averageOrderValue: coupon.averageOrderValue || 0,
      currency: coupon.currency,
    },
    
    performance: {
      conversionRate: coupon.conversionRate || 0,
      uniqueUsers: coupon.usedBy?.length || 0,
    },
    
    validity: {
      status: coupon.status,
      isActive: coupon.isActive,
      startDate: coupon.startDate,
      endDate: coupon.endDate,
      daysUntilExpiration: calculateDaysUntilExpiration(coupon.endDate),
    },
  };

  return analytics;
};

/**
 * Get auto-apply coupons for cart
 */
const getAutoApplyCoupons = async (cartData, userId) => {
  const { tenant, subtotal } = cartData;

  let tenantId = tenant;
  
  // If tenant is a string (name), look up the tenant ID
  if (tenant && typeof tenant === 'string' && !tenant.match(/^[0-9a-fA-F]{24}$/)) {
    const tenantDoc = await Tenant.findOne({ name: tenant });
    if (tenantDoc) {
      tenantId = tenantDoc._id;
    } else {
      // If tenant name not found, don't filter by tenant
      tenantId = null;
    }
  }

  const coupons = await Coupon.getAutoApplyCoupons({ tenant: tenantId });

  const applicableCoupons = [];

  for (const coupon of coupons) {
    try {
      const validation = await validateCoupon(coupon.code, userId, cartData);
      if (validation.valid) {
        applicableCoupons.push({
          coupon: validation.coupon,
          discount: validation.discount,
        });
      }
    } catch (error) {
      // Skip invalid coupons
      continue;
    }
  }

  // Sort by discount amount (highest first)
  applicableCoupons.sort((a, b) => b.discount - a.discount);

  return applicableCoupons;
};

/**
 * Generate unique coupon code
 */
const generateCouponCode = async (prefix = '', length = 8) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = prefix.toUpperCase();
  
  const remainingLength = length - prefix.length;
  
  for (let i = 0; i < remainingLength; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  // Check if code exists
  const existing = await Coupon.findOne({ code });
  
  if (existing) {
    // Recursively generate new code
    return generateCouponCode(prefix, length);
  }

  return code;
};

/**
 * Bulk create coupons
 */
const bulkCreateCoupons = async (couponTemplate, count, userId) => {
  const coupons = [];

  for (let i = 0; i < count; i++) {
    const code = await generateCouponCode(couponTemplate.codePrefix || '', 10);
    
    const couponData = {
      ...couponTemplate,
      code,
      createdBy: userId,
    };

    const coupon = await Coupon.create(couponData);
    coupons.push(coupon);
  }

  return {
    message: `${count} coupons created successfully`,
    coupons: coupons.map(c => ({
      _id: c._id,
      code: c.code,
      name: c.name,
    })),
  };
};

/**
 * Update scheduled coupons status
 */
const updateScheduledCouponsStatus = async () => {
  const now = new Date();

  // Activate scheduled coupons
  const toActivate = await Coupon.updateMany(
    {
      status: 'scheduled',
      startDate: { $lte: now },
      endDate: { $gte: now },
      isActive: true,
    },
    {
      status: 'active',
    }
  );

  // Expire active coupons
  const toExpire = await Coupon.updateMany(
    {
      status: 'active',
      endDate: { $lt: now },
    },
    {
      status: 'expired',
      isActive: false,
    }
  );

  return {
    activated: toActivate.modifiedCount,
    expired: toExpire.modifiedCount,
    message: `Updated ${toActivate.modifiedCount} coupons to active and ${toExpire.modifiedCount} coupons to expired`,
  };
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Validate coupon references
 */
async function validateCouponReferences(couponData) {
  // Validate products
  if (couponData.includedProducts && couponData.includedProducts.length > 0) {
    const products = await Product.find({ 
      _id: { $in: couponData.includedProducts } 
    });
    
    if (products.length !== couponData.includedProducts.length) {
      throw new ValidationError('Some included products not found');
    }
  }

  // Validate categories
  if (couponData.includedCategories && couponData.includedCategories.length > 0) {
    const categories = await Category.find({ 
      _id: { $in: couponData.includedCategories } 
    });
    
    if (categories.length !== couponData.includedCategories.length) {
      throw new ValidationError('Some included categories not found');
    }
  }

  // Validate brands
  if (couponData.includedBrands && couponData.includedBrands.length > 0) {
    const brands = await Brand.find({ 
      _id: { $in: couponData.includedBrands } 
    });
    
    if (brands.length !== couponData.includedBrands.length) {
      throw new ValidationError('Some included brands not found');
    }
  }
}

/**
 * Check if coupon is applicable to cart items
 */
async function checkProductApplicability(coupon, items) {
  // This is a simplified version - enhance based on your cart item structure
  for (const item of items) {
    const productId = item.product || item.productId;

    // Check excluded products
    if (coupon.excludedProducts && coupon.excludedProducts.includes(productId)) {
      continue; // Skip excluded products
    }

    // Check included products
    if (coupon.includedProducts && coupon.includedProducts.length > 0) {
      if (coupon.includedProducts.includes(productId)) {
        return true;
      }
    }

    // Check categories and brands
    const product = await Product.findById(productId).lean();
    
    if (product) {
      // Check included categories
      if (coupon.includedCategories && coupon.includedCategories.length > 0) {
        if (coupon.includedCategories.includes(product.category)) {
          return true;
        }
      }

      // Check included brands
      if (coupon.includedBrands && coupon.includedBrands.length > 0) {
        if (coupon.includedBrands.includes(product.brand)) {
          return true;
        }
      }
    }
  }

  return coupon.applicableTo === 'all';
}

/**
 * Enrich coupon data
 */
function enrichCouponData(coupon) {
  const now = new Date();

  return {
    ...coupon,
    
    isValid: coupon.isActive && 
             coupon.status !== 'expired' && 
             coupon.status !== 'depleted' &&
             (!coupon.startDate || now >= new Date(coupon.startDate)) &&
             (!coupon.endDate || now <= new Date(coupon.endDate)) &&
             (!coupon.usageLimit || coupon.timesUsed < coupon.usageLimit),
    
    daysUntilExpiration: calculateDaysUntilExpiration(coupon.endDate),
    
    usagePercentage: coupon.usageLimit 
      ? Math.min(100, (coupon.timesUsed / coupon.usageLimit) * 100).toFixed(2)
      : 0,
    
    remainingUses: coupon.usageLimit 
      ? Math.max(0, coupon.usageLimit - coupon.timesUsed)
      : 'Unlimited',
  };
}

/**
 * Calculate days until expiration
 */
function calculateDaysUntilExpiration(endDate) {
  if (!endDate) return null;
  
  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays : 0;
}

/**
 * Get currency symbol
 */
function getCurrencySymbol(currency) {
  const symbols = {
    NGN: '₦',
    USD: '$',
    GBP: '£',
    EUR: '€',
    ZAR: 'R',
  };
  return symbols[currency] || currency;
}

/**
 * Get coupon statistics
 */
async function getCouponStatistics(baseQuery = {}) {
  const stats = await Coupon.aggregate([
    { $match: baseQuery },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        expired: { $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] } },
        scheduled: { $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] } },
        depleted: { $sum: { $cond: [{ $eq: ['$status', 'depleted'] }, 1, 0] } },
        totalUsed: { $sum: '$timesUsed' },
        totalDiscountGiven: { $sum: '$totalDiscountGiven' },
        totalRevenue: { $sum: '$totalRevenue' },
      },
    },
  ]);

  return stats[0] || {
    total: 0,
    active: 0,
    expired: 0,
    scheduled: 0,
    depleted: 0,
    totalUsed: 0,
    totalDiscountGiven: 0,
    totalRevenue: 0,
  };
}

module.exports = {
  createCoupon,
  getAllCoupons,
  getCouponById,
  getCouponByCode,
  validateCoupon,
  applyCoupon,
  recordCouponUsage,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  getCouponAnalytics,
  getAutoApplyCoupons,
  generateCouponCode,
  bulkCreateCoupons,
  updateScheduledCouponsStatus,
};