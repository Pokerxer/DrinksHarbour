'use strict';
function planMoneyIndexes(indexes) {
  return { legacyNames: indexes.filter(i => i.unique && Object.keys(i.key).length === 2 && i.key.tenant === 1 && i.key.billOrder === 1 && !i.partialFilterExpression).map(i => i.name) };
}
async function previewMoneyIndexes(db) {
  const result = [];
  for (const name of ['VenuePaymentAttempt', 'VenuePaymentAllocation']) {
    const Model = require(`../../models/${name}`), collection = db.collection(Model.collection.name);
    const exists = await db.listCollections({ name: collection.collectionName }).hasNext();
    const indexes = exists ? await collection.listIndexes().toArray() : [];
    const filter = { collectionVersion: { $ne: 2 } };
    const missingLinks = exists ? await collection.countDocuments({ ...filter, $or: [{ billOrder: { $not: { $type: 'objectId' } } }, { session: { $not: { $type: 'objectId' } } }] }) : 0;
    const duplicates = exists ? await collection.aggregate([{ $match: filter }, { $group: { _id: { tenant: '$tenant', billOrder: '$billOrder' }, count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }, { $limit: 20 }]).toArray() : [];
    result.push({ name, collection: collection.collectionName, ...planMoneyIndexes(indexes), legacyDefaultRows: exists ? await collection.countDocuments({ collectionVersion: { $exists: false } }) : 0, missingLinks, duplicates, readyToApply: missingLinks === 0 && duplicates.length === 0 });
  }
  return result;
}
async function applyMoneyIndexes(db) {
  const preview = await previewMoneyIndexes(db);
  if (preview.some(p => !p.readyToApply)) throw new Error('Legacy links or duplicate full-bill obligations require reviewed mapping');
  for (const row of preview) {
    const Model = require(`../../models/${row.name}`), collection = db.collection(row.collection);
    // Preserve a valid per-bill v1 uniqueness guard before removing the old guard.
    await collection.updateMany({ collectionVersion: { $exists: false } }, { $set: { collectionVersion: 1 } });
    await Model.createIndexes();
    for (const name of row.legacyNames) await collection.dropIndex(name);
  }
  return previewMoneyIndexes(db);
}
module.exports = { planMoneyIndexes, previewMoneyIndexes, applyMoneyIndexes };
