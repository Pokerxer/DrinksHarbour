// controllers/promo.controller.js

const promoService = require('../services/promo.service');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');

/**
 * @desc    Create new promo
 * @route   POST /api/promos
 * @access  Private/Admin
 */
exports.createPromo = asyncHandler(async (req, res) => {
  const promo = await promoService.createPromo({
    ...req.body,
    createdBy: req.user?._id,
  });

  successResponse(res, { promo }, 'Promo created successfully', 201);
});

/**
 * @desc    Get all promos
 * @route   GET /api/promos
 * @access  Private/Admin
 */
exports.getAllPromos = asyncHandler(async (req, res) => {
  const result = await promoService.getAllPromos(req.query);
  successResponse(res, result, 'Promos retrieved successfully');
});

/**
 * @desc    Get promo by ID
 * @route   GET /api/promos/:id
 * @access  Private/Admin
 */
exports.getPromoById = asyncHandler(async (req, res) => {
  const promo = await promoService.getPromoById(req.params.id);
  successResponse(res, { promo }, 'Promo retrieved successfully');
});

/**
 * @desc    Get promo by code
 * @route   GET /api/promos/code/:code
 * @access  Private/Admin
 */
exports.getPromoByCode = asyncHandler(async (req, res) => {
  const promo = await promoService.getPromoByCode(req.params.code);
  successResponse(res, { promo }, 'Promo retrieved successfully');
});

/**
 * @desc    Validate promo for order
 * @route   POST /api/promos/validate
 * @access  Private
 */
exports.validatePromo = asyncHandler(async (req, res) => {
  const { code, subtotal, shippingFee, items } = req.body;

  const result = await promoService.validatePromo(code, { subtotal, shippingFee, items }, req.user?._id);

  if (!result.valid) {
    return res.status(400).json({
      success: false,
      message: result.message,
    });
  }

  successResponse(res, result, 'Promo is valid');
});

/**
 * @desc    Apply promo to order
 * @route   POST /api/promos/apply
 * @access  Private
 */
exports.applyPromo = asyncHandler(async (req, res) => {
  const { code, orderId } = req.body;

  const promo = await promoService.applyPromo(code, orderId);
  successResponse(res, { promo }, 'Promo applied successfully');
});

/**
 * @desc    Update promo
 * @route   PUT /api/promos/:id
 * @access  Private/Admin
 */
exports.updatePromo = asyncHandler(async (req, res) => {
  const promo = await promoService.updatePromo(req.params.id, req.body, req.user?._id);
  successResponse(res, { promo }, 'Promo updated successfully');
});

/**
 * @desc    Delete promo
 * @route   DELETE /api/promos/:id
 * @access  Private/Admin
 */
exports.deletePromo = asyncHandler(async (req, res) => {
  await promoService.deletePromo(req.params.id);
  successResponse(res, null, 'Promo deleted successfully');
});

/**
 * @desc    Toggle promo status
 * @route   PATCH /api/promos/:id/toggle
 * @access  Private/Admin
 */
exports.togglePromoStatus = asyncHandler(async (req, res) => {
  const promo = await promoService.togglePromoStatus(req.params.id);
  successResponse(res, { promo }, `Promo ${promo.isActive ? 'activated' : 'deactivated'} successfully`);
});

/**
 * @desc    Get active promos for display
 * @route   GET /api/promos/active
 * @access  Public
 */
exports.getActivePromos = asyncHandler(async (req, res) => {
  const { limit = 10, placement = 'home_promo' } = req.query;
  const promos = await promoService.getActivePromos(placement, { limit: parseInt(limit) });
  successResponse(res, { promos }, 'Active promos retrieved successfully');
});

/**
 * @desc    Reset promo usage count
 * @route   PATCH /api/promos/:id/reset-usage
 * @access  Private/Admin
 */
exports.resetPromoUsage = asyncHandler(async (req, res) => {
  const promo = await promoService.resetPromoUsage(req.params.id);
  successResponse(res, { promo }, 'Promo usage reset successfully');
});
