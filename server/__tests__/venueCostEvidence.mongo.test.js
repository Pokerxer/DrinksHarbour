'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');
test('cost evidence distinguishes unknown from proven zero and refuses wrong owned source', async t => {
  await connectVenueMongo(t,'cost_evidence'); const scope = await fixture(); const source = await beverage(scope);
  const Snapshot = require('../models/VenueCostSnapshot'); await Snapshot.createIndexes();
  const oid = () => new mongoose.Types.ObjectId(); const receiptId = oid();
  await require('../models/InventoryMovement').create({_id:receiptId,tenant:scope.tenantId,warehouse:scope.locationId,subProduct:source.subProductId,size:source.sizeId,type:'received',category:'in',quantity:1,quantityBefore:0,quantityAfter:1,totalCost:0,status:'confirmed',performedBy:scope.actor.userId});
  const lot = await require('../models/WarehouseBatch').create({ tenant: scope.tenantId, warehouse: scope.locationId, subProduct: source.subProductId, size: source.sizeId, batchNumber: 'free-sample', quantity: 1, initialQuantity: 1, venueValuation: { initialCostMinor: 0, initialQuantityScaled: 1, receiptId, reason: 'documented_sample' } });
  const movement = await require('../models/InventoryMovement').create({ tenant: scope.tenantId, warehouse: scope.locationId, subProduct: source.subProductId, size: source.sizeId, type:'shipped',category:'out',quantity:1,quantityBefore:1,quantityAfter:0,status:'confirmed',performedBy:scope.actor.userId });
  const service = require('../services/venue/cost-evidence').issueCostSnapshot;
  const base = { ...scope, sourceEvent: oid(), quantity: { amountScaled: 1, scale: 1, unit:'count' }, sourceAllocations:[{ movementId:movement._id,lotId:lot._id,receiptId,quantity:{amountScaled:1,scale:1,unit:'count'},allocatedCostMinor:0,valuationMethod:'fifo',sourceTimestamp:new Date() }] };
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const zero = await service({...base,effectKey:'zero',mongoSession:session}); assert.equal(zero.amountMinor,0); assert.equal(zero.status,'verified');
      const unknown = await service({...base,effectKey:'unknown',mongoSession:session,sourceAllocations:base.sourceAllocations.map(a=>({...a,allocatedCostMinor:null}))}); assert.equal(unknown.amountMinor,null); assert.equal(unknown.status,'unknown');
    });
    await assert.rejects(session.withTransaction(()=>service({...base,effectKey:'foreign',mongoSession:session,sourceAllocations:base.sourceAllocations.map(a=>({...a,movementId:oid()}))})), e=>e.code==='NOT_FOUND');
    await assert.rejects(Snapshot.updateOne({effectKey:'zero'},{$set:{amountMinor:999}}), /immutable/);
  } finally { await session.endSession(); }
});
test('opaque receipt ids cannot establish verified source cost',async t=>{
 await connectVenueMongo(t,'cost_fake_receipt');const scope=await fixture();const source=await beverage(scope);await require('../models/VenueCostSnapshot').createIndexes();
 const oid=()=>new mongoose.Types.ObjectId();const receiptId=oid();const lot=await require('../models/WarehouseBatch').create({tenant:scope.tenantId,warehouse:scope.locationId,subProduct:source.subProductId,size:source.sizeId,batchNumber:'unproven',quantity:1,initialQuantity:1,venueValuation:{initialCostMinor:0,initialQuantityScaled:1,receiptId,reason:'claimed_zero'}});
 const move=await require('../models/InventoryMovement').create({tenant:scope.tenantId,warehouse:scope.locationId,subProduct:source.subProductId,size:source.sizeId,type:'shipped',category:'out',quantity:1,quantityBefore:1,quantityAfter:0,status:'confirmed',performedBy:scope.actor.userId});const session=await mongoose.startSession();
 try{await assert.rejects(session.withTransaction(()=>require('../services/venue/cost-evidence').issueCostSnapshot({...scope,effectKey:'claimed',sourceEvent:oid(),quantity:{amountScaled:1,scale:1,unit:'count'},sourceAllocations:[{movementId:move._id,lotId:lot._id,receiptId,quantity:{amountScaled:1,scale:1,unit:'count'},allocatedCostMinor:0,valuationMethod:'fifo',sourceTimestamp:new Date()}],mongoSession:session})),e=>e.code==='COST_EVIDENCE_REQUIRED');}finally{await session.endSession();}
});
test('actual-cost policy refuses incomplete physical uniqueness guards',async t=>{
 await connectVenueMongo(t,'cost_index_readiness');const scope=await fixture();process.env.VENUE_ACTUAL_COSTING_ENABLED='true';t.after(()=>delete process.env.VENUE_ACTUAL_COSTING_ENABLED);await require('../models/Warehouse').collection.updateOne({_id:new mongoose.Types.ObjectId(scope.locationId)},{$set:{'venueServices.catalogCosting':{actualCostingEnabled:true,policy:{version:1,state:'approved',approvedBy:scope.actor.userId,approvedAt:new Date(),recognitionTiming:'canonical_sale',currency:'NGN',accounts:{rawInventory:'1200',preparedInventory:'1210',issuedService:'1220',cogs:'5000',waste:'5100'}}}}});for(const [code,type]of [['1200','asset'],['1210','asset'],['1220','asset'],['5000','expense'],['5100','expense']])await require('../models/Account').collection.insertOne({tenant:new mongoose.Types.ObjectId(scope.tenantId),code,type,isActive:true});
 await assert.rejects(require('../services/venue/costing-policy').requireCostingPolicy(scope),e=>e.code==='COST_INDEX_REVIEW_REQUIRED');await require('../services/venue/costing-indexes').prepareCostingIndexes(mongoose.connection.db);assert.equal((await require('../services/venue/costing-policy').requireCostingPolicy(scope)).valuationMethod,'fifo');
});
