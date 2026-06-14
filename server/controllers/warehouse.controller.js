// controllers/warehouse.controller.js
const warehouseService = require('../services/warehouse.service');
const asyncHandler = require('../utils/asyncHandler');
const { ValidationError } = require('../utils/errors');

const resolveTenantId = (req) => {
  if (req.tenant?._id) return req.tenant._id;
  if (req.user?.role === 'super_admin') {
    const tenantId = req.query.tenantId || req.body.tenantId;
    if (tenantId) return tenantId;
    return null;
  }
  throw new ValidationError('Tenant context required');
};

const requireTenant = (req) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) throw new ValidationError('Tenant ID is required');
  return tenantId;
};

const createWarehouse = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const data = await warehouseService.createWarehouse(req.body, req.user._id, tenantId);
  res.status(201).json({ success: true, message: 'Warehouse created', data });
});

const getWarehouses = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  const filters = {};
  if (req.query.isActive !== undefined) filters.isActive = req.query.isActive === 'true';
  if (req.query.type) filters.type = req.query.type;
  const data = await warehouseService.getWarehouses(tenantId, filters);
  res.json({ success: true, data });
});

const getWarehouseById = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const data = await warehouseService.getWarehouseById(req.params.id, tenantId);
  res.json({ success: true, data });
});

const updateWarehouse = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const data = await warehouseService.updateWarehouse(req.params.id, req.body, tenantId);
  res.json({ success: true, message: 'Warehouse updated', data });
});

const deleteWarehouse = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  await warehouseService.deleteWarehouse(req.params.id, tenantId);
  res.json({ success: true, message: 'Warehouse deleted' });
});

const getWarehouseStock = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const data = await warehouseService.getWarehouseStock(req.params.id, tenantId);
  res.json({ success: true, data });
});

const adjustWarehouseStock = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const { subProduct, size, quantity, type, notes } = req.body;
  const data = await warehouseService.adjustStock(
    { warehouseId: req.params.id, subProduct, size, quantity: Number(quantity), type, notes },
    req.user._id,
    tenantId
  );
  res.json({ success: true, message: 'Stock adjusted', data });
});

const transferStock = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const { subProduct, size, fromWarehouse, toWarehouse, quantity, notes } = req.body;
  const data = await warehouseService.transferStock(
    { subProduct, size, fromWarehouse, toWarehouse, quantity: Number(quantity), notes },
    req.user._id,
    tenantId
  );
  res.json({ success: true, message: 'Stock transferred', data });
});

module.exports = {
  createWarehouse, getWarehouses, getWarehouseById, updateWarehouse, deleteWarehouse,
  getWarehouseStock, adjustWarehouseStock, transferStock,
};
