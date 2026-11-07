'use strict';
const {id}=require('./eligibility');const {fail,requireId}=require('./errors');
async function supportReceipt(args,mongoSession=null){
 requireId(args.tenantId);requireId(args.receiptId);requireId(args.actor?.userId);
 if(id(args.actor.tenantId)!==args.tenantId)fail('NOT_FOUND','Receipt not found',404);
 const user=await require('../../models/User').findOne({_id:args.actor.userId,tenant:args.tenantId,status:'active'}).session(mongoSession).lean();
 const tenant=await require('../../models/Tenant').findOne({_id:args.tenantId}).session(mongoSession).lean();
 if(!user||!tenant||!['tenant_owner','tenant_admin'].includes(user.role)||user.venueDeniedActions?.includes('bill.reconcile'))fail('NOT_FOUND','Receipt not found',404);
 if(tenant.status!=='approved'||tenant.isActive===false)fail('VENUE_DISABLED','Financial support is unavailable',403);
 const receipt=await require('../../models/VenuePaymentReceipt').findOne({_id:args.receiptId,tenant:args.tenantId,collectionVersion:2}).session(mongoSession);
 if(!receipt||args.locationId&&id(receipt.location)!==args.locationId)fail('NOT_FOUND','Receipt not found',404);
 const source=receipt.session?await require('../../models/VenueServiceSession').findOne({_id:receipt.session,tenant:args.tenantId,location:receipt.location}).session(mongoSession).lean():receipt.booking?await require('../../models/Booking').findOne({_id:receipt.booking,tenant:args.tenantId,location:receipt.location}).session(mongoSession).lean():null;
 if(!source)fail('PAYMENT_REVIEW_REQUIRED','Original obligation association requires review');
 const entitlement=require('../entitlements.service').resolveEntitlements(tenant);
 if(!entitlement.writesAllowed||!entitlement.capabilities.includes('table_management')){
  const attempt=await require('../../models/VenuePaymentAttempt').findOne({_id:receipt.attempt,tenant:args.tenantId}).session(mongoSession).lean();
  if(!tenant.venueSubscriptionReadOnlySince||!attempt?.createdAt||new Date(attempt.createdAt)>=new Date(tenant.venueSubscriptionReadOnlySince))fail('SUBSCRIPTION_READ_ONLY','Only prior financial obligations can be resolved');
 }
 return {receipt,tenant,actor:{...args.actor,role:user.role,venueDeniedActions:user.venueDeniedActions||[]}};
}
module.exports={supportReceipt};
