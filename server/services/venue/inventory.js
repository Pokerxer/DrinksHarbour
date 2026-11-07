'use strict';
const Stock = require('../../models/WarehouseStock'); const Effect = require('../../models/VenueStockEffect');
const ConsumptionEvent = require('../../models/VenueConsumptionEvent');
const { recalcSubProductStock } = require('../warehouseStock.helpers'); const { fail } = require('./errors'); const { id } = require('./eligibility');

// Settlement adapter (S2 §5). Lines consumed at fire carry a VenueConsumptionEvent;
// a visit owns exactly one held tab and one bill, so the event set is batch-loaded
// ONCE per bill by session (single query, not per line). `${lineId}:${revision}`
// is the skip predicate — those lines' stock effects already shipped, so
// reserve/consume must handle them: no double consumption. effectKey uniqueness
// on VenueConsumptionEvent is untouched; VenueStockEffect rows simply don't
// exist for fire-consumed lines.
async function consumedAtFireSet({ tenantId, billOrder, mongoSession }) {
  const events = await ConsumptionEvent.find({ tenant: tenantId, session: billOrder.venueServiceSession }).session(mongoSession).lean();
  if (billOrder.venueBillSnapshot?.costMode === 'actual') {
    for (const line of billOrder.venueBillSnapshot.acceptedLines) {
      const matches = events.filter(event => event.lineId === line.lineId && event.revision === line.revision);
      if (!matches.length && (line.servingSnapshot?.mode === 'sealed' || !line.servingSnapshot && !line.frozenRecipeVersion)) {
        const recipe = await require('./recipes').resolveActiveVersion(tenantId,{subProduct:line.subproduct,size:line.size},mongoSession);
        if (!recipe) continue;
      }
      if (!matches.length || matches.some(event => event.physicalCoverage !== 'complete' || !event.costSnapshotId || !event.movementIds?.length) || matches.reduce((sum,event) => sum + (event.fireDelta || 0),0) !== line.quantity) fail('COST_REVIEW_REQUIRED', 'Exact physical coverage required before actual-cost billing');
      for (const event of matches) {
        const evidence = await require('../../models/VenueCostSnapshot').exists({ _id: event.costSnapshotId, tenant: tenantId, sourceEvent: event._id, status: 'verified' }).session(mongoSession);
        const movements = await require('../../models/InventoryMovement').countDocuments({ _id: { $in: event.movementIds }, tenant: tenantId, warehouse: event.location, reference: `physical:${event._id}`, status: 'confirmed' }).session(mongoSession);
        if (!evidence || movements !== event.movementIds.length) fail('COST_REVIEW_REQUIRED', 'Original physical effects are incomplete');
      }
    }
  }
  return new Set(events.map(event => `${event.lineId}:${event.revision}`));
}

async function reserveBillStock({ tenantId, locationId, billOrder, actor, mongoSession }) {
  const consumed = await consumedAtFireSet({ tenantId, billOrder, mongoSession });
  // Skipped lines are filtered BEFORE grouping so a consumed-at-fire line can
  // never corrupt a group's stock totals (a group never becomes a half-reserve).
  const groups = new Map();
  for (const line of billOrder.venueBillSnapshot.acceptedLines) {
    if (consumed.has(`${line.lineId}:${line.revision}`)) continue;
    const key = `${id(line.subproduct)}:${id(line.size)}`;
    const group = groups.get(key) || { subproduct: line.subproduct, size: line.size, quantity: 0, lines: [] };
    group.quantity += line.quantity; group.lines.push(line); groups.set(key, group);
  }
  for (const [, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const row = await Stock.findOneAndUpdate({ tenant: tenantId, warehouse: locationId, subProduct: group.subproduct, size: group.size,
      $expr: { $gte: [{ $subtract: ['$currentQuantity', { $ifNull: ['$reservedQuantity', 0] }] }, group.quantity] } },
    { $inc: { reservedQuantity: group.quantity } }, { session: mongoSession, new: true });
    if (!row) fail('STOCK_UNAVAILABLE', 'Insufficient unreserved stock at this venue');
    for (const line of group.lines) {
      const product = await require('../../models/Product').findOne({ _id: line.product }).session(mongoSession).lean();
      let allocations = [];
      if (product?.tracksBatch !== false || billOrder.venueBillSnapshot.costMode === 'actual') {
        allocations = await require('../batch.service').depleteBatchesFefo({ tenantId, warehouseId: locationId, subProduct: line.subproduct, size: line.size, quantity: line.quantity, order: billOrder.venueBillSnapshot.costMode === 'actual' ? 'fifo' : 'fefo', excludeExpired: true }, mongoSession);
        if (allocations.reduce((sum, a) => sum + a.quantity, 0) !== line.quantity) fail('STOCK_UNAVAILABLE', 'Tracked stock needs complete eligible batch allocations');
      }
      const reservedCost = billOrder.venueBillSnapshot.costMode === 'actual' ? await require('./sealed-cost').sealedCosts({tenantId,locationId,effect:{subproduct:line.subproduct,size:line.size,quantity:line.quantity,batchAllocations:allocations},mongoSession}) : null;
      await Effect.create([{ tenant: tenantId, location: locationId, session: billOrder.venueServiceSession, billOrder: billOrder._id,
        lineId: line.lineId, revision: line.revision, subproduct: line.subproduct, product: line.product, size: line.size, quantity: line.quantity,
        ...(reservedCost ? {costPolicyVersion: reservedCost.policy.version, valuationMethod: reservedCost.valuationMethod} : {}),
        state: 'reserved', batchAllocations: allocations, before: row.currentQuantity, after: row.currentQuantity, operationKey: `reserve:${id(billOrder)}` }], { session: mongoSession });
    }
    await recalcSubProductStock(group.subproduct, mongoSession, tenantId);
  }
}
module.exports = { reserveBillStock };
async function consumeBillStock({ tenantId, billOrder, actor, mongoSession }) {
  const consumed = await consumedAtFireSet({ tenantId, billOrder, mongoSession });
  // Fire-consumed lines carry no effects (they were never reserved); the filter
  // is belt-only for the adapter contract. The review error keeps its meaning:
  // a bill with no owned effects and no fire-time consumption is unreconciled.
  const effects = (await Effect.find({ tenant: tenantId, billOrder: billOrder._id, session: billOrder.venueServiceSession }).sort({ subproduct: 1, size: 1, lineId: 1 }).session(mongoSession))
    .filter(effect => !consumed.has(`${effect.lineId}:${effect.revision}`));
  if (!effects.length && !consumed.size) fail('STOCK_REVIEW_REQUIRED', 'Bill has no owned stock effects');
  for (const effect of effects) {
    if (effect.state === 'consumed') continue;
    if (effect.state !== 'reserved') fail('STOCK_REVIEW_REQUIRED', 'Bill stock was released');
    const matches = billOrder.items.filter(line => line.venueLineId === effect.lineId && line.venueLineRevision === effect.revision);
    const line = matches[0];
    if (matches.length !== 1 || id(line.subproduct) !== id(effect.subproduct) || id(line.size) !== id(effect.size) || line.quantity !== effect.quantity) fail('STOCK_REVIEW_REQUIRED', 'Accepted bill line identity needs reconciliation');
    const stock = await Stock.findOneAndUpdate({ tenant: tenantId, warehouse: effect.location, subProduct: effect.subproduct, size: effect.size, currentQuantity: { $gte: effect.quantity }, reservedQuantity: { $gte: effect.quantity } },
      { $inc: { currentQuantity: -effect.quantity, reservedQuantity: -effect.quantity } }, { session: mongoSession, new: true });
    if (!stock) fail('STOCK_REVIEW_REQUIRED', 'Owned stock reservation needs reconciliation');
    const eventId = new (require('mongoose').Types.ObjectId)(); const movementId = new (require('mongoose').Types.ObjectId)();
    const actualCost = billOrder.venueBillSnapshot.costMode === 'actual' ? await require('./sealed-cost').sealedCosts({tenantId,locationId:id(effect.location),effect,mongoSession,advance:true,movementId}) : null;
    const reference = actualCost ? `physical:${eventId}` : `venue:${id(effect)}`;
    await require('../../models/WarehouseMovement').create([{ tenant: tenantId, warehouse: effect.location, subProduct: effect.subproduct, size: effect.size,
      type: 'shipped', quantity: effect.quantity, balanceBefore: stock.currentQuantity + effect.quantity, balanceAfter: stock.currentQuantity, stockChange: -effect.quantity, reference, performedBy: actor?.userId }], { session: mongoSession });
    await require('../../models/InventoryMovement').create([{ _id: movementId, ...(actualCost ? {totalCost:actualCost.amountMinor/100,unitCost:actualCost.amountMinor/100/effect.quantity}:{}), tenant: tenantId, warehouse: effect.location, subProduct: effect.subproduct, size: effect.size, product: effect.product,
      type: 'shipped', category: 'out', quantity: effect.quantity, quantityBefore: stock.currentQuantity + effect.quantity, quantityAfter: stock.currentQuantity,
      reference, referenceType: 'order', relatedOrder: billOrder._id, source: 'system', status: 'confirmed', performedBy: actor?.userId, performedAt: new Date() }], { session: mongoSession });
    if (actualCost) await require('./sealed-cost').recordSealedCost({tenantId,billOrder,effect,movementId,eventId,actor,mongoSession,cost:actualCost});
    effect.state = 'consumed'; effect.before = stock.currentQuantity + effect.quantity; effect.after = stock.currentQuantity; await effect.save({ session: mongoSession });
    line.batchAllocations = effect.batchAllocations.map(allocation => ({ ...allocation }));
    await recalcSubProductStock(effect.subproduct, mongoSession, tenantId);
  }
}
module.exports.consumeBillStock = consumeBillStock;
module.exports.releaseUnpaidBillStock = (...args) => require('./stock-release').releaseUnpaidBillStock(...args);
