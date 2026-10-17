'use strict';
const asyncHandler = require('../utils/asyncHandler');
const { getTenantId } = require('../utils/tenantContext');
const service = require('../services/product-stock.service');
exports.getProductStock = asyncHandler(async (req, res) => {
  const platform = ['super_admin', 'admin'].includes(req.user.role);
  const tenantId = getTenantId(req, { required: !platform });
  const product = await service.getProductStock(req.params.id, tenantId);
  res.set('Cache-Control', 'private, no-store');
  res.status(200).json({ success: true, data: { product } });
});
