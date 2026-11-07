'use strict';
const router=require('express').Router();const rateLimit=require('express-rate-limit');
const asyncHandler=require('../utils/asyncHandler');const {protect,attachTenant,requireOwnTenant}=require('../middleware/auth.middleware');
const {venueActor}=require('../middleware/venue.middleware');const {id,resolveVenueEligibility}=require('../services/venue/eligibility');
const {staffCommands,staffConfigurations}=require('../middleware/venue-rate-limit.middleware');
const {validateKey}=require('../services/venue/operations');const {fail,requireId}=require('../services/venue/errors');
const publicAPI=require('../services/venue/public-experience');const experience=require('../services/venue/experience');const requests=require('../services/venue/reservations');
router.use((req,res,next)=>(process.env.VENUE_EXPERIENCE_ENABLED==='true'||(/^\/(?:me\/requests|payers)(?:\/|$)/.test(req.path)||/^\/staff\/locations\/[a-f\d]{24}\/(?:money-cases|refunds)(?:\/|$)/i.test(req.path)))?next():res.status(404).json({success:false,message:'Venue experience is not enabled'}));
const send=(res,data,status=200)=>res.set('Cache-Control','no-store').status(status).json({success:true,data});
const args=req=>({tenantId:id(req.user.tenant),locationId:req.params.locationId,actor:venueActor(req)});
const key=req=>validateKey(req.get('Idempotency-Key'));
require('./venue-capacity.routes').publicRoutes(router,send);
router.get('/public',asyncHandler(async(req,res)=>send(res,await publicAPI.listLocations(req.query))));
router.get('/public/:slug',asyncHandler(async(req,res)=>send(res,await publicAPI.listLocations({...req.query,slug:req.params.slug}))));
router.get('/public/:slug/:locationSlug',asyncHandler(async(req,res)=>send(res,await publicAPI.publicDetail(req.params))));
// Phase-4 E1: public occurrence discovery — rides the same gated public segment and
// VENUE_EXPERIENCE_ENABLED pattern as every other /public read (no carve-out added).
router.get('/public/:slug/:locationSlug/events',asyncHandler(async(req,res)=>send(res,await publicAPI.publicOccurrences(req.params))));
// Phase-4 E2: public guest-list REQUEST submission — the same request-only pattern as
// the booking requests route: customer JWT + the 10/hour public limiter + channel
// verification. A request is NEVER an admission; staff approval gates entitlement
// issuance and the door enforces the shared cap.
router.post('/public/:slug/:locationSlug/events/:occurrenceId/guest-lists',protect,rateLimit({windowMs:3600000,limit:10}),asyncHandler(async(req,res)=>{
 const source=require('../services/venue/channel').verifyChannel({channel:req.get('x-venue-channel'),issued:req.get('x-venue-issued'),signature:req.get('x-venue-signature'),...req.params,body:JSON.stringify(req.body)});
 send(res,await require('../services/venue/guestlists').submitPublic({...req.params,customerId:id(req.user),input:req.body.input,source,idempotencyKey:key(req)}),201);
}));
// Phase-4 E3: public WAITLIST join — DECIDED (plan Task 1): it mirrors the
// guest-list public submit carve-out exactly (customer JWT + 10/hour limiter +
// channel HMAC, the booking-requests shape; no new VENUE_EXPERIENCE_ENABLED
// carve-out) because a full house is exactly the guest situation the waitlist
// exists for. Occurrence-scoped when an occurrenceId is sent in the body
// (published, current-or-future — the 404 discipline), otherwise location-scoped;
// verifiedContactRoute is RECORDED, never sent.
router.post('/public/:slug/:locationSlug/waitlist',protect,rateLimit({windowMs:3600000,limit:10}),asyncHandler(async(req,res)=>{
 require('../services/venue/channel').verifyChannel({channel:req.get('x-venue-channel'),issued:req.get('x-venue-issued'),signature:req.get('x-venue-signature'),...req.params,body:JSON.stringify(req.body)});
 send(res,await require('../services/venue/waitlist').submitPublic({...req.params,customerId:id(req.user),input:req.body.input,occurrenceId:req.body.occurrenceId,idempotencyKey:key(req)}),201);
}));
router.post('/public/:slug/:locationSlug/requests',protect,rateLimit({windowMs:3600000,limit:10}),asyncHandler(async(req,res)=>{
 const source=require('../services/venue/channel').verifyChannel({channel:req.get('x-venue-channel'),issued:req.get('x-venue-issued'),signature:req.get('x-venue-signature'),...req.params,body:JSON.stringify(req.body)});
 send(res,await requests.submitRequest({...req.params,customerId:id(req.user),input:req.body,source,idempotencyKey:key(req)}),201);
}));
require('./venue-money.routes').customerRoutes(router,send);
router.get('/me/requests',protect,asyncHandler(async(req,res)=>send(res,await requests.ownedRequests({customerId:id(req.user),after:req.query.after,limit:req.query.limit}))));
router.get('/me/requests/:reference',protect,asyncHandler(async(req,res)=>send(res,await requests.ownedRequest({customerId:id(req.user),reference:req.params.reference}))));
router.post('/me/requests/:reference/cancel',protect,rateLimit({windowMs:60000,limit:20,message:{success:false,code:'RATE_LIMITED',message:'Too many cancellation attempts. Please wait a moment.'}}),asyncHandler(async(req,res)=>send(res,await requests.cancelRequest({customerId:id(req.user),reference:req.params.reference,expectedVersion:req.body.expectedVersion,idempotencyKey:key(req)}))));
router.use('/staff',protect,attachTenant,requireOwnTenant);
router.get('/staff/locations',asyncHandler(async(req,res)=>{
 const actor=venueActor(req);const manager=['tenant_owner','tenant_admin'].includes(actor.role);
 const rows=await require('../models/Warehouse').find({tenant:id(req.user.tenant),isActive:true,...(!manager?{venueStaff:req.user._id}:{})}).select('_id tenant name venueStaff venueServices').lean();
 const permitted=[];
 for(const location of rows){try{await require('../services/venue/context').loadVenueContext({tenantId:id(req.user.tenant),locationId:id(location),actor,action:'experience.read'});permitted.push({id:id(location),name:location.name});}catch(error){if(!['NOT_FOUND','VENUE_PERMISSION_DENIED','SUBSCRIPTION_READ_ONLY','PLAN_UPGRADE_REQUIRED','VENUE_NOT_CONFIGURED','VENUE_NOT_PUBLIC'].includes(error.code))throw error;}}
 send(res,permitted);
}));
router.get('/staff/locations/:locationId',asyncHandler(async(req,res)=>send(res,await experience.workspace(args(req)))));
require('./venue-money.routes').staffRoutes(router,args,send);
require('./venue-capacity.routes').staffRoutes(router,args,send);
router.put('/staff/locations/:locationId/:kind',staffConfigurations,asyncHandler(async(req,res)=>send(res,await experience.saveConfiguration({...args(req),kind:req.params.kind,input:req.body.input,expectedVersion:req.body.expectedVersion,idempotencyKey:key(req)}))));
router.get('/staff/locations/:locationId/catalog',asyncHandler(async(req,res)=>send(res,await experience.menuCandidates({...args(req),after:req.query.after}))));
router.get('/staff/locations/:locationId/requests',asyncHandler(async(req,res)=>send(res,await requests.listRequests({...args(req),after:req.query.after}))));
router.post('/staff/locations/:locationId/requests/:bookingId/:action',staffCommands,asyncHandler(async(req,res)=>{
 const input={...args(req),bookingId:req.params.bookingId,action:req.params.action,expectedVersion:req.body.expectedVersion,input:req.body.input,idempotencyKey:key(req)};
 if(req.params.action!=='check-in')return send(res,await requests.reviewRequest(input));
 const context=await require('../services/venue/context').loadVenueContext({...args(req),action:'requests.review'});
 requireId(input.bookingId);
 const booking=await require('../models/Booking').findOne({_id:input.bookingId,tenant:input.tenantId,location:input.locationId,requestMode:'request_only'}).lean();
 if(!booking)fail('NOT_FOUND','Request not found',404);
 if(booking.requestVersion!==input.expectedVersion)fail('STATE_CHANGED','Request changed; reload before seating');
 send(res,await require('../services/venue/service-sessions').ensureServiceSession({...args(req),actor:context.actor,bookingId:input.bookingId,expectedBookingVersion:input.expectedVersion,tableIds:req.body.tableIds,expectedTableVersions:req.body.expectedTableVersions,idempotencyKey:input.idempotencyKey}));
}));
module.exports=router;
