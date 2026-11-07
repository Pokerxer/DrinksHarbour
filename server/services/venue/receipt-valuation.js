'use strict';
const { fail, requireId } = require('./errors');
const { id } = require('./eligibility');
const { loadVenueContext } = require('./context');
const { runVenueOperation } = require('./operations');
const math = require('./cost-math');
const { listPage, pageRows } = require('./catalog-list-page');
function receiptMinor(receipt) {
  if (
    receipt.totalCost == null ||
    typeof receipt.totalCost !== 'number' ||
    !Number.isFinite(receipt.totalCost)
  )
    fail('COST_EVIDENCE_REQUIRED', 'Original receipt has no known value');
  const scaled = receipt.totalCost * 100;
  if (Math.abs(scaled - Math.round(scaled)) > 1e-7)
    fail(
      'COST_REVIEW_REQUIRED',
      'Original receipt value is not exact minor money',
    );
  return math.requireMinor(Math.round(scaled));
}
async function listReceiptSources(args) {
  const context = await loadVenueContext({ ...args, action: 'costs.review' });
  const scope = { tenant: args.tenantId, warehouse: args.locationId };
  const lotsPage = listPage({ cursor: args.lotsCursor, limit: args.limit }, -1);
  const receiptsPage = listPage({ cursor: args.receiptsCursor, limit: args.limit }, -1);
  const lots = await require('../../models/WarehouseBatch')
    .find({ ...scope, ...lotsPage.after })
    .sort({ _id: -1 })
    .limit(lotsPage.limit + 1)
    .lean();
  const receipts = await require('../../models/InventoryMovement')
    .find({
      ...scope,
      ...receiptsPage.after,
      type: { $in: ['received', 'purchase'] },
      status: 'confirmed',
    })
    .select('_id subProduct size batchNumber quantity totalCost performedAt relatedPurchaseOrder')
    .sort({ _id: -1 })
    .limit(receiptsPage.limit + 1)
    .lean();
  const lotRows = pageRows(lots, lotsPage.limit);
  const receiptRows = pageRows(receipts, receiptsPage.limit);
  const purchaseIds = receiptRows.items.map(row => row.relatedPurchaseOrder).filter(Boolean);
  const purchases = purchaseIds.length ? await require('../../models/PurchaseOrder')
    .find({ _id: { $in: purchaseIds }, tenant: args.tenantId }).select('_id currency').lean() : [];
  const purchaseCurrencies = new Map(purchases.map(row => [id(row), row.currency]));
  const ngnValue = receipt => (context.tenant.defaultCurrency || 'NGN') === 'NGN' &&
    (!receipt.relatedPurchaseOrder || purchaseCurrencies.get(id(receipt.relatedPurchaseOrder)) === 'NGN');
  return {
    nextLotsCursor: lotRows.nextCursor,
    nextReceiptsCursor: receiptRows.nextCursor,
    lots: lotRows.items.map((lot) => ({
      id: id(lot),
      subProductId: id(lot.subProduct),
      sizeId: id(lot.size),
      batchNumber: lot.batchNumber,
      quantity: lot.quantity,
      initialQuantity: lot.initialQuantity,
      linked: lot.venueValuation?.initialCostMinor != null,
    })),
    receipts: receiptRows.items.map((receipt) => ({
      id: id(receipt),
      subProductId: id(receipt.subProduct),
      sizeId: id(receipt.size),
      batchNumber: receipt.batchNumber,
      quantity: receipt.quantity,
      // This selector offers NGN evidence; an unconverted purchase is not a known NGN amount.
      amountMinor: receipt.totalCost == null || !ngnValue(receipt) ? null : receiptMinor(receipt),
      performedAt: receipt.performedAt,
    })),
  };
}
async function linkReceiptValue(args) {
  requireId(args.batchId);
  const input = args.input;
  if (
    !input ||
    Object.keys(input).some(
      (key) => !['receiptId', 'contentQuantity', 'reason'].includes(key),
    )
  )
    fail(
      'INVALID_INPUT',
      'Original receipt, measured stock content and review reason only',
      400,
    );
  requireId(input.receiptId);
  math.assertQuantity(input.contentQuantity);
  if (
    args.expectedVersion !== 0 ||
    typeof input.reason !== 'string' ||
    input.reason.trim().length < 10 ||
    input.reason.length > 1000
  )
    fail(
      'INVALID_INPUT',
      'Review the original source and supply version zero',
      400,
    );
  const context = await loadVenueContext({ ...args, action: 'costs.review' });
  return runVenueOperation({
    ...args,
    actor: context.actor,
    operation: 'cost.receipt.link',
    key: args.idempotencyKey,
    payload: { batchId: args.batchId, expectedVersion: 0, input },
    targetType: 'WarehouseBatch',
    execute: async ({ mongoSession }) => {
      const fresh = await loadVenueContext({
        ...args,
        action: 'costs.review',
        mongoSession,
      });
      const lot = await require('../../models/WarehouseBatch')
        .findOne({
          _id: args.batchId,
          tenant: args.tenantId,
          warehouse: args.locationId,
        })
        .session(mongoSession);
      if (!lot) fail('NOT_FOUND', 'Owned lot not found', 404);
      if (lot.venueValuation?.initialCostMinor != null)
        fail('STATE_CHANGED', 'Original lot valuation is already linked');
      if (
        lot.quantity !== lot.initialQuantity ||
        !Number.isSafeInteger(lot.initialQuantity) ||
        lot.initialQuantity < 1
      )
        fail(
          'COST_SOURCE_REVIEW_REQUIRED',
          'Previously used or merged lots require an accountant-reviewed adjustment',
        );
      const receipt = await require('../../models/InventoryMovement')
        .findOne({
          _id: input.receiptId,
          tenant: args.tenantId,
          warehouse: args.locationId,
          subProduct: lot.subProduct,
          size: lot.size,
          type: { $in: ['received', 'purchase'] },
          status: 'confirmed',
        })
        .session(mongoSession)
        .lean();
      if (!receipt) fail('NOT_FOUND', 'Owned original receipt not found', 404);
      if (
        receipt.batchNumber !== lot.batchNumber ||
        receipt.quantity !== lot.initialQuantity ||
        id(receipt.relatedPurchaseOrder) !== id(lot.sourcePO)
      )
        fail(
          'COST_SOURCE_REVIEW_REQUIRED',
          'Receipt identity does not match this original lot',
        );
      const amountMinor = receiptMinor(receipt);
      const stock = await require('../../models/WarehouseStock')
        .findOne({
          tenant: args.tenantId,
          warehouse: args.locationId,
          subProduct: lot.subProduct,
          size: lot.size,
          reservedQuantity: 0,
          currentQuantity: { $gte: lot.quantity },
        })
        .session(mongoSession);
      if (!stock)
        fail(
          'COST_SOURCE_REVIEW_REQUIRED',
          'Resolve stock reservations and coverage before linking a lot',
        );
      const used = await require('../../models/InventoryMovement')
        .exists({
          tenant: args.tenantId,
          warehouse: args.locationId,
          subProduct: lot.subProduct,
          size: lot.size,
          status: 'confirmed',
          category: { $in: ['out', 'adjustment', 'transfer'] },
          performedAt: { $gte: receipt.performedAt },
        })
        .session(mongoSession);
      if (used)
        fail(
          'COST_SOURCE_REVIEW_REQUIRED',
          'Historical issue or transfer prevents automatic initial valuation',
        );
      const quantity = input.contentQuantity;
      const profile = await require('../../models/IngredientProfile')
        .findOne({ tenant: args.tenantId, subProduct: lot.subProduct })
        .session(mongoSession)
        .lean();
      if (
        quantity.unit !== 'count' ||
        quantity.amountScaled !== 1 ||
        quantity.scale !== 1 ||
        (profile && profile.dimension !== 'count')
      ) {
        const recipes = await require('../../models/RecipeVersion')
          .find({
            tenant: args.tenantId,
            supersededBy: null,
            'components.stockMapping.sourceSubProductId': lot.subProduct,
            'components.stockMapping.sourceSizeId': lot.size,
          })
          .session(mongoSession)
          .lean();
        const matches = recipes
          .flatMap((recipe) => recipe.components)
          .filter(
            (component) =>
              id(component.stockMapping?.sourceSubProductId) ===
                id(lot.subProduct) &&
              id(component.stockMapping?.sourceSizeId) === id(lot.size) &&
              id(component.stockMapping?.sourceLocationId) ===
                args.locationId &&
              component.stockMapping.reviewedBy,
          );
        if (
          !matches.length ||
          matches.some(
            (component) =>
              component.stockMapping.contentQuantity.amountScaled !==
                quantity.amountScaled ||
              component.stockMapping.contentQuantity.scale !== quantity.scale ||
              component.stockMapping.contentQuantity.unit !== quantity.unit,
          )
        )
          fail(
            'STOCK_MAPPING_REQUIRED',
            'Use one consistent reviewed recipe stock-content definition',
          );
      }
      lot.venueValuation = {
        initialCostMinor: amountMinor,
        initialQuantityScaled: require('./recipe-stock-source').baseAmount(
          lot.initialQuantity,
          quantity.amountScaled,
        ),
        issuedQuantityScaled: 0,
        issuedCostMinor: 0,
        receiptId: receipt._id,
        reason: input.reason,
        reviewedBy: fresh.actor.userId,
        reviewedAt: new Date(),
      };
      await require('./source-receipt').originalReceipt({
        tenantId: args.tenantId,
        locationId: args.locationId,
        lot,
        mongoSession,
      });
      await lot.save({ session: mongoSession });
      return { id: id(lot), version: 1, status: 'source_linked', amountMinor };
    },
  });
}
module.exports = { listReceiptSources, linkReceiptValue };
