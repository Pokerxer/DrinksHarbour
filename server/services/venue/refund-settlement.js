'use strict';
const mongoose=require('mongoose');const Case=require('../../models/VenueRefundCase');const Receipt=require('../../models/VenuePaymentReceipt');
const {fail}=require('./errors');const {id}=require('./eligibility');const {refundShares}=require('./money-rules');
function validateProvider(row,receipt,data){if(!data||String(data.transaction?.reference)!==receipt.reference||data.currency!==receipt.currency||!Number.isSafeInteger(data.amount)||data.amount!==row.amountMinor||String(data.id)!==row.providerRefundId)fail('REFUND_PROVIDER_MISMATCH','Provider refund does not match its original receipt');return data;}
async function recordProcessed(tenantId,caseId,data){
 const session=await mongoose.startSession();try{return await session.withTransaction(async()=>{
  const row=await Case.findOne({_id:caseId,tenant:tenantId}).session(session);if(!row)fail('NOT_FOUND','Refund case not found',404);
  const receipt=await Receipt.findOne({_id:row.receipt,tenant:row.tenant,location:row.location}).session(session);if(!receipt)fail('PAYMENT_REVIEW_REQUIRED');
  validateProvider(row,receipt,data);if(data.status!=='processed')fail('REFUND_PENDING','Refund has not completed');if(row.state==='processed')return {id:id(row),state:row.state,version:row.version};
  if(receipt.refundReservedMinor<row.amountMinor||receipt.refundedMinor+row.amountMinor>receipt.amountMinor)fail('REFUND_EXCEEDS_RECEIPT');
  await require('./refund-preflight').preflightRefund(row,receipt,session);const now=new Date();
  const policy=require('./financial-policy').validatePolicy(row.policySnapshot),source=row.sourceAmounts;
  const allocations=await require('../../models/VenuePaymentAllocation').find({tenant:row.tenant,receipt:receipt._id,collectionVersion:2}).session(session).lean();
  const commission=allocations.reduce((n,a)=>n+Number(a.commissionMinor||0),0),tax=allocations.reduce((n,a)=>n+Number(a.taxMinor||0),0);
  const financial=allocations.reduce((n,a)=>n+Number(a.financialMinor||0),0);
  const previous=receipt.appliedRefundedMinor||0;
  const shares=source.appliedMinor?refundShares({amountMinor:receipt.appliedMinor,commissionMinor:commission},source.appliedMinor,previous):{commissionMinor:0};
  const components=source.appliedMinor?require('./refund-components').refundComponents({appliedMinor:receipt.appliedMinor,taxMinor:tax,financialMinor:financial},source.appliedMinor,previous):{taxMinor:0,financialMinor:0,merchandiseMinor:0};
  const {taxMinor,financialMinor}=components,lines=[];
  const add=(account,debit=0,credit=0)=>lines.push({account,debit:debit/100,credit:credit/100});
  if(source.unappliedMinor)add(policy.accounts.advance,source.unappliedMinor);
  if(source.appliedMinor){if(components.merchandiseMinor)add('4000',components.merchandiseMinor);if(financialMinor)add(policy.accounts.shortfall,financialMinor);if(taxMinor)add('2100',taxMinor);}
  add(policy.accounts.clearing,0,row.amountMinor);
  if(shares.commissionMinor){add(policy.accounts.clearing,shares.commissionMinor);add('6000',0,shares.commissionMinor);}
  await require('../journalEntry.service').postJournalEntry({tenantId:row.tenant,refDoc:row._id,refDocType:'VenueRefundCase',entryType:'refund',source:'venue_refund',date:now,lines,postedBy:row.approvedBy,memo:'Verified original-collection refund',session});
  await require('../../models/VenuePaymentReversal').create([{tenant:row.tenant,location:row.location,receipt:receipt._id,caseId:row._id,billOrder:receipt.billOrder,amountMinor:row.amountMinor,appliedMinor:source.appliedMinor,unappliedMinor:source.unappliedMinor,commissionMinor:shares.commissionMinor,taxMinor,financialMinor,policySnapshot:row.policySnapshot}],{session});
  receipt.refundedMinor+=row.amountMinor;receipt.refundReservedMinor-=row.amountMinor;receipt.unappliedMinor-=source.unappliedMinor;receipt.appliedRefundedMinor=previous+source.appliedMinor;await receipt.save({session});
  if(source.appliedMinor){const bill=await require('../../models/Order').findOne({_id:receipt.billOrder,tenant:row.tenant}).session(session);if(!bill||bill.venueSettlementState!=='settled')fail('REFUND_SETTLEMENT_REVIEW_REQUIRED');bill.venueRefundedMinor=(bill.venueRefundedMinor||0)+source.appliedMinor;bill.paymentStatus=bill.venueRefundedMinor>=bill.venueBillSnapshot.totalMinor?'refunded':'partially_refunded';bill.$locals.deferAccounting=true;await bill.save({session});}
  row.state='processed';row.processedAt=now;row.version++;await row.save({session});
  await require('../../models/AuditLog').create([{actorUserId:row.approvedBy,actorRole:'system',action:'VENUE_REFUND_PROCESSED',actionCategory:'update',targetType:'VenueRefundCase',targetId:row._id,targetTenantId:row.tenant,changes:{after:{amountMinor:row.amountMinor,receiptId:id(receipt),commissionReversedMinor:shares.commissionMinor,providerFeeResolution:'review_required'}}}],{session});
  return {id:id(row),state:row.state,version:row.version};
 });}finally{await session.endSession();}
}
module.exports={recordProcessed,validateProvider};
