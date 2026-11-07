'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');
const { fingerprint } = require('../services/venue/operations');
const fail = (promise, code) => assert.rejects(promise, error => error.code === code);
async function setup(t) {
  await connectVenueMongo(t, 'catalog_migration');
  const db = mongoose.connection.db;
  const first = await fixture(); const second = await fixture();
  const a = await beverage(first); const b = await beverage(second);
  await db.collection('sizes').updateMany({}, { $set: { size: '75cl', sellingPrice: 2500, costPrice: 1000 } });
  await db.collection('sizes').createIndex({ subproduct: 1, size: 1 }, { unique: true, name: 'old_size_guard' });
  await db.collection('users').updateOne({ _id: new mongoose.Types.ObjectId(first.actor.userId) }, { $set: { role: 'super_admin' } });
  const mapping = { tenantId: first.tenantId, locationId: first.locationId, reviewedBy: first.actor.userId,
    expectedDatabase: db.databaseName, legacyIndexName: 'old_size_guard', reviewedTenantIds: [first.tenantId], reviewedLegacySizeIds: [a.sizeId] };
  const targetUri = `mongodb://127.0.0.1:29127/${db.databaseName}?replicaSet=venuePhase0`;
  return { db, mapping, targetUri, a, b, first, second };
}

test('catalogue migration is exact-target read-only by default and refuses unreviewed global impact', { skip: !uri }, async t => {
  const args = await setup(t); const service = require('../services/venue/catalog-costing-migration');
  const before = fingerprint(await args.db.collection('sizes').find({}).sort({ _id: 1 }).toArray());
  const indexes = fingerprint(await args.db.collection('sizes').indexes());
  const preview = await service.previewCatalogCosting(args);
  assert.equal(preview.safe, false); assert.ok(preview.blockers.includes('UNREVIEWED_LEGACY_SIZE'));
  assert.deepEqual(preview.impact.unreviewedSizeIds, [args.b.sizeId]);
  assert.equal(fingerprint(await args.db.collection('sizes').find({}).sort({ _id: 1 }).toArray()), before);
  assert.equal(fingerprint(await args.db.collection('sizes').indexes()), indexes);
  await fail(service.applyCatalogCosting({ ...args, expectedHash: preview.previewHash, mappingReviewed: true, indexChangeReviewed: true, writersPaused: true }), 'CATALOG_COSTING_REVIEW_REQUIRED');
  await fail(service.previewCatalogCosting({ ...args, targetUri: undefined }), 'CATALOG_COSTING_TARGET_REQUIRED');
  await fail(service.previewCatalogCosting({ ...args, mapping: { ...args.mapping, expectedDatabase: 'another_database' } }), 'CATALOG_COSTING_TARGET_MISMATCH');
  const parse = require('../services/venue/catalog-costing-mapping');
  assert.throws(() => parse.requireCatalogCostingUri({ MONGODB_URI: args.targetUri }), error => error.code === 'CATALOG_COSTING_TARGET_REQUIRED');
});

test('reviewed migration blocks duplicate/orphan/ambiguous source mappings and changed preview inputs', { skip: !uri }, async t => {
  const args = await setup(t); const service = require('../services/venue/catalog-costing-migration');
  args.mapping.reviewedTenantIds.push(args.second.tenantId); args.mapping.reviewedLegacySizeIds.push(args.b.sizeId);
  assert.equal((await service.previewCatalogCosting(args)).safe, true);
  const oid = () => new mongoose.Types.ObjectId();
  const orphan = { _id: oid(), tenant: new mongoose.Types.ObjectId(args.first.tenantId), subproduct: oid(), size: 'unit', servingSchemaVersion: 1 };
  await args.db.collection('sizes').insertOne(orphan);
  assert.ok((await service.previewCatalogCosting(args)).blockers.includes('ORPHAN_SIZE'));
  await args.db.collection('sizes').deleteOne({ _id: orphan._id });
  await args.db.collection('sizes').dropIndex('old_size_guard');
  const duplicate = { ...(await args.db.collection('sizes').findOne({ _id: new mongoose.Types.ObjectId(args.a.sizeId) })), _id: oid(), servingSchemaVersion: 1 };
  await args.db.collection('sizes').insertOne(duplicate);
  assert.ok((await service.previewCatalogCosting(args)).blockers.includes('DUPLICATE_LEGACY_SIZE'));
  await args.db.collection('sizes').deleteOne({ _id: duplicate._id });
  await args.db.collection('sizes').createIndex({ subproduct: 1, size: 1 }, { unique: true, name: 'old_size_guard' });
  await args.db.collection('venuelocationprofiles').insertOne({ tenant: new mongoose.Types.ObjectId(args.first.tenantId), location: new mongoose.Types.ObjectId(args.first.locationId), menu: { sections: [{ id: 'dinner', items: [{ subProductId: args.a.subProductId, sizeId: args.a.sizeId, category: 'Unmapped food' }] }] } });
  assert.ok((await service.previewCatalogCosting(args)).blockers.includes('AMBIGUOUS_MENU_CATEGORY'));
  await args.db.collection('venuelocationprofiles').deleteMany({});
  const preview = await service.previewCatalogCosting(args);
  await args.db.collection('sizes').updateOne({ _id: new mongoose.Types.ObjectId(args.a.sizeId) }, { $set: { sellingPrice: 2600 } });
  await fail(service.applyCatalogCosting({ ...args, expectedHash: preview.previewHash, mappingReviewed: true, indexChangeReviewed: true, writersPaused: true }), 'CATALOG_COSTING_PREVIEW_CHANGED');
});

test('reviewed migration crash stages retain guards, retry is idempotent and history/flags remain unchanged', { skip: !uri }, async t => {
  const args = await setup(t); const service = require('../services/venue/catalog-costing-migration');
  args.mapping.reviewedTenantIds.push(args.second.tenantId); args.mapping.reviewedLegacySizeIds.push(args.b.sizeId);
  const history = { tenant: new mongoose.Types.ObjectId(args.first.tenantId), status: 'closed', paymentStatus: 'paid', totalAmount: 9000, items: [{ costPrice: 750, priceAtPurchase: 2500 }] };
  await args.db.collection('orders').insertOne(history);
  await args.db.collection('venuecostsnapshots').insertOne({ tenant: history.tenant, effectKey: 'old', costMinor: 75000, status: 'verified' });
  await args.db.collection('venuepaymentreceipts').insertOne({ tenant: history.tenant, reference: 'old-paid', amountMinor: 900000 });
  const retained = async () => fingerprint(await Promise.all(['orders', 'venuecostsnapshots', 'venuepaymentreceipts'].map(name => args.db.collection(name).find({}).sort({ _id: 1 }).toArray())));
  const historyHash = await retained();
  const preview = await service.previewCatalogCosting(args); assert.equal(preview.safe, true);
  const command = { ...args, expectedHash: preview.previewHash, mappingReviewed: true, indexChangeReviewed: true, writersPaused: true };
  await fail(service.applyCatalogCosting({ ...command, indexChangeReviewed: false }), 'CATALOG_COSTING_REVIEW_REQUIRED');
  const readiness = require('../services/venue/serving-indexes');
  for (const stage of ['backfilled', 'legacy_guard_installed', 'venue_guard_installed']) {
    await assert.rejects(service.applyCatalogCosting({ ...command, afterStage: current => { if (current === stage) throw new Error(`crash:${stage}`); } }), new RegExp(`crash:${stage}`));
    assert.equal((await readiness.previewServingIndexes(args.db)).ready, false, stage);
    assert.ok((await args.db.collection('sizes').indexes()).some(row => row.name === 'old_size_guard'));
  }
  const result = await service.applyCatalogCosting(command); assert.equal(result.applied, true);
  assert.equal((await readiness.previewServingIndexes(args.db)).ready, true);
  for (const [collection,key] of [['venuecostsnapshots',{tenant:1,effectKey:1}],['venueproductionbatches',{tenant:1,productionKey:1}],['venueinventorycounts',{tenant:1,location:1,countKey:1}]]) {
    assert.ok((await args.db.collection(collection).indexes()).some(index=>index.unique&&JSON.stringify(index.key)===JSON.stringify(key)));
  }
  assert.equal((await service.applyCatalogCosting(command)).replay, true);
  const rows = await args.db.collection('sizes').find({}).toArray();
  assert.ok(rows.every(row => row.servingSchemaVersion === 1 && row.sellingPrice === 2500 && row.costPrice === 1000));
  assert.equal(await retained(), historyHash);
  const location = await args.db.collection('warehouses').findOne({ _id: new mongoose.Types.ObjectId(args.mapping.locationId) });
  assert.notEqual(location.venueServices.catalogCosting?.servingsV2Enabled, true);
  assert.notEqual(location.venueServices.catalogCosting?.actualCostingEnabled, true);
  await service.pauseCatalogCosting({ ...args, mappingReviewed: true });
  assert.equal(await retained(), historyHash);
  assert.equal((await readiness.previewServingIndexes(args.db)).ready, true);
});

test('reviewed explicit-null legacy serving versions are guarded before the original index is removed', { skip: !uri }, async t => {
  const args = await setup(t);
  const service = require('../services/venue/catalog-costing-migration');
  args.mapping.reviewedTenantIds.push(args.second.tenantId);
  args.mapping.reviewedLegacySizeIds.push(args.b.sizeId);
  await args.db.collection('sizes').updateOne({ _id: new mongoose.Types.ObjectId(args.a.sizeId) },
    { $set: { servingSchemaVersion: null } });
  const preview = await service.previewCatalogCosting(args);
  assert.equal(preview.safe, true);
  await service.applyCatalogCosting({ ...args, expectedHash: preview.previewHash,
    mappingReviewed: true, indexChangeReviewed: true, writersPaused: true,
    afterStage: async stage => {
      if (stage !== 'backfilled') return;
      const row = await args.db.collection('sizes').findOne({ _id: new mongoose.Types.ObjectId(args.a.sizeId) });
      assert.equal(row.servingSchemaVersion, 1, 'Every reviewed legacy row must enter the replacement guard before index removal');
      assert.ok((await args.db.collection('sizes').indexes()).some(index => index.name === 'old_size_guard'));
    },
  });
  assert.equal((await require('../services/venue/serving-indexes').previewServingIndexes(args.db)).ready, true);
  const row = await args.db.collection('sizes').findOne({ _id: new mongoose.Types.ObjectId(args.a.sizeId) });
  assert.equal(row.sellingPrice, 2500);
  assert.equal(row.costPrice, 1000);
});
