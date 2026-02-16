// controllers/subproduct.controller.js

const asyncHandler = require('../utils/asyncHandler');
const subProductService = require('../services/subproduct.service');
const { ValidationError } = require('../utils/errors');
const Tenant = require('../models/Tenant');

/**
 * @desc    Get tenant's SubProducts
 * @route   GET /api/subproducts
 * @access  Private (Tenant admin)
 */
const getMySubProducts = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;
  const {
    page = 1,
    limit = 20,
    status,
    search,
    sort = 'createdAt',
    order = 'desc',
  } = req.query;

  const result = await subProductService.getMySubProducts(tenantId, {
    page: parseInt(page),
    limit: parseInt(limit),
    status,
    search,
    sort,
    order,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Create SubProduct
 * @route   POST /api/subproducts
 * @access  Private (Tenant admin)
 */
const createSubProduct = asyncHandler(async (req, res) => {
  // Get tenantId - either from req.tenant (for tenant admins) or from body (for superadmins)
  let tenantId = req.tenant?._id;
  
  // If no tenant in req, try to get from body
  if (!tenantId) {
    tenantId = req.body.tenant || req.body.subProductData?.tenant;
  }
  
  // If still no tenant, throw error (service will handle super_admin system tenant)
  if (!tenantId) {
    throw new ValidationError('Tenant ID is required. Please provide a tenant ID.');
  }
  
  const user = req.user;

  console.log('=== BACKEND RECEIVED ===');
  console.log('tenantId:', tenantId);
  console.log('user role:', user?.role);
  console.log('Body keys:', Object.keys(req.body));
  console.log('subProductData:', req.body.subProductData);

  const subProduct = await subProductService.createSubProduct(
    req.body,
    tenantId,
    user
  );

  res.status(201).json({
    success: true,
    message: 'Product added to your catalog successfully',
    data: { subProduct },
  });
});

/**
 * @desc    Get single SubProduct
 * @route   GET /api/subproducts/:id
 * @access  Private (Tenant admin)
 */
const getSubProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenant._id;

  const subProduct = await subProductService.getSubProduct(id, tenantId);

  res.status(200).json({
    success: true,
    data: { subProduct },
  });
});

/**
 * @desc    Update SubProduct
 * @route   PATCH /api/subproducts/:id
 * @access  Private (Tenant admin)
 */
const updateSubProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenant._id;
  const user = req.user;

  const subProduct = await subProductService.updateSubProduct(
    id,
    req.body,
    tenantId,
    user
  );

  res.status(200).json({
    success: true,
    message: 'Product updated successfully',
    data: { subProduct },
  });
});

/**
 * @desc    Delete SubProduct
 * @route   DELETE /api/subproducts/:id
 * @access  Private (Tenant admin)
 */
const deleteSubProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenant._id;

  await subProductService.deleteSubProduct(id, tenantId);

  res.status(200).json({
    success: true,
    message: 'Product removed from your catalog successfully',
  });
});

/**
 * @desc    Bulk update stock levels
 * @route   PATCH /api/subproducts/stock/bulk
 * @access  Private (Tenant admin)
 */
const updateStockBulk = asyncHandler(async (req, res) => {
  const { updates } = req.body;
  const tenantId = req.tenant._id;

  if (!Array.isArray(updates) || updates.length === 0) {
    throw new ValidationError('Updates array is required');
  }

  const result = await subProductService.updateStockBulk(updates, tenantId);

  res.status(200).json({
    success: true,
    message: `Stock updated: ${result.success} succeeded, ${result.failed} failed`,
    data: result,
  });
});

/**
 * @desc    Bulk create SubProducts
 * @route   POST /api/subproducts/bulk
 * @access  Private (Tenant Admin, Super Admin)
 */
const bulkCreate = asyncHandler(async (req, res) => {
  const { productIds, tenantId } = req.body;

  const results = await subProductService.bulkCreateSubProducts(
    productIds,
    tenantId,
    req.user
  );

  res.status(201).json({
    success: true,
    data: results,
  });
});

/**
 * @desc    Duplicate SubProduct
 * @route   POST /api/subproducts/:id/duplicate
 * @access  Private (Tenant Admin, Super Admin)
 */
const duplicate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.body;

  const result = await subProductService.duplicateSubProduct(id, tenantId);

  res.status(201).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Transfer SubProduct to another tenant
 * @route   POST /api/subproducts/:id/transfer
 * @access  Private (Tenant Admin, Super Admin)
 */
const transfer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newTenantId } = req.body;

  const result = await subProductService.transferSubProduct(
    id,
    newTenantId,
    req.user
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Archive SubProduct
 * @route   PATCH /api/subproducts/:id/archive
 * @access  Private (Tenant Admin, Super Admin)
 */
const archive = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.body;

  const result = await subProductService.archiveSubProduct(id, tenantId);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Restore archived SubProduct
 * @route   PATCH /api/subproducts/:id/restore
 * @access  Private (Tenant Admin, Super Admin)
 */
const restore = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.body;

  const result = await subProductService.restoreSubProduct(id, tenantId);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Update SubProduct pricing
 * @route   PATCH /api/subproducts/:id/pricing
 * @access  Private (Tenant Admin, Super Admin)
 */
const updatePricing = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tenantId, ...pricingData } = req.body;

  const result = await subProductService.updateSubProductPricing(
    id,
    pricingData,
    tenantId
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Calculate effective price
 * @route   GET /api/subproducts/:id/sizes/:sizeId/effective-price
 * @access  Public
 */
const getEffectivePrice = asyncHandler(async (req, res) => {
  const { id, sizeId } = req.params;

  const breakdown = await subProductService.calculateEffectivePrice(id, sizeId);

  res.status(200).json({
    success: true,
    data: breakdown,
  });
});

/**
 * @desc    Apply bulk discount
 * @route   POST /api/subproducts/discount/apply
 * @access  Private (Tenant Admin, Super Admin)
 */
const applyDiscount = asyncHandler(async (req, res) => {
  const { subProductIds, discount, tenantId } = req.body;

  const result = await subProductService.applyBulkDiscount(
    subProductIds,
    discount,
    tenantId
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Remove bulk discount
 * @route   POST /api/subproducts/discount/remove
 * @access  Private (Tenant Admin, Super Admin)
 */
const removeDiscount = asyncHandler(async (req, res) => {
  const { subProductIds, tenantId } = req.body;

  const result = await subProductService.removeBulkDiscount(
    subProductIds,
    tenantId
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get SubProduct price history
 * @route   GET /api/subproducts/:id/price-history
 * @access  Private (Tenant Admin, Super Admin)
 */
const getPriceHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const history = await subProductService.getSubProductPriceHistory(id);

  res.status(200).json({
    success: true,
    data: history,
  });
});


// ============================================================
// CONTROLLERS - controllers/subproduct.controller.js (ADD THESE)
// ============================================================



/**
 * @desc    Get SubProduct inventory
 * @route   GET /api/subproducts/:id/inventory
 * @access  Private (Tenant Admin, Super Admin)
 */
const getInventory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.query;

  const inventory = await subProductService.getSubProductInventory(id, tenantId);

  res.status(200).json({
    success: true,
    data: inventory,
  });
});

/**
 * @desc    Adjust stock for a size
 * @route   POST /api/subproducts/:id/sizes/:sizeId/adjust-stock
 * @access  Private (Tenant Admin, Super Admin)
 */
const adjustStock = asyncHandler(async (req, res) => {
  const { id, sizeId } = req.params;
  const { adjustment, reason } = req.body;

  const result = await subProductService.adjustStock(
    id,
    sizeId,
    adjustment,
    reason,
    req.user
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get stock movements history
 * @route   GET /api/subproducts/:id/stock-movements
 * @access  Private (Tenant Admin, Super Admin)
 */
const getStockMovements = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;

  const movements = await subProductService.getStockMovements(id, {
    startDate,
    endDate,
  });

  res.status(200).json({
    success: true,
    data: movements,
  });
});

/**
 * @desc    Get low stock SubProducts
 * @route   GET /api/subproducts/tenant/:tenantId/low-stock
 * @access  Private (Tenant Admin, Super Admin)
 */
const getLowStock = asyncHandler(async (req, res) => {
  const { tenantId } = req.params;
  const { threshold } = req.query;

  const lowStock = await subProductService.getLowStockSubProducts(
    tenantId,
    threshold ? parseInt(threshold) : 10
  );

  res.status(200).json({
    success: true,
    data: lowStock,
  });
});

/**
 * @desc    Get out of stock SubProducts
 * @route   GET /api/subproducts/tenant/:tenantId/out-of-stock
 * @access  Private (Tenant Admin, Super Admin)
 */
const getOutOfStock = asyncHandler(async (req, res) => {
  const { tenantId } = req.params;

  const outOfStock = await subProductService.getOutOfStockSubProducts(tenantId);

  res.status(200).json({
    success: true,
    data: outOfStock,
  });
});

/**
 * @desc    Set reorder points for sizes
 * @route   POST /api/subproducts/:id/reorder-points
 * @access  Private (Tenant Admin, Super Admin)
 */
const setReorderPoints = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tenantId, ...reorderData } = req.body;

  const result = await subProductService.setReorderPoints(
    id,
    reorderData,
    tenantId
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get SubProduct sales
 * @route   GET /api/subproducts/:id/sales
 * @access  Private (Tenant Admin, Super Admin)
 */
const getSales = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;

  const sales = await subProductService.getSubProductSales(id, {
    startDate,
    endDate,
  });

  res.status(200).json({
    success: true,
    data: sales,
  });
});

/**
 * @desc    Get SubProduct revenue
 * @route   GET /api/subproducts/:id/revenue
 * @access  Private (Tenant Admin, Super Admin)
 */
const getRevenue = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;

  const revenue = await subProductService.getSubProductRevenue(id, {
    startDate,
    endDate,
  });

  res.status(200).json({
    success: true,
    data: revenue,
  });
});

/**
 * @desc    Get top selling SubProducts
 * @route   GET /api/subproducts/tenant/:tenantId/top-selling
 * @access  Private (Tenant Admin, Super Admin)
 */
const getTopSelling = asyncHandler(async (req, res) => {
  const { tenantId } = req.params;
  const { limit, startDate, endDate } = req.query;

  const topSelling = await subProductService.getTopSellingSubProducts(
    tenantId,
    limit ? parseInt(limit) : 10,
    { startDate, endDate }
  );

  res.status(200).json({
    success: true,
    data: topSelling,
  });
});

/**
 * @desc    Get SubProduct conversion rate
 * @route   GET /api/subproducts/:id/conversion-rate
 * @access  Private (Tenant Admin, Super Admin)
 */
const getConversionRate = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const conversion = await subProductService.getSubProductConversionRate(id);

  res.status(200).json({
    success: true,
    data: conversion,
  });
});

/**
 * @desc    Get SubProduct average order value
 * @route   GET /api/subproducts/:id/average-order-value
 * @access  Private (Tenant Admin, Super Admin)
 */
const getAverageOrderValue = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const aov = await subProductService.getSubProductAverageOrderValue(id);

  res.status(200).json({
    success: true,
    data: aov,
  });
});

/**
 * @desc    Get all SubProducts with filters
 * @route   GET /api/subproducts
 * @access  Public
 */
const getAllSubProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    search,
    sort = 'createdAt',
    order = 'desc',
  } = req.query;

  const result = await subProductService.getAllSubProducts({
    page: parseInt(page),
    limit: parseInt(limit),
    status,
    search,
    sort,
    order,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get SubProducts by tenant
 * @route   GET /api/subproducts/tenant/:tenantId
 * @access  Public
 */
const getSubProductsByTenant = asyncHandler(async (req, res) => {
  const { tenantId } = req.params;
  const { page = 1, limit = 20, status } = req.query;

  const result = await subProductService.getSubProductsByTenant(tenantId, {
    page: parseInt(page),
    limit: parseInt(limit),
    status,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get SubProducts by product
 * @route   GET /api/subproducts/product/:productId
 * @access  Public
 */
const getSubProductsByProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const result = await subProductService.getSubProductsByProduct(productId);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get SubProduct by ID
 * @route   GET /api/subproducts/:id
 * @access  Public
 */
const getSubProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const subProduct = await subProductService.getSubProductById(id);

  res.status(200).json({
    success: true,
    data: subProduct,
  });
});

/**
 * @desc    Get SubProduct by SKU
 * @route   GET /api/subproducts/sku/:sku
 * @access  Public
 */
const getSubProductBySKU = asyncHandler(async (req, res) => {
  const { sku } = req.params;

  const subProduct = await subProductService.getSubProductBySKU(sku);

  res.status(200).json({
    success: true,
    data: subProduct,
  });
});

/**
 * @desc    Add size to SubProduct
 * @route   POST /api/subproducts/:id/sizes
 * @access  Private (Tenant Admin, Super Admin)
 */
const addSize = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenant?._id || req.body.tenantId;
  const user = req.user;

  const result = await subProductService.addSize(id, req.body, tenantId, user);

  res.status(201).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Update size
 * @route   PATCH /api/subproducts/:id/sizes/:sizeId
 * @access  Private (Tenant Admin, Super Admin)
 */
const updateSize = asyncHandler(async (req, res) => {
  const { id, sizeId } = req.params;
  const tenantId = req.tenant?._id || req.body.tenantId;
  const user = req.user;

  const result = await subProductService.updateSize(id, sizeId, req.body, tenantId, user);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Delete size
 * @route   DELETE /api/subproducts/:id/sizes/:sizeId
 * @access  Private (Tenant Admin, Super Admin)
 */
const deleteSize = asyncHandler(async (req, res) => {
  const { id, sizeId } = req.params;
  const tenantId = req.tenant?._id || req.body.tenantId;
  const user = req.user;

  await subProductService.deleteSize(id, sizeId, tenantId, user);

  res.status(200).json({
    success: true,
    message: 'Size deleted successfully',
  });
});

/**
 * @desc    Update stock for SubProduct
 * @route   PATCH /api/subproducts/:id/stock
 * @access  Private (Tenant Admin, Super Admin)
 */
const updateStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { stock, sizeId, tenantId: bodyTenantId } = req.body;
  const tenantId = req.tenant?._id || bodyTenantId;
  const user = req.user;

  const result = await subProductService.updateStock(id, { stock, sizeId }, tenantId, user);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get stock status for SubProduct
 * @route   GET /api/subproducts/:id/stock-status
 * @access  Public
 */
const getStockStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const status = await subProductService.getStockStatus(id);

  res.status(200).json({
    success: true,
    data: status,
  });
});

module.exports = {
  getMySubProducts,
  createSubProduct,
  getSubProduct,
  updateSubProduct,
  deleteSubProduct,
  updateStockBulk,
  bulkCreate,
  duplicate,
  transfer,
  archive,
  restore,
  updatePricing,
  getEffectivePrice,
  applyDiscount,
  removeDiscount,
  getPriceHistory,

  // Inventory Management
  getInventory,
  adjustStock,
  getStockMovements,
  getLowStock,
  getOutOfStock,
  setReorderPoints,

  // Sales & Analytics
  getSales,
  getRevenue,
  getTopSelling,
  getConversionRate,
  getAverageOrderValue,

  // Additional routes
  getAllSubProducts,
  getSubProductsByTenant,
  getSubProductsByProduct,
  getSubProductById,
  getSubProductBySKU,
  addSize,
  updateSize,
  deleteSize,
  updateStock,
  getStockStatus,
};