const { movementMetrics, summarizeMovements } = require('./warehouseMovementHistory');
const { purchaseMetrics, summarizePurchases } = require('./warehousePurchaseTotals');
const {
  summarizeTransfers,
  summarizeTransferMovements,
  movementNetQuantities,
} = require('./warehouseTransferTotals');
const mongoose = require('mongoose');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { productIds, productCondition, addHistoryFilters } = require('./warehouseHistory.filters');
const ref = (value) => String(value?._id || value || '');
const kinds = ['purchases', 'transfers', 'movements', 'transfer_movements'];
function historyQuery(
  tenant,
  warehouse,
  { kind = 'movements', product, start, end, status, search } = {},
) {
  if (!kinds.includes(kind)) throw new ValidationError('Invalid history kind');
  const selectedProduct = productCondition(product);
  const query = { tenant };
  if (kind === 'purchases')
    query.$or = [
      { warehouse, ...(selectedProduct ? { 'items.subProductId': selectedProduct } : {}) },
      {
        partialReceipts: {
          $elemMatch: {
            warehouseId: warehouse,
            status: { $ne: 'cancelled' },
            ...(selectedProduct ? { 'items.subProductId': selectedProduct } : {}),
          },
        },
      },
    ];
  else if (kind === 'transfers') {
    query.$or = [{ sourceWarehouse: warehouse }, { destinationWarehouse: warehouse }];
    if (selectedProduct) query['items.subProductId'] = selectedProduct;
  } else {
    query.warehouse = warehouse;
    if (selectedProduct) query.subProduct = selectedProduct;
    if (kind === 'transfer_movements')
      query.$or = [
        { type: { $in: ['transfer_in', 'transfer_out'] } },
        { type: { $in: ['returned', 'return_out'] }, parentMovement: { $ne: null } },
      ];
  }
  function date(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ValidationError('Invalid history date');
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
      throw new ValidationError('Invalid history date');
    return parsed;
  }
  if (start || end) {
    query.createdAt = {};
    if (start) query.createdAt.$gte = date(start);
    if (end) {
      const until = date(end);
      until.setUTCDate(until.getUTCDate() + 1);
      query.createdAt.$lt = until;
    }
    if (start && end && start > end) throw new ValidationError('Start date must precede end date');
  }
  return addHistoryFilters(query, kind, { status, search });
}
function purchaseRow(doc, warehouse, product, returns = []) {
  const metrics = purchaseMetrics(doc, warehouse, product, returns);
  return {
    id: ref(doc),
    documentId: ref(doc),
    documentType: 'purchase',
    reference: doc.poNumber,
    date: doc.createdAt,
    status: doc.status,
    description: doc.vendorName || 'Supplier',
    quantity: metrics.receivedQuantity,
    returned: metrics.returnedQuantity,
    purchasedQuantity: metrics.netReceivedQuantity,
    receivedAmount: metrics.receivedValue,
    returnedAmount: metrics.returnedValue,
    netPurchaseAmount: metrics.netReceivedValue,
    amount: (doc.items || []).reduce((sum, item) => sum + (item.totalCost || 0), 0),
    currency: doc.currency || 'NGN',
  };
}
function transferRow(doc, warehouse, product) {
  const selected = productIds(product);
  const items = (doc.items || []).filter(
    (item) => !selected.length || selected.includes(ref(item.subProductId)),
  );
  const inbound = ref(doc.destinationWarehouse) === warehouse;
  return {
    id: ref(doc),
    documentId: ref(doc),
    documentType: 'transfer',
    reference: doc.transferNumber,
    date: doc.createdAt,
    status: doc.status,
    description: `${inbound ? 'Incoming from' : 'Outgoing to'} ${(inbound ? doc.sourceWarehouse : doc.destinationWarehouse)?.name || 'Location'}`,
    quantity: items.reduce(
      (sum, item) => sum + (inbound ? item.receivedQty || 0 : item.transferredQty || 0),
      0,
    ),
    transferInQuantity: inbound
      ? items.reduce((sum, item) => sum + (item.receivedQty || 0) - (item.returnedQty || 0), 0)
      : 0,
    transferOutQuantity: !inbound
      ? items.reduce((sum, item) => sum + (item.transferredQty || 0) - (item.returnedQty || 0), 0)
      : 0,
    returned: items.reduce((sum, item) => sum + (item.returnedQty || 0), 0),
    amount: doc.total ?? doc.totalValue ?? 0,
    currency: doc.currency || 'NGN',
  };
}
function movementRow(doc) {
  return {
    id: ref(doc),
    documentId: ref(doc.subProduct),
    documentType: 'product',
    reference: doc.reference || 'Stock movement',
    date: doc.createdAt,
    status: doc.type,
    description: `${doc.subProduct?.product?.name || doc.subProduct?.sku || 'Product'}${doc.size?.size ? ` · ${doc.size.size}` : ''}`,
    quantity: doc.quantity,
    ...movementNetQuantities(doc),
    ...movementMetrics(doc),
    balanceAfter: doc.balanceAfter,
    actor: doc.performedBy?.name || '—',
  };
}
async function getWarehouseHistory(tenant, warehouse, params = {}, deps = {}) {
  if (!mongoose.isValidObjectId(warehouse)) throw new ValidationError('Invalid warehouse');
  const query = historyQuery(tenant, warehouse, params);
  const Warehouse = deps.Warehouse || require('../models/Warehouse');
  const location = await Warehouse.findOne({ _id: warehouse, tenant }).select('name code').lean();
  if (!location) throw new NotFoundError('Warehouse not found');
  const kind = params.kind || 'movements';
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  if (!Number.isSafeInteger(page) || page > 1000000)
    throw new ValidationError('Invalid history page');
  const limit = Math.min(100, Math.max(1, Math.floor(Number(params.limit) || 20)));
  if (!Number.isFinite(limit)) throw new ValidationError('Invalid history limit');
  const Model =
    kind === 'purchases'
      ? deps.PurchaseOrder || require('../models/PurchaseOrder')
      : kind === 'transfers'
        ? deps.StockTransfer || require('../models/StockTransfer')
        : deps.WarehouseMovement || require('../models/WarehouseMovement');
  let cursor = Model.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  if (kind === 'purchases')
    cursor = cursor.select(
      'poNumber vendorName warehouse status currency items partialReceipts createdAt',
    );
  else if (kind === 'transfers')
    cursor = cursor
      .select(
        'transferNumber status currency items total totalValue sourceWarehouse destinationWarehouse createdAt',
      )
      .populate('sourceWarehouse destinationWarehouse', 'name');
  else
    cursor = cursor
      .populate({
        path: 'subProduct',
        select: 'sku product',
        populate: { path: 'product', select: 'name' },
      })
      .populate('size', 'size')
      .populate('performedBy', 'name');
  let totals = Promise.resolve(undefined);
  if (kind === 'transfers')
    totals = Model.find(query)
      .select(
        'sourceWarehouse destinationWarehouse currency total totalValue deliveryCharge items returns',
      )
      .populate('sourceWarehouse destinationWarehouse', 'name')
      .lean()
      .then((documents) => ({
        kind: 'documents',
        ...summarizeTransfers(documents, warehouse, params.product),
      }));
  else if (kind === 'transfer_movements')
    totals = Model.find(query)
      .select('type quantity parentMovement')
      .lean()
      .then((documents) => ({ kind: 'movements', ...summarizeTransferMovements(documents) }));
  const movementTotals =
    kind === 'movements'
      ? Model.find(query)
          .select('type quantity balanceBefore balanceAfter stockChange')
          .lean()
          .then(summarizeMovements)
      : Promise.resolve(undefined);
  let purchaseData = Promise.resolve(undefined);
  if (kind === 'purchases')
    purchaseData = Model.find(query)
      .select('warehouse currency items partialReceipts')
      .lean()
      .then(async (orders) => {
        const Return = deps.VendorReturn || require('../models/VendorReturn');
        const returns = orders.length
          ? await Return.find({
              tenant,
              purchaseOrder: { $in: orders.map((doc) => doc._id) },
              stockAdjusted: true,
              status: { $nin: ['draft', 'cancelled', 'rejected'] },
            })
              .select('purchaseOrder warehouse stockAdjusted status items')
              .lean()
          : [];
        return {
          returns,
          currencies: summarizePurchases(orders, warehouse, params.product, returns),
        };
      });
  const [documents, total, transferTotals, purchases, movements] = await Promise.all([
    cursor.lean(),
    Model.countDocuments(query),
    totals,
    purchaseData,
    movementTotals,
  ]);
  return {
    warehouse: location,
    ...(movements ? { movementTotals: movements } : {}),
    ...(purchases ? { purchaseTotals: { currencies: purchases.currencies } } : {}),
    ...(transferTotals ? { transferTotals } : {}),
    rows: documents.map((doc) =>
      kind === 'purchases'
        ? purchaseRow(doc, warehouse, params.product, purchases?.returns)
        : kind === 'transfers'
          ? transferRow(doc, warehouse, params.product)
          : movementRow(doc),
    ),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}
module.exports = { historyQuery, purchaseRow, getWarehouseHistory };
