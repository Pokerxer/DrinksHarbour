const asyncHandler = require('express-async-handler');
const salesImportSvc = require('../services/salesImport.service');
const { logPrivilegedAction } = require('../utils/auditLog');

// Platform roles that can operate across tenants (via ?tenant=/x-tenant-slug).
const PLATFORM_ROLES = ['super_admin', 'admin'];

function requireResolvedTenant(tenantId, res) {
  if (!tenantId) {
    res.status(401).json({ success: false, message: 'Tenant not resolved' });
    return false;
  }
  return true;
}

function auditPrivilegedSalesAction(req, action, actionCategory) {
  if (!PLATFORM_ROLES.includes(req.user?.role)) return;
  void logPrivilegedAction(req, action, actionCategory, {
    targetType: 'SalesOrder',
    targetTenantId: req.tenant?._id,
    justification: req.body?.justification,
  });
}

exports.importSalesOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;

  const { csv } = req.body;
  if (!csv) {
    return res.status(400).json({ success: false, message: 'CSV text is required in body.csv' });
  }

  const orders = salesImportSvc.parseSalesCsv(csv);
  if (!orders.length) {
    return res.status(400).json({ success: false, message: 'No valid rows found in CSV' });
  }

  const result = await salesImportSvc.bulkImportSales(orders, tenantId);
  auditPrivilegedSalesAction(req, 'SALES_IMPORT', 'create');

  res.json({ success: true, data: result });
});
