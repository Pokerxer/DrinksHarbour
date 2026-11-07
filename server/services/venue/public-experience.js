'use strict';
const Config=require('../../models/VenueLocationProfile');
const Tenant=require('../../models/Tenant');const Warehouse=require('../../models/Warehouse');
const {resolveVenueEligibility,id}=require('./eligibility');const {fail}=require('./errors');
const validSlug=value=>typeof value==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
async function publicLocation({slug,locationSlug,request=false,mongoSession=null}) {
 if(!validSlug(slug)||!validSlug(locationSlug))fail('NOT_FOUND','Venue location not found',404);
 const tenant=await Tenant.findOne({slug,status:'approved',isActive:{$ne:false}}).session(mongoSession).lean();
 if(!tenant||!resolveVenueEligibility({tenant,action:request?'public.request':'public.discover'}).allowed)fail('NOT_FOUND','Venue location not found',404);
 const config=await Config.findOne({tenant:tenant._id,slug:locationSlug}).session(mongoSession).lean();
 const location=config&&await Warehouse.findOne({_id:config.location,tenant:tenant._id,isActive:true}).session(mongoSession).lean();
 if(!config?.profile||!config.reviewedBy||!config.reviewedAt||config.reviewedProfileVersion!==config.profileVersion||!location?.venueServices?.enabled||!location.venueServices.reviewedAt)fail('NOT_FOUND','Venue location not found',404);
 if(config.profile.timezone!==location.venueServices.timezone)fail('NOT_FOUND','Venue location not found',404);
 if(request&&!location.venueServices.capabilities?.includes('request_bookings'))fail('NOT_FOUND','Requests unavailable at this location',404);
 return {tenant,location,config};
}
function profileDTO({tenant,location,config}) {
 const publicProfile=Object.fromEntries(['slug','name','types','timezone','description','address','hours','exceptions','policies','publicPhone','photos'].filter(key=>config.profile[key]!==undefined).map(key=>[key,config.profile[key]]));
 return {tenant:{id:id(tenant),name:tenant.name,slug:tenant.slug,logo:tenant.logo?.url||typeof tenant.logo==='string'&&tenant.logo||undefined,city:tenant.address?.city||tenant.city},locationId:id(location),version:config.profileVersion,...publicProfile,bookingMode:location.venueServices.capabilities?.includes('request_bookings')?'request':'disabled',retailAvailable:tenant.businessCapabilities?.includes('retail')===true};
}
async function publicDetail(args) {
 const context=await publicLocation(args);
 const menu=await require('./experience').projectMenu(context,context.config.menu);
 const events=await occurrenceList(context);
 return {...profileDTO(context),menu,events};
}
// Phase-4 E1 — public occurrence READ (discovery only). Published, CURRENT-or-FUTURE
// (venue-local service date via clock.businessDate) occurrences of a reviewed,
// public-discoverable location. Safe projection: name/slug/service date/UTC instants/
// admissionTerms/minimumAge plus an availability SUMMARY that guarantees NOTHING —
// the Phase-1 request-only discipline ("Availability may change. A request requires
// staff acceptance."); there is no ordering/payment promise here (spec §4 R-row).
// No guest PII (occurrences carry none) and no capacity internals (maxGuests/
// maxTables/room are staff-side LIMIT definitions on the shared capacity ledger).
const AVAILABILITY_MESSAGE='Capacity is limited and entry is arranged with the venue directly. Availability may change; age and admission terms apply at the door.';
function occurrenceDTO(row){
 return {eventSlug:row.eventSlug,name:row.name,occurrenceDate:row.occurrenceDate,
  startAt:new Date(row.startAt).toISOString(),endAt:new Date(row.endAt).toISOString(),
  ...(row.agePolicy?.minimumAge!=null?{minimumAge:row.agePolicy.minimumAge}:{}),
  admissionTerms:row.agePolicy?.admissionTerms||'',
  availability:{status:'inquire',message:AVAILABILITY_MESSAGE}};
}
async function occurrenceList(context){
 const services=context.location.venueServices||{};
 const today=require('./clock').businessDate(new Date(),services.timezone,services.businessDayStartMinutes==null?240:services.businessDayStartMinutes);
 const rows=await require('../../models/VenueEventOccurrence').find({tenant:context.tenant._id,location:context.location._id,publication:'published',occurrenceDate:{$gte:today}}).sort({occurrenceDate:1,startAt:1}).limit(50).lean();
 return {items:rows.map(occurrenceDTO)};
}
async function publicOccurrences({slug,locationSlug}){
 return occurrenceList(await publicLocation({slug,locationSlug}));
}
async function listLocations({slug,city,type,after,limit=20}={}) {
 const size=Number(limit);if(!Number.isInteger(size)||size<1||size>50)fail('INVALID_INPUT','Invalid page size',400);
 if(after)require('./errors').requireId(after);
 if(slug&&!validSlug(slug))fail('NOT_FOUND','Venue not found',404);
 if(type&&!['restaurant','bar','lounge','club'].includes(type))fail('INVALID_INPUT','Invalid venue type',400);
 const selectedTenant=slug?await Tenant.findOne({slug}).select('_id').lean():null;
 if(slug&&!selectedTenant)return {items:[],next:null};
 const items=[];let cursor=after||null;let lastReturned=null;
 while(true){
  const candidates=await Config.find({reviewedAt:{$ne:null},reviewedBy:{$ne:null},profile:{$ne:null},$expr:{$eq:['$reviewedProfileVersion','$profileVersion']},...(selectedTenant?{tenant:selectedTenant._id}:{}),...(cursor?{_id:{$gt:cursor}}:{}),...(type?{'profile.types':type}:{})}).sort({_id:1}).limit(300).lean();
  if(!candidates.length)return {items,next:null};
  const cityFilter=city?{$or:[{'address.city':String(city).slice(0,100)},{'address.city':{$in:[null,'']},city:String(city).slice(0,100)}]}:{};
  const tenants=await Tenant.find({_id:{$in:candidates.map(row=>row.tenant)},...cityFilter}).select('_id slug').lean();
  const byId=new Map(tenants.map(tenant=>[id(tenant),tenant]));
  for(const candidate of candidates){
   cursor=id(candidate);const tenant=byId.get(id(candidate.tenant));
   if(!tenant)continue;
   try{
    const item=profileDTO(await publicLocation({slug:tenant.slug,locationSlug:candidate.slug}));
    if(items.length===size)return {items,next:lastReturned};
    items.push(item);lastReturned=cursor;
   }catch(error){if(error.code!=='NOT_FOUND')throw error;}
  }
  if(candidates.length<300)return {items,next:null};
 }
}
module.exports={publicLocation,profileDTO,publicDetail,publicOccurrences,occurrenceList,listLocations};
