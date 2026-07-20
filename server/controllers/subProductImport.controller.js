const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const importSvc = require('../services/subProductImport.service');
const Warehouse = require('../models/Warehouse');
const { logPrivilegedAction } = require('../utils/auditLog');

function resolveTenant(req, res) {
  const tenantId = req.tenant?._id || req.user?.tenant;
  if (!tenantId) {
    res.status(401).json({ success: false, message: 'Tenant not resolved' });
    return null;
  }
  return tenantId;
}

exports.previewImport = asyncHandler(async (req, res) => {
  const tenantId = resolveTenant(req, res);
  if (!tenantId) return;
  const { rows, warehouseId, mode } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: 'rows[] is required' });
  }
  if (warehouseId) {
    if (!mongoose.isValidObjectId(warehouseId) ||
        !(await Warehouse.exists({ _id: warehouseId, tenant: tenantId }))) {
      return res.status(400).json({ success: false, message: 'Selected warehouse not found for this tenant' });
    }
  }
  const data = await importSvc.validateImport(rows, { warehouseId, mode }, tenantId, undefined);
  res.json({ success: true, data });
});

exports.commitImport = asyncHandler(async (req, res) => {
  const tenantId = resolveTenant(req, res);
  if (!tenantId) return;
  const { rows, warehouseId, enrichments, mode } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: 'rows[] is required' });
  }
  if (warehouseId) {
    if (!mongoose.isValidObjectId(warehouseId) ||
        !(await Warehouse.exists({ _id: warehouseId, tenant: tenantId }))) {
      return res.status(400).json({ success: false, message: 'Selected warehouse not found for this tenant' });
    }
  }
  const data = await importSvc.commitImport(rows, { warehouseId, enrichments, mode }, tenantId, req.user, undefined);
  if (['super_admin', 'admin'].includes(req.user?.role)) {
    void logPrivilegedAction(req, mode === 'update' ? 'SUBPRODUCT_IMPORT_UPDATE' : 'SUBPRODUCT_IMPORT', 'update', {
      targetType: 'SubProduct', targetTenantId: tenantId,
      justification: mode === 'update'
        ? `updated ${data.updatedSizes} sizes, ${data.stockUpdated} stock lines`
        : `imported ${data.createdSubProducts} subproducts, ${data.createdSizes} sizes`,
    });
  }
  res.json({ success: true, data });
});
