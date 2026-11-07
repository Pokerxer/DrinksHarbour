'use strict';
const { id } = require('./eligibility');
const { requireCostingPolicy } = require('./costing-policy');
const { mappedSource, baseAmount, assertSourceValuation } = require('./recipe-stock-source');
const { originalReceipt } = require('./source-receipt');
async function getServingAvailability({
  tenantId,
  locationId,
  servingSnapshot,
  mongoSession = null,
  at = new Date(),
}) {
  const reply = (available, reason) => ({
    available,
    asOf: new Date(at).toISOString(),
    reason,
  });
  try {
    const { valuationMethod } = await requireCostingPolicy({ tenantId, locationId, mongoSession });
    if (valuationMethod !== 'fifo') return reply(false, 'not_configured');
    const location = await require('../../models/Warehouse')
      .findOne({ _id: locationId, tenant: tenantId })
      .session(mongoSession)
      .lean();
    if (
      process.env.VENUE_SERVINGS_V2_ENABLED !== 'true' ||
      !location.venueServices.catalogCosting.servingsV2Enabled
    )
      return reply(false, 'not_configured');
    await require('./serving-indexes').assertServingIndexes(
      require('mongoose').connection.db,
    );
    await require('./cost-evidence').costIndexesReady();
    const size = await require('../../models/Size')
      .findOne({
        _id: servingSnapshot.sizeId,
        tenant: tenantId,
        servingSchemaVersion: 2,
      })
      .session(mongoSession)
      .lean();
    if (
      !size ||
      size.venueServing?.version !== servingSnapshot.servingVersion ||
      size.venueServing?.mode !== servingSnapshot.mode
    )
      return reply(false, 'not_configured');
    if (['prepared_batch','sealed'].includes(servingSnapshot.mode)) {
      const stock = await require('../../models/WarehouseStock').findOne({tenant:tenantId,warehouse:locationId,subProduct:size.subproduct,size:size._id}).session(mongoSession).lean();
      if (!stock || stock.currentQuantity - (stock.reservedQuantity || 0) < 1) return reply(false,'unavailable');
      const prepared = servingSnapshot.mode === 'prepared_batch';
      const recipe = prepared ? await require('./recipes').resolveActiveVersion(tenantId,{subProduct:size.subproduct,size:size._id},mongoSession) : null;
      if(prepared && (!recipe || recipe.effectiveFrom > at)) return reply(false,'not_configured');
      const lots = await require('../../models/WarehouseBatch')
        .find({
          tenant: tenantId,
          warehouse: locationId,
          subProduct: size.subproduct,
          size: size._id,
          quantity: { $gt: 0 },
          quarantined: { $ne: true },
          $or: [{ expiryDate: null }, { expiryDate: { $gt: at } }],
        })
        .session(mongoSession)
        .lean();
      if (!lots.length) return reply(false, 'unavailable');
      for (const lot of lots) {
        const job =
          prepared && lot.venueProduction?.batchId &&
          (await require('../../models/VenueProductionBatch')
            .exists({
              _id: lot.venueProduction.batchId,
              tenant: tenantId,
              location: locationId,
              state: 'completed',
              recipeVersionId: recipe?._id,
              outputBatchId: lot._id,
            })
            .session(mongoSession));
        if (
          (prepared && !job) ||
          !lot.venueValuation?.receiptId ||
          !Number.isSafeInteger(lot.venueValuation.initialCostMinor) ||
          lot.venueValuation.initialQuantityScaled !== lot.initialQuantity
        )
          return reply(false, 'not_configured');
        await originalReceipt({tenantId,locationId,lot,mongoSession});
        if (prepared) assertSourceValuation(lot, 1);
        else await require('./sealed-valuation').assertSealedValuation({
          tenantId, locationId, lot, mongoSession,
        });
      }
      return reply(
        lots.reduce((sum, lot) => sum + lot.quantity, 0) >= 1,
        'available',
      );
    }
    if (servingSnapshot.mode !== 'made_to_order')
      return reply(false, 'not_configured');
    const recipe = await require('./recipes').resolveActiveVersion(
      tenantId,
      { subProduct: size.subproduct, size: size._id },
      mongoSession,
    );
    if (!recipe || recipe.effectiveFrom > at)
      return reply(false, 'not_configured');
    for (const component of recipe.components) {
      const source = await mappedSource({
        tenantId,
        locationId,
        component,
        fireDelta: 1,
        mongoSession,
      });
      const stock = await require('../../models/WarehouseStock')
        .findOne({
          tenant: tenantId,
          warehouse: locationId,
          subProduct: source.mapping.sourceSubProductId,
          size: source.mapping.sourceSizeId,
        })
        .session(mongoSession)
        .lean();
      if (
        !stock ||
        baseAmount(
          stock.currentQuantity - (stock.reservedQuantity || 0),
          source.mapping.contentQuantity.amountScaled,
        ) < source.amount.amountScaled
      )
        return reply(false, 'unavailable');
      const lots = await require('../../models/WarehouseBatch')
        .find({
          tenant: tenantId,
          warehouse: locationId,
          subProduct: source.mapping.sourceSubProductId,
          size: source.mapping.sourceSizeId,
          quantity: { $gt: 0 },
          quarantined: { $ne: true },
          $or: [{ expiryDate: null }, { expiryDate: { $gt: at } }],
        })
        .session(mongoSession)
        .lean();
      for (const lot of lots) {
        assertSourceValuation(lot, source.mapping.contentQuantity.amountScaled);
        await originalReceipt({tenantId,locationId,lot,mongoSession});
      }
      if (
        lots.reduce(
          (sum, lot) =>
            sum +
            baseAmount(
              lot.quantity,
              source.mapping.contentQuantity.amountScaled,
            ),
          0,
        ) < source.amount.amountScaled
      )
        return reply(false, 'unavailable');
    }
    return reply(true, 'available');
  } catch (error) {
    if (
      [
        'COSTING_NOT_CONFIGURED',
        'COST_POLICY_REQUIRED',
        'COST_INDEX_REVIEW_REQUIRED',
        'VENUE_SERVINGS_NOT_READY',
        'STOCK_MAPPING_REQUIRED',
        'NOT_FOUND',
        'UNIT_CONVERSION',
        'COST_POLICY_UNSUPPORTED',
        'COST_EVIDENCE_REQUIRED',
        'COST_REVIEW_REQUIRED',
        'INVALID_CURRENCY',
        'VENUE_DISABLED',
        'ACCOUNTING_PERIOD_CLOSED',
      ].includes(error.code)
    )
      return reply(false, 'not_configured');
    if (error.code === 'STOCK_UNAVAILABLE') return reply(false, 'unavailable');
    throw error;
  }
}
module.exports = { getServingAvailability };
