'use strict';
// Transaction adapter over existing WarehouseStock/Batch/Movement. No independent balance.
const { fail } = require('./errors');
const { id } = require('./eligibility');
const math = require('./cost-math');
const Stock = require('../../models/WarehouseStock');
const Batch = require('../../models/WarehouseBatch');
function baseAmount(stockUnits, contentScaled) {
  const raw = stockUnits * contentScaled;
  const rounded = Math.round(raw);
  if (!Number.isSafeInteger(rounded) || Math.abs(raw - rounded) > 0.000001)
    fail(
      'UNIT_CONVERSION',
      'Stock form is not representable in exact base units',
      400,
    );
  return rounded;
}
function assertSourceValuation(batch, content) {
  const value = batch.venueValuation;
  if (
    !value?.receiptId || !value.reason ||
    !Number.isSafeInteger(value.initialCostMinor) || value.initialCostMinor < 0 ||
    !Number.isSafeInteger(value.initialQuantityScaled) || value.initialQuantityScaled < 1 ||
    value.initialQuantityScaled !== baseAmount(batch.initialQuantity, content)
  ) fail('COST_EVIDENCE_REQUIRED', 'Original receipt cost mapping required', 503);
  const issued = value.issuedQuantityScaled;
  if (!Number.isSafeInteger(issued) || issued < 0 || issued > value.initialQuantityScaled ||
      issued !== value.initialQuantityScaled - baseAmount(batch.quantity, content) ||
      !Number.isSafeInteger(value.issuedCostMinor) || value.issuedCostMinor < 0)
    fail('COST_REVIEW_REQUIRED', 'Lot quantity and original valuation coverage differ');
  const expectedCost = issued === 0 ? 0 : math.allocateSourceCost({
    costMinor: value.initialCostMinor, quantityScaled: value.initialQuantityScaled,
    issuedBeforeScaled: 0, issueScaled: issued,
  });
  if (value.issuedCostMinor !== expectedCost)
    fail('COST_REVIEW_REQUIRED', 'Lot issued cost differs from original receipt');
}
async function mappedSource({
  tenantId,
  locationId,
  component,
  fireDelta,
  mongoSession,
}) {
  const mapping = component.stockMapping;
  const profileId = id(component.profile);
  if (!mapping?.reviewedBy || !mapping.reviewedAt)
    fail(
      'STOCK_MAPPING_REQUIRED',
      'Reviewed ingredient stock form required',
      503,
    );
  // Initial implementation permits current authorized preparation location only.
  if (id(mapping.sourceLocationId) !== locationId)
    fail(
      'STOCK_MAPPING_REQUIRED',
      'Source must be the reviewed service location',
      503,
    );
  math.assertQuantity(mapping.contentQuantity);
  const profile = await require('../../models/IngredientProfile')
    .findOne({
      _id: profileId,
      tenant: tenantId,
      subProduct: mapping.sourceSubProductId,
    })
    .session(mongoSession)
    .lean();
  const sub = await require('../../models/SubProduct')
    .findOne({ _id: mapping.sourceSubProductId, tenant: tenantId })
    .session(mongoSession)
    .lean();
  const size = await require('../../models/Size')
    .findOne({
      _id: mapping.sourceSizeId,
      tenant: tenantId,
      subproduct: mapping.sourceSubProductId,
    })
    .session(mongoSession)
    .lean();
  if (!profile || !sub || !size)
    fail('NOT_FOUND', 'Ingredient stock form not found', 404);
  const amount = math.multiplyQuantity(
    math.quantityFrom(component.quantity, component.unit),
    fireDelta,
  );
  if (
    amount.unit !== mapping.contentQuantity.unit ||
    amount.scale !== mapping.contentQuantity.scale
  )
    fail(
      'UNIT_CONVERSION',
      'Recipe and stock mapping need the same reviewed base unit',
      400,
    );
  return { mapping, amount, sub, profileId };
}
async function issueSource({
  tenantId,
  locationId,
  actor,
  source,
  effectKey,
  mongoSession,
  valuationMethod,
}) {
  const { mapping, amount, sub } = source;
  const content = mapping.contentQuantity.amountScaled;
  const filter = {
    tenant: tenantId,
    warehouse: locationId,
    subProduct: mapping.sourceSubProductId,
    size: mapping.sourceSizeId,
  };
  const stock = await Stock.findOne(filter).session(mongoSession).lean();
  if (
    !stock ||
    baseAmount(stock.currentQuantity - (stock.reservedQuantity || 0), content) <
      amount.amountScaled
  )
    fail('STOCK_UNAVAILABLE', 'Insufficient ingredient stock');
  const batches = await Batch.find({
    ...filter,
    quarantined: { $ne: true },
    $or: [{ expiryDate: null }, { expiryDate: { $gt: new Date() } }],
  })
    .sort({ receivedDate: 1, _id: 1 })
    .session(mongoSession);
  const available = batches.reduce(
    (sum, batch) => sum + baseAmount(batch.quantity, content),
    0,
  );
  if (available < amount.amountScaled)
    fail('STOCK_UNAVAILABLE', 'Complete eligible ingredient lots required');
  // Financial FIFO and physical FEFO remain distinct: initial adapter uses FIFO
  // physical picking, which is a valid supported picking policy; no FEFO assertion.
  if (valuationMethod !== 'fifo')
    fail(
      'COST_POLICY_UNSUPPORTED',
      'Average-valued ingredient pool needs reviewed receipt adapter',
      503,
    );
  const movementId = new (require('mongoose').Types.ObjectId)();
  const allocations = [];
  let left = amount.amountScaled;
  for (const batch of batches) {
    if (!left) break;
    const availableScaled = baseAmount(batch.quantity, content);
    const take = Math.min(left, availableScaled);
    if (!take) continue;
    assertSourceValuation(batch, content);
    const valuation = batch.venueValuation;
    const issuedBefore = valuation.issuedQuantityScaled;
    const cost = math.allocateSourceCost({
      costMinor: valuation.initialCostMinor,
      quantityScaled: valuation.initialQuantityScaled,
      issuedBeforeScaled: issuedBefore,
      issueScaled: take,
    });
    batch.quantity = (availableScaled - take) / content;
    batch.venueValuation.issuedQuantityScaled = issuedBefore + take;
    batch.venueValuation.issuedCostMinor =
      (valuation.issuedCostMinor || 0) + cost;
    await batch.save({ session: mongoSession });
    allocations.push({
      movementId,
      lotId: batch._id,
      receiptId: valuation.receiptId,
      quantity: { ...amount, amountScaled: take },
      allocatedCostMinor: cost,
      valuationMethod,
      sourceTimestamp: batch.receivedDate,
    });
    left -= take;
  }
  const beforeScaled = baseAmount(stock.currentQuantity, content);
  const after = (beforeScaled - amount.amountScaled) / content;
  const result = await Stock.updateOne(
    {
      ...filter,
      currentQuantity: stock.currentQuantity,
      reservedQuantity: stock.reservedQuantity,
    },
    { $set: { currentQuantity: after } },
    { session: mongoSession },
  );
  if (result.modifiedCount !== 1)
    fail('STATE_CHANGED', 'Ingredient stock changed; refresh');
  const totalCost = math.sumMinor(allocations.map((a) => a.allocatedCostMinor));
  const units = amount.amountScaled / content;
  const doc = {
    _id: movementId,
    ...filter,
    product: sub.product,
    type: 'shipped',
    category: 'out',
    quantity: units,
    quantityBefore: stock.currentQuantity,
    quantityAfter: after,
    unitCost: totalCost / 100 / units,
    totalCost: totalCost / 100,
    reference: effectKey,
    referenceType: 'order',
    source: 'system',
    status: 'confirmed',
    performedBy: actor.userId,
    performedAt: new Date(),
  };
  await require('../../models/InventoryMovement').create([doc], {
    session: mongoSession,
  });
  await require('../../models/WarehouseMovement').create(
    [
      {
        ...filter,
        type: 'shipped',
        quantity: units,
        balanceBefore: stock.currentQuantity,
        balanceAfter: after,
        stockChange: -units,
        reference: effectKey,
        performedBy: actor.userId,
      },
    ],
    { session: mongoSession },
  );
  await require('../warehouseStock.helpers').recalcSubProductStock(
    mapping.sourceSubProductId,
    mongoSession,
    tenantId,
  );
  return { movementId, allocations };
}
module.exports = { mappedSource, issueSource, baseAmount, assertSourceValuation };
