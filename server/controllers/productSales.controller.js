const asyncHandler = require('../utils/asyncHandler');
const { getTenantId } = require('../utils/tenantContext');
const service = require('../services/product-sales.service');
exports.getProductSalesHistory = asyncHandler(async (req, res) => {
  const platform = ['super_admin', 'admin'].includes(req.user.role);
  const tenantId = getTenantId(req, { required: !platform });
  const report = await service.getProductSalesHistory(req.params.id, tenantId);
  res.set('Cache-Control', 'private, no-store');
  res.status(200).json({ success: true, data: { report } });
});
