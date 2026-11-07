"use strict";
const mongoose=require('mongoose');
const {ConflictError}=require('../../utils/errors');
const {id,hash}=require('./allocation');
const {basisFor,postCost}=require('./goodsCostBasis');
async function cancelGoodsAccounting({parent,child,actor,session}){
  if(!session?.inTransaction())throw new ConflictError('Goods cancellation requires an owning transaction');
  if(parent.merchantFulfillmentVersion!==1||parent.settlementOwner!=='platform'||parent.currency!=='NGN'||
    id(child.order)!==id(parent)||!['pending','accepted','picking'].includes(child.state)||child.shippedAt||child.deliveredAt)
    throw new ConflictError('Original goods cost accounting requires reconciliation before cancellation');
  const {basis,original}=await basisFor(parent,child,session,1);
  if(basis.cancellations.some(row=>row.merchantOrder===id(child)))return;
  const amount=basis.lines.filter(line=>line.merchantOrder===id(child)).reduce((n,line)=>n+line.costMinor,0);
  const journalRef=new mongoose.Types.ObjectId(hash(`${id(child)}:goods-cancel-v1`).slice(0,24));
  await postCost({basis,original,child,amount,journalRef,actor,session});
}
module.exports={cancelGoodsAccounting};
