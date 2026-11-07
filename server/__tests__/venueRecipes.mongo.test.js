'use strict';
// Task 3 (S2) — recipe authoring service + routes: monotonic immutable versions,
// tenancy isolation, unknown-profile NOT_FOUND, expectedVersion STATE_CHANGED,
// eligibility ACTIONS suppression and HTTP wiring on the venue-ops router.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');
const eligibility = require('../services/venue/eligibility');

const codeOf = error => error && error.code;
const assertFails = (promise, code) => assert.rejects(promise, error => codeOf(error) === code);

test('recipe authoring: versions, tenancy, errors (service level)', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'recipe_versions');
  const args = await fixture();
  const recipes = require('../services/venue/recipes');
  const RecipeVersion = require('../models/RecipeVersion');
  const IngredientProfile = require('../models/IngredientProfile');
  await RecipeVersion.createIndexes(); await IngredientProfile.createIndexes();
  const userId = new mongoose.Types.ObjectId(args.actor.userId);

  // New actions are eligibility Actions — nothing else may be invented here.
  for (const action of ['recipes.read', 'recipes.write', 'stock.open']) assert.ok(eligibility.ACTIONS.includes(action));

  // Output = a beverage SubProduct (legacy kind → venue-service eligible); the
  // component profile layers over a second bottled-spirit stock item.
  const cocktail = await beverage(args);
  const spirit = await beverage(args);
  const profile = await IngredientProfile.create({ tenant: args.tenantId, subProduct: spirit.subProductId, dimension: 'volume', createdBy: userId });
  const input = over => ({ components: [{ profile: String(profile._id), quantity: 50, unit: 'ml' }], yieldAssumption: { units: 10, lossMl: 5 }, method: 'shake hard', ...over });
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, subProductId: cocktail.subProductId, sizeId: cocktail.sizeId, actor: { ...args.actor }, idempotencyKey: over.idempotencyKey || 'recipe-authoring', ...over });

  // v1 with an explicit projected cost
  const v1 = await recipes.createVersion({ ...base({}), expectedVersion: 0, input: input({ costMinorPerUnit: 120000 }) });
  assert.equal(v1.version, 1);
  assert.deepEqual(v1.components, [{ profileId: String(profile._id), quantity: 50, unit: 'ml' }]);
  assert.deepEqual(v1.yieldAssumption, { units: 10, lossMl: 5 });
  assert.equal(v1.method, 'shake hard');
  assert.equal(v1.costMinorPerUnit, 120000);
  assert.equal(v1.supersededBy, null);
  assert.ok(v1.effectiveFrom);

  // cost never guessed: absent costMinorPerUnit persists as null
  const v2 = await recipes.createVersion(base({ expectedVersion: 1, input: input({ method: 'shake longer' }), idempotencyKey: 'recipe-authoring-2' }));
  assert.equal(v2.version, 2);
  assert.equal(v2.costMinorPerUnit, null);

  // v1 untouched except the supersede pointer (append-only versions)
  const rows = await RecipeVersion.find({ tenant: args.tenantId }).sort({ version: 1 }).lean();
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].components.map(component => ({ profile: String(component.profile), quantity: component.quantity, unit: component.unit })),
    [{ profile: String(profile._id), quantity: 50, unit: 'ml' }]);
  assert.equal(String(rows[0].method), 'shake hard'); // immutable: v1 components/method never rewritten
  assert.equal(String(rows[0].supersededBy), String(rows[1]._id));

  // resolveActiveVersion: newest non-superseded, tenant-scoped
  const outputs = [{ subProduct: cocktail.subProductId, size: cocktail.sizeId }, { subProductId: cocktail.subProductId, sizeId: cocktail.sizeId }];
  for (const output of outputs) {
    const active = await recipes.resolveActiveVersion(args.tenantId, output);
    assert.equal(String(active._id), String(rows[1]._id));
    assert.equal(active.version, 2);
  }
  assert.equal(await recipes.resolveActiveVersion(args.tenantId, { subProduct: spirit.subProductId, size: spirit.sizeId }), null);

  // optimistic concurrency: re-create against a stale expectedVersion fails STATE_CHANGED
  await assertFails(recipes.createVersion({ ...base({ expectedVersion: 1, input: input({}), idempotencyKey: 'recipe-authoring-3' }) }), 'STATE_CHANGED');

  // unknown profile in the SAME tenant space → NOT_FOUND
  await assertFails(recipes.createVersion(base({ expectedVersion: 2, idempotencyKey: 'recipe-authoring-4',
    input: { components: [{ profile: new mongoose.Types.ObjectId().toString(), quantity: 1, unit: 'ml' }], yieldAssumption: { units: 1 } } })), 'NOT_FOUND');

  // component validation rides units.assertRecipeQuantities (duplicate, fractional count, non-positive)
  await assertFails(recipes.createVersion(base({ expectedVersion: 2, idempotencyKey: 'recipe-authoring-5',
    input: { components: [{ profile: profile._id, quantity: 0.5, unit: 'count' }], yieldAssumption: { units: 1 } } })), 'UNIT_CONVERSION');

  // output must satisfy isVenueServiceProduct and be a tenant-owned SubProduct
  const oid = () => new mongoose.Types.ObjectId();
  const retailProduct = oid(); const retailSub = oid();
  await require('../models/Product').collection.insertOne({ _id: retailProduct, name: 'Glass', type: 'bib' });
  await require('../models/SubProduct').collection.insertOne({ _id: retailSub, tenant: new mongoose.Types.ObjectId(args.tenantId), product: retailProduct, status: 'active' });
  await assertFails(recipes.createVersion(base({ subProductId: String(retailSub), expectedVersion: 2, idempotencyKey: 'recipe-authoring-6', input: input({}) })), 'INVALID_INPUT');
  await assertFails(recipes.createVersion(base({ subProductId: new mongoose.Types.ObjectId().toString(), expectedVersion: 0, idempotencyKey: 'recipe-authoring-7', input: input({}) })), 'NOT_FOUND');

  // l inputs collapse to ml
  const v3 = await recipes.createVersion(base({ expectedVersion: 2, idempotencyKey: 'recipe-authoring-8',
    input: { components: [{ profile: profile._id, quantity: 1.5, unit: 'l' }], yieldAssumption: { units: 20 } } }));
  assert.deepEqual(v3.components, [{ profileId: String(profile._id), quantity: 1500, unit: 'ml' }]);
  assert.equal(v3.version, 3);

  // Tenancy isolation: another tenant authoring against tenant A's profile fails NOT_FOUND
  const other = await fixture();
  const otherOutput = await beverage(other);
  const otherProfile = await IngredientProfile.create({ tenant: other.tenantId, subProduct: spirit.subProductId, dimension: 'volume', createdBy: new mongoose.Types.ObjectId(other.actor.userId) });
  await assertFails(recipes.createVersion({ tenantId: other.tenantId, locationId: other.locationId, subProductId: otherOutput.subProductId, sizeId: otherOutput.sizeId,
    expectedVersion: 0, actor: other.actor, idempotencyKey: 'cross-tenant-1',
    input: { components: [{ profile: String(profile._id), quantity: 50, unit: 'ml' }], yieldAssumption: { units: 10 } } }), 'NOT_FOUND');
  const otherVersion = await recipes.createVersion({ tenantId: other.tenantId, locationId: other.locationId, subProductId: otherOutput.subProductId, sizeId: otherOutput.sizeId,
    expectedVersion: 0, actor: other.actor, idempotencyKey: 'cross-tenant-2',
    input: { components: [{ profile: String(otherProfile._id), quantity: 50, unit: 'ml' }], yieldAssumption: { units: 10 } } });
  assert.equal(otherVersion.version, 1);
  // tenant B lookups never leak tenant A rows and vice versa
  assert.equal(String((await recipes.resolveActiveVersion(other.tenantId, { subProduct: otherOutput.subProductId, size: otherOutput.sizeId }))._id), String(otherVersion.id));
  assert.equal(await recipes.resolveActiveVersion(other.tenantId, { subProduct: cocktail.subProductId, size: cocktail.sizeId }), null);
});

test('recipe routes: auth, idempotency key, eligibility denial and listing', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'recipe_versions_http');
  const args = await fixture();
  const previous = { JWT_SECRET: process.env.JWT_SECRET };
  process.env.JWT_SECRET = 'recipe-http-test-only';
  t.after(() => { for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  const express = require('express');
  const app = express(); app.use(express.json()); app.use('/api/venue-ops', require('../routes/venue-ops.routes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ code: error.code }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const root = `http://127.0.0.1:${server.address().port}/api/venue-ops`;

  const other = await fixture(); // foreign tenant/location pair
  const output = await beverage(args);
  const RecipeVersion = require('../models/RecipeVersion');
  const profile = await require('../models/IngredientProfile').create({ tenant: args.tenantId, subProduct: output.subProductId, dimension: 'volume', createdBy: new mongoose.Types.ObjectId(args.actor.userId) });
  await RecipeVersion.createIndexes();

  const headers = () => ({ Authorization: `Bearer ${require('jsonwebtoken').sign({ userId: args.actor.userId }, process.env.JWT_SECRET)}`, 'Content-Type': 'application/json' });
  const saveUrl = `${root}/locations/${args.locationId}/recipes/${output.subProductId}`;
  const listUrl = `${root}/locations/${args.locationId}/recipes`;
  const save = (body, extra = {}) => fetch(saveUrl, { method: 'PUT', headers: { ...headers(), ...extra }, body: JSON.stringify(body) });

  assert.equal((await fetch(listUrl, {})).status, 401); // no token
  const missingKey = await save({ sizeId: output.sizeId, expectedVersion: 0, input: { components: [{ profile: String(profile._id), quantity: 50, unit: 'ml' }], yieldAssumption: { units: 10 } } });
  assert.equal(missingKey.status, 400); assert.equal((await missingKey.json()).code, 'IDEMPOTENCY_KEY_REQUIRED');

  const key = { 'Idempotency-Key': 'recipe-http-1' };
  const created = await save({ sizeId: output.sizeId, expectedVersion: 0, input: { components: [{ profile: String(profile._id), quantity: 50, unit: 'ml' }], yieldAssumption: { units: 10 }, costMinorPerUnit: 9000 } }, key);
  assert.equal(created.status, 201);
  const version = (await created.json()).data;
  assert.equal(version.version, 1);
  assert.equal(version.costMinorPerUnit, 9000);

  // replay of the same key returns the same recorded result
  const replay = await save({ sizeId: output.sizeId, expectedVersion: 0, input: { components: [{ profile: String(profile._id), quantity: 50, unit: 'ml' }], yieldAssumption: { units: 10 }, costMinorPerUnit: 9000 } }, key);
  assert.equal(replay.status, 201); assert.equal((await replay.json()).data.version, 1);

  // stale expectedVersion → STATE_CHANGED, not a duplicate row
  const stale = await save({ sizeId: output.sizeId, expectedVersion: 0, input: { components: [{ profile: String(profile._id), quantity: 60, unit: 'ml' }], yieldAssumption: { units: 10 } }, ...{} }, { 'Idempotency-Key': 'recipe-http-2' });
  assert.equal(stale.status, 409); assert.equal((await stale.json()).code, 'STATE_CHANGED');
  assert.equal(await RecipeVersion.countDocuments({ tenant: args.tenantId }), 1);

  const listed = await fetch(listUrl, { headers: headers() });
  assert.equal(listed.status, 200); assert.equal(listed.headers.get('cache-control'), 'no-store');
  const listing = (await listed.json()).data;
  assert.equal(listing.items.length, 1);
  assert.equal(listing.items[0].activeVersion.version, 1);
  assert.equal(listing.items[0].versions.length, 1);

  // cross-tenant location addressing fails NOT_FOUND at eligibility
  const foreign = await fetch(`${root}/locations/${other.locationId}/recipes`, { headers: headers() });
  assert.equal(foreign.status, 404); assert.equal((await foreign.json()).code, 'NOT_FOUND');

  // an actor whose venueDeniedActions suppress recipes.write is denied by eligibility
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: ['recipes.write'] } });
  const denied = await save({ sizeId: output.sizeId, expectedVersion: 1, input: { components: [{ profile: String(profile._id), quantity: 70, unit: 'ml' }], yieldAssumption: { units: 10 } } }, { 'Idempotency-Key': 'recipe-http-3' });
  assert.equal(denied.status, 403); assert.equal((await denied.json()).code, 'VENUE_PERMISSION_DENIED');
});
