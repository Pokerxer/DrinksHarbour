const SalesOrder = require('../../models/SalesOrder');
const Reservation = require('../../models/SalesStockReservation');
const Stock = require('../../models/WarehouseStock');
const { ConflictError, NotFoundError } = require('../../utils/errors');
const { productLines, id, qty } = require('./quantities');
const { expiryState, rollup } = require('./stock');

async function consumeOwnedStock({tenantId,orderId,lineId,warehouseId,subProduct,size,quantity,session}) {
  qty(quantity); if(!session?.inTransaction()) throw new ConflictError('Reservation consumption requires a transaction.');
  const order=await SalesOrder.findOne({_id:orderId,tenant:tenantId,reservationVersion:1}).session(session);
  if(!order || !['confirmed','partially_fulfilled'].includes(order.orderStatus))throw new NotFoundError('Confirmed reservation order not found');
  const line=productLines(order.items).find(row=>id(row)===String(lineId));
  if(!line || id(line.subproduct)!==id(subProduct) || id(line.size)!==id(size))throw new ConflictError('Reservation line does not match this sale.');
  if(quantity<=0 || quantity>Math.max(0,line.quantity-(line.fulfilledQty||0)))throw new ConflictError('Requested delivery exceeds the original remaining quantity.');
  const key={tenant:tenantId,warehouse:warehouseId,subProduct,size};
  const row=await Stock.findOne(key).session(session).lean();
  if(!row)throw new ConflictError('No stock at this warehouse.');
  const holds=await Reservation.find({tenant:tenantId,salesOrder:orderId,lineId:String(lineId),heldQty:{$gt:0}}).session(session);
  const own=holds.filter(r=>id(r.warehouse)===id(warehouseId)).reduce((s,r)=>s+r.heldQty,0);
  const reserved=row.reservedQuantity||0;
  if(reserved<own)throw new ConflictError('Reservation stock counter needs review.');
  const expiry=await expiryState(key,session);
  const extraExpired=Math.max(0,expiry.expired-expiry.quarantinedExpired);
  if(row.currentQuantity-(reserved-own)-extraExpired<quantity)
    throw new ConflictError('Insufficient unreserved stock or usable owned reservation at this warehouse.');
  const used=Math.min(quantity,own);
  const changed=await Stock.updateOne({...key,currentQuantity:row.currentQuantity,$expr:{$eq:[{$ifNull:['$reservedQuantity',0]},reserved]}},
    {$inc:{currentQuantity:-quantity,reservedQuantity:-used}},{session});
  if(!changed.modifiedCount)throw new ConflictError('Stock changed; retry this delivery with the same requestId.');
  let remaining=used;
  for(const hold of holds.filter(r=>id(r.warehouse)===id(warehouseId))){
    const take=Math.min(remaining,hold.heldQty);hold.heldQty-=take;hold.consumedQty+=take;remaining-=take;await hold.save({session});
  }
  if(quantity>used)await Reservation.updateOne({...key,salesOrder:orderId,lineId:String(lineId)},
    {$inc:{consumedQty:quantity-used},$setOnInsert:{heldQty:0,releasedQty:0}},{session,upsert:true});
  // Shipping from another location releases only the corresponding portion of
  // the old hold; untouched demand stays protected at its original location.
  let moved=quantity-used;
  for(const hold of holds.filter(r=>id(r.warehouse)!==id(warehouseId))){
    const take=Math.min(moved,hold.heldQty);if(!take)continue;
    const oldKey={tenant:tenantId,warehouse:hold.warehouse,subProduct:hold.subProduct,size:hold.size};
    const released=await Stock.updateOne({...oldKey,reservedQuantity:{$gte:take}},{$inc:{reservedQuantity:-take}},{session});
    if(!released.modifiedCount)throw new ConflictError('Source reservation counter needs review.');
    hold.heldQty-=take;hold.releasedQty+=take;moved-=take;
    await hold.save({session});await rollup(oldKey,session);
  }
  await rollup(key,session);
  return {before:row.currentQuantity,after:row.currentQuantity-quantity};
}
module.exports={consumeOwnedStock};
