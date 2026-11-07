'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),mongoose=require('mongoose');
const {connectVenueMongo}=require('./helpers/venueMongo');
test('money index preparation previews legacy rows, preserves v1 uniqueness and replays safely',async t=>{
 await connectVenueMongo(t,'money_indexes');
 const Attempt=require('../models/VenuePaymentAttempt'),Allocation=require('../models/VenuePaymentAllocation');
 const tenant=new mongoose.Types.ObjectId(),bill=new mongoose.Types.ObjectId(),session=new mongoose.Types.ObjectId();
 await Attempt.collection.createIndex({tenant:1,billOrder:1},{unique:true});await Allocation.collection.createIndex({tenant:1,billOrder:1},{unique:true});
 await Attempt.collection.insertOne({tenant,billOrder:bill,session,reference:'legacy'});
 const service=require('../services/venue/money-indexes');
 const preview=await service.previewMoneyIndexes(mongoose.connection.db);assert.equal(preview[0].legacyDefaultRows,1);
 assert.equal((await Attempt.collection.findOne({reference:'legacy'})).collectionVersion,undefined);
 await service.applyMoneyIndexes(mongoose.connection.db);await service.applyMoneyIndexes(mongoose.connection.db);
 assert.equal((await Attempt.collection.findOne({reference:'legacy'})).collectionVersion,1);
 await assert.rejects(Attempt.collection.insertOne({tenant,billOrder:bill,session,collectionVersion:1,reference:'duplicate'}),e=>e.code===11000);
 await Attempt.collection.insertMany([{tenant,billOrder:bill,session,collectionVersion:2,reference:'payer-a',collectionSlot:'a'},{tenant,billOrder:bill,session,collectionVersion:2,reference:'payer-b',collectionSlot:'b'}]);
 assert.equal(await Attempt.collection.countDocuments(),3);
 const ready=require('../services/venue/financial-policy').moneyIndexesReady;await ready();
 for(const [Model,name] of [[Attempt,'venue_full_bill_attempt'],[Allocation,'venue_full_bill_allocation'],[Allocation,'tenant_1_receipt_1_billOrder_1_key_1']]){
  await Model.collection.dropIndex(name);await assert.rejects(ready(),e=>e.code==='MONEY_INDEX_REVIEW_REQUIRED');await Model.createIndexes();await ready();
 }
});
