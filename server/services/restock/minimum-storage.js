async function persistMinimums(
  tenantId,
  plan,
  Stock = require('../../models/WarehouseStock'),
) {
  const operations = plan.lines
    .filter((l) => l.stockRecordId && l.minimumPolicy?.status === 'active')
    .map((l) => ({
      updateOne: {
        filter: {
          _id: l.stockRecordId,
          tenant: tenantId,
          warehouse: l.warehouseId,
          subProduct: l.subProductId,
          size: l.sizeId,
          ...(l.previousMinimumAt
            ? { 'automaticMinimum.calculatedAt': l.previousMinimumAt }
            : { 'automaticMinimum.calculatedAt': { $exists: false } }),
        },
        update: { $set: { automaticMinimum: l.minimumPolicy } },
        upsert: false,
      },
    }));
  if (operations.length) {
    const result = await Stock.bulkWrite(operations, { ordered: false });
    if (
      Number.isFinite(result?.matchedCount) &&
      result.matchedCount !== operations.length
    )
      throw new (require('../../utils/errors').ConflictError)(
        'Minimum stock levels changed during refresh. Refresh warehouse alerts again.',
      );
  }
}
module.exports = { persistMinimums };
