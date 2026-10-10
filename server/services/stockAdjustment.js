const mongoose = require('mongoose');
const { createHash } = require('node:crypto');
const { ValidationError, NotFoundError, ConflictError } = require('../utils/errors');
const { computeRollup } = require('./warehouseStock.helpers');
const real = {
  startSession: () => mongoose.startSession(),
  Warehouse: require('../models/Warehouse'),
  SubProduct: require('../models/SubProduct'),
  Size: require('../models/Size'),
  Tenant: require('../models/Tenant'),
  WarehouseStock: require('../models/WarehouseStock'),
  InventoryMovement: require('../models/InventoryMovement'),
  WarehouseBatch: require('../models/WarehouseBatch'),
  adjustStock: (...args) => require('./warehouse.service').adjustStock(...args),
};
async function applyStockAdjustment(d, input, actor, tenant) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new ValidationError('Adjustment details are required');
  const { warehouseId, subProductId, sizeId, targetQuantity, expectedQuantity, requestId } = input;
  for (const id of [warehouseId, subProductId, sizeId, tenant])
    if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))
      throw new ValidationError('Select a valid warehouse, product and size');
  if (
    !Number.isSafeInteger(targetQuantity) ||
    targetQuantity < 0 ||
    !Number.isSafeInteger(expectedQuantity)
  )
    throw new ValidationError(
      'Enter a whole nonnegative counted quantity and a valid current count',
    );
  if (typeof requestId !== 'string' || !/^[\w-]{8,80}$/.test(requestId))
    throw new ValidationError('A valid adjustment request ID is required');
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  const reference = typeof input.reference === 'string' ? input.reference.trim() : '';
  if (!reason || reason.length > 200 || notes.length > 1000 || reference.length > 100)
    throw new ValidationError(
      'A reason is required (maximum 200 characters); notes and reference must be within their limits',
    );
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify([
        warehouseId,
        subProductId,
        sizeId,
        targetQuantity,
        expectedQuantity,
        reason,
        notes,
        reference,
      ]),
    )
    .digest('hex');
  const requestQuery = { tenant, adjustmentRequestId: requestId };
  const reuse = (prior) => {
    if (prior.adjustmentFingerprint !== fingerprint)
      throw new ConflictError('This adjustment request was already used with different details');
    return prior;
  };
  const session = await d.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const prior = await d.InventoryMovement.findOne(requestQuery).session(session).lean();
      if (prior) {
        result = reuse(prior);
        return;
      }
      const warehouse = await d.Warehouse.findOne({ _id: warehouseId, tenant })
        .session(session)
        .lean();
      if (!warehouse || warehouse.isActive === false)
        throw new NotFoundError('Active warehouse not found');
      const sp = await d.SubProduct.findOne({ _id: subProductId, tenant })
        .select('product sizes costPrice lowStockThreshold')
        .populate('product', 'tracksBatch')
        .session(session)
        .lean();
      if (!sp) throw new NotFoundError('Product not found');
      const size = await d.Size.findOne({ _id: sizeId, tenant, subProduct: subProductId })
        .select('costPrice')
        .session(session)
        .lean();
      if (!size || !(sp.sizes || []).some((id) => String(id) === sizeId))
        throw new NotFoundError('Size does not belong to this product');
      const row = await d.WarehouseStock.findOne({
        tenant,
        warehouse: warehouseId,
        subProduct: subProductId,
        size: sizeId,
      })
        .session(session)
        .lean();
      const before = row?.currentQuantity ?? 0;
      if (before !== expectedQuantity)
        throw new ConflictError('Stock has changed. Refresh the current count before adjusting');
      if (targetQuantity === before) throw new ValidationError('That is already the current count');
      if (!Number.isSafeInteger(targetQuantity - before))
        throw new ValidationError('Stock change is too large');
      if (targetQuantity < (row?.reservedQuantity || 0))
        throw new ValidationError(
          'Count cannot be lower than reserved stock; resolve the reservations first',
        );
      const config = await d.Tenant.findOne({ _id: tenant })
        .select('warehouseSettings')
        .session(session)
        .lean();
      const settings = config?.warehouseSettings || {};
      const tracksBatch = settings.batchTrackingEnabled !== false && !!sp.product?.tracksBatch;
      if (tracksBatch && targetQuantity < before) {
        const lots = await d.WarehouseBatch.find({
          tenant,
          warehouse: warehouseId,
          subProduct: subProductId,
          size: sizeId,
          quarantined: true,
          quantity: { $gt: 0 },
        })
          .session(session)
          .lean();
        const protectedUnits =
          lots.reduce((sum, lot) => sum + lot.quantity, 0) + (row?.reservedQuantity || 0);
        if (targetQuantity < protectedUnits)
          throw new ValidationError(
            'Resolve quarantined stock and reservations before lowering this count',
          );
      }
      const costs = [size.costPrice, sp.costPrice].filter(
        (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
      );
      const unitCost = costs.find((v) => v > 0) ?? costs[0];
      if (unitCost !== undefined && !Number.isFinite(unitCost * Math.abs(targetQuantity - before)))
        throw new ValidationError('Correction cost is too large');
      await d.adjustStock(
        {
          warehouseId,
          subProduct: subProductId,
          size: sizeId,
          quantity: targetQuantity,
          type: 'adjusted',
          notes: reference || reason,
          unitCost: unitCost ?? null,
          tracksBatch,
          fefoPicking: settings.fefoPicking,
          recordHistory: false,
          session,
        },
        actor,
        tenant,
      );
      const sizeRows = await d.WarehouseStock.find({
        tenant,
        subProduct: subProductId,
        size: sizeId,
      })
        .select('currentQuantity reservedQuantity')
        .session(session)
        .lean();
      const localTotals = computeRollup(sizeRows);
      await d.Size.updateOne(
        { _id: sizeId, tenant },
        {
          $set: {
            stock: localTotals.totalStock,
            reservedStock: localTotals.reservedStock,
            availableStock: localTotals.availableStock,
            availability: localTotals.availableStock > 0 ? 'in_stock' : 'out_of_stock',
          },
        },
      ).session(session);
      const allRows = await d.WarehouseStock.find({ tenant, subProduct: subProductId })
        .select('currentQuantity reservedQuantity')
        .session(session)
        .lean();
      const totals = computeRollup(allRows);
      await d.SubProduct.updateOne(
        { _id: subProductId, tenant },
        {
          $set: {
            ...totals,
            stockStatus:
              totals.availableStock <= 0
                ? 'out_of_stock'
                : totals.availableStock <= (sp.lowStockThreshold ?? 10)
                  ? 'low_stock'
                  : 'in_stock',
          },
        },
      ).session(session);
      const delta = targetQuantity - before;
      const [movement] = await d.InventoryMovement.create(
        [
          {
            tenant,
            warehouse: warehouseId,
            subProduct: subProductId,
            size: sizeId,
            product: sp.product?._id || sp.product,
            type: delta > 0 ? 'adjustment_in' : 'adjustment_out',
            category: 'adjustment',
            quantity: Math.abs(delta),
            quantityBefore: before,
            quantityAfter: targetQuantity,
            unitCost,
            totalCost: unitCost === undefined ? undefined : unitCost * Math.abs(delta),
            reason,
            notes,
            reference: reference || undefined,
            referenceType: 'adjustment',
            source: 'manual',
            performedBy: actor,
            performedAt: new Date(),
            status: 'confirmed',
            isVerified: true,
            verifiedAt: new Date(),
            adjustmentRequestId: requestId,
            adjustmentFingerprint: fingerprint,
          },
        ],
        { session, ordered: true },
      );
      result = movement;
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const prior = await d.InventoryMovement.findOne(requestQuery).lean();
    if (!prior)
      throw new ConflictError(
        'Another stock update completed. Refresh the current count before adjusting',
      );
    result = reuse(prior);
  } finally {
    await session.endSession();
  }
  return result;
}
module.exports = {
  applyStockAdjustment,
  postStockAdjustment: (input, actor, tenant) => applyStockAdjustment(real, input, actor, tenant),
};
