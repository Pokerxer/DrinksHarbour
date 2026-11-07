'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');

// Seeds a SubProduct/Size for a manually-inserted Product with an explicit
// catalogKind (the legacy helper beverage() never sets catalogKind). Mirrors
// the collection-level seeding style of helpers/venueMongo.beverage().
async function kindItem(args, name, kind, { type = 'wine' } = {}) {
  const oid = () => new mongoose.Types.ObjectId();
  const product = oid(), subproduct = oid(), size = oid(); const tenant = new mongoose.Types.ObjectId(args.tenantId);
  await require('../models/Product').collection.insertOne({ _id: product, name, type, isAlcoholic: false, tracksBatch: false, catalogKind: kind });
  await require('../models/SubProduct').collection.insertOne({ _id: subproduct, tenant, product, status: 'active', visibleInPOS: true, baseSellingPrice: 3000, defaultSize: size, costPrice: 1500 });
  await require('../models/Size').collection.insertOne({ _id: size, tenant, subproduct, sellingPrice: 3000, costPrice: 1500 });
  await require('../models/WarehouseStock').create({ tenant, warehouse: args.locationId, subProduct: subproduct, size, currentQuantity: 10, reservedQuantity: 2 });
  return { subProductId: String(subproduct), sizeId: String(size) };
}

test('menuCandidates are catalog-kind aware: kinds extend, legacy beverages stay, other kinds excluded', {skip:!uri}, async t => {
  await connectVenueMongo(t,'kind_candidates'); const args = await fixture();
  const api = require('../services/venue/experience');
  const legacy = await beverage(args); // legacy: no catalogKind field at all
  const preparedBeverage = await kindItem(args,'Espresso Martini Mix','prepared_beverage',{type:'snack'});
  const preparedFood = await kindItem(args,'Jollof Plate','prepared_food',{type:'snack'});
  const consumable = await kindItem(args,'Bar Rag','consumable',{type:'beer'});
  const ingredient = await kindItem(args,'Cherry Syrup','ingredient',{type:'beer'});
  const result = await api.menuCandidates({...args,actor:args.actor});
  const candidateIds = result.items.map((row)=>String(row.id));
  assert.ok(candidateIds.includes(legacy.subProductId),'legacy beverage without catalogKind must still appear');
  assert.ok(candidateIds.includes(preparedBeverage.subProductId),'prepared_beverage must appear as a candidate');
  assert.ok(candidateIds.includes(preparedFood.subProductId),'prepared_food must appear as a candidate');
  assert.equal(candidateIds.includes(consumable.subProductId),false,'consumable kind is not venue-sellable');
  assert.equal(candidateIds.includes(ingredient.subProductId),false,'ingredient kind is not venue-sellable');
  const prepared = result.items.find((row)=>row.id===preparedFood.subProductId);
  assert.ok(prepared.sizes.length,'kind candidates expose their sizes like beverages');
});

test('unpublished draft menu items: prepared_food saves, consumable kind stays rejected', {skip:!uri}, async t => {
  await connectVenueMongo(t,'kind_gate_draft'); const args = await fixture();
  const api = require('../services/venue/experience');
  await require('../services/venue/service-sessions').ensureIndexes();
  await require('../models/VenueLocationProfile').createIndexes();
  const food = await kindItem(args,'Jollof Plate','prepared_food',{type:'snack'});
  const rag = await kindItem(args,'Bar Rag','consumable',{type:'beer'});
  const menu = (item) => ({ sections: [{ id:'s1', name:'Kitchen', items:[item] }] });
  // Draft (unpublished) items skip pricing, but must still pass the venue
  // service gate: prepared_food products are venue-sellable on save.
  const saved = await api.saveConfiguration({...args, kind:'menu', expectedVersion:0,
    input: menu({ subProductId: food.subProductId, sizeId: food.sizeId, published:false }), idempotencyKey:'kind-gate-draft-food'});
  assert.equal(saved.version, 1, 'unpublished prepared_food item saves without VENUE_UNSUPPORTED_CART');
  // Consumable-kind products are not venue-sellable even with a beverage type.
  await assert.rejects(
    api.saveConfiguration({...args, kind:'menu', expectedVersion:1,
      input: menu({ subProductId: rag.subProductId, sizeId: rag.sizeId, published:false }), idempotencyKey:'kind-gate-draft-rag'}),
    (error) => error.code === 'VENUE_UNSUPPORTED_CART',
    'unpublished consumable-kind item must still fail with VENUE_UNSUPPORTED_CART'
  );
});

test('published menu items: prepared_food products pass saveConfiguration pricing', {skip:!uri}, async t => {
  await connectVenueMongo(t,'kind_gate_price'); const args = await fixture();
  const api = require('../services/venue/experience');
  await require('../services/venue/service-sessions').ensureIndexes();
  await require('../models/VenueLocationProfile').createIndexes();
  const food = await kindItem(args,'Jollof Plate','prepared_food',{type:'snack'});
  // Published items are priced through priceVenueLines: a prepared_food
  // product must pass the venue product gate, not be rejected as a
  // non-beverage type.
  const saved = await api.saveConfiguration({...args, kind:'menu', expectedVersion:0,
    input: { sections: [{ id:'s1', name:'Kitchen', items:[{ subProductId: food.subProductId, sizeId: food.sizeId, published:true }] }] },
    idempotencyKey:'kind-gate-pub-food'});
  assert.equal(saved.version, 1, 'published prepared_food item prices successfully');
});
