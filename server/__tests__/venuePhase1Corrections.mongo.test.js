'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const mongoose=require('mongoose');const express=require('express');const jwt=require('jsonwebtoken');
const {uri,connectVenueMongo,fixture,beverage}=require('./helpers/venueMongo');
const profile={slug:'main',name:'Main lounge',types:['lounge'],timezone:'Africa/Lagos',description:'Drinks',address:'Abuja',hours:[],exceptions:[],policies:'Request only'};
test('request list ignores customer identity overrides even during feature pause',{skip:!uri},async t=>{
 await connectVenueMongo(t,'phase1_identity');const args=await fixture();
 const User=require('../models/User');const Booking=require('../models/Booking');
 const owner=new mongoose.Types.ObjectId(),other=new mongoose.Types.ObjectId();
 await User.collection.insertMany([owner,other].map(_id=>({_id,role:'customer',status:'active'})));
 await Booking.collection.insertMany([owner,other].map((createdBy,i)=>({tenant:new mongoose.Types.ObjectId(args.tenantId),location:new mongoose.Types.ObjectId(args.locationId),createdBy,requestMode:'request_only',requestReference:`VR-private-${i}`,requestState:'submitted',requestVersion:0,status:'pending',bookingAt:new Date(Date.now()+3600000),partySize:2,guest:{name:`Guest ${i}`,phone:`private-${i}`},requestPolicy:{timezone:'Africa/Lagos',policies:'Test'}})));
 const oldKey=process.env.JWT_SECRET,oldFlag=process.env.VENUE_EXPERIENCE_ENABLED;process.env.JWT_SECRET='phase1-correction-only';
 t.after(()=>{for(const [key,value] of Object.entries({JWT_SECRET:oldKey,VENUE_EXPERIENCE_ENABLED:oldFlag}))if(value===undefined)delete process.env[key];else process.env[key]=value;});
 const app=express();app.use(express.json());app.use('/api/venue-experience',require('../routes/venue-experience.routes'));app.use((e,req,res,next)=>res.status(e.statusCode||500).json({message:e.message}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}/api/venue-experience/me/requests`;
 const headers={Authorization:`Bearer ${jwt.sign({userId:String(owner)},process.env.JWT_SECRET,{expiresIn:'10m'})}`,'x-customer-id':String(other)};
 for(const flag of ['true','false']){
  process.env.VENUE_EXPERIENCE_ENABLED=flag;
  if(flag==='false')await require('../models/Tenant').updateOne({_id:args.tenantId},{$set:{subscriptionStatus:'cancelled','venueSettings.publicListed':false}});
  for(const query of ['',`?customerId=${other}`,`?customerId=${other}&tenantId=${args.tenantId}&limit=1`]){
   const response=await fetch(base+query,{headers});assert.equal(response.status,200);
   const data=(await response.json()).data;assert.deepEqual(data.items.map(row=>row.reference),['VR-private-0']);
  }
  const body=JSON.stringify({customerId:String(other)});
  const response=await new Promise((resolve,reject)=>{
   const request=require('node:http').request(base,{method:'GET',headers:{...headers,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},res=>{
    let text='';res.on('data',chunk=>{text+=chunk;});res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(text).data}));
   });request.on('error',reject);request.end(body);
  });
  assert.equal(response.status,200);assert.deepEqual(response.data.items.map(row=>row.reference),['VR-private-0']);
 }
});
test('unavailable unpublished menu entries remain editable without relaxing ownership or publication',{skip:!uri},async t=>{
 await connectVenueMongo(t,'phase1_menu');const args=await fixture();
 await require('../services/venue/service-sessions').ensureIndexes();await require('../models/VenueLocationProfile').createIndexes();
 const api=require('../services/venue/experience');let version=0;let serial=0;
 const save=async input=>{const result=await api.saveConfiguration({...args,kind:'menu',expectedVersion:version,input,idempotencyKey:`menu-${serial++}`});version=result.version;return result;};
 for(const status of ['hidden','discontinued','archived']){
  const line=await beverage(args);const item={subProductId:line.subProductId,sizeId:line.sizeId,published:true};
  await save({sections:[{id:'drinks',name:'Drinks',items:[item]}]});
  await require('../models/SubProduct').updateOne({_id:line.subProductId},{$set:{status}});
  const draft={sections:[{id:'drinks',name:'Renamed section',items:[{...item,published:false}]}]};
  const result=await save(draft);assert.equal(result.menu.sections[0].items[0].published,false);
  await save({...draft,sections:[{...draft.sections[0],name:'Another edit'}]});
  await assert.rejects(save({sections:[{...draft.sections[0],items:[item]}]}),e=>e.code==='NOT_FOUND');
 }
 const foreign=await fixture();const foreignLine=await beverage(foreign);const localLine=await beverage(args);
 for(const item of [foreignLine,{...localLine,sizeId:foreignLine.sizeId}])await assert.rejects(save({sections:[{id:'drinks',name:'Drinks',items:[{subProductId:item.subProductId,sizeId:item.sizeId,published:false}]}]}),e=>e.code==='NOT_FOUND');
});
test('public discovery scans beyond unrelated and stale batches with stable eligible cursors',{skip:!uri},async t=>{
 await connectVenueMongo(t,'phase1_directory');const args=await fixture();
 const Tenant=require('../models/Tenant'),Config=require('../models/VenueLocationProfile'),Warehouse=require('../models/Warehouse');
 await Tenant.updateOne({_id:args.tenantId},{$set:{slug:'target-lounge','address.city':'Abuja','venueSettings.publicListed':true}});
 await Config.createIndexes();
 const irrelevant=new mongoose.Types.ObjectId();await Tenant.collection.insertOne({_id:irrelevant,slug:'other-lounge',city:'Lagos',status:'approved',isActive:true,plan:'venue',subscriptionStatus:'active',businessCapabilities:['hospitality'],venueSettings:{identityVersion:1,publicListed:false}});
 const rows=Array.from({length:610},(_,i)=>{const target=i>=305;const slug='loc-'+i;return {_id:new mongoose.Types.ObjectId((i+1).toString(16).padStart(24,'0')),tenant:target?new mongoose.Types.ObjectId(args.tenantId):irrelevant,location:new mongoose.Types.ObjectId(),slug,version:1,profileVersion:2,reviewedProfileVersion:i<305||i>=608?2:1,reviewedAt:new Date(),reviewedBy:args.actor.userId,profile:{...profile,slug}};});
 await Warehouse.collection.insertMany(rows.map(row=>({_id:row.location,tenant:row.tenant,name:row.slug,isActive:true,venueServices:{enabled:true,reviewedAt:new Date(),timezone:'Africa/Lagos'}})));
 await Config.collection.insertMany(rows);
 const api=require('../services/venue/public-experience');
 for(const filter of [{slug:'target-lounge'},{city:'Abuja'},{}]){
  const one=await api.listLocations({...filter,limit:1});assert.deepEqual(one.items.map(row=>row.slug),['loc-608'],JSON.stringify(filter));assert.equal(one.items[0].tenant.city,'Abuja');assert.ok(one.next);
  const two=await api.listLocations({...filter,limit:1,after:one.next});assert.deepEqual(two.items.map(row=>row.slug),['loc-609']);assert.equal(two.next,null);
 }
 assert.equal((await api.publicDetail({slug:'target-lounge',locationSlug:'loc-608'})).name,profile.name);
 assert.deepEqual(await api.listLocations({slug:'missing-lounge'}),{items:[],next:null});
});
