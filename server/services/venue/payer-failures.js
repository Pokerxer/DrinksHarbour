'use strict';
const mongoose=require('mongoose');const {fail}=require('./errors');
function failureMatches(attempt,result){
 const data=result?.data;
 return result?.success===false&&result.status==='failed'&&result.providerStatus==='failed'&&data?.reference===attempt.reference&&data.currency===attempt.currency&&Number.isSafeInteger(data.amountMinor)&&data.amountMinor===attempt.amountMinor&&/^[\w-]+$/.test(String(data.transactionId||''));
}
async function recordFailure(reference,result){
 const session=await mongoose.startSession();try{return await session.withTransaction(async()=>{
  const attempt=await require('../../models/VenuePaymentAttempt').findOne({reference,method:'paystack',collectionVersion:2,payerPortion:{$ne:null}}).session(session);
  if(!attempt||!failureMatches(attempt,result))fail('PAYMENT_PENDING','Provider outcome has not been conclusively matched');
  if(attempt.receipt||['verified','settled'].includes(attempt.state))return false;
  const portion=await require('../../models/VenuePayerPortion').findOne({_id:attempt.payerPortion,tenant:attempt.tenant,billOrder:attempt.billOrder,attempt:attempt._id}).session(session);
  if(!portion)fail('PAYMENT_REVIEW_REQUIRED');
  if(portion.state==='failed')return true;
  if(portion.state!=='pending')fail('PAYMENT_REVIEW_REQUIRED');
  await require('../../models/Order').updateOne({_id:attempt.billOrder,tenant:attempt.tenant},{$inc:{venueMoneyLockVersion:1}},{session});
  portion.state='failed';await portion.save({session});attempt.state='failed';attempt.providerTransactionId=String(result.data.transactionId);await attempt.save({session});
  await require('../../models/AuditLog').create([{actorUserId:attempt.actor||attempt.payer,actorRole:'system',action:'VENUE_PAYER_FAILURE_VERIFIED',actionCategory:'update',targetType:'VenuePaymentAttempt',targetId:attempt._id,targetTenantId:attempt.tenant,changes:{after:{providerStatus:'failed',reference:attempt.reference,amountMinor:attempt.amountMinor}}}],{session});
  return true;
 });}finally{await session.endSession();}
}
module.exports={failureMatches,recordFailure};
