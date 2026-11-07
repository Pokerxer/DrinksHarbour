'use strict';
// Task 2 (S2) — five additive recipe/pour collections: uniqueness, tenancy scoping, enums.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture } = require('./helpers/venueMongo');
const dupCode = error => error && error.code === 11000;

test('recipe collections enforce unique keys, kinds, waste reasons and tenant scoping', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'recipe_models');
  const args = await fixture();
  const tenant = new mongoose.Types.ObjectId(args.tenantId);
  const otherTenant = new mongoose.Types.ObjectId();
  const IngredientProfile = require('../models/IngredientProfile');
  const RecipeVersion = require('../models/RecipeVersion');
  const OpenedBottle = require('../models/OpenedBottle');
  const Consumption = require('../models/VenueConsumptionEvent');
  const Waste = require('../models/VenueWasteEvent');
  await Promise.all([IngredientProfile, RecipeVersion, OpenedBottle, Consumption, Waste].map(model => model.createIndexes()));
  const oid = () => new mongoose.Types.ObjectId();
  const subProduct = oid(), size = oid(), profileGhost = oid(), session = oid(), bill = oid(), actor = oid();

  // IngredientProfile {tenant, subProduct} unique per tenant
  const profile = await IngredientProfile.create({ tenant, subProduct, dimension: 'volume', gramsPerMl: 0.995, allergenSource: ['sulfites'], createdBy: actor });
  await assert.rejects(IngredientProfile.create({ tenant, subProduct, dimension: 'volume', gramsPerMl: 0.995, createdBy: actor }), dupCode);
  await IngredientProfile.create({ tenant, subProduct: oid(), dimension: 'count', perishable: true, createdBy: actor });
  // Tenancy: scoped {_id, tenant} lookup cannot read another tenant's row
  assert.equal(await IngredientProfile.findOne({ _id: profile._id, tenant: otherTenant }).lean(), null);
  assert.ok(await IngredientProfile.findOne({ _id: profile._id, tenant }).lean());

  // RecipeVersion {tenant, output.subProduct, output.size, version} unique
  const output = { subProduct, size };
  await RecipeVersion.create({ tenant, output, version: 1, components: [{ profile: profile._id, quantity: 50, unit: 'ml' }], effectiveFrom: new Date(), createdBy: actor });
  await RecipeVersion.create({ tenant, output, version: 2, components: [{ profile: profile._id, quantity: 60, unit: 'ml' }], effectiveFrom: new Date(), createdBy: actor });
  await assert.rejects(RecipeVersion.create({ tenant, output, version: 2, components: [{ profile: profile._id, quantity: 70, unit: 'ml' }], createdBy: actor }), dupCode);
  const clone = await RecipeVersion.create({ tenant: otherTenant, output, version: 1, components: [{ profile: profile._id, quantity: 50, unit: 'ml' }], createdBy: actor });
  assert.equal(String(clone.tenant), String(otherTenant));
  // recipe subdoc needs a size per version; version monotonic starts at 1
  await assert.rejects(RecipeVersion.create({ tenant, output: { subProduct: oid() }, version: 3, components: [{ profile: profile._id, quantity: 1, unit: 'count' }], createdBy: actor }), /recipe version/i);
  await assert.rejects(RecipeVersion.create({ tenant, output, version: 0, components: [{ profile: profile._id, quantity: 1, unit: 'count' }], createdBy: actor }), /recipe version/i);

  // VenueConsumptionEvent effectKey unique; kind enum exactly poured|recipe|sealed-issue
  const base = { tenant, location: args.locationId, session, billOrder: bill, lineId: 'L1', revision: 1, kind: 'poured', items: [{ subProduct, size, quantity: 50, unit: 'ml' }], actor };
  await Consumption.create({ ...base, effectKey: 'fire:test:l1:1' });
  await assert.rejects(Consumption.create({ ...base, effectKey: 'fire:test:l1:1' }), dupCode);
  await Consumption.create({ ...base, lineId: 'L2', effectKey: 'fire:test:l2:1', kind: 'recipe', recipeVersion: profileGhost, items: [{ subProduct, size, profile: profile._id, quantity: 2, unit: 'count', sourceEffect: bill }] });
  await assert.rejects(Consumption.create({ ...base, effectKey: 'fire:test:l3:1', kind: 'cooking' }), /consumption kind/i);

  // OpenedBottle carries source batch, contents/remaining and open|exhausted state
  const bottle = await OpenedBottle.create({ tenant, location: args.locationId, source: { subProduct, size }, batchAllocation: [{ batchId: oid(), units: 1 }], contentsMl: 750, remainingMl: 630, openedBy: actor });
  assert.equal(bottle.state, 'open');
  await assert.rejects(OpenedBottle.create({ tenant, location: args.locationId, source: { subProduct, size }, contentsMl: 750, remainingMl: 800, openedBy: actor }), /remaining/i);

  // VenueWasteEvent reason enum spills exactly as spec §2 lists it
  await Waste.create({ tenant, location: args.locationId, consumptionEvent: bottle._id, lineId: 'L1', reason: 'spill', quantity: 20, unit: 'ml', approvedBy: actor, actor });
  await Waste.create({ tenant, location: args.locationId, reason: 'supersed-portion', quantity: 1, unit: 'count', approvedBy: actor, actor });
  for (const reason of ['spoiled', 'burned', 'return_outcome']) {
    await assert.rejects(Waste.create({ tenant, location: args.locationId, reason, quantity: 5, unit: 'ml', approvedBy: actor, actor }), /waste reason/i);
  }

  // Declared indexes exist after createIndexes (readiness contract)
  const indexRows = async model => (await model.collection.listIndexes().toArray()).map(row => row.key);
  assert.deepEqual(await indexRows(IngredientProfile), [{ _id: 1 }, { tenant: 1, subProduct: 1 }]);
  assert.ok((await indexRows(RecipeVersion)).find(row => row['output.subProduct'] === 1 && row['output.size'] === 1 && row.version === 1));
  assert.ok((await indexRows(OpenedBottle)).find(row => row.state === 1 && row['source.subProduct'] === 1));
  assert.deepEqual(await indexRows(Consumption), [{ _id: 1 }, { tenant: 1, effectKey: 1 }]);
  assert.ok((await indexRows(Waste)).find(row => row.location === 1 && row.createdAt === -1));

  // Readiness service (audit-indexes.js) agrees with the declared schema indexes
  const preview = await require('../services/venue/audit-indexes').previewRecipeModelIndexes(mongoose.connection.db);
  assert.equal(preview.filter(row => row.missing.length).length, 0);
});
