'use strict';
const Booking=require('../../models/Booking');const {requireId,fail}=require('./errors');const {id}=require('./eligibility');const {runVenueOperation}=require('./operations');
async function cancelRequest({customerId,reference,expectedVersion,idempotencyKey}){
 requireId(customerId);if(typeof reference!=='string'||reference.length>80)fail('NOT_FOUND','Request not found',404);
 if(!Number.isInteger(expectedVersion)||expectedVersion<0)fail('STATE_CHANGED','Request version required');
 const query={createdBy:customerId,requestReference:reference,requestMode:'request_only'};
 const original=await Booking.findOne(query).lean();if(!original)fail('NOT_FOUND','Request not found',404);
 return runVenueOperation({targetType:'Booking',tenantId:id(original.tenant),locationId:id(original.location),actor:{userId:customerId,role:'customer'},operation:'request.cancel',key:idempotencyKey,payload:{reference,expectedVersion},execute:async({mongoSession})=>{
  const row=await Booking.findOne({...query,tenant:original.tenant,location:original.location}).session(mongoSession);
  if(!row||row.requestVersion!==expectedVersion||!['pending','confirmed'].includes(row.status)||row.serviceSession)fail('STATE_CHANGED','Request changed; reload or contact the venue');
  await require('./capacity').releaseClaim({tenantId:id(row.tenant),locationId:id(row.location),bookingId:id(row)},mongoSession);
  const receipts=await require('../../models/VenuePaymentReceipt').find({tenant:row.tenant,booking:row._id,purpose:'venue_deposit'}).session(mongoSession);
  for(const receipt of receipts){if(receipt.amountMinor>receipt.refundedMinor){receipt.resolution='paid_needs_resolution';await receipt.save({session:mongoSession});row.moneyState='paid_needs_resolution';await require('./collections').enqueue({tenant:row.tenant,location:row.location,kind:'money_resolution',targetId:receipt._id,mongoSession});}}
  row.status='cancelled';row.capacitySnapshot=row.capacitySnapshot?{...row.capacitySnapshot,state:'released'}:null;row.requestState='cancelled';row.requestVersion+=1;await row.save({session:mongoSession});
  return require('./reservations').requestDTO(row);
 }});
}
module.exports={cancelRequest};
