'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {uri,connectVenueMongo,fixture,beverage}=require('./helpers/venueMongo');
test('venue-only stock cannot be reserved for delivery; old retail reservations can still release',{skip:!uri},async t=>{
 await connectVenueMongo(t,'retail_boundary');const args=await fixture();const line=await beverage(args);const SP=require('../models/SubProduct');
 await SP.collection.updateOne({_id:new(require('mongoose').Types.ObjectId)(line.subProductId)},{$set:{isPublished:true,visibleInOnlineStore:false,sellWithoutSizeVariants:true,totalStock:10,availableStock:10,reservedStock:0}});
 const items=[{subproduct:line.subProductId,tenant:args.tenantId,quantity:1}];const service=require('../services/storefrontStock');
 await assert.rejects(service.reserveStock(items,null),/stock changed/i);
 assert.equal((await SP.findOne({_id:line.subProductId}).lean()).availableStock,10);
 await SP.updateOne({_id:line.subProductId},{$set:{visibleInOnlineStore:true}});await service.reserveStock(items,null);
 await SP.updateOne({_id:line.subProductId},{$set:{visibleInOnlineStore:false,sellWithoutSizeVariants:false}});await service.releaseStock(items,null);
 const after=await SP.findOne({_id:line.subProductId}).lean();assert.equal(after.availableStock,10);assert.equal(after.reservedStock,0);
});
