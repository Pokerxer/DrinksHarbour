'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const mongoose=require('mongoose');
const {uri,connectVenueMongo,fixture,beverage}=require('./helpers/venueMongo');
test('public review is explicit, versioned and requires the operational timezone; menus enforce catalog ownership',{skip:!uri},async t=>{
 await connectVenueMongo(t,'publication');const args=await fixture();const line=await beverage(args);
 await require('../services/venue/service-sessions').ensureIndexes();const Config=require('../models/VenueLocationProfile');await Config.createIndexes();
 const Tenant=require('../models/Tenant');await Tenant.updateOne({_id:args.tenantId},{$set:{slug:'review-lounge','venueSettings.publicListed':true}});
 const profile={slug:'main',name:'Main lounge',types:['lounge'],timezone:'Africa/Lagos',description:'Beverages',address:'Abuja',hours:[],exceptions:[],policies:'Requests await review'};
 const api=require('../services/venue/experience');await api.saveConfiguration({...args,kind:'profile',expectedVersion:0,input:profile,idempotencyKey:'profile'});
 const reviewer=new mongoose.Types.ObjectId();await require('../models/User').collection.insertOne({_id:reviewer,role:'super_admin',status:'active'});
 const review=require('../services/venue/publication');const mapping={tenantId:args.tenantId,locationId:args.locationId,expectedVersion:1,profileVersion:1,reviewerId:String(reviewer)};
 const preview=await review.reviewProfile(mapping);assert.equal(preview.mode,'preview');assert.equal((await Config.findOne({tenant:args.tenantId})).reviewedAt,null);
 await assert.rejects(review.reviewProfile({...mapping,reviewerId:args.actor.userId,apply:true}),/reviewer/i);
 await review.reviewProfile({...mapping,apply:true});await review.reviewProfile({...mapping,apply:true});
 assert.equal((await require('../services/venue/public-experience').publicDetail({slug:'review-lounge',locationSlug:'main'})).name,'Main lounge');
 const menu={sections:[{id:'drinks',name:'Drinks',items:[{subProductId:line.subProductId,sizeId:line.sizeId,published:true}]}]};
 const sp=await require('../models/SubProduct').findOne({_id:line.subProductId});const Product=require('../models/Product');
 for(const [status,owner,count] of [['pending',new mongoose.Types.ObjectId(),0],['pending',args.tenantId,1],['rejected',args.tenantId,0],['approved',null,1]]){
  await Product.collection.updateOne({_id:sp.product},{$set:{status,submittingTenant:owner?new mongoose.Types.ObjectId(owner):null,isPublished:status==='approved'}});
  const projected=await api.projectMenu({tenant:await Tenant.findById(args.tenantId).lean(),location:await require('../models/Warehouse').findById(args.locationId).lean()},menu);
  assert.equal(projected.sections[0]?.items.length||0,count);
 }
 await api.saveConfiguration({...args,kind:'profile',expectedVersion:1,input:{...profile,timezone:'America/New_York'},idempotencyKey:'clock-change'});
 await assert.rejects(review.reviewProfile({...mapping,expectedVersion:2,profileVersion:2,apply:true}),/timezone/i);
 await assert.rejects(require('../services/venue/public-experience').publicDetail({slug:'review-lounge',locationSlug:'main'}),/not found/i);
});
