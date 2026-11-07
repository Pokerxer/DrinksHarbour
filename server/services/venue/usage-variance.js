'use strict';
const { fail, requireId } = require('./errors');
const { loadVenueContext } = require('./context');
const math = require('./cost-math');
function usageBridge(values) {
  const required = [
    'openingMinor',
    'receivedMinor',
    'transfersInMinor',
    'supplierReturnsMinor',
    'transfersOutMinor',
    'closingMinor',
    'theoreticalMinor',
    'knownWasteMinor',
  ];
  if (required.some((key) => values[key] == null))
    return {
      actualUsageMinor: null,
      theoreticalUsageMinor: values.theoreticalMinor ?? null,
      varianceMinor: null,
      knownWasteMinor: values.knownWasteMinor ?? null,
      unexplainedMinor: null,
    };
  required.forEach((key) => math.requireMinor(values[key], { signed: true }));
  const actual = math.sumMinor([
    values.openingMinor,
    values.receivedMinor,
    values.transfersInMinor,
    -values.supplierReturnsMinor,
    -values.transfersOutMinor,
    -values.closingMinor,
  ]);
  const variance = math.sumMinor([actual, -values.theoreticalMinor]);
  return {
    actualUsageMinor: actual,
    theoreticalUsageMinor: values.theoreticalMinor,
    varianceMinor: variance,
    knownWasteMinor: values.knownWasteMinor,
    unexplainedMinor: math.sumMinor([variance, -values.knownWasteMinor]),
  };
}
async function getUsageVariance(args) {
  requireId(args.openingCountId);
  requireId(args.closingCountId);
  await loadVenueContext({ ...args, action: 'profitability.read' });
  const Count = require('../../models/VenueInventoryCount');
  const scope = {
    tenant: args.tenantId,
    location: args.locationId,
    state: 'completed',
  };
  const opening = await Count.findOne({
    ...scope,
    _id: args.openingCountId,
  }).lean();
  const closing = await Count.findOne({
    ...scope,
    _id: args.closingCountId,
  }).lean();
  if (!opening || !closing) fail('NOT_FOUND', 'Completed count not found', 404);
  if (
    opening.scopeHash !== closing.scopeHash ||
    opening.cutoff >= closing.cutoff
  )
    fail(
      'COUNT_SCOPE_MISMATCH',
      'Counts require identical scope and increasing cutoffs',
      400,
    );
  const reasons = [...opening.missingReasons, ...closing.missingReasons];
  const rows = [];
  const asOf = new Date();
  if (
    opening.completeness !== 'complete' ||
    closing.completeness !== 'complete'
  )
    reasons.push('counts_incomplete');
  const Costs = require('../../models/VenueCostSnapshot');
  const movements = await require('../../models/InventoryMovement')
    .find({
      tenant: args.tenantId,
      warehouse: args.locationId,
      status: 'confirmed',
      performedAt: { $gt: opening.cutoff, $lte: closing.cutoff },
    })
    .lean();
  if (movements.some((m) => m.createdAt > closing.completedAt))
    reasons.push('late_movement');
  for (const item of opening.items) {
    const close = closing.items.find(
      (row) =>
        String(row.subProductId) === String(item.subProductId) &&
        String(row.sizeId) === String(item.sizeId),
    );
    const relevant = movements.filter(
      (m) =>
        String(m.subProduct) === String(item.subProductId) &&
        String(m.size) === String(item.sizeId),
    );
    let received = 0,
      inbound = 0,
      outbound = 0,
      returns = 0;
    const itemReasons = [];
    for (const movement of relevant) {
      if (
        ![
          'received',
          'purchase',
          'return',
          'transfer_in',
          'transfer_out',
          'return_out',
        ].includes(movement.type)
      )
        continue;
      const lots = await require('../../models/WarehouseBatch')
        .find({
          tenant: args.tenantId,
          warehouse: args.locationId,
          'venueValuation.receiptId': movement._id,
        })
        .lean();
      if (
        !lots.length ||
        lots.some(
          (lot) =>
            !lot.venueValuation.reason ||
            !Number.isSafeInteger(lot.venueValuation.initialCostMinor),
        )
      ) {
        itemReasons.push('movement_valuation_unknown');
        continue;
      }
      let receiptKnown = lots.reduce((sum,lot)=>sum+lot.initialQuantity,0) === movement.quantity;
      for(const lot of lots){
        try { await require('./source-receipt').originalReceipt({tenantId:args.tenantId,locationId:args.locationId,lot}); }
        catch(error){ if(['COST_EVIDENCE_REQUIRED','INVALID_CURRENCY'].includes(error.code)) receiptKnown=false; else throw error; }
      }
      if(!receiptKnown){itemReasons.push('movement_valuation_unknown');continue;}
      const amount = math.sumMinor(lots.map((lot) => lot.venueValuation.initialCostMinor));
      if(movement.reference?.startsWith('production-complete:')) {
        const job = await require('../../models/VenueProductionBatch').exists({tenant:args.tenantId,location:args.locationId,state:'completed',outputBatchId:{$in:lots.map(lot=>lot._id)},outputCostMinor:amount});
        if(!job){itemReasons.push('production_transform_bridge_missing');continue;}
        inbound=math.sumMinor([inbound,amount]);continue;
      }
      if (['received', 'purchase', 'return'].includes(movement.type))
        received = math.sumMinor([received, amount]);
      if (movement.type === 'transfer_in')
        inbound = math.sumMinor([inbound, amount]);
      if (movement.type === 'transfer_out')
        outbound = math.sumMinor([outbound, amount]);
      if (movement.type === 'return_out')
        returns = math.sumMinor([returns, amount]);
    }
    const costRows = await Costs.find({
      tenant: args.tenantId,
      location: args.locationId,
      recordedAt: { $gt: opening.cutoff, $lte: closing.cutoff },
      'sourceAllocations.movementId': { $in: relevant.map((m) => m._id) },
    }).lean();
    let theoretical = 0,
      waste = 0;
    for (const cost of costRows) {
      if (cost.status !== 'verified' || cost.amountMinor == null) {
        itemReasons.push('physical_cost_unknown');
        continue;
      }
      const amount = math.sumMinor(
        cost.sourceAllocations
          .filter((a) =>
            relevant.some((m) => String(m._id) === String(a.movementId)),
          )
          .map((a) => a.allocatedCostMinor),
      );
      if(cost.sourceKind === 'production_output') {
        const job=await require('../../models/VenueProductionBatch').exists({_id:cost.sourceEvent,tenant:args.tenantId,location:args.locationId,state:'completed',costSnapshotId:cost._id,sourceCostMinor:cost.amountMinor,outputCostMinor:cost.amountMinor});
        if(!job){itemReasons.push('production_transform_bridge_missing');continue;}
        outbound=math.sumMinor([outbound,amount]);
      }
      else if (cost.sourceKind === 'waste') waste = math.sumMinor([waste, amount]);
      else if (
        ['recipe_issue', 'pour', 'sealed_issue'].includes(cost.sourceKind)
      )
        theoretical = math.sumMinor([theoretical, amount]);
    }
    for(const movement of relevant){
      if(['shipped','sold','damaged','expired','theft','written_off'].includes(movement.type) && !costRows.some(cost=>cost.sourceAllocations.some(allocation=>String(allocation.movementId)===String(movement._id)))) itemReasons.push('physical_cost_unknown');
      if(['adjustment_in','adjustment_out'].includes(movement.type)) itemReasons.push('adjustment_bridge_missing');
    }
    if (itemReasons.length) reasons.push(...itemReasons);
    rows.push({
      subProductId: String(item.subProductId),
      sizeId: String(item.sizeId),
      ...usageBridge({
        openingMinor: item.valueMinor,
        closingMinor: close?.valueMinor ?? null,
        receivedMinor: itemReasons.length ? null : received,
        transfersInMinor: inbound,
        transfersOutMinor: outbound,
        supplierReturnsMinor: returns,
        theoreticalMinor: theoretical,
        knownWasteMinor: waste,
      }),
      movementIds: relevant.map((m) => String(m._id)),
      costSnapshotIds: costRows.map((c) => String(c._id)),
      missingReasons: [...new Set(itemReasons)],
    });
  }
  const incomplete = reasons.length > 0;
  const fields = [
    'actualUsageMinor',
    'theoreticalUsageMinor',
    'varianceMinor',
    'knownWasteMinor',
    'unexplainedMinor',
  ];
  const totals = Object.fromEntries(
    fields.map((field) => [
      field,
      incomplete || rows.some((row) => row[field] == null)
        ? null
        : math.sumMinor(rows.map((row) => row[field])),
    ]),
  );
  return {
    rows,
    totals,
    coverage: {
      reconciliationStatus: incomplete ? 'incomplete' : 'complete',
      missingReasons: [...new Set(reasons)],
      openingCountId: args.openingCountId,
      closingCountId: args.closingCountId,
    },
    asOf: asOf.toISOString(),
    currency: 'NGN',
    interval: {
      from: opening.cutoff.toISOString(),
      to: closing.cutoff.toISOString(),
    },
  };
}
module.exports = { usageBridge, getUsageVariance };
