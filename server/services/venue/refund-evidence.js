'use strict';
const Case=require('../../models/VenueRefundCase');
const {supportReceipt}=require('./money-support');const {runVenueOperation}=require('./operations');
const {fail,requireId}=require('./errors');const {id}=require('./eligibility');
async function linkRefundEvidence(args){
 requireId(args.caseId);
 if(typeof args.providerRefundId!=='string'||! /^[\w-]{1,200}$/.test(args.providerRefundId))fail('REFUND_EVIDENCE_REQUIRED','A valid provider refund ID is required',400);
 if(typeof args.reason!=='string'||!args.reason.trim()||args.reason.length>1000||!Array.isArray(args.evidence)||!args.evidence.length||args.evidence.length>20||args.evidence.some(e=>typeof e!=='string'||!e.trim()||e.length>400))fail('REFUND_EVIDENCE_REQUIRED','Record the review reason and evidence references',400);
 const initial=await Case.findOne({_id:args.caseId,tenant:args.tenantId}).lean();if(!initial)fail('NOT_FOUND','Refund case not found',404);
 const command={...args,receiptId:id(initial.receipt)};const authority=await supportReceipt(command);
 // Read-only verification is outside the retriable transaction. Operator input
 // can identify evidence, but can never declare that a provider refunded money.
 const provider=await require('./paystack-refunds').fetch(args.providerRefundId);
 require('./refund-settlement').validateProvider({...initial,providerRefundId:args.providerRefundId},authority.receipt,provider);
 return runVenueOperation({...args,actor:authority.actor,locationId:id(initial.location),operation:'refund.link_evidence',key:args.idempotencyKey,targetType:'VenueRefundCase',payload:{caseId:args.caseId,expectedVersion:args.expectedVersion,providerRefundId:args.providerRefundId,reason:args.reason.trim(),evidence:args.evidence},execute:async({mongoSession})=>{
  const {receipt}=await supportReceipt(command,mongoSession);const row=await Case.findOne({_id:args.caseId,tenant:args.tenantId,location:initial.location}).session(mongoSession);
  if(!row||row.version!==args.expectedVersion||!row.submissionStartedAt||row.providerRefundId||!['needs_review','submitting'].includes(row.state))fail('STATE_CHANGED','Only an uncertain submitted refund can link new provider evidence');
  require('./refund-settlement').validateProvider({...row.toObject(),providerRefundId:args.providerRefundId},receipt,provider);
  row.providerRefundId=args.providerRefundId;row.state='pending';row.version++;
  row.providerEvidence={linkedBy:authority.actor.userId,linkedAt:new Date(),reason:args.reason.trim(),references:args.evidence,verifiedStatus:String(provider.status||'unknown')};
  await row.save({session:mongoSession});return require('./refunds').dto(row);
 }});
}
module.exports={linkRefundEvidence};
