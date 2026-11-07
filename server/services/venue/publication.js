'use strict';
const mongoose=require('mongoose');
const Config=require('../../models/VenueLocationProfile');
const {fail,requireId}=require('./errors');
const {id,resolveVenueEligibility}=require('./eligibility');
// Called only by the explicit operator CLI, never a public or tenant endpoint.
async function reviewProfile({tenantId,locationId,expectedVersion,profileVersion,reviewerId,apply=false}){
 for(const value of [tenantId,locationId,reviewerId])requireId(value);
 const session=await mongoose.startSession();
 try{return await session.withTransaction(async()=>{
  const reviewer=await require('../../models/User').findOne({_id:reviewerId,role:'super_admin',status:'active'}).session(session).lean();
  if(!reviewer)fail('VENUE_PERMISSION_DENIED','An active platform publication reviewer is required',403);
  const tenant=await require('../../models/Tenant').findOne({_id:tenantId}).session(session).lean();
  const location=await require('../../models/Warehouse').findOne({_id:locationId,tenant:tenantId,isActive:true}).session(session).lean();
  const config=await Config.findOne({tenant:tenantId,location:locationId}).session(session);
  if(!config||!location)fail('NOT_FOUND','Location configuration not found',404);
  if(config.version!==expectedVersion||config.profileVersion!==profileVersion)fail('STATE_CHANGED','Configuration changed; preview again');
  if(!resolveVenueEligibility({tenant,action:'public.discover'}).allowed)fail('VENUE_NOT_PUBLIC','Paid eligibility and tenant publication grant must be reviewed first',403);
  if(!location.venueServices?.enabled||!location.venueServices.reviewedAt)fail('VENUE_NOT_CONFIGURED','Review the operational location mapping first',409);
  const profile=require('./experience-validation').validateProfile(config.profile);
  if(profile.timezone!==location.venueServices.timezone)fail('INVALID_MAPPING','Public and operational timezone must match',409);
  const result={mode:apply?'apply':'preview',tenantId,locationId,expectedVersion,profileVersion,profile,alreadyReviewed:config.reviewedProfileVersion===profileVersion&&!!config.reviewedAt};
  if(apply&&!result.alreadyReviewed){
   config.reviewedProfileVersion=profileVersion;config.reviewedBy=reviewerId;config.reviewedAt=new Date();await config.save({session});
   await require('../../models/AuditLog').create([{actorUserId:reviewerId,actorRole:'super_admin',action:'VENUE_PROFILE_PUBLICATION_REVIEW',actionCategory:'update',targetType:'VenueLocationProfile',targetId:config._id,targetTenantId:tenantId,changes:{after:{locationId,profileVersion}}}],{session});
  }
  return result;
 });}finally{await session.endSession();}
}
module.exports={reviewProfile};
