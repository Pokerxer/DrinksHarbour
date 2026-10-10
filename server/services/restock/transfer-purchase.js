const { getPlan } = require('./service');
const { id } = require('./series');
const { ValidationError, ConflictError } = require('../../utils/errors');
async function validateTransferPreparation(tenantId, body, service = getPlan) {
  if (body.warehouseRecommendation === undefined) return;
  const ref = body.warehouseRecommendation;
  if (
    !ref ||
    typeof ref.key !== 'string' ||
    ![7, 14, 30].includes(ref.coverDays) ||
    !Array.isArray(body.items) ||
    body.items.length !== 1
  )
    throw new ValidationError('Invalid warehouse transfer recommendation');
  const plan = await service(tenantId, {
    includeSales: true,
    refresh: true,
    coverDays: ref.coverDays,
  });
  const line = plan.lines.find((l) => l.key === ref.key),
    source = line?.transferPlan?.sources.find(
      (s) => s.sourceWarehouseId === id(body.sourceWarehouse),
    ),
    item = body.items[0];
  if (
    !line ||
    !source ||
    line.warehouseId !== id(body.destinationWarehouse) ||
    line.subProductId !== id(item.subProductId) ||
    line.sizeId !== id(item.sizeId) ||
    !Number.isSafeInteger(item.quantity) ||
    item.quantity <= 0 ||
    item.quantity > source.recommendedUnits
  )
    throw new ConflictError(
      'Transfer allocation changed. Refresh warehouse recommendations and review the quantity again.',
    );
}
module.exports = { validateTransferPreparation };
