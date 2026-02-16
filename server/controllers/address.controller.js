// controllers/address.controller.js
const addressService = require('../services/address.service');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');

/**
 * @desc    Get all addresses for current user
 * @route   GET /api/addresses
 * @access  Private
 */
exports.getMyAddresses = asyncHandler(async (req, res) => {
  const addresses = await addressService.getAddressesByUser(req.user._id);
  
  successResponse(res, { addresses }, 'Addresses retrieved successfully');
});

/**
 * @desc    Create new address
 * @route   POST /api/addresses
 * @access  Private
 */
exports.createAddress = asyncHandler(async (req, res) => {
  const address = await addressService.createAddress({
    user: req.user._id,
    ...req.body,
  });

  successResponse(res, { address }, 'Address created successfully', 201);
});

/**
 * @desc    Update address
 * @route   PUT /api/addresses/:id
 * @access  Private
 */
exports.updateAddress = asyncHandler(async (req, res) => {
  const address = await addressService.updateAddress(
    req.params.id,
    req.user._id,
    req.body
  );

  successResponse(res, { address }, 'Address updated successfully');
});

/**
 * @desc    Delete address
 * @route   DELETE /api/addresses/:id
 * @access  Private
 */
exports.deleteAddress = asyncHandler(async (req, res) => {
  await addressService.deleteAddress(req.params.id, req.user._id);

  successResponse(res, null, 'Address deleted successfully');
});

/**
 * @desc    Set default address
 * @route   PATCH /api/addresses/:id/default
 * @access  Private
 */
exports.setDefaultAddress = asyncHandler(async (req, res) => {
  const { type } = req.body; // 'shipping' or 'billing'
  
  const address = await addressService.setDefaultAddress(
    req.params.id,
    req.user._id,
    type
  );

  successResponse(res, { address }, `Default ${type} address updated successfully`);
});
