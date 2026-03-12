// controllers/warehouse.controller.js

const warehouseService = require('../services/warehouse.service');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError, ValidationError } = require('../utils/errors');

/**
 * Helper to resolve tenant ID for super_admin users
 */
const resolveTenantId = (req) => {
  // If user has tenant context, use it
  if (req.tenant?._id) {
    return req.tenant._id;
  }

  // For super_admin without tenant context, require tenantId in query/body
  if (req.user?.role === 'super_admin') {
    const tenantId = req.query.tenantId || req.body.tenantId;
    if (tenantId) {
      return tenantId;
    }
    // Allow super_admin to view all if no tenant specified (for listing endpoints)
    return null;
  }

  throw new ValidationError('Tenant context required');
};

/**
 * @desc    Create a new warehouse
 * @route   POST /api/warehouses
 * @access  Private (tenant_admin, super_admin)
 */
const createWarehouse = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) {
    throw new ValidationError('Tenant ID is required to create a warehouse');
  }

  const warehouse = await warehouseService.createWarehouse(
    req.body,
    req.user._id,
    tenantId
  );

  res.status(201).json({
    success: true,
    message: 'Warehouse created successfully',
    data: warehouse,
  });
});

/**
 * @desc    Get all warehouses for tenant
 * @route   GET /api/warehouses
 * @access  Private (tenant_admin, tenant_staff, tenant_viewer, super_admin)
 */
const getWarehouses = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  
  const options = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 50,
    sortBy: req.query.sortBy || 'createdAt',
    sortOrder: req.query.sortOrder || 'desc',
    locationType: req.query.locationType,
    status: req.query.status,
    isActive: req.query.isActive !== 'false',
    subProductId: req.query.subProductId,
  };

  const result = await warehouseService.getWarehouses(tenantId, options);

  res.status(200).json({
    success: true,
    data: result.warehouses,
    pagination: result.pagination,
  });
});

/**
 * @desc    Get a single warehouse by ID
 * @route   GET /api/warehouses/:id
 * @access  Private (tenant_admin, tenant_staff, tenant_viewer, super_admin)
 */
const getWarehouseById = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) {
    throw new ValidationError('Tenant ID is required');
  }

  const warehouse = await warehouseService.getWarehouseById(
    req.params.id,
    tenantId
  );

  res.status(200).json({
    success: true,
    data: warehouse,
  });
});

/**
 * @desc    Update a warehouse
 * @route   PATCH /api/warehouses/:id
 * @access  Private (tenant_admin, super_admin)
 */
const updateWarehouse = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) {
    throw new ValidationError('Tenant ID is required');
  }

  const warehouse = await warehouseService.updateWarehouse(
    req.params.id,
    req.body,
    tenantId,
    req.user._id
  );

  res.status(200).json({
    success: true,
    message: 'Warehouse updated successfully',
    data: warehouse,
  });
});

/**
 * @desc    Delete a warehouse (soft delete)
 * @route   DELETE /api/warehouses/:id
 * @access  Private (tenant_admin, super_admin)
 */
const deleteWarehouse = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) {
    throw new ValidationError('Tenant ID is required');
  }

  const result = await warehouseService.deleteWarehouse(
    req.params.id,
    tenantId,
    req.user._id
  );

  res.status(200).json(result);
});

/**
 * @desc    Get inventory at a specific warehouse
 * @route   GET /api/warehouses/:id/inventory
 * @access  Private (tenant_admin, tenant_staff, tenant_viewer, super_admin)
 */
const getWarehouseInventory = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) {
    throw new ValidationError('Tenant ID is required');
  }

  const options = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 50,
  };

  const result = await warehouseService.getWarehouseInventory(
    req.params.id,
    tenantId,
    options
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Adjust stock at a warehouse
 * @route   POST /api/warehouses/:id/adjust
 * @access  Private (tenant_admin, super_admin)
 */
const adjustWarehouseStock = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) {
    throw new ValidationError('Tenant ID is required');
  }

  const { quantity, type, notes } = req.body;

  if (!quantity || !type) {
    throw new ValidationError('Quantity and type are required');
  }

  const validTypes = ['received', 'shipped', 'adjusted', 'transferred', 'returned', 'damaged', 'expired'];
  if (!validTypes.includes(type)) {
    throw new ValidationError(`Type must be one of: ${validTypes.join(', ')}`);
  }

  const warehouse = await warehouseService.adjustWarehouseStock(
    req.params.id,
    quantity,
    type,
    tenantId,
    req.user._id,
    notes
  );

  res.status(200).json({
    success: true,
    message: 'Stock adjusted successfully',
    data: warehouse,
  });
});

/**
 * @desc    Get low stock warehouses
 * @route   GET /api/warehouses/low-stock
 * @access  Private (tenant_admin, tenant_staff, super_admin)
 */
const getLowStockWarehouses = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) {
    throw new ValidationError('Tenant ID is required');
  }

  const warehouses = await warehouseService.getLowStockWarehouses(tenantId);

  res.status(200).json({
    success: true,
    data: warehouses,
    count: warehouses.length,
  });
});

/**
 * @desc    Get capacity utilization by location type
 * @route   GET /api/warehouses/capacity-utilization
 * @access  Private (tenant_admin, super_admin)
 */
const getCapacityUtilization = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) {
    throw new ValidationError('Tenant ID is required');
  }

  const utilization = await warehouseService.getCapacityUtilization(tenantId);

  res.status(200).json({
    success: true,
    data: utilization,
  });
});

module.exports = {
  createWarehouse,
  getWarehouses,
  getWarehouseById,
  updateWarehouse,
  deleteWarehouse,
  getWarehouseInventory,
  adjustWarehouseStock,
  getLowStockWarehouses,
  getCapacityUtilization,
};
