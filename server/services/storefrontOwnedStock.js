'use strict';
const Stock=require('../models/WarehouseStock'),Batch=require('../models/WarehouseBatch');
const {rollup}=require('./salesReservations/stock');const{ConflictError}=require('../utils/errors');
// Shared physical mutation for whole V1 and exact unit-range V2 ownership.
async function applyOwnedStock({hold,quantity,action,batches,reference,orderId,actorId,session}){
 if(!session?.inTransaction()||!Number.isSafeInteger(quantity)||quantity<1||!['consume','release'].includes(action))throw new ConflictError('Valid owned stock transaction required');
 const key={tenant:hold.tenant,warehouse:hold.warehouse,subProduct:hold.subProduct,size:hold.size};
 const stock=await Stock.findOneAndUpdate({...key,reservedQuantity:{$gte:quantity},...(action==='consume'?{currentQuantity:{$gte:quantity}}:{})},{$inc:{reservedQuantity:-quantity,...(action==='consume'?{currentQuantity:-quantity}:{})}},{session,returnDocument:'after'});
 if(!stock)throw new ConflictError('Owned stock counter needs reconciliation');
 if(action==='release'){
  for(const allocation of batches){const restored=await Batch.updateOne({_id:allocation.batch,...key},{$inc:{quantity:allocation.quantity}},{session});if(!restored.modifiedCount)throw new ConflictError('Owned batch allocation is unavailable');}
 }else{
  await require('../models/WarehouseMovement').create([{...key,type:'shipped',quantity,balanceBefore:stock.currentQuantity+quantity,balanceAfter:stock.currentQuantity,stockChange:-quantity,reference,performedBy:actorId}],{session});
  await require('../models/InventoryMovement').create([{...key,product:hold.product,type:'shipped',category:'out',quantity,quantityBefore:stock.currentQuantity+quantity,quantityAfter:stock.currentQuantity,reference,referenceType:'order',relatedOrder:orderId,source:'system',status:'confirmed',performedBy:actorId}],{session});
  await require('../models/SubProduct').updateOne({_id:hold.subProduct,tenant:hold.tenant},{$inc:{totalSold:quantity}},{session});
 }
 await rollup(key,session);return stock;
}
module.exports={applyOwnedStock};
