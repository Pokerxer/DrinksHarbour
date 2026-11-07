'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');
// Catches ledger-only recipe fire, unscaled deltas, partial stock writes and guessed cost.
test('physical recipe issue scales the fired delta, conserves cost and replays once', async t => {
  await connectVenueMongo(t, 'recipe_issue_v2');
  const scope = await fixture(); const output = await beverage(scope, { reservedQuantity: 0 });
  const source = await beverage(scope, { currentQuantity: 3, reservedQuantity: 0 });
  const oid = () => new mongoose.Types.ObjectId();
  const Recipe = require('../models/RecipeVersion'); const Profile = require('../models/IngredientProfile');
  const p = await Profile.create({ tenant: scope.tenantId, subProduct: source.subProductId, dimension: 'mass', createdBy: scope.actor.userId });
  const recipe = await Recipe.create({ tenant: scope.tenantId, output: { subProduct: output.subProductId, size: output.sizeId }, version: 1,
    components: [{ profile: p._id, quantity: 100, unit: 'g', stockMapping: { sourceSubProductId: source.subProductId, sourceSizeId: source.sizeId,
      sourceLocationId: scope.locationId, contentQuantity: { amountScaled: 10000, scale: 100, unit: 'g' }, reviewedBy: scope.actor.userId, reviewedAt: new Date() } }],
    yieldAssumption: { units: 1 }, effectiveFrom: new Date(), createdBy: scope.actor.userId });
  await require('../models/Warehouse').collection.updateOne({ _id: new mongoose.Types.ObjectId(scope.locationId) }, { $set: { 'venueServices.catalogCosting': {
    actualCostingEnabled: true, policy: { version: 1, state: 'approved', approvedBy: scope.actor.userId, approvedAt: new Date(), recognitionTiming: 'canonical_sale', currency: 'NGN',
      accounts: { rawInventory: '1200', preparedInventory: '1210', issuedService: '1220', cogs: '5000', waste: '5100' } } } } });
  for (const [code, type] of [['1200','asset'],['1210','asset'],['1220','asset'],['5000','expense'],['5100','expense']]) {
    await require('../models/Account').collection.insertOne({ tenant: new mongoose.Types.ObjectId(scope.tenantId), code, type, isActive: true });
  }
  process.env.VENUE_ACTUAL_COSTING_ENABLED = 'true'; t.after(() => delete process.env.VENUE_ACTUAL_COSTING_ENABLED);
  const receipt = await require('../models/InventoryMovement').create({tenant:scope.tenantId,warehouse:scope.locationId,subProduct:source.subProductId,size:source.sizeId,type:'received',category:'in',quantity:3,quantityBefore:0,quantityAfter:3,totalCost:1,status:'confirmed',performedBy:scope.actor.userId});
  await require('../models/WarehouseBatch').create({ tenant: scope.tenantId, warehouse: scope.locationId, subProduct: source.subProductId, size: source.sizeId,
    batchNumber: 'valued', quantity: 3, initialQuantity: 3, unitCost: 1 / 3,
    venueValuation: { initialCostMinor: 100, initialQuantityScaled: 30000, issuedQuantityScaled: 0, issuedCostMinor: 0, receiptId: receipt._id, reason: 'supplier_receipt' } });
  const line = { lineId: 'meal', revision: 1, subproduct: output.subProductId, size: output.sizeId };
  const visit = { _id: oid(), heldOrder: oid() };
  const args = { ...scope, line, fireDelta: 3, acceptedRecipeVersionId: recipe.id, visit, effectKey: 'fire:meal:1:0:3' };
  await require('../models/VenueCostSnapshot').createIndexes();await require('../services/venue/costing-indexes').prepareCostingIndexes(mongoose.connection.db);
  await require('../models/VenueConsumptionEvent').createIndexes();
  const issue = require('../services/venue/recipe-stock').issueRecipe;
  let first; const session = await mongoose.startSession();
  try { await session.withTransaction(async () => { first = await issue({ ...args, mongoSession: session }); });
    await session.withTransaction(async () => { const replay = await issue({ ...args, mongoSession: session }); assert.equal(replay.consumptionId, first.consumptionId); });
  } finally { await session.endSession(); }
  const stock = await require('../models/WarehouseStock').findOne({ tenant: scope.tenantId, subProduct: source.subProductId }).lean();
  assert.equal(stock.currentQuantity, 0);
  const event = await require('../models/VenueConsumptionEvent').findById(first.consumptionId).lean();
  assert.equal(event.items[0].quantity, 300); assert.equal(event.fireDelta, 3); assert.equal(event.physicalCoverage, 'complete');
  const cost = await require('../models/VenueCostSnapshot').findById(first.costSnapshotId).lean();
  assert.equal(cost.amountMinor, 100); assert.equal(cost.status, 'verified'); assert.equal(cost.sourceAllocations.length, 1);
  assert.equal(await require('../models/InventoryMovement').countDocuments({ tenant: scope.tenantId, reference: `physical:${event._id}` }), 1);
  const shortageSession = await mongoose.startSession();
  try { await assert.rejects(shortageSession.withTransaction(() => issue({ ...args, effectKey: 'fire:meal:1:3:4', fireDelta: 1, mongoSession: shortageSession })), e => e.code === 'STOCK_UNAVAILABLE'); }
  finally { await shortageSession.endSession(); }
  assert.equal(await require('../models/VenueConsumptionEvent').countDocuments({ tenant: scope.tenantId }), 1);
});

// A ledger-only event must never exempt actual-cost stock reservation.
test('actual costing refuses legacy ledger claims as stock coverage', async t => {
  await connectVenueMongo(t,'recipe_coverage'); const scope=await fixture(); const item=await beverage(scope,{currentQuantity:5,reservedQuantity:0});
  const oid=()=>new mongoose.Types.ObjectId(); const sessionId=oid();
  await require('../models/VenueConsumptionEvent').create({tenant:scope.tenantId,location:scope.locationId,session:sessionId,billOrder:oid(),lineId:'legacy',revision:1,effectKey:'legacy',kind:'recipe',actor:scope.actor.userId});
  const bill={_id:oid(),venueServiceSession:sessionId,venueBillSnapshot:{costMode:'actual',acceptedLines:[{lineId:'legacy',revision:1,subproduct:item.subProductId,size:item.sizeId,quantity:1,servingSnapshot:{mode:'made_to_order'}}]}};
  const session=await mongoose.startSession();
  try {await assert.rejects(session.withTransaction(()=>require('../services/venue/inventory').reserveBillStock({...scope,billOrder:bill,mongoSession:session})),e=>e.code==='COST_REVIEW_REQUIRED');}finally{await session.endSession();}
  const stock=await require('../models/WarehouseStock').findOne({tenant:scope.tenantId,subProduct:item.subProductId}).lean();assert.equal(stock.reservedQuantity,0);
});
test('recipe authoring retains owned stock mapping and stamps its reviewer on the server',async t=>{
 await connectVenueMongo(t,'recipe_mapping');const scope=await fixture();await require('../services/venue/service-sessions').ensureIndexes();const output=await beverage(scope);const source=await beverage(scope);
 const profile=await require('../models/IngredientProfile').create({tenant:scope.tenantId,subProduct:source.subProductId,dimension:'mass',createdBy:scope.actor.userId});
 const saved=await require('../services/venue/recipes').createVersion({...scope,subProductId:output.subProductId,sizeId:output.sizeId,expectedVersion:0,idempotencyKey:'mapped-recipe',input:{components:[{profile:profile.id,quantity:100,unit:'g',stockMapping:{sourceSubProductId:source.subProductId,sourceSizeId:source.sizeId,sourceLocationId:scope.locationId,contentQuantity:{amountScaled:10000,scale:100,unit:'g'}}}],yieldAssumption:{units:1}}});
 const row=await require('../models/RecipeVersion').findById(saved.id).lean();assert.equal(String(row.components[0].stockMapping?.sourceSizeId),source.sizeId);assert.equal(String(row.components[0].stockMapping.reviewedBy),scope.actor.userId);
 await assert.rejects(require('../services/venue/recipes').createVersion({...scope,subProductId:output.subProductId,sizeId:output.sizeId,expectedVersion:1,idempotencyKey:'unsafe-unit',input:{components:[{profile:profile.id,quantity:100,unit:'ml',stockMapping:{sourceSubProductId:source.subProductId,sourceSizeId:source.sizeId,sourceLocationId:scope.locationId,contentQuantity:{amountScaled:10000,scale:100,unit:'ml'}}}],yieldAssumption:{units:1}}}),e=>e.code==='UNIT_CONVERSION');
});
