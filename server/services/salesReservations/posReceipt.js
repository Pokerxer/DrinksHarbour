const Sales = require('../../models/Sales');
const { ConflictError } = require('../../utils/errors');
const { productLines, id } = require('./quantities');
const { fulfillStatus, mapPaymentMethod } = require('../salesFulfill.helpers');
const { matchingLine } = require('../linkedReturns.helpers');
async function settleReceipt({order,receipt,consumed,tenantId,warehouseId,actorId,actor,session}) {
  if(id(receipt.tenant)!==id(tenantId)||id(receipt.linkedSalesOrder)!==id(order))throw new ConflictError('Receipt does not belong to this reservation order.');
  const receiptQty=new Map();
  for(const item of receipt.items){
    const line=matchingLine(order,item);if(!line)throw new ConflictError('Receipt product line is ambiguous.');
    receiptQty.set(id(line),(receiptQty.get(id(line))||0)+item.quantity);
    const [sale]=await Sales.create([{tenant:tenantId,order:receipt._id,product:item.product,subproduct:item.subproduct,size:item.size,
      quantity:item.quantity,priceAtSale:item.priceAtPurchase,itemSubtotal:item.itemSubtotal,
      finalItemPrice:item.priceAtPurchase,discountAmount:item.discountAmount||0,
      tenantAmount:item.tenantRevenueShare||0,platformAmount:item.platformCommission||0,
      revenueModelUsed:item.tenantRevenueModel||'markup',paymentMethod:mapPaymentMethod(receipt.paymentMethod),
      channel:'tenant_pos',channelDetail:`POS ${receipt.receiptNumber}`,currency:order.currency}],{session});
    order.relatedSales.push(sale._id);
  }
  if(receiptQty.size!==consumed.size || [...consumed].some(([lineId,quantity])=>receiptQty.get(lineId)!==quantity))
    throw new ConflictError('Receipt quantities do not match reserved stock consumption.');
  for(const line of productLines(order.items))if(consumed.has(id(line))){
    line.fulfilledQty=(line.fulfilledQty||0)+consumed.get(id(line));line.postedQty=line.fulfilledQty;
  }
  order.fulfillments.push({warehouseId,items:[...consumed].map(([lineId,qty])=>({lineId,qty})),
    ref:receipt.receiptNumber,status:'reconciled',at:new Date(),by:actorId,paymentMethod:receipt.paymentMethod});
  order.orderStatus=fulfillStatus(productLines(order.items))||order.orderStatus;
  if(order.orderStatus==='fulfilled') {
    const attribution=require('../salesSalesperson');
    attribution.completeFulfillment(order,await attribution.fulfillmentActorForReceipt(receipt,actor,tenantId,session));
  }
  const collected=Math.max(0,(receipt.totalAmount||0)-(receipt.tipAmount||0)-(receipt.roundingAmount||0)-(receipt.paymentDetails?.accountCharge||0));
  order.amountPaid=Math.min(order.total,Math.round(((order.amountPaid||0)+collected)*100)/100);
  order.paymentStatus=order.amountPaid>=order.total&&order.total>0?'paid':order.amountPaid>0?'partial':'unpaid';
  order.warehouseId=warehouseId;order.$locals.skipSalesInvoiceSync=true;
  await order.save({session});
}
function replayResponse(result){
  const r=result.receipt;
  return {success:true,duplicate:true,data:{order:{...r,total:r.totalAmount,
    items:r.items.map((item,index)=>({...item,name:result.displayItems?.[index]?._name||'Product'})),
    amountTendered:r.paymentDetails?.amount||r.totalAmount,change:r.paymentDetails?.change||0,
    placedAt:r.placedAt,splitPayments:r.paymentDetails?.splitPayments}}};
}
module.exports={settleReceipt,replayResponse};
