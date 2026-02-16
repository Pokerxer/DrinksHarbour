// controllers/sale.controller.js

const saleService = require('../services/sale.service');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');

/**
 * @desc    Create new sale
 * @route   POST /api/sales
 * @access  Private/Admin
 */
exports.createSale = asyncHandler(async (req, res) => {
  const sale = await saleService.createSale({
    ...req.body,
    createdBy: req.user?._id,
  });

  successResponse(res, { sale }, 'Sale created successfully', 201);
});

/**
 * @desc    Get all sales
 * @route   GET /api/sales
 * @access  Private/Admin
 */
exports.getAllSales = asyncHandler(async (req, res) => {
  const result = await saleService.getAllSales(req.query);
  successResponse(res, result, 'Sales retrieved successfully');
});

/**
 * @desc    Get sale by ID
 * @route   GET /api/sales/:id
 * @access  Private/Admin
 */
exports.getSaleById = asyncHandler(async (req, res) => {
  const sale = await saleService.getSaleById(req.params.id);
  successResponse(res, { sale }, 'Sale retrieved successfully');
});

/**
 * @desc    Update sale
 * @route   PUT /api/sales/:id
 * @access  Private/Admin
 */
exports.updateSale = asyncHandler(async (req, res) => {
  const sale = await saleService.updateSale(req.params.id, req.body, req.user?._id);
  successResponse(res, { sale }, 'Sale updated successfully');
});

/**
 * @desc    Delete sale
 * @route   DELETE /api/sales/:id
 * @access  Private/Admin
 */
exports.deleteSale = asyncHandler(async (req, res) => {
  await saleService.deleteSale(req.params.id);
  successResponse(res, null, 'Sale deleted successfully');
});

/**
 * @desc    Toggle sale status
 * @route   PATCH /api/sales/:id/toggle
 * @access  Private/Admin
 */
exports.toggleSaleStatus = asyncHandler(async (req, res) => {
  const sale = await saleService.toggleSaleStatus(req.params.id);
  successResponse(res, { sale }, `Sale ${sale.isActive ? 'activated' : 'deactivated'} successfully`);
});

/**
 * @desc    Get active sales for display
 * @route   GET /api/sales/active
 * @access  Public
 */
exports.getActiveSales = asyncHandler(async (req, res) => {
  const { limit = 10, type } = req.query;
  const sales = await saleService.getActiveSales({ limit: parseInt(limit), type });
  successResponse(res, { sales }, 'Active sales retrieved successfully');
});

/**
 * @desc    Get sale by product
 * @route   GET /api/sales/product/:productId
 * @access  Public
 */
exports.getSaleByProduct = asyncHandler(async (req, res) => {
  const sale = await saleService.getSaleByProduct(req.params.productId);
  successResponse(res, { sale }, 'Sale retrieved successfully');
});

/**
 * @desc    Apply sale to products
 * @route   POST /api/sales/:id/apply
 * @access  Private/Admin
 */
exports.applySaleToProducts = asyncHandler(async (req, res) => {
  const { productIds } = req.body;
  const result = await saleService.applySaleToProducts(req.params.id, productIds);
  successResponse(res, result, 'Sale applied to products successfully');
});

/**
 * @desc    Remove sale from products
 * @route   POST /api/sales/:id/remove
 * @access  Private/Admin
 */
exports.removeSaleFromProducts = asyncHandler(async (req, res) => {
  await saleService.removeSaleFromProducts(req.params.id);
  successResponse(res, null, 'Sale removed from products successfully');
});

/**
 * @desc    End sale manually
 * @route   PATCH /api/sales/:id/end
 * @access  Private/Admin
 */
exports.endSale = asyncHandler(async (req, res) => {
  const sale = await saleService.endSale(req.params.id);
  successResponse(res, { sale }, 'Sale ended successfully');
});

/**
 * @desc    Increment view count
 * @route   POST /api/sales/:id/view
 * @access  Public
 */
exports.incrementView = asyncHandler(async (req, res) => {
  await saleService.incrementViewCount(req.params.id);
  successResponse(res, null, 'View counted');
});
