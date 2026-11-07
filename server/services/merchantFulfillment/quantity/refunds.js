'use strict';
const mongoose=require('mongoose'),{ConflictError,ValidationError}=require('../../../utils/errors');
const {id,hash}=require('../allocation'),access=require('../access'),range=require('./ranges'),dto=require('../refundView');
const Refund=require('../../../models/MerchantRefundAllocation'),Child=require('../../../models/MerchantOrder'),Group=require('../../../models/MerchantOrderSet');
const fail=()=>{throw new ConflictError('Exact original quantity refund ownership requires reconciliation');};
const overlap=(a,b)=>a.start<b.start+b.quantity&&b.start<a.start+a.quantity;
function canonical(input){
 if(!input||Object.keys(input).some(key=>!['lines','expectedVersion','idempotencyKey','reason'].includes(key))||
   !Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1||typeof input.idempotencyKey!=='string'||!input.idempotencyKey||input.idempotencyKey.length>128||
   typeof input.reason!=='string'||input.reason.trim().length<5||input.reason.length>500||!Array.isArray(input.lines)||!input.lines.length||input.lines.length>100)
   throw new ValidationError('Exact original lines, ranges, version, reason and operation key required');
 const lines=input.lines.map(line=>{
   if(!line||Object.keys(line).some(key=>!['line','ranges'].includes(key))||typeof line.line!=='string'||!/^[a-f\d]{24}$/.test(line.line)||
     !Array.isArray(line.ranges)||!line.ranges.length||line.ranges.length>100||line.ranges.some(row=>!row||Object.keys(row).some(key=>!['start','quantity'].includes(key))))
     throw new ValidationError('Valid original line identity and unit ranges required');
   return {line:line.line,ranges:line.ranges.map(row=>({start:row.start,quantity:row.quantity})).sort((a,b)=>a.start-b.start)};
 }).sort((a,b)=>a.line.localeCompare(b.line));
 if(new Set(lines.map(line=>line.line)).size!==lines.length)fail();
 return lines;
}
async function validateHold(child,parent,line,ranges,session){
 await require('./ownership').owned(child,parent,id(line.line),session);
 const holds=await require('../../../models/OnlineStockReservation').find({order:child.order,tenant:child.tenant,warehouse:child.location,
   merchantOrder:child._id,fulfillmentLineId:id(line.line),reservationVersion:2}).session(session).lean();
 if(holds.length!==1)fail();const hold=holds[0];
 if(hold.quantity!==line.quantity||id(hold.product)!==id(line.product)||id(hold.subProduct)!==id(line.subproduct)||id(hold.size)!==id(line.size))fail();
 const used=range.checked(line.quantity,hold.unitDispositions||[]);
 if(used.reduce((n,row)=>n+row.quantity,0)!==(hold.consumedQuantity||0)+(hold.releasedQuantity||0))fail();
 if((hold.unitDispositions||[]).some(row=>row.action==='release'&&ranges.some(wanted=>overlap(row,wanted))))fail();
}
function assertReserved(row,child){
 if(child.fulfillmentVersion!==2||!row.unitRanges?.length)fail();
 let amountMinor=0,commissionMinor=0,tenantShareMinor=0;
 for(const selected of row.unitRanges){
   const line=child.lines.find(line=>id(line.line)===selected.line),progress=child.quantityProgress?.find(p=>p.line===selected.line);
   if(!line||!progress)fail();
   const expected=range.checked(line.quantity,selected.ranges),blocks=progress.financialBlocks.filter(block=>id(block.refund)===id(row));
   const money=range.money(line,expected);amountMinor+=money.merchandiseMinor;commissionMinor+=money.commissionMinor;tenantShareMinor+=money.tenantShareMinor;
   if(blocks.length!==expected.length||blocks.some(block=>block.kind!=='reserved')||expected.some(wanted=>!blocks.some(block=>block.start===wanted.start&&block.quantity===wanted.quantity)))fail();
 }
 if(amountMinor!==row.amountMinor||commissionMinor!==row.commissionMinor||tenantShareMinor!==row.tenantShareMinor)fail();
 if((child.quantityProgress||[]).reduce((n,p)=>n+p.financialBlocks.filter(block=>id(block.refund)===id(row)).length,0)!==row.unitRanges.reduce((n,line)=>n+line.ranges.length,0))fail();
}
function settleBlocks(row,child){
 assertReserved(row,child);
 for(const progress of child.quantityProgress)for(const block of progress.financialBlocks)if(id(block.refund)===id(row))block.kind='refunded';
 child.version++;
}
async function request(childId,input,actor){
 access.scope(actor,true);const lines=canonical(input),reason=input.reason.trim();
 const refundId=new mongoose.Types.ObjectId(hash(`${childId}:unit-refund:${input.idempotencyKey}`).slice(0,24));
 const fingerprint=hash(JSON.stringify({lines,reason,expectedVersion:input.expectedVersion}));
 const session=await mongoose.startSession();let result;
 try{await session.withTransaction(async()=>{
   const child=access.assertOwned(await Child.findOne({_id:childId,...access.scope(actor,true)}).session(session),actor,true);
   if(child.fulfillmentVersion!==2)fail();
   const prior=await Refund.findById(refundId).session(session);
   if(prior){if(prior.fingerprint!==fingerprint||prior.fulfillmentVersion!==2)fail();result=dto(prior);return;}
   if(child.version!==input.expectedVersion)throw new ConflictError('Merchant order changed; reload');
   const {parent,receipt}=await require('../refundAuthority').original(child,session);
   let amountMinor=0,commissionMinor=0,tenantShareMinor=0;
   for(const selected of lines){
     const line=child.lines.find(line=>id(line.line)===selected.line),progress=child.quantityProgress?.find(row=>row.line===selected.line);
     if(!line||!progress)fail();range.checked(line.quantity,selected.ranges);
     const blocks=range.checked(line.quantity,progress.financialBlocks||[]);
     if(selected.ranges.some(wanted=>blocks.some(block=>overlap(wanted,block))))fail();
     await validateHold(child,parent,line,selected.ranges,session);
     const money=range.money(line,selected.ranges);amountMinor+=money.merchandiseMinor;commissionMinor+=money.commissionMinor;tenantShareMinor+=money.tenantShareMinor;
   }
   const group=await Group.findById(child.order).session(session);
   if(!amountMinor||!group||!group.children.includes(childId)||child.refundReservedMinor+child.refundedMinor+amountMinor>child.merchandiseMinor||
     group.refundReservedMinor+group.refundedMinor+amountMinor>group.totalMinor)fail();
   const [row]=await Refund.create([{_id:refundId,merchantOrder:childId,order:child.order,tenant:child.tenant,fulfillmentVersion:2,unitRanges:lines,
     amountMinor,commissionMinor,tenantShareMinor,currency:parent.currency,provider:receipt.provider,providerTransactionId:receipt.provider==='paystack'?String(receipt.receipt.transactionId):undefined,account:'platform',providerReference:receipt.reference,
     receipt:receipt._id,customer:parent.user,fingerprint,reason,requestedBy:actor._id}],{session});
   for(const selected of lines){const progress=child.quantityProgress.find(p=>p.line===selected.line);
     for(const wanted of selected.ranges)progress.financialBlocks.push({...wanted,refund:refundId,kind:'reserved'});}
   await access.audit(child,actor,'MERCHANT_UNIT_REFUND_REQUEST',{session});
   child.refundReservedMinor+=amountMinor;child.version++;await child.save({session});
   group.refundReservedMinor+=amountMinor;group.version++;await group.save({session});result=dto(row);
 });return result;}finally{await session.endSession();}
}
module.exports={request,assertReserved,settleBlocks};
