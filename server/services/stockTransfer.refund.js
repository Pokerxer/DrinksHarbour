const mongoose = require('mongoose');
const { ValidationError, NotFoundError } = require('../utils/errors');

async function returnStockTransferLine({ id, tenantId, userId, itemIndex, quantity, note, requestId, authorize }, deps = {}) {
  if (!Number.isSafeInteger(itemIndex) || itemIndex < 0 || !Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new ValidationError('Choose a transfer line and a positive integer return quantity');
  }
  if (requestId && (typeof requestId !== 'string' || requestId.length > 100)) throw new ValidationError('Invalid return request id');
  const Model = deps.StockTransfer || require('../models/StockTransfer');
  const Movements = deps.WarehouseMovement || require('../models/WarehouseMovement');
  const stock = deps.stock || require('./stockTransferReturn');
  const transaction = deps.transaction || (run => mongoose.connection.transaction(run));
  const transfer = await transaction(async session => {
    const doc = await Model.findOne({ _id: id, tenant: tenantId }).session(session);
    if (!doc) throw new NotFoundError('Stock transfer not found');
    await authorize(doc);
    const existing = requestId && (doc.returns || []).find(r => r.requestId === requestId);
    if (existing) {
      const line = existing.lines[0];
      if (line.itemIndex !== itemIndex || line.quantity !== quantity || (line.note || '') !== String(note || '').slice(0, 200)) {
        throw new ValidationError('This return request was already used with different details');
      }
      return doc;
    }
    if (!['completed', 'partially_received'].includes(doc.status)) {
      throw new ValidationError('Only received transfer stock can be returned');
    }
    const item = doc.items[itemIndex];
    if (!item) throw new ValidationError('Transfer line not found');
    const returnable = Math.max(0, (item.receivedQty ?? item.transferredQty ?? 0) - (item.returnedQty || 0));
    if (quantity > returnable) throw new ValidationError(`Cannot return more than received (${returnable} available)`);
    const movement = await Movements.findOne({ tenant: tenantId, warehouse: doc.destinationWarehouse,
      subProduct: item.subProductId, size: item.sizeId || null, type: 'transfer_in',
      reference: `Transfer ${doc.transferNumber}` }).session(session).lean();
    if (!movement) throw new ValidationError('Original receipt movement not found');
    const ctx = { kind: 'module', transfer: doc, item, itemIndex, movement,
      holding: doc.destinationWarehouse, other: doc.sourceWarehouse,
      transferNumber: doc.transferNumber, returnable };
    await stock.returnTransferStock(ctx, { tenantId, userId, quantity, note, session }, deps.stockDeps || {});
    await stock.reverseTransferMoney(ctx, { userId, quantity, note, requestId, session }, {});
    return doc;
  });
  if (deps.deferTax) return transfer;
  const tax = deps.tax || require('./tax.service');
  await tax.reverseDocumentTax({ sourceType: 'stock_transfer', doc: transfer, userId });
  await tax.captureDocumentTax({ sourceType: 'stock_transfer', doc: transfer, postedBy: userId });
  return transfer;
}

async function returnWholeStockTransfer(args, deps = {}) {
  const { id, tenantId, userId, note, requestId, authorize } = args;
  if (requestId && (typeof requestId !== 'string' || requestId.length > 80)) throw new ValidationError('Invalid whole-return request id');
  const Model = deps.StockTransfer || require('../models/StockTransfer');
  const transaction = deps.transaction || (run => mongoose.connection.transaction(run));
  const returnLine = deps.returnLine || returnStockTransferLine;
  const transfer = await transaction(async session => {
    let doc = await Model.findOne({ _id: id, tenant: tenantId }).session(session);
    if (!doc) throw new NotFoundError('Stock transfer not found');
    await authorize(doc);
    const prior = requestId && (doc.returns || []).filter(r => r.requestId?.startsWith(`${requestId}:`));
    if (prior?.length) {
      if (prior.some(r => r.lines.some(l => (l.note || '') !== String(note || '').slice(0, 200)))) throw new ValidationError('This return request was already used with different details');
      return doc;
    }
    if (!['completed', 'partially_received'].includes(doc.status)) throw new ValidationError('Only received transfer stock can be returned');
    const lines = doc.items.map((item, itemIndex) => ({ itemIndex, quantity: Math.max(0, (item.receivedQty ?? item.transferredQty ?? 0) - (item.returnedQty || 0)) })).filter(l => l.quantity > 0);
    if (!lines.length) throw new ValidationError('No received products remain to return');
    for (const line of lines) {
      doc = await returnLine({ ...args, ...line, requestId: requestId ? `${requestId}:${line.itemIndex}` : undefined }, {
        ...deps, transaction: run => run(session), deferTax: true,
      });
    }
    return doc;
  });
  const tax = deps.tax || require('./tax.service');
  await tax.reverseDocumentTax({ sourceType: 'stock_transfer', doc: transfer, userId });
  await tax.captureDocumentTax({ sourceType: 'stock_transfer', doc: transfer, postedBy: userId });
  return transfer;
}

module.exports = { returnStockTransferLine, returnWholeStockTransfer };
