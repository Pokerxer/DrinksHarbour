'use strict';
const Case=require('../../models/VenueRefundCase');const Receipt=require('../../models/VenuePaymentReceipt');
const {supportReceipt}=require('./money-support');const {runVenueOperation}=require('./operations');const {fail,requireId}=require('./errors');const {id}=require('./eligibility');const {minor}=require('./money-rules');
const dto=row=>({id:id(row),receiptId:id(row.receipt),amountMinor:row.amountMinor,currency:row.currency,state:row.state,version:row.version,reason:row.reason,providerFeeResolution:row.providerFeeResolution});
function reason(value){if(typeof value!=='string'||!value.trim()||value.length>1000)fail('REFUND_REASON_REQUIRED','Record a review reason',400);return value.trim();}
async function requestRefund(args){
 const initial=await supportReceipt(args);minor(args.amountMinor);if(!args.amountMinor)fail('INVALID_MONEY','Refund must be positive',400);
 const explanation=reason(args.reason);if(!Array.isArray(args.evidence)||!args.evidence.length||args.evidence.length>20||args.evidence.some(e=>typeof e!=='string'||!e.trim()||e.length>400))fail('REFUND_EVIDENCE_REQUIRED','Record scoped evidence references',400);
 return runVenueOperation({...args,actor:initial.actor,locationId:id(initial.receipt.location),operation:'refund.request',key:args.idempotencyKey,payload:{receiptId:args.receiptId,amountMinor:args.amountMinor,reason:explanation,evidence:args.evidence},targetType:'VenueRefundCase',execute:async({mongoSession})=>{
  const {receipt}=await supportReceipt(args,mongoSession);const policy=require('./financial-policy').validatePolicy(receipt.policySnapshot);
  if(receipt.provider!=='paystack'||args.amountMinor>receipt.amountMinor-receipt.refundedMinor-receipt.refundReservedMinor)fail('REFUND_EXCEEDS_RECEIPT','Refund exceeds remaining original funds');
  const pending=await Case.find({tenant:args.tenantId,receipt:receipt._id,state:{$ne:'processed'}}).session(mongoSession).lean();
  const heldUnapplied=pending.reduce((n,c)=>n+Number(c.sourceAmounts.unappliedMinor||0),0),unappliedMinor=Math.min(args.amountMinor,Math.max(0,receipt.unappliedMinor-heldUnapplied));
  const appliedMinor=args.amountMinor-unappliedMinor;
  if(appliedMinor){const bill=await require('../../models/Order').findOne({_id:receipt.billOrder,tenant:args.tenantId,venueSettlementState:'settled'}).session(mongoSession).lean();if(!bill)fail('REFUND_SETTLEMENT_REVIEW_REQUIRED','Part-paid bill requires financial review before an applied refund');}
  receipt.refundReservedMinor+=args.amountMinor;await receipt.save({session:mongoSession});
  const [row]=await Case.create([{tenant:args.tenantId,location:receipt.location,receipt:receipt._id,amountMinor:args.amountMinor,key:args.idempotencyKey,reason:explanation,evidence:args.evidence,requestedBy:args.actor.userId,policySnapshot:policy,sourceAmounts:{unappliedMinor,appliedMinor}}],{session:mongoSession});return dto(row);
 }});
}
async function approveRefund(args){
 requireId(args.caseId);const row=await Case.findOne({_id:args.caseId,tenant:args.tenantId}).lean();if(!row)fail('NOT_FOUND','Refund case not found',404);
 const command={...args,receiptId:id(row.receipt)},initial=await supportReceipt(command);const explanation=reason(args.reason);
 return runVenueOperation({...args,actor:initial.actor,locationId:id(row.location),operation:'refund.approve',key:args.idempotencyKey,payload:{caseId:args.caseId,expectedVersion:args.expectedVersion,reason:explanation},targetType:'VenueRefundCase',execute:async({mongoSession})=>{
  await supportReceipt(command,mongoSession);const current=await Case.findOne({_id:args.caseId,tenant:args.tenantId,location:row.location}).session(mongoSession);
  if(current.state!=='review_required'||current.version!==args.expectedVersion)fail('STATE_CHANGED','Refund review changed');
  current.state='approved';current.approvedBy=args.actor.userId;current.approvalReason=explanation;current.version++;await current.save({session:mongoSession});return dto(current);
 }});
}
async function executeRefund({tenantId,caseId}){
 if(process.env.VENUE_REFUNDS_ENABLED!=='true')fail('REFUND_EXECUTION_NOT_ENABLED','Provider refund execution awaits activation');
 requireId(tenantId);requireId(caseId);
 const session=await require('mongoose').startSession();let row;
 try{row=await session.withTransaction(async()=>{
  const current=await Case.findOne({_id:caseId,tenant:tenantId,state:'approved',submissionStartedAt:null}).session(session);
  if(!current)return null;
  const original=await Receipt.findOne({_id:current.receipt,tenant:tenantId,location:current.location}).session(session).lean();
  await require('./refund-preflight').preflightRefund(current,original,session);
  current.state='submitting';current.submissionStartedAt=new Date();current.version++;await current.save({session});return current;
 });}finally{await session.endSession();}
 if(!row){const existing=await Case.findOne({_id:caseId,tenant:tenantId}).lean();if(!existing)fail('NOT_FOUND','Refund case not found',404);return dto(existing);}
 const receipt=await Receipt.findOne({_id:row.receipt,tenant:row.tenant}).lean();
 try{
  const result=await require('./paystack-refunds').create({reference:receipt.reference,amountMinor:row.amountMinor,currency:row.currency,caseId:id(row)});
  if(!/^[\w-]+$/.test(String(result.id||''))||result.transaction?.reference!==receipt.reference||result.amount!==row.amountMinor||result.currency!==row.currency)throw new Error('Unknown provider refund');
  await Case.updateOne({_id:row._id,tenant:row.tenant,state:'submitting'},{$set:{state:'pending',providerRefundId:String(result.id)}});
 }catch{await Case.updateOne({_id:row._id,tenant:row.tenant,state:'submitting'},{$set:{state:'needs_review',lastErrorCode:'REFUND_SUBMISSION_UNKNOWN'}});}
 return dto(await Case.findOne({_id:row._id,tenant:row.tenant}).lean());
}
async function reconcileRefund({tenantId,caseId}){
 requireId(tenantId);requireId(caseId);const row=await Case.findOne({_id:caseId,tenant:tenantId}).lean();if(!row)fail('NOT_FOUND','Refund case not found',404);
 if(row.state==='processed')return dto(row);if(!row.providerRefundId)fail('REFUND_PENDING','Provider outcome requires review; do not submit again');
 const data=await require('./paystack-refunds').fetch(row.providerRefundId);
 return require('./refund-settlement').recordProcessed(tenantId,caseId,data);
}
async function ensureIndexes(){await require('./advances').ensureIndexes();for(const Model of[Case,require('../../models/VenuePaymentReversal')])await Model.createIndexes();}
module.exports={linkRefundEvidence:require('./refund-evidence').linkRefundEvidence,listCases:require('./money-cases').listCases,requestRefund,approveRefund,executeRefund,reconcileRefund,ensureIndexes,dto};
