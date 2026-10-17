// Forward-only cleanup of virtual fields accidentally serialized by the first
// draft creation. Exact owned record only. Classification and status unchanged.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 20000 });
    const collection = mongoose.connection.db.collection('subcategories');
    const filter = {
      _id: new mongoose.Types.ObjectId('6acbe4e924f36e887dc58b6a'),
      slug: 'cashew-nuts',
      parent: new mongoose.Types.ObjectId('6ab1fb748872d6ec08749cb6'),
      type: 'nuts', status: 'draft',
      notes: 'Template15 held-row taxonomy. Created as draft. No stock or products imported.',
    };
    const before = await collection.findOne(filter);
    if (!before) throw new Error('Owned draft record no longer matches; no cleanup performed');
    const result = await collection.updateOne(filter, { $unset: { id: '', url: '', isPublished: '' } });
    const after = await collection.findOne(filter);
    const clean = doc => Object.fromEntries(Object.entries(doc).filter(([key]) => !['id', 'url', 'isPublished'].includes(key)));
    if (JSON.stringify(clean(before)) !== JSON.stringify(after)) throw new Error('Unexpected taxonomy metadata change');
    console.log(JSON.stringify({ _id: String(after._id), name: after.name, status: after.status, type: after.type, parent: String(after.parent), showInMenu: after.showInMenu, virtualFieldsRemoved: result.modifiedCount ? ['id', 'url', 'isPublished'] : [], classificationUnchanged: true, productOrStockWrites: 0 }));
  } finally { await mongoose.disconnect(); }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
