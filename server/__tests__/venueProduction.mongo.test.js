'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const mongoose=require('mongoose');
const {connectVenueMongo,fixture,beverage}=require('./helpers/venueMongo');
async function setup(t,suffix){
  await connectVenueMongo(t,suffix);const scope=await fixture();const output=await beverage(scope,{currentQuantity:0,reservedQuantity:0});const source=await beverage(scope,{currentQuantity:4,reservedQuantity:0});
  await require('../models/User').collection.updateOne({_id:new mongoose.Types.ObjectId(scope.actor.userId)},{$set:{posPermissions:['venue:production_write','venue:inventory_count','venue:profitability_read']}});scope.actor.permissions.push('venue:production_write');
  await require('../models/Size').collection.updateOne({_id:new mongoose.Types.ObjectId(output.sizeId)},{$set:{servingSchemaVersion:2,size:'venue_serving',displayName:'Prepared plate',venueServing:{code:'plate',mode:'prepared_batch',saleUnit:'plate',channels:['venue'],version:0}}});
  const profile=await require('../models/IngredientProfile').create({tenant:scope.tenantId,subProduct:source.subProductId,dimension:'mass',createdBy:scope.actor.userId});
  const recipe=await require('../models/RecipeVersion').create({tenant:scope.tenantId,output:{subProduct:output.subProductId,size:output.sizeId},version:1,components:[{profile:profile._id,quantity:100,unit:'g',stockMapping:{sourceSubProductId:source.subProductId,sourceSizeId:source.sizeId,sourceLocationId:scope.locationId,contentQuantity:{amountScaled:10000,scale:100,unit:'g'},reviewedBy:scope.actor.userId,reviewedAt:new Date()}}],yieldAssumption:{units:1},effectiveFrom:new Date(),createdBy:scope.actor.userId});
  const policy={version:1,state:'approved',approvedBy:scope.actor.userId,approvedAt:new Date(),recognitionTiming:'canonical_sale',currency:'NGN',productionLossTreatment:'normal_absorbed',allowZeroOutputWaste:true,accounts:{rawInventory:'1200',preparedInventory:'1210',issuedService:'1220',cogs:'5000',waste:'5100'}};
  await require('../models/Warehouse').collection.updateOne({_id:new mongoose.Types.ObjectId(scope.locationId)},{$set:{'venueServices.catalogCosting':{actualCostingEnabled:true,policy}}});
  for(const [code,type]of [['1200','asset'],['1210','asset'],['1220','asset'],['5000','expense'],['5100','expense']])await require('../models/Account').collection.insertOne({tenant:new mongoose.Types.ObjectId(scope.tenantId),code,type,isActive:true});
  const receipt=await require('../models/InventoryMovement').create({tenant:scope.tenantId,warehouse:scope.locationId,subProduct:source.subProductId,size:source.sizeId,type:'received',category:'in',quantity:4,quantityBefore:0,quantityAfter:4,totalCost:1,status:'confirmed',performedBy:scope.actor.userId});
  await require('../models/WarehouseBatch').create({tenant:scope.tenantId,warehouse:scope.locationId,subProduct:source.subProductId,size:source.sizeId,batchNumber:'raw-receipt',quantity:4,initialQuantity:4,unitCost:0.25,venueValuation:{initialCostMinor:100,initialQuantityScaled:40000,issuedQuantityScaled:0,issuedCostMinor:0,receiptId:receipt._id,reason:'supplier_receipt'}});
  process.env.VENUE_ACTUAL_COSTING_ENABLED='true';t.after(()=>delete process.env.VENUE_ACTUAL_COSTING_ENABLED);
  await require('../services/venue/service-sessions').ensureIndexes();await require('../models/VenueCostSnapshot').createIndexes();await require('../services/venue/costing-indexes').prepareCostingIndexes(mongoose.connection.db);
  let api;try{api=require('../services/venue/production');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
  assert.equal(typeof api?.createProduction,'function','production commands must exist');
  await require('../models/VenueProductionBatch').createIndexes();
  await require('../models/JournalEntry').createIndexes();
  return {scope,output,source,recipe,api};
}
const count=n=>({amountScaled:n,scale:1,unit:'count'});
const stockOf=(scope,item)=>require('../models/WarehouseStock').findOne({tenant:scope.tenantId,warehouse:scope.locationId,subProduct:item.subProductId,size:item.sizeId}).lean();
async function draft(x,key='batch'){return x.api.createProduction({...x.scope,input:{subProductId:x.output.subProductId,sizeId:x.output.sizeId,recipeVersionId:x.recipe.id,expectedOutput:count(4)},expectedVersion:0,idempotencyKey:key});}

test('production actual yield transfers exact source cost, completes once and prepared serving never issues raw twice',async t=>{
  const x=await setup(t,'production_yield');const job=await draft(x);assert.equal(job.state,'draft');
  const counts=require('../services/venue/inventory-counts');await require('../models/VenueInventoryCount').createIndexes();const takeCount=async(key,raw,prepared)=>{const d=await counts.createCount({...x.scope,input:{countKey:key,items:[{subProductId:x.source.subProductId,sizeId:x.source.sizeId,quantity:countQuantity(raw)},{subProductId:x.output.subProductId,sizeId:x.output.sizeId,quantity:countQuantity(prepared)}]},idempotencyKey:'count-'+key});return counts.completeCount({...x.scope,countId:d.id,expectedVersion:0,idempotencyKey:'finish-'+key});};const countQuantity=amountScaled=>({amountScaled,scale:1,unit:'count'});const opening=await takeCount('before',4,0);

  const reserved=await x.api.reserveProduction({...x.scope,batchId:job.id,expectedVersion:0,idempotencyKey:'reserve'});assert.equal((await stockOf(x.scope,x.source)).reservedQuantity,4);assert.equal((await stockOf(x.scope,x.source)).currentQuantity,4);
  const command={...x.scope,batchId:job.id,expectedVersion:reserved.version,actualOutput:count(3),waste:{classification:'normal',reason:'Measured cooking yield'},idempotencyKey:'complete'};
  const results=await Promise.all([x.api.completeProduction(command),x.api.completeProduction(command)]);assert.equal(results[0].outputBatchId,results[1].outputBatchId);
  const completed=results[0];assert.equal(completed.state,'completed');assert.equal(completed.sourceCostMinor,100);assert.equal(completed.outputCostMinor,100);assert.equal(completed.lossCostMinor,0);assert.equal((await stockOf(x.scope,x.source)).currentQuantity,0);assert.equal((await stockOf(x.scope,x.source)).reservedQuantity,0);assert.equal((await stockOf(x.scope,x.output)).currentQuantity,3);
  assert.equal(await require('../models/InventoryMovement').countDocuments({tenant:x.scope.tenantId,reference:`production-complete:${job.id}`}),2);
  const lot=await require('../models/WarehouseBatch').findById(completed.outputBatchId).lean();assert.equal(lot.venueValuation.initialCostMinor,100);assert.equal(String(lot.venueProduction.batchId),job.id);
  assert.equal(await require('../models/JournalEntry').countDocuments({tenant:x.scope.tenantId,refDoc:job.id,refDocType:'VenueProductionBatch',status:'posted'}),1);
  const closing=await takeCount('after',0,3);const variance=await require('../services/venue/usage-variance').getUsageVariance({...x.scope,openingCountId:opening.id,closingCountId:closing.id});assert.equal(variance.coverage.reconciliationStatus,'complete');for(const row of variance.rows){assert.equal(row.actualUsageMinor,0);assert.equal(row.unexplainedMinor,0);}assert.equal(variance.totals.actualUsageMinor,0);
  const line={lineId:'prepared',revision:1,subproduct:x.output.subProductId,size:x.output.sizeId,servingSnapshot:{mode:'prepared_batch',sizeId:x.output.sizeId,servingVersion:0},acceptedRecipeVersionId:x.recipe._id};const visit={_id:new mongoose.Types.ObjectId(),heldOrder:new mongoose.Types.ObjectId()};
  await require('../models/VenueConsumptionEvent').createIndexes();const mongoSession=await mongoose.startSession();let effect;
  try{await mongoSession.withTransaction(async()=>{effect=await require('../services/venue/prepared-stock').issuePrepared({...x.scope,line,visit,fireDelta:3,effectKey:'prepared-fire',mongoSession});});}finally{await mongoSession.endSession();}
  assert.equal(effect.coverage,'complete');assert.equal((await stockOf(x.scope,x.output)).currentQuantity,0);assert.equal((await stockOf(x.scope,x.source)).currentQuantity,0);
  const cost=await require('../models/VenueCostSnapshot').findById(effect.costSnapshotId).lean();assert.equal(cost.amountMinor,100);
  await assert.rejects(x.api.cancelProduction({...x.scope,batchId:job.id,expectedVersion:completed.version,reason:'Already cooked',idempotencyKey:'late-cancel'}),e=>e.code==='STATE_CHANGED');
});

test('production shortage has no reservation, cancellation releases only owned inputs and zero output is explicit waste',async t=>{
  const x=await setup(t,'production_waste');const job=await draft(x);const reserved=await x.api.reserveProduction({...x.scope,batchId:job.id,expectedVersion:0,idempotencyKey:'reserve'});
  const other=await draft(x,'second');await assert.rejects(x.api.reserveProduction({...x.scope,batchId:other.id,expectedVersion:0,idempotencyKey:'short'}),e=>e.code==='STOCK_UNAVAILABLE');assert.equal((await stockOf(x.scope,x.source)).reservedQuantity,4);
  process.env.VENUE_ACTUAL_COSTING_ENABLED='false';
  const cancelled=await x.api.cancelProduction({...x.scope,batchId:job.id,expectedVersion:reserved.version,reason:'Not started',idempotencyKey:'cancel'});assert.equal(cancelled.state,'cancelled');assert.equal((await stockOf(x.scope,x.source)).reservedQuantity,0);assert.equal((await stockOf(x.scope,x.source)).currentQuantity,4);
  process.env.VENUE_ACTUAL_COSTING_ENABLED='true';
  const nowReserved=await x.api.reserveProduction({...x.scope,batchId:other.id,expectedVersion:0,idempotencyKey:'reserve-second'});
  await assert.rejects(x.api.completeProduction({...x.scope,batchId:other.id,expectedVersion:nowReserved.version,actualOutput:count(0),idempotencyKey:'implicit-zero'}),e=>e.code==='PRODUCTION_WASTE_REVIEW_REQUIRED');assert.equal((await stockOf(x.scope,x.source)).currentQuantity,4);
  const lost=await x.api.completeProduction({...x.scope,batchId:other.id,expectedVersion:nowReserved.version,actualOutput:count(0),waste:{classification:'abnormal',reason:'Burnt batch reviewed by manager'},idempotencyKey:'waste'});assert.equal(lost.state,'cancelled');assert.equal(lost.sourceCostMinor,100);assert.equal(lost.outputCostMinor,0);assert.equal(lost.lossCostMinor,100);assert.equal(lost.outputBatchId,null);assert.equal((await stockOf(x.scope,x.source)).currentQuantity,0);assert.equal((await stockOf(x.scope,x.output)).currentQuantity,0);
  await assert.rejects(x.api.completeProduction({...x.scope,batchId:other.id,expectedVersion:lost.version,actualOutput:count(1),idempotencyKey:'redo'}),e=>e.code==='STATE_CHANGED');
});
