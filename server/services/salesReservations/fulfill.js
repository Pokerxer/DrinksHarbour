const SalesOrder = require('../../models/SalesOrder');
const Sales = require('../../models/Sales');
const SubProduct = require('../../models/SubProduct');
const Tenant = require('../../models/Tenant');
const batch = require('../batch.service');
const { buildSalesRow, fulfillStatus } = require('../salesFulfill.helpers');
const { ConflictError, NotFoundError, ValidationError } = require('../../utils/errors');
const { transaction, requireIds } = require('./transaction');
const { resolveWarehouse } = require('./references');
const { consumeOwnedStock } = require('./consume');
const { recordShipment } = require('./history');
const { identity, beginOperation, finishOperation } = require('./operations');
const { id, productLines, qty } = require('./quantities');

async function fulfillReservedOrder(args) {
  const {tenantId,orderId,actorId,warehouseId,items}=args;
  requireIds(tenantId,orderId);
  if(!Array.isArray(items)||!items.length)throw new ValidationError('Select at least one product quantity.');
  const seen=new Set();
  for(const item of items){qty(item.qty);if(!item.qty||seen.has(String(item.lineId)))throw new ValidationError('Each product line must appear once with a positive quantity.');seen.add(String(item.lineId));}
  const op=identity({...args,kind:'fulfill'},{warehouseId:id(warehouseId),items:[...items].sort((a,b)=>String(a.lineId).localeCompare(String(b.lineId)))});
  return transaction(async session=>{
    const operation=await beginOperation(op,session);
    if(operation.previous)return {...operation.previous,duplicate:true};
    const order=await SalesOrder.findOne({_id:orderId,tenant:tenantId,reservationVersion:1}).session(session);
    if(!order)throw new NotFoundError('Reservation order not found');
    if(!['confirmed','partially_fulfilled'].includes(order.orderStatus))throw new ConflictError('Only confirmed orders can be delivered.');
    const warehouse=await resolveWarehouse(tenantId,warehouseId||order.warehouseId,session);
    const tenant=await Tenant.findOne({_id:tenantId}).select('revenueModel commissionPercentage markupPercentage warehouseSettings').session(session).lean();
    const postedLineIds=[];
    for(const requested of items){
      const item=productLines(order.items).find(row=>id(row)===String(requested.lineId));
      if(!item)throw new ValidationError('Product line not found in this order.');
      const key={tenant:tenantId,warehouse,subProduct:item.subproduct,size:item.size};
      const balance=await consumeOwnedStock({tenantId,orderId,lineId:id(item),warehouseId:warehouse,
        subProduct:item.subproduct,size:item.size,quantity:requested.qty,session});
      const sp=await SubProduct.findOne({_id:item.subproduct,tenant:tenantId}).select('costPrice product').session(session).lean();
      if(!sp)throw new ConflictError('Tenant product no longer exists.');
      const product=await require('../../models/Product').findOne({_id:sp.product}).select('tracksBatch').session(session).lean();
      if(product?.tracksBatch)await batch.depleteBatchesFefo({tenantId,warehouseId:warehouse,subProduct:item.subproduct,size:item.size,
        quantity:requested.qty,order:tenant?.warehouseSettings?.fefoPicking?'fefo':'fifo',excludeExpired:!!tenant?.warehouseSettings?.blockExpiredStock},session);
      await recordShipment({key,quantity:requested.qty,...balance,reference:order.soNumber,actorId,product:item.product,orderId,session});
      const payload=buildSalesRow({tenantId,item,qty:requested.qty,paymentMethod:order.paymentMethod||'invoice',unitCost:sp.costPrice||0,
        revenue:{revenueModel:tenant?.revenueModel,commissionPct:tenant?.commissionPercentage},channelDetail:`Sales order ${order.soNumber}`});
      const [sale]=await Sales.create([{...payload,currency:order.currency}],{session});
      order.relatedSales.push(sale._id);item.fulfilledQty=(item.fulfilledQty||0)+requested.qty;item.postedQty=item.fulfilledQty;
      postedLineIds.push(id(item));
    }
    order.fulfillments.push({warehouseId:warehouse,items:items.map(i=>({lineId:String(i.lineId),qty:i.qty})),ref:args.requestId,status:'posted',by:actorId,at:new Date()});
    order.orderStatus=fulfillStatus(productLines(order.items))||order.orderStatus;
    require('../salesSalesperson').completeFulfillment(order,args.actor);
    order.warehouseId=warehouse;order.$locals.skipSalesInvoiceSync=true;await order.save({session});
    const result={order:order.toObject(),posting:{successCount:items.length,failCount:0,failures:[],postedLineIds},duplicate:false};
    await finishOperation(operation.doc,result,session);return result;
  });
}
module.exports={fulfillReservedOrder};
