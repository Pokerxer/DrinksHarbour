'use strict';
const mongoose=require('mongoose');const Claim=require('../../models/VenueCapacityClaim');
async function expireHolds({now=new Date(),limit=50}={}){
 const rows=await Claim.find({state:'held',expiresAt:{$lte:now}}).sort({expiresAt:1}).limit(Math.min(100,Math.max(0,limit))).select('_id tenant location booking').lean();let expired=0;
 for(const candidate of rows){const session=await mongoose.startSession();try{const committed=await session.withTransaction(async()=>{
  const row=await Claim.findOne({_id:candidate._id,tenant:candidate.tenant,location:candidate.location,state:'held',expiresAt:{$lte:now}}).session(session);if(!row)return;
  await require('./capacity').lockTables({tenantId:String(row.tenant),locationId:String(row.location)},row.resources.map(String),session,{occupied:true});
  row.state='expired';row.version++;await row.save({session});
  const booking=await require('../../models/Booking').findOne({_id:row.booking,tenant:row.tenant,location:row.location,capacityClaim:row._id,status:'confirmed',serviceSession:null}).session(session);
  if(booking){booking.status='cancelled';booking.requestState='expired';booking.requestVersion++;booking.capacitySnapshot=require('./capacity').dto(row);await booking.save({session});}
  // Phase-4 E3 (additive): a claim that a waitlist OFFER was riding expires → the
  // entry transitions offered→expired and its still-pending offer Booking is
  // cancelled — an expired offer can never confirm or charge (11 §3). Entries in
  // every other state are untouched: acceptance is recorded history, and the
  // post-acceptance booking lifecycle (e.g. a missed deposit deadline) stays the
  // existing booking/claim machinery's business, never a waitlist rewind.
  const waitlistEntry=await require('../../models/VenueWaitlistEntry').findOne({tenant:row.tenant,'offer.claimRef':row._id,state:'offered'}).session(session);
  if(waitlistEntry){waitlistEntry.state='expired';waitlistEntry.version++;await waitlistEntry.save({session});
   const offerBooking=await require('../../models/Booking').findOne({_id:waitlistEntry.offer.bookingRef,tenant:row.tenant,location:row.location,status:'pending',serviceSession:null}).session(session);
   if(offerBooking){offerBooking.status='cancelled';offerBooking.requestState='expired';offerBooking.requestVersion++;await offerBooking.save({session});}}
  return true;
 });if(committed)expired++;}finally{await session.endSession();}}
 return {expired};
}
module.exports={expireHolds};
