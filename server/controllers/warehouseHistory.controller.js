const asyncHandler = require('../utils/asyncHandler');
const { getTenantId } = require('../utils/tenantContext');
const { getWarehouseHistory } = require('../services/warehouseHistory.service');
module.exports = asyncHandler(async (req, res) => {
  const data = await getWarehouseHistory(getTenantId(req), req.params.id, {
    kind: req.query.kind,
    page: req.query.page,
    limit: req.query.limit,
    product: req.query.product,
    status: req.query.status,
    search: req.query.search,
    start: req.query.start,
    end: req.query.end,
  });
  res.json({ success: true, data });
});
