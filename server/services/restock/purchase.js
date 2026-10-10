const { getPlan } = require('./service');
const { id } = require('./series');
const { ConflictError, ValidationError } = require('../../utils/errors');
const { roundOrder } = require('./offers');
async function validateRestockPurchase(tenantId, body, service = getPlan) {
  if (body.restockPlan === undefined) return;
  const reference = body.restockPlan;
  if (
    !reference ||
    ![7, 14, 30].includes(reference.coverDays) ||
    !Array.isArray(reference.lines) ||
    !reference.lines.length ||
    reference.lines.length > 500 ||
    !Array.isArray(body.items) ||
    body.items.length !== reference.lines.length
  )
    throw new ValidationError('Invalid restock plan reference');
  const plan = await service(tenantId, {
    purchasing: true,
    includeSales: true,
    refresh: true,
    coverDays: reference.coverDays,
  });
  const seen = new Set();
  for (let i = 0; i < reference.lines.length; i++) {
    const ref = reference.lines[i];
    if (
      !ref ||
      typeof ref.key !== 'string' ||
      typeof ref.offerId !== 'string' ||
      seen.has(ref.key)
    )
      throw new ValidationError('Invalid restock plan line');
    seen.add(ref.key);
    const line = plan.lines.find((l) => l.key === ref.key),
      offer = line?.alternatives?.find((o) => o.offerId === ref.offerId);
    const matches = line
      ? body.items.filter(
          (item) =>
            item &&
            line.subProductId === id(item.subProductId) &&
            line.sizeId === id(item.sizeId),
        )
      : [];
    if (matches.length !== 1)
      throw new ValidationError(
        'Invalid or duplicate restock purchase item match',
      );
    const item = matches[0];
    const rounded = offer && roundOrder(item.quantity, offer);
    if (
      !line ||
      !offer ||
      line.warehouseId !== id(body.warehouse) ||
      line.subProductId !== id(item.subProductId) ||
      line.sizeId !== id(item.sizeId) ||
      offer.vendorId !== id(body.vendor) ||
      offer.currency !== body.currency ||
      item.unitCost !== offer.unitPrice ||
      item.packagingQty !== offer.packagingQty ||
      !rounded ||
      rounded.quantity !== item.quantity ||
      item.quantity <= 0
    )
      throw new ConflictError(
        'Restock supplier terms or quantities changed. Refresh recommendations and review this purchase again.',
      );
  }
}
module.exports = { validateRestockPurchase };
