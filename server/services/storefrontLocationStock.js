'use strict';
const crypto = require('crypto');
const Stock = require('../models/WarehouseStock');
const Hold = require('../models/OnlineStockReservation');
const Product = require('../models/Product');
const { availableStock, rollup } = require('./salesReservations/stock');
const { ConflictError } = require('../utils/errors');
const { id } = require('./storefrontPricing');
function requireTransaction(session) {
  if (!session?.inTransaction()) throw new ConflictError('Online stock requires an owning transaction');
}
function groups(items, { lineScoped = false } = {}) {
  const values = new Map();
  for (const item of items) {
    if (!item.warehouse || !item.size || !item.tenant || !Number.isInteger(item.quantity) || item.quantity < 1) throw new ConflictError('Online stock requires a tenant, location and variant');
    if (lineScoped && !/^[a-f\d]{24}$/i.test(item.fulfillmentLineId || '')) throw new ConflictError('Line-scoped reservation requires original line identity');
    const key = [item.tenant, item.warehouse, item.subproduct, item.size, ...(lineScoped ? [item.fulfillmentLineId] : [])].map(id).join(':');
    const row = values.get(key) || { tenant: item.tenant, warehouse: item.warehouse, subProduct: item.subproduct,
      size: item.size, product: item.product, quantity: 0, ...(lineScoped ? { fulfillmentLineId: item.fulfillmentLineId } : {}) };
    row.quantity += item.quantity; values.set(key, row);
  }
  return [...values].sort(([a], [b]) => a.localeCompare(b));
}
async function reserve(items, orderId, session, options = {}) {
  requireTransaction(session);
  for (const [identity, group] of groups(items, { lineScoped: options.version === 2 })) {
    const { quantity, product, fulfillmentLineId, ...key } = group;
    const { row, available } = await availableStock(key, session);
    if (!row || available < quantity) throw new ConflictError('Insufficient available stock at the website location');
    // New retail holds cannot claim a venue-only portion. Original hold release
    // and consumption retain their accepted identity even after catalogue edits.
    if (await require('../models/Size').exists({ _id: key.size, tenant: key.tenant, subproduct: key.subProduct,
      $nor: [require('../constants/sizeChannels').retailSizeWhereClause()] }).session(session)) throw new ConflictError('Venue serving variant is unavailable in retail');
    const changed = await Stock.updateOne({ ...key, currentQuantity: row.currentQuantity,
      $expr: { $eq: [{ $ifNull: ['$reservedQuantity', 0] }, row.reservedQuantity || 0] } },
    { $inc: { reservedQuantity: quantity } }, { session });
    if (!changed.modifiedCount) throw new ConflictError('Stock changed; refresh the cart');
    const master = await Product.findOne({ _id: product }).select('tracksBatch').session(session).lean();
    if (!master) throw new ConflictError('Stock product no longer exists');
    let allocations = [];
    if (master.tracksBatch !== false) {
      allocations = await require('./batch.service').depleteBatchesFefo({ tenantId: key.tenant, warehouseId: key.warehouse,
        subProduct: key.subProduct, size: key.size, quantity, excludeExpired: true }, session);
      if (allocations.reduce((sum, a) => sum + a.quantity, 0) !== quantity) throw new ConflictError('Eligible batches do not cover this order');
    }
    const holdId = crypto.createHash('sha256').update(`${id(orderId)}:${identity}`).digest('hex');
    await Hold.create([{ _id: holdId, ...group, order: orderId, state: 'reserved', batchAllocations: allocations, ...(options.version === 2 ? { reservationVersion: 2, merchantOrder: crypto.createHash('sha256').update(`${id(orderId)}:${id(group.tenant)}:${id(group.warehouse)}`).digest('hex'), fulfillmentLineId, consumedQuantity: 0, releasedQuantity: 0, unitDispositions: [] } : {}) }], { session });
    await rollup(key, session);
  }
}
async function transition(order, action, session, actorId, scope = null) {
  requireTransaction(session);
  if (scope && (!scope.tenant || !scope.warehouse || order.items.some(line => id(line.tenant) !== id(scope.tenant) || id(line.warehouse) !== id(scope.warehouse)))) throw new ConflictError('Invalid owned merchant stock scope');
  const holds = await Hold.find({ order: order._id, tenant: { $in: order.items.filter(i => i.warehouse).map(i => i.tenant) }, ...(scope ? { tenant: scope.tenant, warehouse: scope.warehouse } : {}) })
    .sort({ _id: 1 }).session(session);
  const expected = groups(order.items.filter(i => i.warehouse));
  if (holds.length !== expected.length) throw new ConflictError('Online stock ownership needs review');
  for (const hold of holds) {
    if (hold.reservationVersion === 2) throw new ConflictError('Use exact quantity reservation commands');
    const key = { tenant: hold.tenant, warehouse: hold.warehouse, subProduct: hold.subProduct, size: hold.size };
    const match = expected.find(([, g]) => ['tenant', 'warehouse', 'subProduct', 'size'].every(k => id(g[k]) === id(key[k])));
    if (!match || match[1].quantity !== hold.quantity) throw new ConflictError('Online stock does not match this order');
    const target = action === 'consume' ? 'consumed' : 'released';
    if (hold.state === target) continue;
    if (hold.state !== 'reserved') throw new ConflictError('Online stock is no longer reserved');
    await require('./storefrontOwnedStock').applyOwnedStock({ hold, quantity: hold.quantity, action, batches: hold.batchAllocations, reference: `online:${hold._id}`, orderId: order._id, actorId, session });
    if (action === 'consume') {
      const lines = order.items.filter(i => id(i.subproduct) === id(hold.subProduct) && id(i.size) === id(hold.size) && id(i.warehouse) === id(hold.warehouse));
      let cursor = 0;
      const remaining = hold.batchAllocations.map(a => ({ batch: a.batch, quantity: a.quantity }));
      for (const line of lines) {
        line.batchAllocations = []; let need = line.quantity;
        while (need > 0 && cursor < remaining.length) {
          const a = remaining[cursor], take = Math.min(need, a.quantity);
          line.batchAllocations.push({ batch: a.batch, quantity: take }); need -= take; a.quantity -= take;
          if (!a.quantity) cursor++;
        }
      }
    }
    hold.state = target; await hold.save({ session });
  }
}
async function availability(tenant, products, session = null) {
  const channel = tenant.storefrontChannel;
  if (!channel || !products.length) return [];
  const rows = await Stock.find({ tenant: tenant._id, warehouse: channel.warehouse, subProduct: { $in: products.map(p => p._id) } }).session(session).lean();
  const result = [];
  for (const row of rows) {
    const key = { tenant: tenant._id, warehouse: channel.warehouse, subProduct: row.subProduct, size: row.size };
    const value = await availableStock(key, session);
    result.push({ ...row, available: value.available });
  }
  return result;
}
module.exports = { reserve, transition, availability };
