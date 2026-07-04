const asyncHandler = require('express-async-handler');
const importSvc = require('../services/subProductImport.service');
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
  const { rows, warehouseId } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: 'rows[] is required' });
  }
  const data = await importSvc.validateImport(rows, { warehouseId }, tenantId, undefined);
  res.json({ success: true, data });
});

exports.commitImport = asyncHandler(async (req, res) => {
  const tenantId = resolveTenant(req, res);
  if (!tenantId) return;
  const { rows, warehouseId } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: 'rows[] is required' });
  }
  const data = await importSvc.commitImport(rows, { warehouseId }, tenantId, req.user, undefined);
  if (['super_admin', 'admin'].includes(req.user?.role)) {
    void logPrivilegedAction(req, 'SUBPRODUCT_IMPORT', 'create', {
      targetType: 'SubProduct', targetTenantId: tenantId,
      justification: `imported ${data.createdSubProducts} subproducts, ${data.createdSizes} sizes`,
    });
  }
  res.json({ success: true, data });
});
