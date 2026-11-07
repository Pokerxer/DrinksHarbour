'use strict';
const {fail}=require('./errors');
// This runs before submission and again before posting. A provider refund must
// never be initiated while the supported ledger adapter cannot represent it.
async function preflightRefund(row,receipt,mongoSession=null){
 if(!receipt||String(receipt.tenant)!==String(row.tenant)||String(receipt.location)!==String(row.location))fail('PAYMENT_REVIEW_REQUIRED');
 const policy=require('./financial-policy').validatePolicy(row.policySnapshot);
 const tenant=await require('../../models/Tenant').findOne({_id:row.tenant}).session(mongoSession).lean();
 if(!tenant||tenant.status!=='approved'||tenant.isActive===false)fail('VENUE_DISABLED','Financial support is unavailable',403);
 if(tenant.venueSettings?.accountingClosedThrough&&new Date()<=new Date(tenant.venueSettings.accountingClosedThrough))fail('ACCOUNTING_PERIOD_CLOSED');
 const {minor}=require('./money-rules');const source=row.sourceAmounts;
 for(const value of[row.amountMinor,source?.unappliedMinor,source?.appliedMinor,receipt.refundedMinor,receipt.refundReservedMinor,receipt.unappliedMinor,receipt.appliedMinor,receipt.appliedRefundedMinor||0])minor(value);
 if(source.unappliedMinor+source.appliedMinor!==row.amountMinor||receipt.refundReservedMinor<row.amountMinor||receipt.refundedMinor+row.amountMinor>receipt.amountMinor)fail('REFUND_EXCEEDS_RECEIPT');
 if(source.unappliedMinor>receipt.unappliedMinor||source.appliedMinor>receipt.appliedMinor-(receipt.appliedRefundedMinor||0))fail('REFUND_SOURCE_REVIEW_REQUIRED','Original refundable source changed; review the reserved allocation');
 const codes=new Map([[policy.accounts.clearing,'asset']]);
 if(source.unappliedMinor)codes.set(policy.accounts.advance,'liability');
 if(source.appliedMinor){
  const bill=await require('../../models/Order').findOne({_id:receipt.billOrder,tenant:row.tenant,venueSettlementState:'settled'}).session(mongoSession).lean();
  if(!bill)fail('REFUND_SETTLEMENT_REVIEW_REQUIRED');
  codes.set('4000','income');
  const allocations=await require('../../models/VenuePaymentAllocation').find({tenant:row.tenant,receipt:receipt._id,collectionVersion:2}).session(mongoSession).lean();
  if(!allocations.length||allocations.reduce((n,a)=>n+Number(a.amountMinor||0),0)!==receipt.appliedMinor)fail('REFUND_SOURCE_REVIEW_REQUIRED','Original applied allocation evidence requires review');
  const totals=allocations.reduce((n,a)=>({taxMinor:n.taxMinor+Number(a.taxMinor||0),financialMinor:n.financialMinor+Number(a.financialMinor||0)}),{taxMinor:0,financialMinor:0});
  require('./refund-components').refundComponents({appliedMinor:receipt.appliedMinor,...totals},source.appliedMinor,receipt.appliedRefundedMinor||0);
  if(allocations.some(a=>a.taxMinor>0))codes.set('2100','liability');
  if(allocations.some(a=>a.commissionMinor>0))codes.set('6000','expense');
  if(allocations.some(a=>a.financialMinor>0))codes.set(policy.accounts.shortfall,'income');
 }
 const posted=await require('../../models/JournalEntry').exists({tenant:row.tenant,refDoc:receipt._id,refDocType:'VenuePaymentReceipt',entryType:'customer_payment',status:'posted'}).session(mongoSession);
 if(!posted)fail('REFUND_LEDGER_REVIEW_REQUIRED','Post the original verified receipt before refund execution or reversal');
 const accounts=await require('../../models/Account').find({tenant:row.tenant,code:{$in:[...codes.keys()]},isActive:true}).session(mongoSession).lean();
 if([...codes].some(([code,type])=>!accounts.some(a=>a.code===code&&a.type===type)))fail('REFUND_ACCOUNT_REVIEW_REQUIRED','Review active refund account mappings');
 return policy;
}
module.exports={preflightRefund};
