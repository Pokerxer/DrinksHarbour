// controllers/promotion.controller.js

const promotionService = require('../services/promotion.service');
const asyncHandler = require('express-async-handler');

/**
 * @desc    Create a new promotion
 * @route   POST /api/promotions
 * @access  Private (Tenant admin)
 */
const createPromotion = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const tenantId = req.tenant._id;

  const promotion = await promotionService.createPromotion(req.body, userId, tenantId);

  res.status(201).json({
    success: true,
    message: 'Promotion created successfully',
    data: promotion,
  });
});

/**
 * @desc    Get all promotions
 * @route   GET /api/promotions
 * @access  Private (Tenant admin)
 */
const getPromotions = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;
  const {
    type,
    status,
    isActive,
    applyTo,
    search,
    page,
    limit,
    sortBy,
    sortOrder,
  } = req.query;

  const result = await promotionService.getPromotions(tenantId, {
    type,
    status,
    isActive: isActive !== undefined ? isActive === 'true' : undefined,
    applyTo,
    search,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sortBy,
    sortOrder,
  });

  res.status(200).json({
    success: true,
    data: result.promotions,
    pagination: result.pagination,
  });
});

/**
 * @desc    Get a single promotion by ID
 * @route   GET /api/promotions/:id
 * @access  Private (Tenant admin)
 */
const getPromotionById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenant._id;

  const promotion = await promotionService.getPromotionById(id, tenantId);

  res.status(200).json({
    success: true,
    data: promotion,
  });
});

/**
 * @desc    Get a promotion by code
 * @route   GET /api/promotions/code/:code
 * @access  Private (Tenant user or public for checkout)
 */
const getPromotionByCode = asyncHandler(async (req, res) => {
  const { code } = req.params;
  const tenantId = req.tenant._id;

  const promotion = await promotionService.getPromotionByCode(code, tenantId);

  res.status(200).json({
    success: true,
    data: promotion,
  });
});

/**
 * @desc    Update a promotion
 * @route   PATCH /api/promotions/:id
 * @access  Private (Tenant admin)
 */
const updatePromotion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const tenantId = req.tenant._id;

  const promotion = await promotionService.updatePromotion(id, req.body, tenantId, userId);

  res.status(200).json({
    success: true,
    message: 'Promotion updated successfully',
    data: promotion,
  });
});

/**
 * @desc    Delete a promotion
 * @route   DELETE /api/promotions/:id
 * @access  Private (Tenant admin)
 */
const deletePromotion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenant._id;

  await promotionService.deletePromotion(id, tenantId);

  res.status(200).json({
    success: true,
    message: 'Promotion deleted successfully',
  });
});

/**
 * @desc    Activate a promotion
 * @route   POST /api/promotions/:id/activate
 * @access  Private (Tenant admin)
 */
const activatePromotion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const tenantId = req.tenant._id;

  const promotion = await promotionService.activatePromotion(id, tenantId, userId);

  res.status(200).json({
    success: true,
    message: 'Promotion activated successfully',
    data: promotion,
  });
});

/**
 * @desc    Deactivate a promotion
 * @route   POST /api/promotions/:id/deactivate
 * @access  Private (Tenant admin)
 */
const deactivatePromotion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const tenantId = req.tenant._id;

  const promotion = await promotionService.deactivatePromotion(id, tenantId, userId);

  res.status(200).json({
    success: true,
    message: 'Promotion deactivated successfully',
    data: promotion,
  });
});

/**
 * @desc    Get active promotions for a subproduct
 * @route   GET /api/promotions/subproduct/:subProductId
 * @access  Private
 */
const getPromotionsForSubProduct = asyncHandler(async (req, res) => {
  const { subProductId } = req.params;
  const { sizeId } = req.query;
  const tenantId = req.tenant._id;

  const promotions = await promotionService.getActivePromotionsForSubProduct(
    subProductId,
    tenantId,
    sizeId
  );

  res.status(200).json({
    success: true,
    data: promotions,
  });
});

/**
 * @desc    Apply promotion to subproducts
 * @route   POST /api/promotions/:id/apply
 * @access  Private (Tenant admin)
 */
const applyToSubProducts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { subProductIds } = req.body;
  const userId = req.user._id;
  const tenantId = req.tenant._id;

  if (!subProductIds || !Array.isArray(subProductIds) || subProductIds.length === 0) {
    res.status(400).json({
      success: false,
      message: 'subProductIds array is required',
    });
    return;
  }

  const promotion = await promotionService.applyPromotionToSubProducts(
    id,
    subProductIds,
    tenantId,
    userId
  );

  res.status(200).json({
    success: true,
    message: `Promotion applied to ${subProductIds.length} products`,
    data: promotion,
  });
});

/**
 * @desc    Remove subproducts from promotion
 * @route   POST /api/promotions/:id/remove-products
 * @access  Private (Tenant admin)
 */
const removeSubProducts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { subProductIds } = req.body;
  const userId = req.user._id;
  const tenantId = req.tenant._id;

  if (!subProductIds || !Array.isArray(subProductIds) || subProductIds.length === 0) {
    res.status(400).json({
      success: false,
      message: 'subProductIds array is required',
    });
    return;
  }

  const promotion = await promotionService.removeSubProductsFromPromotion(
    id,
    subProductIds,
    tenantId,
    userId
  );

  res.status(200).json({
    success: true,
    message: `Removed ${subProductIds.length} products from promotion`,
    data: promotion,
  });
});

/**
 * @desc    Apply promotion to sizes
 * @route   POST /api/promotions/:id/apply-sizes
 * @access  Private (Tenant admin)
 */
const applyToSizes = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { sizeIds } = req.body;
  const userId = req.user._id;
  const tenantId = req.tenant._id;

  if (!sizeIds || !Array.isArray(sizeIds) || sizeIds.length === 0) {
    res.status(400).json({
      success: false,
      message: 'sizeIds array is required',
    });
    return;
  }

  const promotion = await promotionService.applyPromotionToSizes(
    id,
    sizeIds,
    tenantId,
    userId
  );

  res.status(200).json({
    success: true,
    message: `Promotion applied to ${sizeIds.length} sizes`,
    data: promotion,
  });
});

/**
 * @desc    Calculate discount for a cart item
 * @route   POST /api/promotions/calculate-discount
 * @access  Private
 */
const calculateDiscount = asyncHandler(async (req, res) => {
  const { subProductId, sizeId, originalPrice, quantity, customerId } = req.body;
  const tenantId = req.tenant._id;

  if (!subProductId || !originalPrice) {
    res.status(400).json({
      success: false,
      message: 'subProductId and originalPrice are required',
    });
    return;
  }

  const result = await promotionService.calculateDiscountForItem(
    tenantId,
    subProductId,
    sizeId,
    originalPrice,
    quantity || 1,
    customerId
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get promotion statistics
 * @route   GET /api/promotions/stats
 * @access  Private (Tenant admin)
 */
const getPromotionStats = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;

  const stats = await promotionService.getPromotionStats(tenantId);

  res.status(200).json({
    success: true,
    data: stats,
  });
});

/**
 * @desc    Duplicate a promotion
 * @route   POST /api/promotions/:id/duplicate
 * @access  Private (Tenant admin)
 */
const duplicatePromotion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const tenantId = req.tenant._id;

  const promotion = await promotionService.duplicatePromotion(id, tenantId, userId);

  res.status(201).json({
    success: true,
    message: 'Promotion duplicated successfully',
    data: promotion,
  });
});

/**
 * @desc    Validate a promotion code
 * @route   POST /api/promotions/validate-code
 * @access  Public (for checkout)
 */
const validateCode = asyncHandler(async (req, res) => {
  const { code, subProductId, sizeId, amount } = req.body;
  const tenantId = req.tenant._id;

  if (!code) {
    res.status(400).json({
      success: false,
      message: 'Promotion code is required',
    });
    return;
  }

  try {
    const promotion = await promotionService.getPromotionByCode(code, tenantId);

    // Check if promotion applies to the subproduct/size if provided
    if (subProductId) {
      const isApplicable = promotion.isApplicableTo(subProductId, sizeId);
      if (!isApplicable) {
        res.status(400).json({
          success: false,
          message: 'This promotion code does not apply to the selected product',
        });
        return;
      }
    }

    // Check minimum purchase amount
    if (promotion.minPurchaseAmount && amount < promotion.minPurchaseAmount) {
      res.status(400).json({
        success: false,
        message: `Minimum purchase amount of ${promotion.minPurchaseAmount} required`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Promotion code is valid',
      data: {
        promotionId: promotion._id,
        name: promotion.name,
        type: promotion.type,
        discountValue: promotion.discountValue,
        discountType: promotion.discountType,
        maxDiscountAmount: promotion.maxDiscountAmount,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Invalid or expired promotion code',
    });
  }
});

module.exports = {
  createPromotion,
  getPromotions,
  getPromotionById,
  getPromotionByCode,
  updatePromotion,
  deletePromotion,
  activatePromotion,
  deactivatePromotion,
  getPromotionsForSubProduct,
  applyToSubProducts,
  removeSubProducts,
  applyToSizes,
  calculateDiscount,
  getPromotionStats,
  duplicatePromotion,
  validateCode,
};
