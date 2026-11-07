'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const mongoose=require('mongoose');
const {connectVenueMongo,fixture,beverage}=require('./helpers/venueMongo');
test('reviewed counts distinguish uncounted from zero and freeze stock watermark',async t=>{
 await connectVenueMongo(t,'usage_counts');const scope=await fixture();await require('../services/venue/service-sessions').ensureIndexes();
 await require('../models/User').collection.updateOne({_id:new mongoose.Types.ObjectId(scope.actor.userId)},{$set:{posPermissions:['pos:sell','venue:inventory_count','venue:profitability_read']}});
 const a=await beverage(scope,{currentQuantity:0,reservedQuantity:0});const b=await beverage(scope,{currentQuantity:4,reservedQuantity:0});
 const api=require('../services/venue/inventory-counts');await require('../models/VenueInventoryCount').createIndexes();
 await require('../models/OpenedBottle').create({tenant:scope.tenantId,location:scope.locationId,source:{subProduct:a.subProductId,size:a.sizeId},contentsMl:750,remainingMl:50,openedBy:scope.actor.userId});
 const draft=await api.createCount({...scope,input:{countKey:'opening',items:[{subProductId:a.subProductId,sizeId:a.sizeId,quantity:{amountScaled:0,scale:1,unit:'count'}},{subProductId:b.subProductId,sizeId:b.sizeId,quantity:null}]},idempotencyKey:'create'});
 const frozen=await api.completeCount({...scope,countId:draft.id,expectedVersion:0,idempotencyKey:'complete'});
 assert.equal(frozen.completeness,'incomplete');
 const row=await require('../models/VenueInventoryCount').findById(draft.id).lean();assert.equal(row.items.find(item=>String(item.subProductId)===a.subProductId).quantity.amountScaled,0);assert.equal(row.items.find(item=>String(item.subProductId)===b.subProductId).quantity,null);assert.ok(row.missingReasons.includes('not_counted'));assert.ok(row.missingReasons.includes('opened_stock_count_missing'));
 await assert.rejects(api.completeCount({...scope,countId:draft.id,expectedVersion:0,idempotencyKey:'another'}),e=>e.code==='STATE_CHANGED');
 const again=await api.completeCount({...scope,countId:draft.id,expectedVersion:0,idempotencyKey:'complete'});assert.equal(again.id,draft.id);
 const stock=await require('../models/WarehouseStock').findOne({tenant:scope.tenantId,subProduct:b.subProductId}).lean();assert.equal(stock.currentQuantity,4);
});
test('usage variance conserves counts and does not add known waste twice',()=>{
 const {usageBridge}=require('../services/venue/usage-variance');
 assert.deepEqual(usageBridge({openingMinor:100000,receivedMinor:200000,transfersInMinor:0,supplierReturnsMinor:0,transfersOutMinor:0,closingMinor:70000,theoreticalMinor:200000,knownWasteMinor:10000}),{actualUsageMinor:230000,theoreticalUsageMinor:200000,varianceMinor:30000,knownWasteMinor:10000,unexplainedMinor:20000});
 assert.equal(usageBridge({openingMinor:null,receivedMinor:0,transfersInMinor:0,supplierReturnsMinor:0,transfersOutMinor:0,closingMinor:0,theoreticalMinor:0,knownWasteMinor:0}).actualUsageMinor,null);
});

test('counts require original receipt and consistent remaining source quantity',async t=>{
 await connectVenueMongo(t,'count_receipt');const scope=await fixture();await require('../services/venue/service-sessions').ensureIndexes();await require('../models/User').updateOne({_id:scope.actor.userId},{$set:{posPermissions:['pos:sell','venue:inventory_count']}});await require('../models/VenueInventoryCount').createIndexes();const item=await beverage(scope,{currentQuantity:2,reservedQuantity:0});const receiptId=new mongoose.Types.ObjectId();
 const lot=await require('../models/WarehouseBatch').create({tenant:scope.tenantId,warehouse:scope.locationId,subProduct:item.subProductId,size:item.sizeId,batchNumber:'count-proof',quantity:2,initialQuantity:3,venueValuation:{receiptId,reason:'reviewed_receipt',initialCostMinor:300,issuedCostMinor:100,initialQuantityScaled:3,issuedQuantityScaled:1}});
 const api=require('../services/venue/inventory-counts');const finish=async key=>{const row=await api.createCount({...scope,input:{countKey:key,items:[{subProductId:item.subProductId,sizeId:item.sizeId,quantity:{amountScaled:2,scale:1,unit:'count'}}]},idempotencyKey:'create-'+key});const result=await api.completeCount({...scope,countId:row.id,expectedVersion:0,idempotencyKey:'complete-'+key});return require('../models/VenueInventoryCount').findById(result.id).lean();};
 const missing=await finish('missing');assert.equal(missing.completeness,'incomplete');assert.equal(missing.items[0].valueMinor,null);
 await require('../models/InventoryMovement').create({_id:receiptId,tenant:scope.tenantId,warehouse:scope.locationId,subProduct:item.subProductId,size:item.sizeId,type:'received',category:'in',quantity:3,quantityBefore:0,quantityAfter:3,totalCost:3,status:'confirmed',performedBy:scope.actor.userId});
 const verified=await finish('verified');assert.equal(verified.completeness,'complete');assert.equal(verified.items[0].valueMinor,200);
 await require('../models/WarehouseBatch').updateOne({_id:lot._id},{$set:{'venueValuation.issuedQuantityScaled':2}});
 const drift=await finish('drift');assert.equal(drift.completeness,'incomplete');assert.equal(drift.items[0].valueMinor,null);
});
