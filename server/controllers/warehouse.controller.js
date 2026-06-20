// controllers/warehouse.controller.js
const warehouseService = require('../services/warehouse.service');
const Tenant = require('../models/Tenant');
const SubProduct = require('../models/SubProduct');
const asyncHandler = require('../utils/asyncHandler');
const { ValidationError } = require('../utils/errors');

// Resolve whether a stock mutation on this sub-product should write the batch
// sub-ledger: the tenant master switch (batchTrackingEnabled) AND the product's
// own tracksBatch flag must both be on.
const resolveTracksBatch = async (subProductId, batchTrackingEnabled) => {
  if (!batchTrackingEnabled) return false;
  const sp = await SubProduct.findById(subProductId)
    .select('product')
    .populate('product', 'tracksBatch')
    .lean();
  return !!(sp && sp.product && sp.product.tracksBatch);
};

// Tenant-level warehouse settings with schema defaults applied
const WAREHOUSE_SETTINGS_DEFAULTS = {
  defaultWarehouse: null,
  lowStockThreshold: 10,
  valuationMethod: 'fifo',
  allowNegativeStock: false,
  batchTrackingEnabled: true,
  nearExpiryDays: 30,
  // Replenishment & alerts
  reorderPoint: 0,
  reorderQuantity: 0,
  flagBelowReorderPoint: false,
  outOfStockAlert: true,
  overstockCeiling: 0,
  // Transfers
  requireTransferApproval: false,
  allowInterWarehouseTransfers: true,
  transferApprovalThreshold: 0,
  // Expiry enforcement
  blockExpiredStock: false,
  fefoPicking: false,
  autoQuarantineExpired: false,
};

const getTenantWarehouseSettings = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId)
    .select('warehouseSettings')
    .lean();
  return { ...WAREHOUSE_SETTINGS_DEFAULTS, ...(tenant?.warehouseSettings || {}) };
};

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
  const settings = await getTenantWarehouseSettings(tenantId);
  const data = await warehouseService.getWarehouseStock(req.params.id, tenantId, settings);
  res.json({ success: true, data });
});

const getAllWarehouseStock = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const settings = await getTenantWarehouseSettings(tenantId);
  const data = await warehouseService.getAllStock(tenantId, settings);
  res.json({ success: true, data });
});

const getWarehouseBatches = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const { subProduct, size } = req.query;
  const data = await warehouseService.getBatches(
    { warehouseId: req.params.id, subProduct, size },
    tenantId
  );
  res.json({ success: true, data });
});

const adjustWarehouseStock = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const { subProduct, size, quantity, type, notes } = req.body;
  const settings = await getTenantWarehouseSettings(tenantId);
  const tracksBatch = await resolveTracksBatch(subProduct, settings.batchTrackingEnabled);
  const data = await warehouseService.adjustStock(
    {
      warehouseId: req.params.id, subProduct, size, quantity: Number(quantity), type, notes,
      tracksBatch, allowNegativeStock: settings.allowNegativeStock,
      fefoPicking: settings.fefoPicking,
    },
    req.user._id,
    tenantId
  );
  res.json({ success: true, message: 'Stock adjusted', data });
});

const transferStock = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const { subProduct, size, fromWarehouse, toWarehouse, quantity, notes } = req.body;
  const settings = await getTenantWarehouseSettings(tenantId);
  const tracksBatch = await resolveTracksBatch(subProduct, settings.batchTrackingEnabled);
  const data = await warehouseService.transferStock(
    {
      subProduct, size, fromWarehouse, toWarehouse, quantity: Number(quantity), notes,
      tracksBatch,
      allowInterWarehouseTransfers: settings.allowInterWarehouseTransfers,
      allowNegativeStock: settings.allowNegativeStock,
      fefoPicking: settings.fefoPicking,
    },
    req.user._id,
    tenantId
  );
  res.json({ success: true, message: 'Stock transferred', data });
});

// @desc    Get tenant warehouse settings
// @route   GET /api/warehouses/settings
// @access  Private (Tenant admin)
const getWarehouseSettings = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const warehouseSettings = await getTenantWarehouseSettings(tenantId);
  res.json({ success: true, data: { warehouseSettings } });
});

const isObjectId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

// Declarative validators — a new key only needs one entry here to persist
const WAREHOUSE_SETTING_VALIDATORS = {
  // null/'' clears the default; otherwise must be a valid ObjectId
  defaultWarehouse: (v) => v === null || v === '' || isObjectId(v),
  lowStockThreshold: (v) => typeof v === 'number' && v >= 0,
  valuationMethod: (v) => ['fifo', 'average'].includes(v),
  allowNegativeStock: (v) => typeof v === 'boolean',
  batchTrackingEnabled: (v) => typeof v === 'boolean',
  nearExpiryDays: (v) => typeof v === 'number' && v >= 0 && v <= 365,
  // Replenishment & alerts
  reorderPoint: (v) => typeof v === 'number' && v >= 0,
  reorderQuantity: (v) => typeof v === 'number' && v >= 0,
  flagBelowReorderPoint: (v) => typeof v === 'boolean',
  outOfStockAlert: (v) => typeof v === 'boolean',
  overstockCeiling: (v) => typeof v === 'number' && v >= 0,
  // Transfers
  requireTransferApproval: (v) => typeof v === 'boolean',
  allowInterWarehouseTransfers: (v) => typeof v === 'boolean',
  transferApprovalThreshold: (v) => typeof v === 'number' && v >= 0,
  // Expiry enforcement
  blockExpiredStock: (v) => typeof v === 'boolean',
  fefoPicking: (v) => typeof v === 'boolean',
  autoQuarantineExpired: (v) => typeof v === 'boolean',
};

// @desc    Update tenant warehouse settings
// @route   PATCH /api/warehouses/settings
// @access  Private (Tenant admin)
const updateWarehouseSettings = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const { warehouseSettings = {} } = req.body;

  const updates = {};
  Object.entries(WAREHOUSE_SETTING_VALIDATORS).forEach(([key, isValid]) => {
    if (key in warehouseSettings && isValid(warehouseSettings[key])) {
      const val = warehouseSettings[key];
      updates[`warehouseSettings.${key}`] =
        key === 'defaultWarehouse' && val === '' ? null : val;
    }
  });

  if (Object.keys(updates).length === 0) {
    throw new ValidationError('No valid warehouse settings provided');
  }

  await Tenant.findByIdAndUpdate(tenantId, { $set: updates });
  const saved = await getTenantWarehouseSettings(tenantId);
  res.json({ success: true, data: { warehouseSettings: saved } });
});

module.exports = {
  createWarehouse, getWarehouses, getWarehouseById, updateWarehouse, deleteWarehouse,
  getWarehouseStock, getAllWarehouseStock, getWarehouseBatches, adjustWarehouseStock, transferStock,
  getWarehouseSettings, updateWarehouseSettings, getTenantWarehouseSettings,
};
