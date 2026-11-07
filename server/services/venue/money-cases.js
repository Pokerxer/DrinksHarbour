'use strict';
const {fail,requireId}=require('./errors');const {id}=require('./eligibility');
async function listCases(args){
 requireId(args.tenantId);requireId(args.locationId);requireId(args.actor?.userId);
 if(id(args.actor.tenantId)!==args.tenantId)fail('NOT_FOUND','Location not found',404);
 const user=await require('../../models/User').findOne({_id:args.actor.userId,tenant:args.tenantId,status:'active'}).lean();
 const tenant=await require('../../models/Tenant').findOne({_id:args.tenantId,status:'approved',isActive:{$ne:false}}).lean();
 if(!user||!tenant||!['tenant_owner','tenant_admin'].includes(user.role)||user.venueDeniedActions?.includes('bill.reconcile'))fail('NOT_FOUND','Location not found',404);
 if(args.after)requireId(args.after);
 const receipts=await require('../../models/VenuePaymentReceipt').find({tenant:args.tenantId,location:args.locationId,collectionVersion:2,$or:[{resolution:{$ne:'none'}},{refundReservedMinor:{$gt:0}},{refundedMinor:{$gt:0}}],...(args.after?{_id:{$gt:args.after}}:{})}).sort({_id:1}).limit(51).lean();
 const cases=await require('../../models/VenueRefundCase').find({tenant:args.tenantId,location:args.locationId,receipt:{$in:receipts.map(r=>r._id)}}).sort({createdAt:1}).lean();
 const items=[];for(const receipt of receipts.slice(0,50)){
  await require('./money-support').supportReceipt({...args,receiptId:id(receipt)});
  items.push({receiptId:id(receipt),purpose:receipt.purpose,amountMinor:receipt.amountMinor,currency:receipt.currency,appliedMinor:receipt.appliedMinor,unappliedMinor:receipt.unappliedMinor,refundedMinor:receipt.refundedMinor,resolution:receipt.resolution,
   refunds:cases.filter(c=>id(c.receipt)===id(receipt)).map(require('./refunds').dto)});
 }
 return {items,next:receipts.length>50?id(receipts[49]):null,providerExecutionEnabled:process.env.VENUE_REFUNDS_ENABLED==='true'};
}
module.exports={listCases};
