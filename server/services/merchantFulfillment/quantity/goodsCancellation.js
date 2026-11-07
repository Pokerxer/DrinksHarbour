'use strict';
const mongoose=require('mongoose'),{ConflictError}=require('../../../utils/errors');
const {id}=require('../allocation'),{basisFor,postCost}=require('../goodsCostBasis'),range=require('./ranges');
const fail=()=>{throw new ConflictError('Original quantity goods cost requires reconciliation before cancellation');};
const overlap=(a,b)=>a.start<b.start+b.quantity&&b.start<a.start+a.quantity;
async function cancelQuantityGoodsAccounting({parent,child,lines,allocationId,actor,session}){
 if(!session?.inTransaction())throw new ConflictError('Goods cancellation requires an owning transaction');
 if(parent.merchantFulfillmentVersion!==2||child.fulfillmentVersion!==2||parent.currency!=='NGN'||parent.settlementOwner!=='platform'||
   id(parent)!==id(child.order)||!mongoose.isValidObjectId(allocationId)||!Array.isArray(lines)||!lines.length)fail();
 if(new Set(lines.map(line=>line.line)).size!==lines.length)fail();
 const selected=lines.map(input=>{
   const line=child.lines.find(line=>id(line.line)===input.line);if(!line||!input.ranges?.length)fail();
   return {line:input.line,ranges:range.checked(line.quantity,input.ranges)};
 }).sort((a,b)=>a.line.localeCompare(b.line));
 const {basis,original}=await basisFor(parent,child,session,2),allocation=id(allocationId);
 const prior=basis.cancellations.find(row=>row.allocation===allocation);
 if(prior){
   const saved=prior.unitRanges.map(line=>({line:line.line,ranges:line.ranges.map(row=>({start:row.start,quantity:row.quantity}))}));
   if(prior.merchantOrder!==id(child)||JSON.stringify(saved)!==JSON.stringify(selected))fail();return;
 }
 let amount=0;
 for(const input of selected){
   const line=child.lines.find(line=>id(line.line)===input.line),progress=child.quantityProgress?.find(p=>p.line===input.line);
   if(!progress)fail();
   const refunded=range.checked(line.quantity,progress.financialBlocks.filter(block=>block.kind==='refunded'));
   if(input.ranges.some(wanted=>refunded.reduce((n,block)=>n+Math.max(0,Math.min(wanted.start+wanted.quantity,block.start+block.quantity)-Math.max(wanted.start,block.start)),0)!==wanted.quantity))fail();
   const holds=await require('../../../models/OnlineStockReservation').find({order:parent._id,tenant:child.tenant,warehouse:child.location,
     reservationVersion:2,merchantOrder:child._id,fulfillmentLineId:input.line}).session(session).lean();
   if(holds.length!==1)fail();const hold=holds[0];
   if(hold.quantity!==line.quantity||id(hold.product)!==id(line.product)||id(hold.subProduct)!==id(line.subproduct)||id(hold.size)!==id(line.size))fail();
   const used=range.checked(line.quantity,hold.unitDispositions||[]);
   if(input.ranges.some(wanted=>used.some(row=>overlap(row,wanted))))fail();
   for(const entry of basis.cancellations)for(const priorLine of entry.unitRanges||[])
     if(priorLine.line===input.line&&input.ranges.some(wanted=>priorLine.ranges.some(row=>overlap(wanted,row))))fail();
   const cost=basis.lines.find(row=>row.line===input.line&&row.merchantOrder===id(child));if(!cost)fail();
   amount+=range.rangeAmount(cost.costMinor,line.quantity,input.ranges);
 }
 await postCost({basis,original,child,amount,journalRef:new mongoose.Types.ObjectId(allocationId),actor,session,evidence:{allocation,unitRanges:selected}});
}
module.exports={cancelQuantityGoodsAccounting};
