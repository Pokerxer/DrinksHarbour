'use strict';
const Count = require('../../models/VenueInventoryCount');
const Stock = require('../../models/WarehouseStock');
const { loadVenueContext } = require('./context');
const { runVenueOperation, fingerprint } = require('./operations');
const { fail, requireId } = require('./errors');
const { id } = require('./eligibility');
const math = require('./cost-math');
const dto = (row) => ({
  id: id(row),
  version: row.version,
  state: row.state,
  completeness: row.completeness,
  asOf: row.cutoff?.toISOString?.() || row.cutoff,
  missingReasons: row.missingReasons || [],
});
async function requireIndexes() {
  const indexes = await Count.collection
    .listIndexes()
    .toArray()
    .catch((error) => {
      if (error.code === 26) return [];
      throw error;
    });
  if (
    !indexes.some(
      (i) =>
        i.unique &&
        !i.partialFilterExpression &&
        !i.sparse &&
        JSON.stringify(i.key) ===
          JSON.stringify({ tenant: 1, location: 1, countKey: 1 }),
    )
  )
    fail(
      'COUNT_INDEX_REVIEW_REQUIRED',
      'Reviewed count uniqueness guard required',
      503,
    );
}
function inputOf(input) {
  if (
    !input ||
    Object.keys(input).some((key) => !['countKey', 'items'].includes(key)) ||
    typeof input.countKey !== 'string' ||
    !/^[\w-]{1,100}$/.test(input.countKey) ||
    !Array.isArray(input.items) ||
    input.items.length < 1 ||
    input.items.length > 1000
  )
    fail('INVALID_INPUT', 'Choose an explicit count scope', 400);
  const seen = new Set();
  return {
    countKey: input.countKey,
    items: input.items
      .map((item) => {
        requireId(item.subProductId);
        requireId(item.sizeId);
        if (
          Object.keys(item).some(
            (key) => !['subProductId', 'sizeId', 'quantity'].includes(key),
          )
        )
          fail('INVALID_INPUT', 'Unexpected count fields', 400);
        const key = `${item.subProductId}:${item.sizeId}`;
        if (seen.has(key))
          fail('INVALID_INPUT', 'Count items must be distinct', 400);
        seen.add(key);
        if (item.quantity !== null) {
          math.assertQuantity(item.quantity, { allowZero: true });
          if (item.quantity.unit !== 'count')
            fail(
              'COUNT_UNIT_UNSUPPORTED',
              'Count the reviewed stock form in whole stock units',
              400,
            );
        }
        return {
          subProductId: item.subProductId,
          sizeId: item.sizeId,
          quantity: item.quantity,
        };
      })
      .sort((a, b) =>
        `${a.subProductId}:${a.sizeId}`.localeCompare(
          `${b.subProductId}:${b.sizeId}`,
        ),
      ),
  };
}
async function createCount(args) {
  const input = inputOf(args.input);
  const context = await loadVenueContext({
    ...args,
    action: 'inventory.count',
  });
  await requireIndexes();
  return runVenueOperation({
    ...args,
    actor: context.actor,
    operation: 'inventory.count.create',
    key: args.idempotencyKey,
    payload: input,
    targetType: 'VenueInventoryCount',
    execute: async ({ mongoSession }) => {
      await loadVenueContext({
        ...args,
        action: 'inventory.count',
        mongoSession,
      });
      const items = [];
      for (const item of input.items) {
        const size = await require('../../models/Size')
          .exists({
            _id: item.sizeId,
            subproduct: item.subProductId,
            tenant: args.tenantId,
          })
          .session(mongoSession);
        if (!size) fail('NOT_FOUND', 'Count stock form not found', 404);
        const stock = await Stock.findOne({
          tenant: args.tenantId,
          warehouse: args.locationId,
          subProduct: item.subProductId,
          size: item.sizeId,
        })
          .session(mongoSession)
          .lean();
        if (!stock) fail('NOT_FOUND', 'Count stock not found', 404);
        items.push({
          ...item,
          stockId: stock._id,
          stockUpdatedAt: stock.updatedAt,
          expectedQuantity: stock.currentQuantity,
        });
      }
      const cutoff = new Date();
      const last = await require('../../models/InventoryMovement')
        .findOne({
          tenant: args.tenantId,
          warehouse: args.locationId,
          status: 'confirmed',
          performedAt: { $lte: cutoff },
        })
        .sort({ _id: -1 })
        .session(mongoSession)
        .lean();
      const [row] = await Count.create(
        [
          {
            tenant: args.tenantId,
            location: args.locationId,
            countKey: input.countKey,
            items,
            scopeHash: fingerprint(
              items.map((item) => [item.subProductId, item.sizeId]),
            ),
            observedAt: cutoff,
            cutoff,
            movementWatermark: last?._id,
            createdBy: context.actor.userId,
          },
        ],
        { session: mongoSession },
      );
      return dto(row);
    },
  });
}
async function completeCount(args) {
  requireId(args.countId);
  if (!Number.isSafeInteger(args.expectedVersion) || args.expectedVersion < 0)
    fail('STATE_CHANGED');
  const context = await loadVenueContext({
    ...args,
    action: 'inventory.count',
  });
  return runVenueOperation({
    ...args,
    actor: context.actor,
    operation: 'inventory.count.complete',
    key: args.idempotencyKey,
    payload: { countId: args.countId, expectedVersion: args.expectedVersion },
    targetType: 'VenueInventoryCount',
    execute: async ({ mongoSession }) => {
      await loadVenueContext({
        ...args,
        action: 'inventory.count',
        mongoSession,
      });
      const row = await Count.findOne({
        _id: args.countId,
        tenant: args.tenantId,
        location: args.locationId,
      }).session(mongoSession);
      if (!row) fail('NOT_FOUND', 'Count not found', 404);
      if (row.state !== 'draft' || row.version !== args.expectedVersion)
        fail('STATE_CHANGED');
      const reasons = [];
      for (const item of row.items) {
        const opened = await require('../../models/OpenedBottle')
          .exists({
            tenant: args.tenantId,
            location: args.locationId,
            'source.subProduct': item.subProductId,
            'source.size': item.sizeId,
            state: 'open',
            remainingMl: { $gt: 0 },
          })
          .session(mongoSession);
        if (opened) reasons.push('opened_stock_count_missing');
        if (item.quantity == null) {
          reasons.push('not_counted');
          continue;
        }
        const stock = await Stock.findOne({
          _id: item.stockId,
          tenant: args.tenantId,
          warehouse: args.locationId,
          subProduct: item.subProductId,
          size: item.sizeId,
        })
          .session(mongoSession)
          .lean();
        if (
          !stock ||
          stock.currentQuantity !== item.expectedQuantity ||
          String(stock.updatedAt) !== String(item.stockUpdatedAt)
        )
          fail('COUNT_STALE', 'Stock changed after count capture; recount');
        if (stock.currentQuantity !== item.quantity.amountScaled) {
          reasons.push('stock_adjustment_review_required');
          continue;
        }
        const lots = await require('../../models/WarehouseBatch')
          .find({
            tenant: args.tenantId,
            warehouse: args.locationId,
            subProduct: item.subProductId,
            size: item.sizeId,
            quantity: { $gt: 0 },
          })
          .session(mongoSession)
          .lean();
        if (
          lots.reduce((sum, lot) => sum + lot.quantity, 0) !==
          stock.currentQuantity
        ) {
          reasons.push('lot_coverage_incomplete');
          continue;
        }
        const value = await require('./count-valuation').valueCountLots({
          tenantId:args.tenantId,locationId:args.locationId,lots,mongoSession,
        });
        if(value == null){ reasons.push('valuation_unknown'); continue; }
        item.valueMinor = value;
        item.valuationRefs = lots.map((lot) => lot._id);
      }
      row.missingReasons = [...new Set(reasons)];
      row.completeness = reasons.length ? 'incomplete' : 'complete';
      row.state = 'completed';
      row.reviewedBy = context.actor.userId;
      row.completedAt = new Date();
      row.version++;
      await row.save({ session: mongoSession });
      return dto(row);
    },
  });
}
module.exports = { createCount, completeCount };
