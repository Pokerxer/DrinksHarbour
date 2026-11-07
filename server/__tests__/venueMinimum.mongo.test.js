'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),mongoose=require('mongoose');
const {connectVenueMongo,fixture,beverage}=require('./helpers/venueMongo');
for(const reservedMinor of [0,4000000])test(`minimum financial line and capped advance reconcile on one canonical beverage bill (reserved refund ${reservedMinor})`,async t=>{
 await connectVenueMongo(t,'minimum');const args=await fixture(),item=await beverage(args);item.quantity=1;
 await require('../models/Size').updateOne({_id:item.sizeId,tenant:args.tenantId},{$set:{sellingPrice:160000}});await require('../models/SubProduct').updateOne({_id:item.subProductId,tenant:args.tenantId},{$set:{baseSellingPrice:160000}});
 await require('../services/venue/service-sessions').ensureIndexes();await require('../services/venue/billing').ensureIndexes();await require('../services/venue/advances').ensureIndexes();
 const customer=new mongoose.Types.ObjectId();await require('../models/User').collection.insertOne({_id:customer,role:'customer',status:'active'});
 const policy={tenant:args.tenantId,location:args.locationId,version:7,state:'approved',approvedBy:args.actor.userId,approvedAt:new Date(),decisionOwner:'Synthetic finance review',currency:'NGN',depositMinor:5000000,paymentWindowSeconds:600,minimumMinor:20000000,minimumTerms:'Disclosed minimum NGN200000 eligible net merchandise',cancellationTerms:'Review',noShowTerms:'Review',excessCreditTerms:'Review',refundAuthority:'owner_review',refundFunding:'original_collection',taxTreatment:'existing_merchandise',eligibility:'merchandise_net',excludedSubProducts:[],shortfallClassification:'service_shortfall',shortfallTaxRate:0,shortfallTaxDecision:'synthetic-exempt-policy-7',accounts:{advance:'2250',clearing:'1300',shortfall:'4050'}};
 const booking=await require('../models/Booking').create({tenant:args.tenantId,location:args.locationId,createdBy:customer,guest:{name:'Guest',phone:'123'},partySize:2,bookingAt:new Date(),source:'discovery',status:'confirmed',acquisitionAuthority:'server',financialPolicy:policy});
 await assert.rejects(require('../services/venue/service-sessions').ensureServiceSession({...args,bookingId:String(booking._id),idempotencyKey:'unaccepted-arrival'}),e=>e.code==='FINANCIAL_TERMS_NOT_ACCEPTED');
 await require('../models/Booking').updateOne({_id:booking._id},{$set:{financialTermsVersion:7,financialTermsAcceptedAt:new Date()}});
 const visit=await require('../services/venue/service-sessions').ensureServiceSession({...args,bookingId:String(booking._id),idempotencyKey:'arrival'});
 const accepted=await require('../services/venue/lines').setSessionLines({...args,sessionId:visit.id,expectedVersion:visit.version,lines:[item],idempotencyKey:'lines'});
 const command={...args,sessionId:visit.id,expectedVersion:accepted.version,lineVersion:accepted.lineVersion,ageVerified:true,idempotencyKey:'freeze'};
 await require('../models/Booking').updateOne({_id:booking._id},{$unset:{financialTermsVersion:1}});
 await assert.rejects(require('../services/venue/billing').ensureBillOrder(command),e=>e.code==='FINANCIAL_TERMS_NOT_ACCEPTED');
 await require('../models/Booking').updateOne({_id:booking._id},{$set:{financialTermsVersion:7,financialTermsAcceptedAt:new Date()}});
 const attempt=await require('../models/VenuePaymentAttempt').create({tenant:args.tenantId,location:args.locationId,booking:booking._id,payer:customer,purpose:'venue_deposit',collectionVersion:2,collectionSlot:'minimum-deposit',method:'paystack',amountMinor:5000000,reference:'dhv-minimum',state:'verified',key:'deposit',requestHash:'synthetic',policySnapshot:policy});
 const receipt=await require('../models/VenuePaymentReceipt').create({tenant:args.tenantId,location:args.locationId,booking:booking._id,session:visit.id,payer:customer,purpose:'venue_deposit',collectionVersion:2,attempt:attempt._id,provider:'paystack',reference:attempt.reference,providerTransactionId:'minimum-local',amountMinor:5000000,currency:'NGN',verifiedAt:new Date(),unappliedMinor:5000000,policySnapshot:policy});
 if(reservedMinor){await require('../services/venue/refunds').ensureIndexes();await require('../services/venue/refunds').requestRefund({...args,receiptId:String(receipt._id),amountMinor:reservedMinor,reason:'Original advance refund review',evidence:['local-review'],idempotencyKey:'reserved-refund'});}
 const bill=await require('../services/venue/billing').ensureBillOrder(command);
 assert.equal(bill.totalMinor,20000000);assert.equal(bill.outstandingMinor,15000000+reservedMinor);assert.equal(bill.commissionMinor,1440000);assert.equal(bill.financialLines[0].amountMinor,4000000);assert.equal(bill.financialLines[0].account,undefined);
 const again=await require('../services/venue/billing').ensureBillOrder(command);assert.equal(again.orderId,bill.orderId);assert.equal(again.financialLines.length,1);
 assert.equal(await require('../models/Product').countDocuments(),1);assert.equal(await require('../models/Order').countDocuments({venueBillForSession:visit.id}),1);assert.equal(await require('../models/WarehouseMovement').countDocuments(),0);
});
