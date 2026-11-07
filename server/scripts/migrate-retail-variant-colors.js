'use strict';
// Run in a maintenance window with all size writers stopped. Default is read-only.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
const { SERVING_MODEL_INDEXES, exactIndex } = require('../services/venue/serving-indexes');
const { variantOptionKey } = require('../utils/retailVariantIdentity');

async function main() {
  const apply = process.argv.includes('--apply');
  if (process.env.NODE_DNS_SERVERS) require('node:dns').setServers(process.env.NODE_DNS_SERVERS.split(','));
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, { autoIndex: false });
  try {
    const collection = mongoose.connection.db.collection('sizes');
    const definition = SERVING_MODEL_INDEXES[0];
    const indexes = await collection.indexes();
    const obsolete = indexes.filter(index => index.unique &&
      JSON.stringify(index.key) === JSON.stringify({ subproduct: 1, size: 1 }));
    const unversioned = await collection.countDocuments({ servingSchemaVersion: { $nin: [1, 2] } });
    const retail = { servingSchemaVersion: 1 };
    console.log(JSON.stringify({ apply, unversioned, retail: await collection.countDocuments(retail),
      replace: obsolete.map(index => index.name), newIndex: definition.options.name }));
    if (!apply) return;
    if (unversioned) throw new Error('Run the existing serving schema backfill before replacing the retail index');
    if (!obsolete.length && !indexes.some(index => exactIndex(index, definition))) {
      throw new Error('Expected an existing retail uniqueness guard before migration');
    }
    const operations = [];
    for await (const row of collection.find(retail, { projection: { colorName: 1, optionName: 1 } })) {
      operations.push({ updateOne: { filter: { _id: row._id, ...retail }, update: {
        $set: { variantColorKey: variantOptionKey(row.colorName, row.optionName) },
      } } });
      if (operations.length === 500) await collection.bulkWrite(operations.splice(0));
    }
    if (operations.length) await collection.bulkWrite(operations);
    await collection.createIndex(definition.key, { unique: true, ...definition.options });
    if (!(await collection.indexes()).some(index => exactIndex(index, definition))) {
      throw new Error('Compound uniqueness guard was not verified');
    }
    for (const { name } of obsolete) await collection.dropIndex(name);
  } finally {
    await mongoose.disconnect();
  }
}
main().catch(error => { console.error(error.name, error.code || '', error.message); process.exitCode = 1; });
