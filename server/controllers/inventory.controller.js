// controllers/inventory.controller.js

const asyncHandler = require('express-async-handler');
const inventoryService = require('../services/inventory.service');

// @desc    Create inventory movement
// @route   POST /api/inventory/movements
// @access  Private (Tenant admin)
const createMovement = asyncHandler(async (req, res) => {
  const movement = await inventoryService.createMovement(
    req.body,
    req.user._id,
    req.tenant._id
  );

  res.status(201).json({
    success: true,
    data: movement,
  });
});

// @desc    Get inventory movements
// @route   GET /api/inventory/movements
// @access  Private (Tenant admin)
const getMovements = asyncHandler(async (req, res) => {
  const { subProductId, type, category, startDate, endDate, page, limit, sortBy, sortOrder } = req.query;

  const result = await inventoryService.getMovements(req.tenant._id, {
    subProductId,
    type,
    category,
    startDate,
    endDate,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 50,
    sortBy: sortBy || 'createdAt',
    sortOrder,
  });

  res.status(200).json({
    success: true,
    ...result,
  });
});

// @desc    Get inventory summary for a subproduct
// @route   GET /api/inventory/summary/:subProductId
// @access  Private (Tenant admin)
const getInventorySummary = asyncHandler(async (req, res) => {
  const { subProductId } = req.params;

  const summary = await inventoryService.getInventorySummary(req.tenant._id, subProductId);

  res.status(200).json({
    success: true,
    data: summary,
  });
});

// @desc    Adjust inventory
// @route   POST /api/inventory/adjust
// @access  Private (Tenant admin)
const adjustInventory = asyncHandler(async (req, res) => {
  const { subProductId, adjustment, reason, notes, reference } = req.body;

  if (adjustment === 0) {
    res.status(400).json({
      success: false,
      message: 'Adjustment cannot be zero',
    });
    return;
  }

  const movement = await inventoryService.adjustInventory(
    subProductId,
    req.tenant._id,
    adjustment,
    reason,
    req.user._id,
    notes,
    reference
  );

  res.status(201).json({
    success: true,
    data: movement,
  });
});

// @desc    Record received goods
// @route   POST /api/inventory/received
// @access  Private (Tenant admin)
const recordReceived = asyncHandler(async (req, res) => {
  const { subProductId, quantity, unitCost, reference, supplierId, supplierName, batchNumber, lotNumber, expirationDate, notes } = req.body;

  const movement = await inventoryService.recordReceived(
    subProductId,
    req.tenant._id,
    {
      quantity,
      unitCost,
      reference,
      supplierId,
      supplierName,
      batchNumber,
      lotNumber,
      expirationDate,
      notes,
    },
    req.user._id
  );

  res.status(201).json({
    success: true,
    data: movement,
  });
});

// @desc    Record return
// @route   POST /api/inventory/return
// @access  Private (Tenant admin)
const recordReturn = asyncHandler(async (req, res) => {
  const { subProductId, quantity, reason, notes, reference, orderId } = req.body;

  const movement = await inventoryService.recordReturn(
    subProductId,
    req.tenant._id,
    {
      quantity,
      reason,
      notes,
      reference,
      relatedOrder: orderId,
    },
    req.user._id
  );

  res.status(201).json({
    success: true,
    data: movement,
  });
});

// @desc    Cancel a movement
// @route   POST /api/inventory/movements/:id/cancel
// @access  Private (Tenant admin)
const cancelMovement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const movement = await inventoryService.cancelMovement(
    id,
    req.tenant._id,
    req.user._id,
    reason
  );

  res.status(200).json({
    success: true,
    data: movement,
  });
});

// @desc    Get low stock items
// @route   GET /api/inventory/low-stock
// @access  Private (Tenant admin)
const getLowStockItems = asyncHandler(async (req, res) => {
  const items = await inventoryService.getLowStockItems(req.tenant._id);

  res.status(200).json({
    success: true,
    data: items,
    count: items.length,
  });
});

// @desc    Get inventory valuation
// @route   GET /api/inventory/valuation
// @access  Private (Tenant admin)
const getInventoryValuation = asyncHandler(async (req, res) => {
  const valuation = await inventoryService.getInventoryValuation(req.tenant._id);

  res.status(200).json({
    success: true,
    data: valuation,
  });
});

module.exports = {
  createMovement,
  getMovements,
  getInventorySummary,
  adjustInventory,
  recordReceived,
  recordReturn,
  cancelMovement,
  getLowStockItems,
  getInventoryValuation,
};
