const { ValidationError } = require('../utils/errors');
async function applyWarehouseImportStock(
  d,
  { subProductId, productId, sizeId, qty, warehouseId, tenantId, user, unitCost, mode },
) {
  if (!warehouseId)
    throw new ValidationError('Select a target warehouse for imported quantities, including zero.');
  if (!Number.isFinite(qty) || qty < 0) throw new ValidationError('Invalid imported quantity');
  const session = await d.startSession();
  try {
    await session.withTransaction(async () => {
      await d.adjustStock(
        {
          warehouseId,
          subProduct: subProductId,
          size: sizeId,
          quantity: qty,
          type: mode === 'update' ? 'adjusted' : 'received',
          notes: mode === 'update' ? 'Bulk import stock update' : 'Bulk import opening stock',
          unitCost,
          session,
          auditContext: {
            product: productId,
            referenceType: mode === 'update' ? 'adjustment' : 'manual',
            source: 'sync',
          },
        },
        user?._id,
        tenantId,
      );
      // adjustStock owns WarehouseStock, its audit mirror and SubProduct rollups.
      // Size.stock is a total across locations, never the imported local count.
      const rows = await d.WarehouseStock.find({
        tenant: tenantId,
        subProduct: subProductId,
        size: sizeId,
      })
        .select('currentQuantity reservedQuantity')
        .session(session)
        .lean();
      const stock = rows.reduce((sum, row) => sum + (row.currentQuantity || 0), 0);
      const availableStock = Math.max(
        0,
        stock - rows.reduce((sum, row) => sum + (row.reservedQuantity || 0), 0),
      );
      await d.Size.updateOne(
        { _id: sizeId, tenant: tenantId },
        { $set: { stock, availableStock, availability: stock > 0 ? 'in_stock' : 'out_of_stock' } },
      ).session(session);
    });
  } finally {
    await session.endSession();
  }
}
module.exports = { applyWarehouseImportStock };
