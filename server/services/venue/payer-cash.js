'use strict';
const crypto=require('node:crypto');const {id}=require('./eligibility');const {fail,requireId}=require('./errors');
const {runVenueOperation}=require('./operations');const {visitContext}=require('./lines');
async function collect(args){
 require('./payers').enabled();requireId(args.portionId);
 const context=await visitContext({...args,action:'collection.write'});
 const result=await runVenueOperation({...args,locationId:id(context.location),actor:context.actor,operation:'payer.cash',key:args.idempotencyKey,payload:{sessionId:args.sessionId,portionId:args.portionId,expectedVersion:args.expectedVersion,amountTenderedMinor:args.amountTenderedMinor},execute:async({mongoSession})=>{
  const {visit}=await visitContext({...args,action:'collection.write',mongoSession});
  if(args.locationId&&args.locationId!==id(visit.location))fail('NOT_FOUND','Visit not found',404);
  const bill=await require('../../models/Order').findOne({_id:visit.billOrder,tenant:args.tenantId,venueBillForSession:visit._id,venueMoneyVersion:2}).session(mongoSession);
  if(!bill||visit.acquisition.kind!=='direct'||!visit.posSessionId)fail('VENUE_UNSUPPORTED_TENDER','Cash portions require a direct visit and its existing POS drawer',422);
  if(visit.version!==args.expectedVersion||visit.state!=='closing'||bill.paymentStatus!=='pending')fail('STATE_CHANGED','Refresh the bill');
  const portion=await require('../../models/VenuePayerPortion').findOne({_id:args.portionId,tenant:args.tenantId,session:visit._id,billOrder:bill._id}).session(mongoSession);
  if(!portion)fail('NOT_FOUND','Portion not found',404);
  if(portion.state!=='reserved'||portion.attempt||portion.expiresAt<=new Date())fail('PAYMENT_PENDING','This portion is expired or already has a payment');
  require('./money-rules').minor(args.amountTenderedMinor);if(args.amountTenderedMinor<portion.amountMinor)fail('INVALID_MONEY','Cash must cover this reserved portion',400);
  await require('./accounting').preflightVenueAccounting({tenantId:args.tenantId,snapshot:bill.venueBillSnapshot,method:'cash',mongoSession});
  const drawer=await require('../../models/POSSession').updateOne({_id:visit.posSessionId,tenant:args.tenantId,warehouse:visit.location,status:'open'},{$inc:{__v:1}},{session:mongoSession});if(!drawer.modifiedCount)fail('DRAWER_NOT_OPEN','Bound drawer is not open');
  await require('../../models/Order').updateOne({_id:bill._id,tenant:args.tenantId},{$inc:{venueMoneyLockVersion:1}},{session:mongoSession});
  const changeMinor=args.amountTenderedMinor-portion.amountMinor;
  await require('./financial-policy').preflightCollection({tenantId:args.tenantId,policy:bill.venueFinancialPolicy,mongoSession});
  const [attempt]=await require('../../models/VenuePaymentAttempt').create([{tenant:args.tenantId,location:visit.location,session:visit._id,billOrder:bill._id,payerPortion:portion._id,collectionVersion:2,collectionSlot:`payer:${id(portion)}`,purpose:'venue_bill',policySnapshot:bill.venueFinancialPolicy,method:'cash',amountMinor:portion.amountMinor,reference:`dhv-${crypto.randomUUID()}`,state:'verified',actor:context.actor.userId,key:args.idempotencyKey,requestHash:require('./operations').fingerprint(args.portionId),changeMinor}],{session:mongoSession});
  const [receipt]=await require('../../models/VenuePaymentReceipt').create([{tenant:args.tenantId,location:visit.location,session:visit._id,billOrder:bill._id,collectionVersion:2,purpose:'venue_bill',policySnapshot:bill.venueFinancialPolicy,attempt:attempt._id,provider:'cash',reference:attempt.reference,amountMinor:portion.amountMinor,currency:'NGN',verifiedAt:new Date(),paidAt:new Date()}],{session:mongoSession});
  attempt.receipt=receipt._id;await attempt.save({session:mongoSession});portion.attempt=attempt._id;portion.state='pending';portion.grantVersion++;await portion.save({session:mongoSession});
  visit.version++;await visit.save({session:mongoSession});
  for(const kind of ['post_advance','settle_bill'])await require('./collections').enqueue({tenant:args.tenantId,location:visit.location,kind,targetId:receipt._id,mongoSession});
  return {sessionId:id(visit),receiptId:id(receipt),changeMinor,version:visit.version};
 }});
 let bill;try{bill=await require('./settlement').settleVenueBill({tenantId:args.tenantId,receiptId:result.receiptId,actor:context.actor});}catch{bill=await require('./billing').getBill(args);}
 return {...result,bill};
}
module.exports={collect};
