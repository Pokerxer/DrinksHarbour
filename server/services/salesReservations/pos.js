const mongoose = require('mongoose');
const SalesOrder = require('../../models/SalesOrder');
const Order = require('../../models/Order');
const Operation = require('../../models/SalesOrderOperation');
const { ConflictError, NotFoundError } = require('../../utils/errors');
const { requireIds, transactionFailure } = require('./transaction');
const { resolveWarehouse } = require('./references');
const { consumeOwnedStock } = require('./consume');
const { recordShipment } = require('./history');
const { identity, beginOperation, finishOperation } = require('./operations');
const { settleReceipt, replayResponse } = require('./posReceipt');
const { matchingLine } = require('../linkedReturns.helpers');
const { id } = require('./quantities');

// This transaction is invoked once, never automatically retried around the
// existing POS wallet/tender code. A conflict requires the same requestId retry.
async function beginPOSSale(args){
  const {tenantId,orderId,warehouseId,actorId,payload}=args;
  requireIds(tenantId,orderId);
  const op=identity({...args,kind:'pos'},payload);
  const session=await mongoose.startSession();session.startTransaction();
  let committed=false,uncertain=false;
  const abort=async()=>{if(session.inTransaction())await session.abortTransaction();};
  const close=async()=>{try{if(!committed&&!uncertain)await abort();}finally{await session.endSession();}};
  try{
    const operation=await beginOperation(op,session);
    if(operation.previous){await close();return {duplicate:true,response:replayResponse(operation.previous)};}
    const order=await SalesOrder.findOne({_id:orderId,tenant:tenantId,reservationVersion:1}).session(session);
    if(!order)throw new NotFoundError('Reservation order not found');
    if(!['confirmed','partially_fulfilled'].includes(order.orderStatus))throw new ConflictError('Only confirmed orders can be sold through POS.');
    if(order.total>0&&order.amountPaid>=order.total)throw new ConflictError('This order is already paid. Use Delivery instead of charging again.');
    await resolveWarehouse(tenantId,warehouseId,session);
    if(await Operation.exists({tenant:tenantId,salesOrder:orderId,kind:{$in:['payment','pos']},state:{$in:['pending','needs_review']},_id:{$ne:operation.doc._id}}).session(session))
      throw new ConflictError('An order payment is pending or needs review. Do not charge through POS.');
    const consumed=new Map();let receiptPayload;
    return {
      duplicate:false,abort,close,
      mutateWallet:args=>require('../wallet.service').mutateWallet({...args,session}),
      consumeLine:async({subProductId,sizeId,quantity,tracksBatch=false,blockExpiredStock=false,fefoPicking=false})=>{
        const line=matchingLine(order,{subproduct:subProductId,size:sizeId});
        if(!line)throw new ConflictError('POS line does not uniquely match this order.');
        const total=(consumed.get(id(line))||0)+quantity;
        if(total>line.quantity-(line.fulfilledQty||0))throw new ConflictError('POS quantity exceeds this order’s remaining demand.');
        const balance=await consumeOwnedStock({tenantId,orderId,lineId:id(line),warehouseId,subProduct:line.subproduct,size:line.size,quantity,session});
        await recordShipment({key:{tenant:tenantId,warehouse:warehouseId,subProduct:line.subproduct,size:line.size},
          quantity,...balance,reference:args.receiptNumber||order.soNumber,actorId,product:line.product,orderId,session});
        const batchAllocations=tracksBatch ? await require('../batch.service').depleteBatchesFefo({tenantId,warehouseId,
          subProduct:line.subproduct,size:line.size,quantity,order:fefoPicking?'fefo':'fifo',excludeExpired:blockExpiredStock},session):[];
        consumed.set(id(line),total);return {...balance,batchAllocations};
      },
      createReceipt:async data=>{
        receiptPayload=data;
        const receipt=new Order(data);receipt.$locals.deferAccounting=true;
        await receipt.save({session});return receipt;
      },
      commitReceipt:async receipt=>{
        await settleReceipt({order,receipt,consumed,tenantId,warehouseId,actorId,actor:args.actor,session});
        await finishOperation(operation.doc,{receipt:receipt.toObject(),displayItems:receiptPayload.items},session);
        try{await session.commitTransaction();committed=true;}
        catch(error){
          if(error.hasErrorLabel?.('UnknownTransactionCommitResult')){
            uncertain=true;
            const saved=await Operation.findOne(op.key).lean().catch(()=>null);
            if(saved?.state==='settled')committed=true;
            else{
              await Operation.updateOne(op.key,{$setOnInsert:{...op.key,fingerprint:op.fingerprint,state:'needs_review',result:{receiptId:receipt._id}}},{upsert:true}).catch(()=>{});
              const conflict=new ConflictError('Payment/receipt outcome needs review. Retry only this requestId; do not create another charge.');
              conflict.reservationCommitUncertain=true;throw conflict;
            }
          }else throw error;
        }
        receipt.$session(null);order.$session(null);
        // Financial projections run only after the stock/receipt commit.
        // Projection failures must never trigger tender compensation after commit.
        await require('../accounting.orders').captureOrderAccounting(receipt).catch(error=>console.error('Reserved POS accounting projection:',error.message));
        await require('../customerInvoice/hooks').sourceSaved(receipt,'pos').catch(error=>console.error('Reserved POS invoice projection:',error.message));
      },
    };
  }catch(error){await close();throw transactionFailure(error);}
}
module.exports={beginPOSSale};
