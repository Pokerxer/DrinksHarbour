const asyncHandler = require('../utils/asyncHandler');
const { getTenantId } = require('../utils/tenantContext');
const { getWarehouseHistoryProducts } = require('../services/warehouseHistory.products');
module.exports = asyncHandler(async (req, res) => {
  const products = await getWarehouseHistoryProducts(getTenantId(req), req.params.id);
  res.json({ success: true, data: products });
});
