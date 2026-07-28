// add-fortified-wine-category.js - New top-level Fortified Wine category
//
// Port Wine was the only fortified category, so Sherry, Madeira, Marsala,
// Vermouth and Moscatel had nowhere to sit — which is why Ermelinda Freitas
// Moscatel de Setúbal ended up filed under Port Wine.
//
// Creates the category (the Category `type` enum already allows
// `fortified_wine`) plus the styles that actually get imported. Sherry is split
// by style rather than lumped into one entry, because Fino and Pedro Ximénez
// are opposite ends of a very wide range and shoppers search the style name.
//
// This does NOT move any product. Reassigning Moscatel de Setúbal out of Port
// Wine is a separate, deliberate call.
//
// Runs read-only by default. Pass --apply to write.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');

const APPLY = process.argv.includes('--apply');

const CATEGORY = {
  name: 'Fortified Wine',
  slug: 'fortified-wine',
  type: 'fortified_wine',
  alcoholCategory: 'alcoholic',
  icon: '🍷',
  color: '#7C2D12',
  tagline: 'Sherry, Madeira, Marsala and more',
  shortDescription:
    'Wines strengthened with grape spirit — from bone-dry Fino Sherry to treacle-thick Pedro Ximénez, plus Madeira, Marsala and Vermouth.',
  description:
    'Fortified wines have grape spirit added during or after fermentation, which both raises the strength and, when added early, leaves natural sweetness behind. The result is a family that spans bone-dry aperitifs like Fino and Manzanilla Sherry through to dessert wines as rich as Pedro Ximénez, alongside Madeira, Marsala and the botanical world of Vermouth. They keep far longer than table wine once opened, which makes them some of the most rewarding bottles to have on the shelf.',
};

const SUBCATEGORIES = [
  { name: 'Fino Sherry', keywords: ['fino', 'jerez', 'dry sherry', 'flor'],
    blurb: 'The driest Sherry style, aged under a veil of flor yeast — pale, bracing and saline, served cold as an aperitif.' },
  { name: 'Manzanilla Sherry', keywords: ['manzanilla', 'sanlucar', 'dry sherry'],
    blurb: 'Fino aged by the sea at Sanlúcar de Barrameda, which gives it an extra salty, delicate tang.' },
  { name: 'Amontillado Sherry', keywords: ['amontillado', 'jerez', 'oxidative'],
    blurb: 'A Fino that lost its flor and continued ageing in contact with air — dry but nutty, amber and far deeper.' },
  { name: 'Oloroso Sherry', keywords: ['oloroso', 'jerez', 'oxidative sherry'],
    blurb: 'Fortified higher and aged oxidatively from the start, giving a rich, walnut-and-dried-fruit Sherry that is still dry.' },
  { name: 'Pedro Ximénez', keywords: ['px', 'pedro ximenez', 'sweet sherry', 'dessert wine'],
    blurb: 'Made from sun-dried grapes, PX is almost black and syrup-thick, tasting of raisin, fig and molasses — pour it over ice cream.' },
  { name: 'Cream Sherry', keywords: ['cream sherry', 'sweet sherry', 'harveys'],
    blurb: 'Oloroso sweetened with Pedro Ximénez — smooth, raisiny and the most approachable way into Sherry.' },
  { name: 'Madeira', keywords: ['madeira', 'sercial', 'verdelho', 'bual', 'malmsey'],
    blurb: "Portugal's heated, deliberately oxidised fortified wine — nearly indestructible once opened, with searing acidity under caramel and nuts." },
  { name: 'Marsala', keywords: ['marsala', 'sicily', 'cooking wine'],
    blurb: "Sicily's fortified wine, made dry to sweet, equally at home in a glass or behind a veal Marsala." },
  { name: 'Vermouth', keywords: ['vermouth', 'rosso', 'bianco', 'dry vermouth', 'aperitif'],
    blurb: 'Wine aromatised with wormwood and botanicals, made sweet or dry — the backbone of the Martini and Negroni.' },
  { name: 'Moscatel de Setúbal', keywords: ['moscatel', 'setubal', 'portugal', 'sweet fortified'],
    blurb: 'Portuguese fortified Muscat aged on its skins — orange peel, honey and raisin, sweet but lifted.' },
];

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

  let category = await Category.findOne({ slug: CATEGORY.slug, parent: null });

  if (category) {
    console.log(`⏭️  Category "${CATEGORY.name}" already exists (${category._id})`);
  } else {
    // Sit it at the end of the wine block in the nav. Not max+1 — several
    // categories still carry the 999 schema default (Port Wine among them),
    // which would strand this one at the very bottom.
    const wineBlock = await Category.find({
      parent: null,
      slug: { $in: ['red-wine', 'white-wine', 'rose-wine', 'sparkling-wine', 'champagne'] },
    }).select('displayOrder');
    const displayOrder =
      wineBlock.reduce(
        (max, c) => Math.max(max, Number.isFinite(c.displayOrder) && c.displayOrder < 900 ? c.displayOrder : 0),
        0,
      ) + 1;

    const doc = {
      ...CATEGORY,
      parent: null,
      level: 0,
      status: 'published',
      displayOrder,
      metaTitle: 'Buy Fortified Wine Online in Nigeria',
      metaDescription: `${CATEGORY.shortDescription} Shop fortified wine at DrinksHarbour with fast delivery in Abuja and nationwide across Nigeria.`,
      metaKeywords: ['fortified wine', 'sherry', 'madeira', 'marsala', 'vermouth', 'port'],
      seoH1: 'Fortified Wine in Nigeria',
      publishedAt: new Date(),
    };

    console.log(`📁 Creating category "${CATEGORY.name}" (${CATEGORY.slug}), order ${displayOrder}`);
    if (APPLY) category = await Category.create(doc);
  }

  if (!APPLY && !category) {
    console.log(`\n  (dry run — ${SUBCATEGORIES.length} subcategories would follow)`);
    SUBCATEGORIES.forEach((s) => console.log(`  ✅ ${s.name} (${generateSlug(s.name)})`));
    console.log('\nRe-run with --apply to write.');
    await mongoose.disconnect();
    return;
  }

  const existing = await SubCategory.find({ parent: category._id }).select('displayOrder');
  let order = existing.reduce(
    (max, s) =>
      Math.max(max, Number.isFinite(s.displayOrder) && s.displayOrder < 900 ? s.displayOrder : 0),
    0,
  );

  let created = 0;
  let skipped = 0;
  const newIds = [];

  for (const { name, blurb, keywords } of SUBCATEGORIES) {
    const slug = generateSlug(name);
    const found = await SubCategory.findOne({ slug });
    if (found) {
      console.log(`  ⏭️  ${name} (slug "${slug}" already taken)`);
      skipped++;
      continue;
    }

    const doc = {
      name,
      slug,
      parent: category._id,
      parentPath: category.slug,
      type: slug.replace(/-/g, '_'),
      subType: 'fortified_style',
      status: 'published',
      displayOrder: ++order,
      shortDescription: blurb,
      seoH1: `${name} in Nigeria`,
      metaTitle: `Buy ${name} Online in Nigeria`,
      metaDescription: `${blurb} Shop ${name} at DrinksHarbour with fast delivery in Abuja and nationwide across Nigeria.`,
      metaKeywords: [name.toLowerCase(), ...(keywords || []), 'fortified wine'],
      publishedAt: new Date(),
    };

    if (APPLY) {
      const sub = await SubCategory.create(doc);
      newIds.push(sub._id);
    }
    console.log(`  ✅ ${name} (${slug})`);
    created++;
  }

  if (APPLY && newIds.length > 0) {
    await Category.findByIdAndUpdate(category._id, {
      $addToSet: { subCategories: { $each: newIds } },
    });
  }

  console.log(`\n${APPLY ? 'Created' : 'Would create'} ${created}, skipped ${skipped} existing.`);
  if (!APPLY) console.log('Re-run with --apply to write.');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
