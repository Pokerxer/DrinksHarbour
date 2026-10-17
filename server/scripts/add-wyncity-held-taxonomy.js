// Dry-run by default. --apply inserts only missing compatible taxonomy.
// No product, listing, size, warehouse, price, approval or stock writes.
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
const SubCategory = require('../models/SubCategory');
const { planTaxonomy } = require('./wyncity-taxonomy-plan');
const output = path.join(__dirname, '../../outputs/wyncity-2026-10-11-template15');
const tenant = new mongoose.Types.ObjectId('699165839f3308b1baeca8fc');
const apply = process.argv.includes('--apply');

async function protectedState(db) {
  const state = {};
  const projections = {
    products: { name: 1, type: 1, status: 1, category: 1, subCategory: 1, isAlcoholic: 1, platformMarkup: 1, platformDiscount: 1, updatedAt: 1 },
    subproducts: { tenant: 1, product: 1, costPrice: 1, baseSellingPrice: 1, markupPercentage: 1, stockQuantity: 1, status: 1, sizes: 1, updatedAt: 1 },
    sizes: { tenant: 1, subproduct: 1, size: 1, barcode: 1, costPrice: 1, sellingPrice: 1, stock: 1, availableStock: 1, updatedAt: 1 },
    warehousestocks: { tenant: 1, product: 1, subproduct: 1, size: 1, warehouse: 1, currentQuantity: 1, reservedQuantity: 1, updatedAt: 1 },
    warehouses: { tenant: 1, name: 1, code: 1, isActive: 1, updatedAt: 1 },
  };
  for (const collection of ['products', 'subproducts', 'sizes', 'warehousestocks', 'warehouses']) {
    const docs = await db.collection(collection).find(collection === 'products' ? {} : { tenant }, { projection: projections[collection] }).sort({ _id: 1 }).maxTimeMS(30000).toArray();
    state[collection] = { count: docs.length, sha256: crypto.createHash('sha256').update(JSON.stringify(docs)).digest('hex') };
    console.log(JSON.stringify({ protectedCollection: collection, records: docs.length }));
  }
  return state;
}
async function snapshot(db) {
  return { categories: await db.collection('categories').find({}).toArray(), subcategories: await db.collection('subcategories').find({}).toArray() };
}
async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 20000 });
    const db = mongoose.connection.db;
    const owner = await db.collection('tenants').findOne({ _id: tenant, slug: 'wyncity' }, { projection: { _id: 1, slug: 1 } });
    if (!owner) throw new Error('Wyncity identity mismatch');
    const before = await snapshot(db), plan = planTaxonomy(before);
    const documents = [];
    for (const item of plan.creates) {
      const document = new SubCategory({ ...item, notes: 'Template15 held-row taxonomy. Created as draft. No stock or products imported.' });
      await document.validate();
      documents.push(document.toObject({ virtuals: false }));
    }
    const evidence = { checkedAt: new Date().toISOString(), apply, proposed: plan.creates, createdIds: [], mappings: plan.mappings, productOrStockWrites: 0 };
    if (apply) {
      const protectedBefore = await protectedState(db);
      fs.mkdirSync(output, { recursive: true });
      const backup = fs.existsSync(path.join(output, 'taxonomy-preapply.json')) ? 'taxonomy-preapply-focused.json' : 'taxonomy-preapply.json';
      fs.writeFileSync(path.join(output, backup), JSON.stringify({ before, protectedBefore }, null, 2));
      for (const document of documents) {
        const now = new Date();
        const result = await db.collection('subcategories').updateOne({ slug: document.slug }, { $setOnInsert: { ...document, createdAt: now, updatedAt: now } }, { upsert: true });
        if (result.upsertedId) evidence.createdIds.push(String(result.upsertedId));
      }
      const after = await snapshot(db), check = planTaxonomy(after);
      if (check.creates.length) throw new Error('Taxonomy creation verification failed');
      evidence.mappings = check.mappings;
      const protectedAfter = await protectedState(db);
      if (JSON.stringify(protectedBefore) !== JSON.stringify(protectedAfter)) throw new Error('Protected records changed during migration; inspect before further work');
      evidence.protectedRecordsUnchanged = true;
      evidence.idempotent = true;
      evidence.protectedBefore = protectedBefore;
      const created = after.subcategories.filter(s => evidence.createdIds.includes(String(s._id)));
      for (const doc of created) if (doc.status !== 'draft' || doc.showInMenu !== false) throw new Error('New shelf visibility differs from draft plan');
      evidence.created = created.map(s => ({ _id: s._id, name: s.name, parent: s.parent, type: s.type, status: s.status, showInMenu: s.showInMenu }));
    }
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, apply ? 'taxonomy-applied.json' : 'taxonomy-dry-run.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence));
  } finally { await mongoose.disconnect(); }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
