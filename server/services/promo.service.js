// services/promo.service.js

const Promo = require('../models/Promo');
const { ValidationError, NotFoundError, ConflictError } = require('../utils/errors');

/**
 * Create a new promo
 */
const createPromo = async (promoData) => {
  const { code, name, type, discountValue, minimumOrderValue, usageLimit, startDate, endDate } = promoData;

  // Check if promo code already exists
  const existingPromo = await Promo.findOne({ code: code.toUpperCase() });
  if (existingPromo) {
    throw new ConflictError('Promo code already exists');
  }

  // Validate discount value based on type
  if (type === 'percentage' && discountValue > 100) {
    throw new ValidationError('Percentage discount cannot exceed 100%');
  }

  if (type === 'fixed' && discountValue <= 0) {
    throw new ValidationError('Fixed discount must be greater than 0');
  }

  const promo = new Promo({
    ...promoData,
    code: code.toUpperCase(),
    usedCount: 0,
  });

  await promo.save();
  return promo;
};

/**
 * Get all promos with filters
 */
const getAllPromos = async (query = {}) => {
  const { page = 1, limit = 20, status, type, search, tenant } = query;

  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (type) {
    filter.type = type;
  }

  if (search) {
    filter.$or = [
      { code: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } },
    ];
  }

  if (tenant) {
    filter.$or = [
      { tenant },
      { isGlobal: true },
    ];
  }

  const promos = await Promo.find(filter)
    .populate('applicableProducts', 'name slug images')
    .populate('applicableCategories', 'name slug')
    .populate('applicableBrands', 'name slug logo')
    .populate('createdBy', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Promo.countDocuments(filter);

  return {
    promos,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get promo by ID
 */
const getPromoById = async (id) => {
  const promo = await Promo.findById(id)
    .populate('applicableProducts', 'name slug images price')
    .populate('applicableCategories', 'name slug')
    .populate('applicableBrands', 'name slug logo')
    .populate('excludedProducts', 'name slug')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email');

  if (!promo) {
    throw new NotFoundError('Promo not found');
  }

  return promo;
};

/**
 * Get promo by code
 */
const getPromoByCode = async (code) => {
  const promo = await Promo.findOne({ code: code.toUpperCase() })
    .populate('applicableProducts', 'name slug images price')
    .populate('applicableCategories', 'name slug');

  if (!promo) {
    throw new NotFoundError('Promo not found');
  }

  return promo;
};

/**
 * Validate promo for an order
 */
const validatePromo = async (code, orderData, userId = null) => {
  const promo = await Promo.findValidPromo(code);

  if (!promo) {
    return {
      valid: false,
      message: 'Invalid or expired promo code',
    };
  }

  // Check minimum order value
  if (promo.minimumOrderValue && orderData.subtotal < promo.minimumOrderValue) {
    return {
      valid: false,
      message: `Minimum order value of ₦${promo.minimumOrderValue.toLocaleString()} required`,
      promo: null,
    };
  }

  // Check if user has already used this promo
  if (userId && promo.usageLimitPerCustomer < Infinity) {
    // This would require checking user promo usage history
    // For now, we'll skip this check
  }

  // Calculate discount amount
  let discountAmount = 0;

  switch (promo.type) {
    case 'percentage':
      discountAmount = (orderData.subtotal * promo.discountValue) / 100;
      break;
    case 'fixed':
      discountAmount = promo.discountValue;
      break;
    case 'bogo':
      discountAmount = 0; // Handle differently based on items
      break;
    case 'free_shipping':
      discountAmount = orderData.shippingFee || 0;
      break;
    default:
      discountAmount = 0;
  }

  // Apply maximum discount cap
  if (promo.maximumDiscount && discountAmount > promo.maximumDiscount) {
    discountAmount = promo.maximumDiscount;
  }

  // Don't exceed order total
  if (discountAmount > orderData.subtotal) {
    discountAmount = orderData.subtotal;
  }

  return {
    valid: true,
    promo: {
      _id: promo._id,
      code: promo.code,
      name: promo.name,
      type: promo.type,
      discountValue: promo.discountValue,
      discountAmount,
      displayDiscount: promo.displayDiscount,
    },
    message: 'Promo applied successfully',
  };
};

/**
 * Apply promo to an order
 */
const applyPromo = async (code, orderId) => {
  const promo = await Promo.findValidPromo(code);

  if (!promo) {
    throw new NotFoundError('Promo not found or expired');
  }

  promo.usedCount += 1;
  await promo.save();

  return promo;
};

/**
 * Update promo
 */
const updatePromo = async (id, updateData, userId) => {
  const promo = await Promo.findById(id);

  if (!promo) {
    throw new NotFoundError('Promo not found');
  }

  // If code is being updated, check for conflicts
  if (updateData.code && updateData.code.toUpperCase() !== promo.code) {
    const existingPromo = await Promo.findOne({ code: updateData.code.toUpperCase() });
    if (existingPromo) {
      throw new ConflictError('Promo code already exists');
    }
    updateData.code = updateData.code.toUpperCase();
  }

  // Validate discount value
  if (updateData.type && updateData.type === 'percentage' && updateData.discountValue > 100) {
    throw new ValidationError('Percentage discount cannot exceed 100%');
  }

  Object.assign(promo, updateData);
  promo.updatedBy = userId;
  await promo.save();

  return promo;
};

/**
 * Delete promo
 */
const deletePromo = async (id) => {
  const promo = await Promo.findByIdAndDelete(id);

  if (!promo) {
    throw new NotFoundError('Promo not found');
  }

  return promo;
};

/**
 * Toggle promo status
 */
const togglePromoStatus = async (id) => {
  const promo = await Promo.findById(id);

  if (!promo) {
    throw new NotFoundError('Promo not found');
  }

  promo.isActive = !promo.isActive;
  await promo.updateStatus();

  return promo;
};

/**
 * Get active promos for display
 */
const getActivePromos = async (placement = 'home_promo', options = {}) => {
  const { limit = 10, tenant } = options;

  const now = new Date();

  const filter = {
    isActive: true,
    status: 'active',
    $or: [
      { startDate: { $exists: false } },
      { startDate: { $lte: now } },
    ],
    $or: [
      { endDate: { $exists: false } },
      { endDate: { $gte: now } },
    ],
    $or: [
      { usageLimit: { $exists: false } },
      { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
    ],
  };

  if (tenant) {
    filter.$or = [
      { tenant },
      { isGlobal: true },
    ];
  }

  const promos = await Promo.find(filter)
    .sort({ priority: -1, createdAt: -1 })
    .limit(limit)
    .select('code name description type discountValue bannerImage startDate endDate priority');

  return promos;
};

/**
 * Reset promo usage count
 */
const resetPromoUsage = async (id) => {
  const promo = await Promo.findById(id);

  if (!promo) {
    throw new NotFoundError('Promo not found');
  }

  promo.usedCount = 0;
  await promo.save();

  return promo;
};

module.exports = {
  createPromo,
  getAllPromos,
  getPromoById,
  getPromoByCode,
  validatePromo,
  applyPromo,
  updatePromo,
  deletePromo,
  togglePromoStatus,
  getActivePromos,
  resetPromoUsage,
};
