'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),mongoose=require('mongoose');
const {uri,connectVenueMongo}=require('./helpers/venueMongo');
test('online publication requires independent effective enrollment while private inventory remains usable',{skip:!uri},async t=>{
 await connectVenueMongo(t,'market_publication');
 const old=process.env.MARKET_FOUNDATIONS_ENABLED;process.env.MARKET_FOUNDATIONS_ENABLED='true';t.after(()=>{if(old===undefined)delete process.env.MARKET_FOUNDATIONS_ENABLED;else process.env.MARKET_FOUNDATIONS_ENABLED=old;});
 const oid=()=>new mongoose.Types.ObjectId(),tenant=oid(),product=oid(),sp=oid(),actor={_id:oid(),role:'super_admin'};
 const Tenant=require('../models/Tenant'),Product=require('../models/Product'),SP=require('../models/SubProduct');
 await Tenant.collection.insertOne({_id:tenant,status:'approved',subscriptionStatus:'active',revenueModel:'commission',commissionPercentage:0});
 await Product.collection.insertOne({_id:product,name:'Synthetic bottle',type:'beer',status:'approved',platformMarkup:0});
 await SP.create({_id:sp,tenant,product,sku:'SYNTHETIC_PUBLICATION',costPrice:100,baseSellingPrice:200,status:'draft',isPublished:false});
 const service=require('../services/subproduct.service');
 await assert.rejects(()=>service.adminSetSubProductStatus(String(sp),'active',{},null,actor),/publication.*enrollment/i);
 assert.equal((await SP.findById(sp).lean()).isPublished,false);
 const before=await Tenant.findById(tenant).lean();
 await service.updateSubProduct(String(sp),{tenantNotes:'Private inventory update'},String(tenant),{...actor,role:'tenant_owner',tenant});
 assert.equal((await SP.findById(sp).lean()).tenantNotes,'Private inventory update');
 assert.equal((await Tenant.findById(tenant).lean()).subscriptionStatus,before.subscriptionStatus);
 const term={effectiveFrom:new Date('2020-01-01'),effectiveUntil:new Date('2090-01-01')};
 await require('../models/CountryConfiguration').collection.insertOne({code:'GB',name:'Synthetic',currency:'NGN',locale:'en-GB',timezones:['Europe/London'],active:true,version:1,capabilities:{marketplace:true,storefront:true,erm:true}});
 await require('../models/MarketCategoryPolicy').collection.insertOne({market:'GB',category:'beverage',channel:'marketplace',version:1,mode:'open',...term});
 await require('../models/MarketEnrollment').collection.insertOne({tenant,market:'GB',category:'beverage',channel:'marketplace',version:1,status:'approved',...term});
 const published=await service.adminSetSubProductStatus(String(sp),'active',{},null,actor);assert.equal(published.isPublished,true);
 await require('../models/MarketEnrollment').collection.insertOne({tenant,market:'GB',category:'beverage',channel:'marketplace',version:2,status:'rejected'});
 await assert.rejects(()=>service.updateSubProduct(String(sp),{isPublished:true},String(tenant),{...actor,role:'tenant_owner',tenant}),/publication.*enrollment/i);
 const gift=oid();await Product.collection.insertOne({_id:gift,type:'gift_set'});
 await require('../models/MarketCategoryPolicy').collection.insertOne({market:'GB',category:'gift',channel:'marketplace',version:1,mode:'open',...term});
 await require('../models/MarketEnrollment').collection.insertOne({tenant,market:'GB',category:'gift',channel:'marketplace',version:1,status:'approved',...term});
 await assert.rejects(()=>service.updateSubProduct(String(sp),{isPublished:true,product:String(gift)},String(tenant),{...actor,role:'tenant_owner',tenant}),/publication.*enrollment/i);

 await SP.collection.updateOne({_id:sp},{$set:{status:'archived',isPublished:true,metadata:{previousStatus:'active'}}});
 await assert.rejects(()=>service.restoreSubProduct(String(sp),String(tenant)),/publication.*enrollment/i);

});
