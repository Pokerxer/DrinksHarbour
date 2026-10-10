// Read-only by default. --apply writes atomically; --report PATH saves the audit.
require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
const fs = require('node:fs');
const SubCategory = require('../models/SubCategory');
const { entries, classifyProduct, validateExisting } = require('../data/chateau-vartely-subcategories');

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  if (process.env.NODE_DNS_SERVERS) {
    require('node:dns').setServers(process.env.NODE_DNS_SERVERS.split(',').map(s => s.trim()));
  }
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  const categories = db.collection('categories');
  const subs = db.collection('subcategories');
  const products = db.collection('products');
  const brands = await db.collection('brands').find({ name: /^ch[aâ]teau vartely$/i }).toArray();
  if (brands.length !== 1) throw new Error('Expected exactly one Château Vartely Brand');
  const brand = brands[0];
  const catalog = await products.find({ brand: brand._id }).toArray();
  if (!catalog.length) throw new Error('Brand has no products');
  const parentSlugs = [...new Set(entries.map(e => e.parent))];
  const parents = await categories.find({ slug: { $in: parentSlugs }, parent: null }).toArray();
  const byParent = new Map(parents.map(c => [c.slug, c]));
  for (const slug of parentSlugs) {
    if (parents.filter(c => c.slug === slug).length !== 1) throw new Error(`Missing/duplicate parent: ${slug}`);
  }
  const existingSubs = await subs.find({}).toArray();
  const targets = new Map();
  const creates = [];
  const links = [];
  for (const entry of entries) {
    const parent = byParent.get(entry.parent);
    const matches = existingSubs.filter(s => s.slug === entry.slug);
    validateExisting(matches, parent._id);
    let target = matches[0];
    if (!target) {
      const order = Math.max(0, ...existingSubs.concat(creates)
        .filter(s => String(s.parent) === String(parent._id))
        .map(s => Number.isFinite(s.displayOrder) && s.displayOrder < 900 ? s.displayOrder : 0)) + 1;
      const doc = new SubCategory({
        name: entry.name, slug: entry.slug, parent: parent._id, parentPath: parent.slug,
        type: entry.slug, status: 'published', displayOrder: order,
        shortDescription: entry.blurb, description: `<p>${entry.blurb}</p>`,
        seoH1: `${entry.name} in Nigeria`, metaTitle: `Buy ${entry.name} Online in Nigeria`,
        metaDescription: `${entry.blurb} Explore ${entry.name} at DrinksHarbour in Nigeria.`,
        metaKeywords: [entry.name.toLowerCase(), 'château vartely', 'moldova', parent.slug],
        publishedAt: new Date(), notes: 'Château Vartely portfolio audit, 2026-10-04.',
      });
      await doc.validate();
      target = doc.toObject({ virtuals: false });
      target.createdAt = target.updatedAt = new Date();
      creates.push(target);
    }
    targets.set(entry.slug, target);
    if (!(parent.subCategories || []).some(id => String(id) === String(target._id))) {
      links.push({ parent: parent._id, sub: target._id });
    }
  }
  const changes = [];
  for (const product of catalog) {
    const classification = classifyProduct(product.name);
    const parent = byParent.get(classification.parent);
    let target = targets.get(classification.slug);
    if (!target) {
      const matches = existingSubs.filter(s => s.slug === classification.slug);
      validateExisting(matches, parent._id);
      if (!matches.length) throw new Error(`Missing target: ${classification.slug}`);
      target = matches[0];
    }
    if (String(product.category) !== String(parent._id) || String(product.subCategory) !== String(target._id)) {
      changes.push({ product, parent, target });
    }
  }
  const report = [
    '# Château Vartely database audit', '', `Date: ${new Date().toISOString()}`, '',
    `Products reviewed: ${catalog.length}. New subcategories: ${creates.length}. Product changes: ${changes.length}. Parent links: ${links.length}.`, '',
    '## New subcategories', '', '| Name | Slug | Parent | Reserved ID |', '|---|---|---|---|',
    ...creates.map(s => `| ${s.name} | ${s.slug} | ${s.parentPath} | ${s._id} |`), '',
    '## Product changes and rollback values', '',
    '| Product | ID | Previous category | Previous subcategory | Target category | Target subcategory |',
    '|---|---|---|---|---|---|',
    ...changes.map(c => `| ${c.product.name} | ${c.product._id} | ${c.product.category || 'null'} | ${c.product.subCategory || 'null'} | ${c.parent.slug} | ${c.target.slug} |`), '',
    'Transaction rolls back automatically on failure. After success, restore the old product references above in a new migration before removing unused created entries.', '',
  ].join('\n');
  const reportIndex = process.argv.indexOf('--report');
  if (reportIndex !== -1) {
    if (!process.argv[reportIndex + 1]) throw new Error('--report requires a path');
    fs.writeFileSync(process.argv[reportIndex + 1], report);
  }
  console.log(report);
  if (!process.argv.includes('--apply')) return;
  if (!creates.length && !changes.length && !links.length) {
    console.log('Verified: no further changes required.');
    return;
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (creates.length) await subs.insertMany(creates, { session });
      for (const link of links) {
        await categories.updateOne({ _id: link.parent }, { $addToSet: { subCategories: link.sub } }, { session });
      }
      for (const change of changes) {
        const result = await products.updateOne({
          _id: change.product._id, brand: brand._id,
          category: change.product.category || null, subCategory: change.product.subCategory || null,
        }, { $set: { category: change.parent._id, subCategory: change.target._id, updatedAt: new Date() } }, { session });
        if (result.matchedCount !== 1) throw new Error(`Concurrent product change: ${change.product.name}`);
      }
      const subIds = new Map();
      const catIds = new Map();
      for (const change of changes) {
        for (const id of [change.product.subCategory, change.target._id]) if (id) subIds.set(String(id), id);
        for (const id of [change.product.category, change.parent._id]) if (id) catIds.set(String(id), id);
      }
      for (const [collection, field, ids] of [[subs, 'subCategory', subIds], [categories, 'category', catIds]]) {
        for (const id of ids.values()) {
          const productCount = await products.countDocuments({ [field]: id }, { session });
          const activeProductCount = await products.countDocuments({ [field]: id, status: 'approved' }, { session });
          await collection.updateOne({ _id: id }, { $set: { productCount, activeProductCount } }, { session });
        }
      }
    });
    console.log('Applied transaction successfully.');
  } finally {
    await session.endSession();
  }
}

if (require.main === module) run().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());

module.exports = { run };
