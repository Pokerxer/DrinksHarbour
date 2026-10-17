const Reservation = require('../../models/SalesStockReservation');
const Stock = require('../../models/WarehouseStock');
const SalesOrder = require('../../models/SalesOrder');
const { NotFoundError, ConflictError } = require('../../utils/errors');
const { cancellationReason } = require('../salesOrderPolicy');
const { transaction, requireIds } = require('./transaction');
const { rollup } = require('./stock');
async function releaseOrderReservations({tenantId,orderId,session,lineId}) {
  const rows = await Reservation.find({tenant:tenantId,salesOrder:orderId,heldQty:{$gt:0},...(lineId?{lineId}: {})}).session(session);
  for (const row of rows) {
    const key={tenant:tenantId,warehouse:row.warehouse,subProduct:row.subProduct,size:row.size};
    const changed=await Stock.updateOne({...key,reservedQuantity:{$gte:row.heldQty}},{$inc:{reservedQuantity:-row.heldQty}},{session});
    if (!changed.modifiedCount) throw new ConflictError('Reservation counter needs review; no stock was released.');
    row.releasedQty+=row.heldQty;row.heldQty=0;
    await row.save({session});await rollup(key,session);
  }
}
async function cancelReservedOrder({tenantId,orderId}) {
  requireIds(tenantId,orderId);
  return transaction(async session=>{
    const doc=await SalesOrder.findOne({_id:orderId,tenant:tenantId}).session(session);
    if(!doc)throw new NotFoundError('Sales order not found');
    if(doc.orderStatus==='cancelled')return doc.toObject();
    if(await require('../../models/SalesOrderOperation').exists({tenant:tenantId,salesOrder:orderId,kind:'payment',state:{$in:['pending','needs_review']}}).session(session))
      throw new ConflictError('Payment is pending or needs review before cancellation.');
    const reason=cancellationReason(doc);if(reason)throw new ConflictError(reason);
    await releaseOrderReservations({tenantId,orderId,session});
    doc.orderStatus='cancelled';doc.$locals.skipSalesInvoiceSync=true;
    await doc.save({session});return doc.toObject();
  });
}
module.exports={releaseOrderReservations,cancelReservedOrder};
