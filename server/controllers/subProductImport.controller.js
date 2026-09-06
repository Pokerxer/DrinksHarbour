const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const importSvc = require('../services/subProductImport.service');
const Warehouse = require('../models/Warehouse');
const { logPrivilegedAction } = require('../utils/auditLog');
const { skuBudgetFor } = require('../middleware/plan.middleware');

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
  // The SKU limit, enforced HERE rather than by a middleware. This was the
  // third and largest unguarded creation door — a CSV import could take any
  // tenant to any number of SKUs regardless of plan.
  //
  // It cannot be a route gate: the number of rows is known but the number of
  // NEW SubProducts is not, because a row matching an existing one is an update.
  // Refusing the whole request on `rows.length` would reject a 500-row file that
  // only creates ten. So the budget is spent as the import goes and what it
  // could not create is reported back (`skippedOverLimit`) rather than dropped
  // in silence. `null` = unlimited plan; platform staff have no req.tenant and
  // so get null too.
  // `req.tenant ?? tenantId` for the same reason resolveTenant falls back:
  // req.tenant can be unset while req.user.tenant is not, and a budget of
  // "unlimited" is the wrong answer to "I could not resolve the plan".
  const skuBudget = await skuBudgetFor(req.tenant ?? tenantId);

  const data = await importSvc.commitImport(rows, { warehouseId, enrichments, mode, skuBudget }, tenantId, req.user, undefined);
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
