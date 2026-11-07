'use strict';
const crypto=require('node:crypto');const Booking=require('../../models/Booking');
const {publicLocation}=require('./public-experience');const {validateRequest}=require('./experience-validation');
const {runVenueOperation}=require('./operations');const {loadVenueContext}=require('./context');const {requireId,fail}=require('./errors');const {id}=require('./eligibility');
function requestDTO(row){row=row.toObject?row.toObject():row;return {id:id(row),reference:row.requestReference,status:row.status,requestState:row.requestState,version:row.requestVersion,bookingAt:new Date(row.bookingAt).toISOString(),partySize:row.partySize,guest:{name:row.guest.name,phone:row.guest.phone},locationId:id(row.location),serviceSessionId:id(row.serviceSession)||null,policy:row.requestPolicy,payment:require('./payment-quote').paymentQuote(row),capacity:row.capacitySnapshot||null,statusLabel:row.requestState==='expired'&&row.moneyState!=='paid_needs_resolution'?'Expired':row.moneyState==='paid_needs_resolution'?'Payment received — venue review required':row.capacitySnapshot?.state==='held'&&row.status==='confirmed'?'Awaiting deposit':row.status==='pending'?'Awaiting venue confirmation':row.status==='checked_in'?'Checked in':row.status==='cancelled'?(row.requestState==='declined'?'Declined':'Cancelled'):row.status};}
async function submitRequest(args){
 requireId(args.customerId);const input=validateRequest(args.input);const context=await publicLocation({...args,request:true});
 const actor={userId:args.customerId,tenantId:id(context.tenant),role:'customer'};
 const customer=await require('../../models/User').findOne({_id:args.customerId,status:'active',role:'customer'}).select('_id').lean();
 if(!customer)fail('NOT_FOUND','Customer not found',404);
 const source=args.source==='direct'?'direct':'discovery';
 return runVenueOperation({targetType:'Booking',tenantId:id(context.tenant),locationId:id(context.location),actor,operation:'request.submit',key:args.idempotencyKey,payload:{...input,source},execute:async({mongoSession})=>{
  const fresh=await publicLocation({...args,request:true,mongoSession});
  const [booking]=await Booking.create([{tenant:fresh.tenant._id,location:fresh.location._id,createdBy:customer._id,...input,status:'pending',source,acquisitionAuthority:'server',requestMode:'request_only',requestReference:`VR-${crypto.randomUUID()}`,requestState:'submitted',requestVersion:0,requestPolicy:{timezone:fresh.config.profile.timezone,policies:fresh.config.profile.policies,profileVersion:fresh.config.profileVersion,locationName:fresh.config.profile.name,venueName:fresh.tenant.name}}],{session:mongoSession});
  return requestDTO(booking);
 }});
}
async function ownedRequest({customerId,reference}){
 requireId(customerId);if(typeof reference!=='string'||reference.length>80)fail('NOT_FOUND','Request not found',404);
 const row=await Booking.findOne({createdBy:customerId,requestReference:reference,requestMode:'request_only'}).lean();if(!row)fail('NOT_FOUND','Request not found',404);return {...requestDTO(row),payment:await require('./payment-quote').ownedPaymentSummary(row)};
}
async function ownedRequests({customerId,after,limit=20}){
 requireId(customerId);if(after)requireId(after);const count=Math.min(Math.max(Number(limit)||20,1),50);
 const rows=await Booking.find({createdBy:customerId,requestMode:'request_only',...(after?{_id:{$lt:after}}:{})}).sort({_id:-1}).limit(count+1).lean();return {items:rows.slice(0,count).map(requestDTO),next:rows.length>count?id(rows[count-1]):null};
}
async function listRequests(args){
 await loadVenueContext({...args,action:'experience.read'});const rows=await Booking.find({tenant:args.tenantId,location:args.locationId,requestMode:'request_only',...(args.after?{_id:{$gt:requireId(args.after)}}:{})}).sort({_id:1}).limit(51).lean();return {items:rows.slice(0,50).map(requestDTO),next:rows.length>50?id(rows[49]):null};
}
async function reviewRequest(args){
 if(args.action==='accept')return require('./capacity-bookings').acceptRequest(args);
 requireId(args.bookingId);if(!['review','decline','amend'].includes(args.action))fail('INVALID_INPUT','Unsupported request action',400);
 const input=args.action==='amend'?validateRequest(args.input):null;
 if(!Number.isInteger(args.expectedVersion)||args.expectedVersion<0)fail('STATE_CHANGED','Request version required');
 const context=await loadVenueContext({...args,action:'requests.review'});
 return runVenueOperation({targetType:'Booking',tenantId:args.tenantId,locationId:args.locationId,actor:context.actor,operation:`request.${args.action}`,key:args.idempotencyKey,payload:{bookingId:args.bookingId,expectedVersion:args.expectedVersion,input},execute:async({mongoSession})=>{
  await loadVenueContext({...args,action:'requests.review',mongoSession});
  const row=await Booking.findOne({_id:args.bookingId,tenant:args.tenantId,location:args.locationId,requestMode:'request_only'}).session(mongoSession);
  if(!row)fail('NOT_FOUND','Request not found',404);
  if(row.requestVersion!==args.expectedVersion||row.status!=='pending'||row.serviceSession)fail('STATE_CHANGED','Request changed; reload before editing');
  if(input){row.guest=input.guest;row.bookingAt=input.bookingAt;row.partySize=input.partySize;}
  row.requestState=args.action==='decline'?'declined':'reviewed';if(args.action==='decline')row.status='cancelled';row.requestVersion+=1;
  await row.save({session:mongoSession});return requestDTO(row);
 }});
}
module.exports={cancelRequest: require('./cancel-request').cancelRequest,requestDTO,submitRequest,ownedRequest,ownedRequests,listRequests,reviewRequest};
