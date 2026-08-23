// controllers/warehouse.controller.js
const warehouseService = require('../services/warehouse.service');
const Tenant = require('../models/Tenant');
const Warehouse = require('../models/Warehouse');
const SubProduct = require('../models/SubProduct');
const User = require('../models/User');
const { logAudit } = require('../utils/auditLog');
const asyncHandler = require('../utils/asyncHandler');
const { ValidationError, NotFoundError } = require('../utils/errors');

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

// Warehouses are tenant-owned. requireOwnTenant has already pinned req.tenant to
// the caller's JWT claim and stripped any tenantId from the query/body, so this
// reads req.tenant and nothing else — the previous super_admin branch trusted
// `req.query.tenantId || req.body.tenantId`, letting a caller name any tenant.
const resolveTenantId = (req) => {
  if (req.tenant?._id) return req.tenant._id;
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
  // The service returns lean rows; managers are resolved here (static populate
  // works on plain objects) so list/detail reads expose who runs each place.
  await Warehouse.populate(data, { path: 'managers', select: 'name email' });
  res.json({ success: true, data });
});

const getWarehouseById = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const data = await warehouseService.getWarehouseById(req.params.id, tenantId);
  await Warehouse.populate(data, { path: 'managers', select: 'name email' });
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

// Movement audit trail for one warehouse, optionally narrowed to a single
// (subProduct, size) line via query params. Limit is clamped in the service.
const getWarehouseMovements = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const { subProduct, size, limit } = req.query;
  const data = await warehouseService.getMovements(
    { warehouseId: req.params.id, subProduct, size, limit },
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

// Validate a proposed manager list against this tenant's own users. Exported
// for unit tests (same pattern as pickValidSettingUpdates): every id must
// resolve to a User of the tenant, otherwise a caller could hand warehouse
// authority (transfer send/receive gating) to an id from another organisation.
async function validateManagerIds(ids, tenantId, User) {
  if (!ids.length) return [];
  const found = await User.find({
    _id: { $in: ids.map(String) },
    tenant: tenantId,
  })
    .select('_id')
    .lean();
  const valid = found.map((u) => String(u._id));
  const missing = ids.map(String).filter((id) => !valid.includes(id));
  if (missing.length) {
    throw new ValidationError(
      'Invalid manager selection: not a user of this tenant'
    );
  }
  return valid;
}

// PATCH /api/warehouses/:id/managers — replace the location's manager list.
// Tenant admins only (route-guarded). Managers gate the two-sided transfer
// flow: source-side actions need a SOURCE manager, receiving needs a
// DESTINATION manager; tenant admins always bypass.
const setWarehouseManagers = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const warehouse = await Warehouse.findOne({
    _id: req.params.id,
    tenant: tenantId,
  });
  if (!warehouse) throw new NotFoundError('Warehouse not found');

  const ids = Array.isArray(req.body.managers) ? req.body.managers : [];
  warehouse.managers = await validateManagerIds(ids, tenantId, User);

  await warehouse.save();
  await warehouse.populate({ path: 'managers', select: 'name email' });
  res.json({
    success: true,
    message: 'Warehouse managers updated',
    data: warehouse,
  });
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

// Declarative validators — a new key only needs one entry here to persist.
// NOTE: these are FORMAT checks only. Cross-field consistency is advised by
// the client's warnings banner; cross-tenant references are rejected in
// updateWarehouseSettings (ownership query).
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

/**
 * Pure step of the settings update: keep only keys that pass their validator
 * and normalise defaultWarehouse '' → null. Exported for unit tests; the DB
 * ownership check for defaultWarehouse stays in the controller.
 */
function pickValidSettingUpdates(warehouseSettings) {
  const updates = {};
  Object.entries(WAREHOUSE_SETTING_VALIDATORS).forEach(([key, isValid]) => {
    if (key in warehouseSettings && isValid(warehouseSettings[key])) {
      const val = warehouseSettings[key];
      updates[`warehouseSettings.${key}`] =
        key === 'defaultWarehouse' && val === '' ? null : val;
    }
  });
  return updates;
}

// @desc    Update tenant warehouse settings
// @route   PATCH /api/warehouses/settings
// @access  Private (Tenant admin)
const updateWarehouseSettings = asyncHandler(async (req, res) => {
  const tenantId = requireTenant(req);
  const { warehouseSettings = {} } = req.body;

  const updates = pickValidSettingUpdates(warehouseSettings);

  if (Object.keys(updates).length === 0) {
    throw new ValidationError('No valid warehouse settings provided');
  }

  // Ownership check: a well-formed ObjectId is not enough — the default
  // warehouse must belong to the caller's tenant, otherwise stock operations
  // could be pointed at another organisation's location.
  const dw = updates['warehouseSettings.defaultWarehouse'];
  if (typeof dw === 'string' && dw !== '') {
    const owned = await Warehouse.findOne({
      _id: dw,
      tenant: tenantId,
    })
      .select('_id')
      .lean();
    if (!owned) {
      throw new ValidationError(
        'Default warehouse must belong to your organisation'
      );
    }
  }

  // Capture before-values for exactly the keys being changed (audit trail).
  const before = await getTenantWarehouseSettings(tenantId);
  const changedKeys = Object.keys(updates).map((k) =>
    k.replace('warehouseSettings.', '')
  );
  const beforeChanged = Object.fromEntries(
    changedKeys.map((k) => [k, before[k]])
  );
  const afterChanged = Object.fromEntries(
    changedKeys.map((k) => [k, updates[`warehouseSettings.${k}`]])
  );

  await Tenant.findByIdAndUpdate(tenantId, { $set: updates });

  // Privileged configuration change → audit trail (fire-and-forget).
  logAudit({
    action: 'WAREHOUSE_SETTINGS_UPDATE',
    actionCategory: 'update',
    targetType: 'Tenant',
    targetId: tenantId,
    targetTenantId: tenantId,
    req,
    changes: { before: beforeChanged, after: afterChanged },
  });

  const saved = await getTenantWarehouseSettings(tenantId);
  res.json({ success: true, data: { warehouseSettings: saved } });
});

module.exports = {
  createWarehouse, getWarehouses, getWarehouseById, updateWarehouse, deleteWarehouse,
  getWarehouseStock, getAllWarehouseStock, getWarehouseBatches, adjustWarehouseStock, transferStock,
  getWarehouseMovements,
  setWarehouseManagers, validateManagerIds,
  getWarehouseSettings, updateWarehouseSettings, getTenantWarehouseSettings,
  pickValidSettingUpdates, WAREHOUSE_SETTING_VALIDATORS,
};
