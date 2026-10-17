const Reservation = require('../../models/SalesStockReservation');
const { productLines, id, neededQty } = require('./quantities');
async function projectReservations(docs, tenantId, session = null) {
  if (!docs.some(doc=>doc.reservationVersion)) return docs;
  const rows = docs.map(doc=>typeof doc.toObject==='function'?doc.toObject():doc);
  const holds = await Reservation.find({tenant:tenantId,salesOrder:{$in:rows.filter(d=>d.reservationVersion).map(d=>d._id)},heldQty:{$gt:0}})
    .session(session).lean();
  const warehouses = await require('../../models/Warehouse').find({tenant:tenantId,_id:{$in:[...new Set(holds.map(r=>id(r.warehouse)))]}})
    .select('name').session(session).lean();
  const names = new Map(warehouses.map(row=>[id(row),row.name]));
  return rows.map(doc => !doc.reservationVersion ? doc : {...doc,items:(doc.items||[]).map(item=>{
    if (!productLines([item]).length) return item;
    const own = holds.filter(r=>id(r.salesOrder)===id(doc)&&r.lineId===id(item));
    const reservedQty=own.reduce((sum,r)=>sum+r.heldQty,0);
    return {...item,reservedQty,waitingQty:doc.orderStatus==='cancelled'?0:neededQty({ordered:item.quantity,delivered:item.fulfilledQty||0,held:reservedQty}),
      reservations:own.map(r=>({warehouseId:r.warehouse,warehouseName:names.get(id(r.warehouse))||'Reservation location',quantity:r.heldQty}))};
  })});
}
module.exports = { projectReservations };
