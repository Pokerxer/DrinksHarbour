'use strict';
const mongoose=require('mongoose');
const Quote=require('../../models/MerchantDeliveryQuote'),Shipment=require('../../models/MerchantShipment'),Event=require('../../models/MerchantShipmentEvent'),Child=require('../../models/MerchantOrder');
const access=require('../merchantFulfillment/access'),{load,hash,provider,key}=require('./scope');
const {ConflictError,NotFoundError,ValidationError}=require('../../utils/errors');
async function quote(id,input,actor){
 provider(input?.provider);
 const {child,snapshot}=await load(id,actor,true);
 if(!['pending','accepted','picking'].includes(child.state))throw new ConflictError('Merchant state cannot receive delivery quotes');
 await access.audit({...snapshot,_id:child._id},actor,'pickup_quote_created');
 return (await Quote.create({...snapshot,createdBy:actor._id,action:'pickup_quote_created',expiresAt:new Date(Date.now()+15*60*1000)})).toObject();
}
function replay(row,operationHash){if(row.operationHash!==operationHash)throw new ConflictError('Merchant order already booked with another operation');return row;}
async function book(id,input,actor){
 access.scope(actor,true);key(input?.idempotencyKey);
 if(!mongoose.isValidObjectId(input?.quoteId))throw new ValidationError('Valid quoteId required');
 const operationHash=hash([id,String(input.quoteId),input.idempotencyKey]);
 const shipmentId=hash(['pickup',id]);
 let result;const session=await mongoose.startSession();
 try{
  await session.withTransaction(async()=>{
   const {child,snapshot}=await load(id,actor,true,session);
   const existing=await Shipment.findOne({_id:shipmentId,...access.scope(actor,true)}).session(session).lean();
   if(existing){result=replay(existing,operationHash);await access.audit(existing,actor,'pickup_booking_replayed',{session});return;}
   const q=await Quote.findOne({_id:input.quoteId,merchantOrder:id,...access.scope(actor,true)}).session(session).lean();
   if(!q)throw new NotFoundError('Delivery quote not found for scope');
   if(q.scopeHash!==snapshot.scopeHash)throw new ConflictError('Delivery quote scope changed');
   if(q.expiresAt.getTime()<=Date.now())throw new ConflictError('Delivery quote expired');
   if(q.bookedShipment)throw new ConflictError('Delivery quote already booked');
   if(!['accepted','picking'].includes(child.state))throw new ConflictError('Accept merchant order before pickup booking');
   // Conflict with concurrent child actions without changing their lifecycle/version.
   const locked=await Child.updateOne({_id:id,version:child.version,state:child.state},{$set:{updatedAt:new Date()}},{session});
   if(locked.matchedCount!==1)throw new ConflictError('Merchant order changed during booking');
   await Quote.updateOne({_id:q._id},{$set:{bookedShipment:shipmentId}},{session});
   const [saved]=await Shipment.create([{_id:shipmentId,...snapshot,quote:q._id,operationHash,bookedBy:actor._id,action:'pickup_booked'}],{session});result=saved.toObject();await access.audit(result,actor,'pickup_booked',{session});
  });
 }catch(error){
  if(error.code!==11000)throw error;
  const existing=await Shipment.findOne({_id:shipmentId,...access.scope(actor,true)}).lean();
  if(!existing)throw error;result=replay(existing,operationHash);await access.audit(existing,actor,'pickup_booking_replayed');
 }finally{await session.endSession();}
 return result;
}
async function ownedShipment(id,actor,write=false){return access.assertOwned(await Shipment.findOne({_id:id,...access.scope(actor,write)}).lean(),actor,write);}
async function get(id,actor){const row=await ownedShipment(id,actor);await access.audit(row,actor,'pickup_shipment_read');return {...row,events:await Event.find({shipment:row._id,tenant:row.tenant}).sort({merchantVersion:1}).lean()};}
async function refreshTracking(id,actor){
 const row=await ownedShipment(id,actor,true);
 const child=access.assertOwned(await Child.findOne({_id:row.merchantOrder,...access.scope(actor,true)}).lean(),actor,true);
 await access.audit(row,actor,'pickup_tracking_recorded');
 const eventId=hash([id,child.version]);
 await Event.updateOne({_id:eventId},{$setOnInsert:{shipment:id,tenant:row.tenant,recordedBy:actor._id,state:child.state,merchantVersion:child.version,source:'merchant_order'}},{upsert:true});
 return get(id,actor);
}
module.exports={quote,book,get,refreshTracking};
