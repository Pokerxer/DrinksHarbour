const SalesOrder = require('../../models/SalesOrder');
const Stock = require('../../models/WarehouseStock');
const Reservation = require('../../models/SalesStockReservation');
const { NotFoundError, ConflictError } = require('../../utils/errors');
const { neededQty, id } = require('./quantities');
const { transaction, requireIds } = require('./transaction');
const { resolveWarehouse, resolveLines } = require('./references');
const { availableStock, rollup } = require('./stock');

async function allocate(order, tenantId, warehouseId, session) {
  const lines = await resolveLines(order,tenantId,session);
  const holds = await Reservation.find({tenant:tenantId,salesOrder:order._id}).session(session);
  for (const line of lines) {
    const held = holds.filter(r=>r.lineId===id(line)).reduce((sum,r)=>sum+r.heldQty,0);
    const need = neededQty({ordered:line.quantity,delivered:line.fulfilledQty||0,held});
    if (!need) continue;
    const key = {tenant:tenantId,warehouse:warehouseId,subProduct:line.subproduct,size:line.size};
    const {row,available} = await availableStock(key,session);
    const take = Math.min(need,available);
    if (!take) continue;
    const updated = await Stock.updateOne({...key,currentQuantity:row.currentQuantity,$expr:{$eq:[{$ifNull:['$reservedQuantity',0]},row.reservedQuantity||0]}},
      {$inc:{reservedQuantity:take}},{session});
    if (!updated.modifiedCount) throw new ConflictError('Stock changed while reserving. Try again.');
    await Reservation.updateOne({...key,salesOrder:order._id,lineId:id(line)},
      {$inc:{heldQty:take},$setOnInsert:{consumedQty:0,releasedQty:0}},{session,upsert:true});
    await rollup(key,session);
  }
}
async function changeReservation(args, topUp) {
  const {tenantId,orderId,actorId} = args;
  requireIds(tenantId,orderId);
  return transaction(async session => {
    const order = await SalesOrder.findOne({_id:orderId,tenant:tenantId}).session(session);
    if (!order) throw new NotFoundError('Sales order not found');
    if (!topUp && order.docType==='order' && ['confirmed','partially_fulfilled','fulfilled'].includes(order.orderStatus))
      return order.toObject();
    if (topUp) {
      if (!order.reservationVersion || !['confirmed','partially_fulfilled'].includes(order.orderStatus))
        throw new ConflictError('Only a confirmed reservation order can check availability.');
    } else {
      if (order.locked) throw new ConflictError('Unlock this document before confirming.');
      if (order.invoiceIssuedAt || order.amountPaid>0 || ['paid','partial'].includes(order.paymentStatus))
        throw new ConflictError('This document has payment or invoice evidence. Review the saved order.');
      if (order.docType==='quotation' ? !['draft','sent','accepted'].includes(order.quoteStatus) : order.orderStatus!=='draft')
        throw new ConflictError('Only an active quotation or draft order can be confirmed.');
    }
    const warehouse = await resolveWarehouse(tenantId,topUp ? order.warehouseId : args.warehouseId||order.warehouseId,session);
    await allocate(order,tenantId,warehouse,session);
    if (!topUp) {
      if (order.docType==='quotation') order.quoteStatus='converted';
      order.docType='order'; order.orderStatus='confirmed';
      order.confirmedAt=new Date(); order.confirmedBy=actorId;
      order.reservationVersion=1; order.warehouseId=warehouse;
    }
    // Always write the order: concurrent top-ups on different stock rows must
    // serialize ownership/demand as well as individual stock counters.
    order.markModified('items');
    order.$locals.skipSalesInvoiceSync=true;
    await order.save({session});
    return order.toObject();
  });
}
module.exports = { allocate, confirmReservation:args=>changeReservation(args,false), checkAvailability:args=>changeReservation(args,true) };
