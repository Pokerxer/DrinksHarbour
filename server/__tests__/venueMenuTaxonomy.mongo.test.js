'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');
const api = require('../services/venue/experience');
const sid = '11111111-1111-4111-8111-111111111111';
const cid = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';
const config = (items=[]) => ({schemaVersion:2,sections:[{id:sid,name:'Dinner',items}],categories:[{id:cid,sectionId:sid,parentId:null,name:'Mains',sortOrder:0}]});
const bad = fn => assert.throws(fn,e=>e.code==='INVALID_INPUT'&&e.statusCode===400);

test('v2 taxonomy rejects cycles, cross-section parents, excessive depth and foreign category placement',()=>{
  const root=config(); const child=randomUUID();
  const cycle=structuredClone(root); cycle.categories[0].parentId=child; cycle.categories.push({id:child,sectionId:sid,parentId:cid,name:'Child',sortOrder:1}); bad(()=>api.validateMenu(cycle));
  const foreign=structuredClone(root); const other=randomUUID(); foreign.sections.push({id:other,name:'Bar',items:[]}); foreign.categories.push({id:child,sectionId:other,parentId:cid,name:'Spirits',sortOrder:0}); bad(()=>api.validateMenu(foreign));
  const deep=structuredClone(root); deep.categories.push({id:child,sectionId:sid,parentId:cid,name:'Rice',sortOrder:1},{id:randomUUID(),sectionId:sid,parentId:child,name:'Too deep',sortOrder:0}); bad(()=>api.validateMenu(deep));
  const misplaced=config([{menuItemId:itemId,categoryId:randomUUID(),subProductId:'507f1f77bcf86cd799439011',sizeId:'507f1f77bcf86cd799439012',published:false,servingVersion:0}]); bad(()=>api.validateMenu(misplaced));
});

test('v2 taxonomy generates UUID identities and preserves IDs across category rename',()=>{
  const draft={schemaVersion:2,sections:[{name:'Dinner',items:[]}],categories:[]};
  assert.match(api.validateMenu(draft).sections[0].id,/^[0-9a-f-]{36}$/);
  const first=api.validateMenu(config()); const renamed=structuredClone(first); renamed.categories[0].name='Main dishes';
  assert.equal(api.validateMenu(renamed).categories[0].id,cid);
  const tooMany=config(); tooMany.categories=Array.from({length:31},(_,i)=>({id:randomUUID(),sectionId:sid,parentId:null,name:`Category ${i}`,sortOrder:i})); bad(()=>api.validateMenu(tooMany));
});

test('v2 menu config owns every portion and modifier reference, freezes version, projects no costs and remains unavailable', {skip:!uri},async t=>{
  await connectVenueMongo(t,'menu_taxonomy'); const args=await fixture();
  await require('../services/venue/service-sessions').ensureIndexes();
  const main=await beverage(args); const extra=await beverage(args); const foreign=await beverage(await fixture());
  const Size=require('../models/Size'); const Product=require('../models/Product'); const Sub=require('../models/SubProduct');
  const promote=async b=>{await Size.collection.updateOne({_id:new (require('mongoose').Types.ObjectId)(b.sizeId)},{$set:{servingSchemaVersion:2,size:'venue_serving',displayName:'Regular',venueServing:{code:'regular',mode:'sealed',saleUnit:'plate',channels:['venue'],version:0}}}); const sp=await Sub.findById(b.subProductId).lean(); await Product.collection.updateOne({_id:sp.product},{$set:{status:'approved',isPublished:true}});};
  await promote(main); await promote(extra);
  const item={menuItemId:itemId,categoryId:cid,subProductId:main.subProductId,sizeId:main.sizeId,published:true,servingVersion:0,modifierSchemaVersion:2,modifierGroups:[{id:'extra',name:'Extra chicken',required:false,minSelect:0,maxSelect:4,options:[{id:'chicken',label:'Chicken',type:'addon',subProductId:extra.subProductId,sizeId:extra.sizeId,allowedSizeIds:[main.sizeId],servingVersion:0}]}]};
  const saved=await api.saveConfiguration({...args,kind:'menu',expectedVersion:0,input:config([item]),idempotencyKey:'v2-save'}); assert.equal(saved.menu.schemaVersion,2);
  const projection=await api.readMenu(args); assert.equal(projection.categories[0].id,cid); const shown=projection.sections[0].items[0]; assert.equal(shown.unitPriceMinor,100000); assert.equal(shown.available,false); assert.equal(shown.availabilityReason,'not_configured'); assert.equal(shown.costMinor,undefined); assert.equal(shown.modifierGroups[0].options[0].unitPriceMinor,100000);
  const raw=JSON.stringify(projection); assert.ok(!/costMinor|costPrice|stationId|recipe|vendor/i.test(raw));
  const stale=structuredClone(item); stale.servingVersion=99; await assert.rejects(api.saveConfiguration({...args,kind:'menu',expectedVersion:1,input:config([stale]),idempotencyKey:'stale'}),e=>e.code==='STATE_CHANGED');
  const wrong=structuredClone(item); wrong.modifierGroups[0].options[0].sizeId=foreign.sizeId; await assert.rejects(api.saveConfiguration({...args,kind:'menu',expectedVersion:1,input:config([wrong]),idempotencyKey:'foreign'}),e=>e.code==='NOT_FOUND'&&e.statusCode===404);
  const renamed=config([item]); renamed.categories[0].name='Main dishes'; const next=await api.saveConfiguration({...args,kind:'menu',expectedVersion:1,input:renamed,idempotencyKey:'rename'}); assert.equal(next.menu.categories[0].id,cid);
  const autoArgs={...args,kind:'menu',expectedVersion:2,input:{schemaVersion:2,sections:[{name:'Draft',items:[]}],categories:[]},idempotencyKey:'generated-replay'};
  const generated=await api.saveConfiguration(autoArgs);const replay=await api.saveConfiguration(autoArgs);
  assert.equal(replay.menu.sections[0].id,generated.menu.sections[0].id);assert.equal(replay.version,generated.version);
});
test('unpublished made-to-order placement can precede recipe authoring but cannot be published without a recipe', {skip:!uri},async t=>{
 await connectVenueMongo(t,'menu_draft_recipe');const args=await fixture();await require('../services/venue/service-sessions').ensureIndexes();const item=await beverage(args);const Size=require('../models/Size');await Size.collection.updateOne({_id:new(require('mongoose').Types.ObjectId)(item.sizeId)},{$set:{servingSchemaVersion:2,size:'venue_serving',displayName:'Large plate',venueServing:{code:'large',mode:'made_to_order',saleUnit:'plate',channels:['venue'],version:1}}});
 const entry={menuItemId:itemId,categoryId:cid,subProductId:item.subProductId,sizeId:item.sizeId,published:false,servingVersion:1};const draft=await api.saveConfiguration({...args,kind:'menu',expectedVersion:0,input:config([entry]),idempotencyKey:'draft'});assert.equal(draft.menu.sections[0].items[0].published,false);
 await assert.rejects(api.saveConfiguration({...args,kind:'menu',expectedVersion:1,input:config([{...entry,published:true}]),idempotencyKey:'publish'}),e=>e.code==='STATE_CHANGED');
});
