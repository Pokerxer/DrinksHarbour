// add-torrontes-subcategory.js - Torrontés under White Wine
//
// White Wine had no home for Argentina's signature white grape, so products
// like Terrazas de los Andes Torrontes sat with no subcategory at all. Follows
// the same shape as add-italian-wine-subcategories.js: SEO fields are written
// up front so the page is never thin, and the long `description` HTML is left
// for backfill-subcategory-seo.js.
//
// Runs read-only by default. Pass --apply to write.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');

const APPLY = process.argv.includes('--apply');

const PARENT_SLUG = 'white-wine';

const ENTRY = {
  name: 'Torrontés',
  blurb:
    "Argentina's signature white grape, at its best in the high-altitude vineyards of Salta and Cafayate — intensely floral and grapey on the nose, then dry and crisp on the palate.",
  keywords: [
    'torrontes',
    'torrontés',
    'argentine white wine',
    'argentina wine',
    'cafayate',
    'salta',
    'aromatic white',
  ],
};

const generateSlug = (name) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/drinksharbour');
  console.log(`Connected to MongoDB — ${APPLY ? 'APPLY (writing)' : 'DRY RUN (read-only)'}\n`);

  const category = await Category.findOne({ slug: PARENT_SLUG, parent: null });
  if (!category) {
    console.error(`❌ Category "${PARENT_SLUG}" not found`);
    process.exit(1);
  }

  const slug = generateSlug(ENTRY.name);
  const existing = await SubCategory.findOne({ slug });
  if (existing) {
    console.log(`⏭️  ${ENTRY.name} already exists (${slug}) — nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  const siblings = await SubCategory.find({ parent: category._id }).select('displayOrder');
  const order =
    siblings.reduce(
      (max, s) =>
        Math.max(max, Number.isFinite(s.displayOrder) && s.displayOrder < 900 ? s.displayOrder : 0),
      0,
    ) + 1;

  const label = `${ENTRY.name} Wine`;
  const doc = {
    name: ENTRY.name,
    slug,
    parent: category._id,
    parentPath: category.slug,
    type: slug,
    subType: 'argentine_varietal',
    status: 'published',
    displayOrder: order,
    shortDescription: ENTRY.blurb,
    seoH1: `${label} in Nigeria`,
    metaTitle: `Buy ${label} Online in Nigeria`,
    metaDescription: `${ENTRY.blurb} Shop ${label} at DrinksHarbour with fast delivery in Abuja and nationwide across Nigeria.`,
    metaKeywords: ENTRY.keywords,
    publishedAt: new Date(),
  };

  console.log(`📁 ${category.name} — ${siblings.length} existing subcategories`);
  console.log(`  ✅ ${ENTRY.name} (${slug}), displayOrder ${order}`);

  if (APPLY) {
    const sub = await SubCategory.create(doc);
    await Category.findByIdAndUpdate(category._id, { $addToSet: { subCategories: sub._id } });
    console.log(`\nCreated ${sub._id}.`);
  } else {
    console.log('\nRe-run with --apply to write.');
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
