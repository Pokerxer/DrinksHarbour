'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');

test('validateMenu and the projected menu accept additive item fields with legacy compatibility', {skip:!uri}, async t => {
  await connectVenueMongo(t,'menu_modifiers'); const args = await fixture();
  const api = require('../services/venue/experience');
  await require('../services/venue/service-sessions').ensureIndexes();
  await require('../models/VenueLocationProfile').createIndexes();
  const bev = await beverage(args);
  const mixer = await beverage(args, { currentQuantity: 5 });
  await require('../models/SubProduct').collection.updateOne({_id:new mongoose.Types.ObjectId(mixer.subProductId)},{$set:{name:'Tonic Water'}});
  await require('../models/Product').collection.updateOne({_id:(await require('../models/SubProduct').findById(mixer.subProductId).lean()).product},{$set:{name:'Tonic Water'}});
  const base = { subProductId: bev.subProductId, sizeId: bev.sizeId, published: true };
  const modifierGroups = [{ id:'mixer', name:'Mixer', required:true, minSelect:1, maxSelect:1, incompatibleWith:[],
    options:[{ id:'tonic', label:'Tonic', subProductId: mixer.subProductId, sizeId: mixer.sizeId }] }];

  // validateMenu is exported (experience.js) — call it directly.
  const validated = api.validateMenu({ sections: [{ id:'s1', name:'Mains', items:[{ ...base, display:'Signature Cocktail', category:'mains', modifierGroups }] }] });
  const item = validated.sections[0].items[0];
  assert.equal(item.display,'Signature Cocktail');
  assert.equal(item.category,'mains');
  assert.deepEqual(item.modifierGroups[0].options[0], { id:'tonic', label:'Tonic', subProductId: mixer.subProductId, sizeId: mixer.sizeId });

  // Legacy payload compatibility: a section/item WITHOUT the additive fields
  // validates to an object without those keys — no `display: undefined` leaks.
  const legacy = api.validateMenu({ sections: [{ id:'s2', name:'Drinks', items:[{ ...base }] }] }).sections[0].items[0];
  assert.equal('display' in legacy, false, 'legacy items must not gain a display key');
  assert.equal('category' in legacy, false, 'legacy items must not gain a category key');
  assert.equal('modifierGroups' in legacy, false, 'legacy items must not gain a modifierGroups key');

  // Save path still prices published items (pricing behavior untouched).
  const saved = await api.saveConfiguration({...args, kind:'menu', expectedVersion:0, input: validated, idempotencyKey:'menu-modifiers'});
  assert.equal(saved.version, 1);

  // Projection exposes the additive fields read-only; pricing unchanged.
  await require('../models/Product').collection.updateOne({_id:(await require('../models/SubProduct').findById(bev.subProductId).lean()).product},{$set:{status:'approved',isPublished:true}});
  const projection = await api.readMenu(args);
  const projected = projection.sections[0].items[0];
  assert.equal(projected.display,'Signature Cocktail');
  assert.equal(projected.category,'mains');
  assert.deepEqual(projected.modifierGroups[0].options[0], { id:'tonic', label:'Tonic', subProductId: mixer.subProductId, sizeId: mixer.sizeId });
  // The save path priced the published parent item through the unchanged rules.
  assert.equal(projected.unitPriceMinor, 100000);
});

test('v2 accepted choices freeze labels, versions, instructions and exact add-on quantities across menu edits', {skip:!uri},async t=>{
  await connectVenueMongo(t,'menu_choice_v2');const args=await fixture();const sessions=require('../services/venue/service-sessions');await sessions.ensureIndexes();
  const visit=await sessions.ensureServiceSession({...args,idempotencyKey:'v2-visit'});
  const main=await beverage(args);const extra=await beverage(args);const Size=require('../models/Size');
  for(const b of [main,extra])await Size.collection.updateOne({_id:new mongoose.Types.ObjectId(b.sizeId)},{$set:{servingSchemaVersion:2,size:'venue_serving',displayName:'Regular plate',venueServing:{code:'regular',mode:'sealed',saleUnit:'plate',channels:['venue'],version:0}}});
  const profile=require('../models/VenueLocationProfile');const iid='33333333-3333-4333-8333-333333333333';const cid='22222222-2222-4222-8222-222222222222';
  const menu={schemaVersion:2,sections:[{id:'11111111-1111-4111-8111-111111111111',name:'Dinner',items:[{menuItemId:iid,categoryId:cid,subProductId:main.subProductId,sizeId:main.sizeId,published:true,servingVersion:0,modifierSchemaVersion:2,modifierGroups:[{id:'protein',name:'Protein',required:true,minSelect:1,maxSelect:4,version:3,options:[{id:'extra',label:'Extra chicken',type:'addon',subProductId:extra.subProductId,sizeId:extra.sizeId,servingVersion:0,allowedSizeIds:[main.sizeId]}]},{id:'cooking',name:'Cooking',required:false,options:[{id:'well',label:'Well done',type:'instruction'}]}]}]}],categories:[{id:cid,sectionId:'11111111-1111-4111-8111-111111111111',parentId:null,name:'Mains',sortOrder:0}]};
  const saved=await require('../services/venue/experience').saveConfiguration({...args,kind:'menu',expectedVersion:0,input:menu,idempotencyKey:'v2-config'});
  const api=require('../services/venue/lines');const input={subProductId:main.subProductId,sizeId:main.sizeId,quantity:2,servingVersion:0,choices:[{groupId:'protein',optionId:'extra',quantity:2},{groupId:'cooking',optionId:'well'}]};
  const accepted=await api.setSessionLines({...args,sessionId:visit.id,expectedVersion:visit.version,lines:[input],idempotencyKey:'v2-lines'});
  const parent=accepted.lines.find(l=>l.subProductId===main.subProductId);const addon=accepted.lines.find(l=>l.subProductId===extra.subProductId);
  assert.equal(addon.quantity,4);assert.equal(accepted.lines.length,2,'instruction creates no ordinary sale line');assert.equal(parent.servingSnapshot.code,'regular');assert.equal(parent.menuConfigVersion,saved.version);assert.equal(parent.choiceSnapshots[0].label,'Extra chicken');assert.equal(parent.choiceSnapshots[0].groupVersion,3);assert.equal(parent.choiceSnapshots[0].quantity,2);assert.equal(parent.choiceSnapshots[0].unitPriceMinor,100000);assert.equal(parent.choiceSnapshots[1].unitPriceMinor,0);
  await profile.collection.updateOne({tenant:new mongoose.Types.ObjectId(args.tenantId),location:new mongoose.Types.ObjectId(args.locationId)},{$set:{'menu.sections.0.items.0.modifierGroups.0.options.0.label':'Changed label','menu.sections.0.items.0.modifierGroups.0.options.0.sizeId':new mongoose.Types.ObjectId().toString()}});
  const unchanged=await api.setSessionLines({...args,sessionId:visit.id,expectedVersion:accepted.version,lines:[input],idempotencyKey:'v2-reconnect'});
  assert.equal(unchanged.lines.find(l=>l.subProductId===main.subProductId).choiceSnapshots[0].label,'Extra chicken');assert.equal(unchanged.lines.find(l=>l.subProductId===extra.subProductId).quantity,4);
  await Size.collection.updateOne({_id:new mongoose.Types.ObjectId(main.sizeId)},{$set:{'venueServing.version':1}});
  await assert.rejects(api.setSessionLines({...args,sessionId:visit.id,expectedVersion:unchanged.version,lines:[{...input,quantity:3}],idempotencyKey:'v2-stale-serving'}),e=>e.code==='STATE_CHANGED');
  await Size.collection.updateOne({_id:new mongoose.Types.ObjectId(main.sizeId)},{$set:{'venueServing.version':0}});
  await Size.collection.updateOne({_id:new mongoose.Types.ObjectId(extra.sizeId)},{$set:{'venueServing.version':1}});
  menu.sections[0].items[0].modifierGroups[0].options[0].servingVersion=1;
  await require('../services/venue/experience').saveConfiguration({...args,kind:'menu',expectedVersion:1,input:menu,idempotencyKey:'v2-extra-version'});
  const more=await api.setSessionLines({...args,sessionId:visit.id,expectedVersion:unchanged.version,lines:[{...input,quantity:3}],idempotencyKey:'v2-new-extra'});
  assert.deepEqual(more.lines.filter(l=>l.subProductId===extra.subProductId).map(l=>[l.quantity,l.servingSnapshot.servingVersion]),[[4,0],[2,1]]);
  const recipe=await require('../models/RecipeVersion').create({tenant:args.tenantId,output:{subProduct:extra.subProductId,size:extra.sizeId},version:1,components:[],yieldAssumption:{units:1},createdBy:args.actor.userId});
  await Size.collection.updateOne({_id:new mongoose.Types.ObjectId(extra.sizeId)},{$set:{'venueServing.version':2,'venueServing.mode':'made_to_order'}});
  menu.sections[0].items[0].modifierGroups[0].options[0].servingVersion=2;
  menu.sections[0].items[0].modifierGroups[0].options[0].acceptedRecipeVersionId=String(recipe._id);
  await require('../services/venue/experience').saveConfiguration({...args,kind:'menu',expectedVersion:2,input:menu,idempotencyKey:'v2-recipe-config'});
  const withRecipe=await api.setSessionLines({...args,sessionId:visit.id,expectedVersion:more.version,lines:[{...input,quantity:4}],idempotencyKey:'v2-recipe-extra'});
  const recipeExtra=withRecipe.lines.find(l=>l.subProductId===extra.subProductId&&l.servingSnapshot?.servingVersion===2);
  assert.equal(String(recipeExtra.acceptedRecipeVersionId),String(recipe._id));
});

test('client metadata cannot forge accepted snapshots or accept a v2 portion outside its owned menu', {skip:!uri},async t=>{
  await connectVenueMongo(t,'menu_snapshot_authority');const args=await fixture();const sessions=require('../services/venue/service-sessions');await sessions.ensureIndexes();const visit=await sessions.ensureServiceSession({...args,idempotencyKey:'authority-visit'});const main=await beverage(args);
  const api=require('../services/venue/lines');const forged=await api.setSessionLines({...args,sessionId:visit.id,expectedVersion:visit.version,idempotencyKey:'forged',lines:[{...main,quantity:1,servingSnapshot:{code:'forged',mode:'made_to_order'},acceptedRecipeVersionId:new mongoose.Types.ObjectId().toString(),choiceSnapshots:[{type:'instruction',label:'forged'}],menuConfigVersion:999}]});
  assert.equal(forged.lines[0].servingSnapshot,undefined);assert.equal(forged.lines[0].acceptedRecipeVersionId,undefined);assert.equal(forged.lines[0].choiceSnapshots,undefined);
  const other=await beverage(args);await require('../models/Size').collection.updateOne({_id:new mongoose.Types.ObjectId(other.sizeId)},{$set:{servingSchemaVersion:2,size:'venue_serving',displayName:'Unlisted',venueServing:{code:'unlisted',mode:'sealed',saleUnit:'plate',channels:['venue'],version:0}}});
  await assert.rejects(api.setSessionLines({...args,sessionId:visit.id,expectedVersion:forged.version,idempotencyKey:'unlisted',lines:[{...main,quantity:1},{...other,quantity:1,servingVersion:0}]}),e=>e.code==='CHOICE_NOT_OFFERED');
});
