// controllers/inventory.controller.js

const asyncHandler = require('express-async-handler');
const inventoryService = require('../services/inventory.service');
const SubProduct = require('../models/SubProduct');
const { ForbiddenError, ValidationError } = require('../utils/errors');

/**
 * Helper to get tenant ID - for super_admin, resolve from SubProduct if no tenant context
 */
const resolveTenantId = async (req, subProductId = null) => {
  // First check if tenant is already attached (from attachTenant middleware)
  if (req.tenant?._id) {
    console.log('📍 Using req.tenant._id:', req.tenant._id);
    return req.tenant._id;
  }
  
  // If user has a tenant directly attached, use that
  if (req.user?.tenant) {
    const userTenant = req.user.tenant;
    const tenantId = typeof userTenant === 'object' && userTenant._id ? userTenant._id : userTenant;
    console.log('📍 Using req.user.tenant:', tenantId);
    return tenantId;
  }
  
  // For super_admin without tenant context, get tenant from SubProduct
  if (req.user?.role === 'super_admin' && subProductId) {
    const subProduct = await SubProduct.findById(subProductId).select('tenant').lean();
    if (!subProduct) {
      throw new ValidationError('SubProduct not found');
    }
    console.log('📍 Using SubProduct.tenant:', subProduct.tenant);
    return subProduct.tenant;
  }
  
  console.error('❌ Cannot resolve tenant. req.user:', req.user ? { _id: req.user._id, role: req.user.role, tenant: req.user.tenant } : 'undefined', 'req.tenant:', req.tenant);
  throw new ForbiddenError('Tenant context required');
};

// @desc    Create inventory movement
// @route   POST /api/inventory/movements
// @access  Private (Tenant admin or Super admin)
const createMovement = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req, req.body.subProductId);
  
  const movement = await inventoryService.createMovement(
    req.body,
    req.user._id,
    tenantId
  );

  res.status(201).json({
    success: true,
    data: movement,
  });
});

// @desc    Get inventory movements
// @route   GET /api/inventory/movements
// @access  Private (Tenant admin or Super admin)
const getMovements = asyncHandler(async (req, res) => {
  const { subProductId, type, category, startDate, endDate, page, limit, sortBy, sortOrder } = req.query;

  const tenantId = await resolveTenantId(req, subProductId);
  
  const result = await inventoryService.getMovements(tenantId, {
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
// @access  Private (Tenant admin or Super admin)
const getInventorySummary = asyncHandler(async (req, res) => {
  const { subProductId } = req.params;

  const tenantId = await resolveTenantId(req, subProductId);
  
  const summary = await inventoryService.getInventorySummary(tenantId, subProductId);

  res.status(200).json({
    success: true,
    data: summary,
  });
});

// @desc    Adjust inventory
// @route   POST /api/inventory/adjust
// @access  Private (Tenant admin or Super admin)
const adjustInventory = asyncHandler(async (req, res) => {
  console.log('📥 POST /api/inventory/adjust - Body:', JSON.stringify(req.body, null, 2));
  console.log('👤 User:', req.user?._id, 'tenant:', req.user?.tenant);
  console.log('🏢 req.tenant:', req.tenant);
  
  const { subProductId, adjustment, reason, notes, reference } = req.body;

  if (adjustment === 0) {
    res.status(400).json({
      success: false,
      message: 'Adjustment cannot be zero',
    });
    return;
  }

  const tenantId = await resolveTenantId(req, subProductId);
  console.log('✅ Resolved tenantId for adjust:', tenantId);
  
  const movement = await inventoryService.adjustInventory(
    subProductId,
    tenantId,
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
// @access  Private (Tenant admin or Super admin)
const recordReceived = asyncHandler(async (req, res) => {
  console.log('📥 POST /api/inventory/received - Body:', JSON.stringify(req.body, null, 2));
  console.log('👤 User:', req.user?._id, 'tenant:', req.user?.tenant);
  console.log('🏢 req.tenant:', req.tenant);
  
  const { subProductId, quantity, unitCost, reference, supplierId, supplierName, batchNumber, lotNumber, expirationDate, notes, reason } = req.body;

  const tenantId = await resolveTenantId(req, subProductId);
  console.log('✅ Resolved tenantId:', tenantId);
  
  const movement = await inventoryService.recordReceived(
    subProductId,
    tenantId,
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
      reason,
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
// @access  Private (Tenant admin or Super admin)
const recordReturn = asyncHandler(async (req, res) => {
  const { subProductId, quantity, reason, notes, reference, orderId } = req.body;

  const tenantId = await resolveTenantId(req, subProductId);
  
  const movement = await inventoryService.recordReturn(
    subProductId,
    tenantId,
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
// @access  Private (Tenant admin or Super admin)
const cancelMovement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  // For cancel, we need to get the SubProduct from the movement
  const tenantId = req.tenant?._id || (req.user?.role === 'super_admin' ? null : null);
  
  const movement = await inventoryService.cancelMovement(
    id,
    tenantId,
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
// @access  Private (Tenant admin or Super admin)
const getLowStockItems = asyncHandler(async (req, res) => {
  // For low-stock report, tenant context is required (can't list all tenants' low stock)
  if (!req.tenant?._id) {
    throw new ForbiddenError('Tenant context required for low stock report');
  }
  
  const items = await inventoryService.getLowStockItems(req.tenant._id);

  res.status(200).json({
    success: true,
    data: items,
    count: items.length,
  });
});

// @desc    Get inventory valuation
// @route   GET /api/inventory/valuation
// @access  Private (Tenant admin or Super admin)
const getInventoryValuation = asyncHandler(async (req, res) => {
  // For valuation report, tenant context is required
  if (!req.tenant?._id) {
    throw new ForbiddenError('Tenant context required for inventory valuation');
  }
  
  const valuation = await inventoryService.getInventoryValuation(req.tenant._id);

  res.status(200).json({
    success: true,
    data: valuation,
  });
});

// @desc    Get next PO number
// @route   GET /api/inventory/next-po
// @access  Private (Tenant admin)
const getNextPONumber = asyncHandler(async (req, res) => {
  if (!req.tenant?._id) {
    throw new ForbiddenError('Tenant context required to get next PO number');
  }
  
  const poNumber = await inventoryService.getNextPONumber(req.tenant._id);

  res.status(200).json({
    success: true,
    data: { poNumber },
  });
});

// @desc    Transfer stock between warehouses
// @route   POST /api/inventory/transfer
// @access  Private (Tenant admin or Super admin)
const transferStock = asyncHandler(async (req, res) => {
  const { subProductId, sourceWarehouseId, destinationWarehouseId, quantity, notes, reference } = req.body;

  const tenantId = await resolveTenantId(req, subProductId);
  
  const result = await inventoryService.transferStock(
    {
      subProductId,
      sourceWarehouseId,
      destinationWarehouseId,
      quantity,
      notes,
      reference,
    },
    req.user._id,
    tenantId
  );

  res.status(201).json({
    success: true,
    message: 'Transfer completed successfully',
    data: result,
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
  getNextPONumber,
  transferStock,
};
