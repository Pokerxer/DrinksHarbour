'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');
const Size = require('../models/Size');
const reject = (promise, code, status) => assert.rejects(promise, error => error.code === code && (!status || error.statusCode === status));
const input = (code = 'regular-plate', extra = {}) => ({ code, displayName: code, mode: 'made_to_order', saleUnit: 'plate', sellingPrice: 2500, ...extra });

test('v2 model defaults retain unknown measurements and cost while legacy defaults remain compatible', async () => {
  const identity = { tenant: new mongoose.Types.ObjectId(), subproduct: new mongoose.Types.ObjectId() };
  const legacy = new Size({ ...identity, size: '75cl' });
  assert.equal(legacy.unitType, 'volume_ml'); assert.equal(legacy.servingsPerUnit, 0); assert.equal(legacy.costPrice, 0);
  const row = new Size({ ...identity, servingSchemaVersion: 2, size: 'venue_serving', displayName: 'Bowl', venueServing: { code: 'bowl', mode: 'made_to_order', saleUnit: 'bowl', channels: ['venue'], version: 0 } });
  assert.equal(row.unitType, 'serving');
  assert.equal(row.volumeMl, undefined); assert.equal(row.weightGrams, undefined);
  assert.equal(row.servingsPerUnit, undefined); assert.equal(row.costPrice, null);
  await row.validate();
});

async function prepare(t) {
  await connectVenueMongo(t, 'servings');
  const previous = process.env.VENUE_SERVINGS_V2_ENABLED;
  process.env.VENUE_SERVINGS_V2_ENABLED = 'true';
  t.after(() => previous === undefined ? delete process.env.VENUE_SERVINGS_V2_ENABLED : process.env.VENUE_SERVINGS_V2_ENABLED = previous);
  const args = await fixture(); const product = await beverage(args);
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { posPermissions: ['pos:sell', 'venue:servings_write'] } });
  await require('../models/Warehouse').collection.updateOne({ _id: new mongoose.Types.ObjectId(args.locationId) }, { $set: { 'venueServices.catalogCosting.servingsV2Enabled': true } });
  // This fixture explicitly performs the reviewed preparation on its disposable DB.
  await Size.collection.updateMany({ servingSchemaVersion: { $exists: false } }, { $set: { servingSchemaVersion: 1 } });
  await Size.createIndexes();
  await require('../models/VenueOperation').createIndexes();
  return { args, product };
}

test('v2_portions_keep_legacy_uniqueness_and_owned_identity', { skip: !uri }, async t => {
  const { args, product } = await prepare(t);
  const service = require('../services/venue/servings');
  const save = (over = {}) => service.saveServing({ ...args, subProductId: product.subProductId, input: input(), expectedVersion: 0, idempotencyKey: 'regular', ...over });
  const regular = await save();
  const large = await save({ input: input('large-plate', { weightGrams: 650.25, servingsPerUnit: 2 }), idempotencyKey: 'large' });
  assert.notEqual(regular.id, large.id);
  assert.deepEqual(await save(), regular);
  const snapshot = await service.servingSnapshot({ tenantId: args.tenantId, subProductId: product.subProductId, sizeId: large.id });
  assert.deepEqual(snapshot, { sizeId: large.id, servingVersion: 1, code: 'large-plate', displayName: 'large-plate', saleUnit: 'plate', mode: 'made_to_order', weightGrams: 650.25, servingsPerUnit: 2 });
  assert.equal(snapshot.costPrice, undefined);
  assert.equal(snapshot.volumeMl, undefined);
  assert.equal(await service.servingSnapshot({ tenantId: args.tenantId, subProductId: product.subProductId, sizeId: product.sizeId }), null);
  const renamed = await save({ sizeId: regular.id, expectedVersion: 1, input: input('regular-plate', { displayName: 'Regular jollof' }), idempotencyKey: 'rename' });
  assert.equal(renamed.version, 2);
  await reject(save({ sizeId: regular.id, expectedVersion: 2, input: input('different'), idempotencyKey: 'code-change' }), 'SERVING_CODE_IMMUTABLE', 409);
  await reject(save({ sizeId: regular.id, expectedVersion: 1, idempotencyKey: 'stale' }), 'STATE_CHANGED', 409);
  await reject(save({ idempotencyKey: 'duplicate-code' }), 'SERVING_CODE_CONFLICT', 409);
  const other = await fixture(); const foreign = await beverage(other);
  await reject(save({ subProductId: foreign.subProductId, idempotencyKey: 'foreign-parent' }), 'NOT_FOUND', 404);
  await reject(save({ sizeId: foreign.sizeId, idempotencyKey: 'foreign-size' }), 'NOT_FOUND', 404);
  await reject(service.servingSnapshot({ tenantId: other.tenantId, subProductId: product.subProductId, sizeId: regular.id }), 'NOT_FOUND', 404);
  const legacy = { tenant: args.tenantId, subproduct: product.subProductId, size: '75cl', sellingPrice: 1000 };
  await Size.create(legacy);
  await assert.rejects(Size.create(legacy), error => error.code === 11000);
  const persisted = await Size.findById(large.id).lean();
  assert.equal(persisted.size, 'venue_serving');
  assert.equal(persisted.unitType, 'serving');
  assert.equal(persisted.servingSchemaVersion, 2);
  assert.deepEqual(persisted.venueServing.channels, ['venue']);
  await assert.rejects(new Size({ ...legacy, size: 'venue_serving' }).validate(), /venue/i);
});

test('serving writes refuse missing, partial or incompatible index preparation', { skip: !uri }, async t => {
  const { args, product } = await prepare(t);
  const { saveServing } = require('../services/venue/servings');
  const definitions = require('../services/venue/serving-indexes').SERVING_MODEL_INDEXES;
  const save = key => saveServing({ ...args, subProductId: product.subProductId, input: input(), expectedVersion: 0, idempotencyKey: key });
  const v2 = definitions.find(row => row.options.partialFilterExpression.servingSchemaVersion === 2);
  const index = (await Size.collection.indexes()).find(row => JSON.stringify(row.key) === JSON.stringify(v2.key));
  await Size.collection.dropIndex(index.name);
  await reject(save('missing'), 'VENUE_SERVINGS_NOT_READY', 503);
  await Size.collection.createIndex(v2.key, { ...v2.options, unique: false });
  await reject(save('nonunique'), 'VENUE_SERVINGS_NOT_READY', 503);
  await Size.collection.dropIndex((await Size.collection.indexes()).find(row => JSON.stringify(row.key) === JSON.stringify(v2.key)).name);
  await Size.collection.createIndex(v2.key, { unique: true, partialFilterExpression: { servingSchemaVersion: 2, 'venueServing.mode': 'sealed' } });
  await reject(save('wrong-filter'), 'VENUE_SERVINGS_NOT_READY', 503);
  await Size.collection.dropIndex((await Size.collection.indexes()).find(row => JSON.stringify(row.key) === JSON.stringify(v2.key)).name);
  await Size.collection.createIndex(v2.key, { ...v2.options, unique: true });
  const v1 = definitions.find(row => row.options.partialFilterExpression.servingSchemaVersion === 1);
  await Size.collection.dropIndex(v1.options.name);
  await reject(save('missing-legacy-guard'), 'VENUE_SERVINGS_NOT_READY', 503);
  await Size.collection.createIndex(v1.key, { ...v1.options, unique: true });
  await Size.collection.createIndex({ subproduct: 1, size: 1 }, { unique: true, name: 'reviewed_legacy_guard' });
  await reject(save('old-guard'), 'VENUE_SERVINGS_NOT_READY', 503);
  await Size.collection.dropIndex('reviewed_legacy_guard');
  await Size.collection.insertOne({ tenant: new mongoose.Types.ObjectId(args.tenantId), subproduct: new mongoose.Types.ObjectId(product.subProductId), size: 'custom' });
  await reject(save('unbackfilled'), 'VENUE_SERVINGS_NOT_READY', 503);
  assert.equal(await Size.countDocuments({ servingSchemaVersion: 2 }), 0);
});

test('serving validation, optimistic concurrency and fresh authorization', { skip: !uri }, async t => {
  const { args, product } = await prepare(t);
  const { saveServing } = require('../services/venue/servings');
  let count = 0;
  const save = (over = {}) => saveServing({ ...args, subProductId: product.subProductId, input: input(), expectedVersion: 0, idempotencyKey: `validation-${count++}`, ...over });
  for (const bad of [input('Upper'), input('x', { weightGrams: 0 }), input('x', { volumeMl: -1 }), input('x', { weightGrams: 1.001 }), input('x', { saleUnit: 'kg' }), input('x', { mode: 'pour' }), input('x', { channels: ['retail'] }), input('x', { costMinor: 0 })]) await reject(save({ input: bad }), 'INVALID_INPUT', 400);
  const pour = await save({ input: input('glass', { mode: 'pour', saleUnit: 'glass', volumeMl: 35.5 }) });
  const racing = await Promise.allSettled([save({ sizeId: pour.id, expectedVersion: 1, input: input('glass', { mode: 'pour', saleUnit: 'glass', volumeMl: 40 }) }), save({ sizeId: pour.id, expectedVersion: 1, input: input('glass', { mode: 'pour', saleUnit: 'glass', volumeMl: 50 }) })]);
  assert.equal(racing.filter(row => row.status === 'fulfilled').length, 1);
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: ['servings.write'] } });
  await reject(save(), 'VENUE_PERMISSION_DENIED', 403);
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: [] } });
  await require('../models/Tenant').collection.updateOne({ _id: new mongoose.Types.ObjectId(args.tenantId) }, { $set: { status: 'suspended' } });
  await reject(save(), 'VENUE_DISABLED', 403);
});

test('beverage v2 serving is excluded from retail size projections and cart selection', { skip: !uri }, async t => {
  const { args, product } = await prepare(t);
  const subproduct = new mongoose.Types.ObjectId(product.subProductId);
  const tenant = new mongoose.Types.ObjectId(args.tenantId);
  const servingId = new mongoose.Types.ObjectId();
  await Size.collection.insertOne({ _id: servingId, tenant, subproduct, servingSchemaVersion: 2, size: 'venue_serving', displayName: 'Venue glass', sellingPrice: 1, costPrice: 0, status: 'active', availability: 'available', stock: 10, availableStock: 10,
    venueServing: { code: 'glass', mode: 'pour', saleUnit: 'glass', channels: ['venue'], version: 1 }, volumeMl: 35, servingsPerUnit: 1 });
  await Size.updateOne({ _id: product.sizeId }, { $set: { size: '75cl', status: 'active', availability: 'available', availableStock: 10, stock: 10 } });
  const sp = await require('../models/SubProduct').findById(subproduct).lean();
  await require('../models/SubProduct').collection.updateOne({ _id: subproduct }, { $set: { sizes: [new mongoose.Types.ObjectId(product.sizeId), servingId], isPublished: true, status: 'active', visibleInOnlineStore: true } });
  const retail = await require('../services/storefrontCatalog.service').loadSizes({ _id: tenant }, [sp]);
  assert.deepEqual(retail.map(row => String(row._id)), [product.sizeId]);
  const projection = await require('../services/subproduct.service').getSubProductsByTenant(args.tenantId);
  assert.deepEqual(projection.subProducts[0].sizes.map(row => String(row._id)), [product.sizeId]);
  await assert.rejects(require('../services/subproduct.service').updateSize(product.subProductId, String(servingId), { displayName: 'Bypassed version' }, args.tenantId), /serving command/i);
  const [cart] = await require('../services/cart.service').validateCartItems([{ subProductId: product.subProductId, sizeId: String(servingId), quantity: 1, price: 1 }]);
  assert.equal(cart.available, false);
  const filter = require('../constants/sizeChannels').retailSizeWhereClause();
  assert.equal(await Size.countDocuments({ ...filter, _id: servingId }), 0);
  assert.equal(await Size.countDocuments({ ...filter, _id: product.sizeId }), 1);
  await require('../models/SubProduct').collection.updateOne({ _id: subproduct }, { $set: { totalStock: 10, availableStock: 10, reservedStock: 0 } });
  await assert.rejects(require('../services/storefrontStock').reserveStock([{ subproduct, tenant, size: servingId, quantity: 1 }], null), /venue|variant.*unavailable/i);
  assert.equal((await require('../models/SubProduct').findById(subproduct).lean()).availableStock, 10);
  await require('../models/WarehouseStock').create({ tenant, warehouse: args.locationId, subProduct: subproduct, size: servingId, currentQuantity: 10 });
  const session = await mongoose.startSession();
  try {
    await assert.rejects(session.withTransaction(() => require('../services/storefrontLocationStock').reserve([{ subproduct, tenant, size: servingId, product: sp.product, warehouse: args.locationId, quantity: 1 }], new mongoose.Types.ObjectId(), session)), /venue|variant.*unavailable/i);
  } finally { await session.endSession(); }
  await require('../models/SubProduct').collection.updateOne({ _id: subproduct }, { $set: { totalStock: 9, availableStock: 9, reservedStock: 1 } });
  await Size.collection.updateOne({ _id: servingId }, { $set: { stock: 9, availableStock: 9, reservedStock: 1 } });
  await require('../services/storefrontStock').releaseStock([{ subproduct, tenant, size: servingId, quantity: 1 }], null);
  assert.equal((await Size.findById(servingId).lean()).availableStock, 10);
});
