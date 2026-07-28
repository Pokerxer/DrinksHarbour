// dedupe-sparkling-subcategories.js - Merge duplicate Sparkling Wine subcategories
//
// Same problem the wine lists had (see dedupe-wine-subcategories.js) but worse:
// Cava, Crémant, Prosecco, Lambrusco, Sekt and Franciacorta each existed twice,
// and Asti was split three ways.
//
// The Asti split is not a plain duplicate. "Moscato d'Asti" (frizzante, ~5.5%)
// and "Asti Spumante" (fully sparkling, ~7-9%) are genuinely different wines, so
// both survive; only the conflated "Asti (Moscato d'Asti)" doc is merged away.
// Its one product, Martini Asti, is an Asti Spumante, so that is its keeper.
//
// Also repairs two names that lost their apostrophe on import.
//
// Runs read-only by default. Pass --apply to write.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Product = require('../models/Product');
const Flavor = require('../models/Flavor');

const APPLY = process.argv.includes('--apply');

const MERGES = [
  { keep: 'cava', drop: 'cava-1' },
  { keep: 'cremant', drop: 'cremant-1' },
  { keep: 'franciacorta', drop: 'franciacorta-1' },
  { keep: 'lambrusco', drop: 'lambrusco-1' },
  { keep: 'prosecco', drop: 'prosecco-1' },
  { keep: 'sekt', drop: 'sekt-1' },
  {
    keep: 'asti-spumante',
    drop: 'asti-moscato-dasti',
    keywords: ['asti', 'asti docg', 'martini asti', 'sparkling moscato'],
  },
];

// Apostrophes were stripped at import, leaving "Moscato dAsti" / "Crémant dAlsace".
const RENAMES = [
  { slug: 'moscato-dasti', name: "Moscato d'Asti" },
  { slug: 'cremant-dalsace', name: "Crémant d'Alsace" },
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/drinksharbour');
  console.log(`Connected to MongoDB — ${APPLY ? 'APPLY (writing)' : 'DRY RUN (read-only)'}\n`);

  let merged = 0;
  let movedProducts = 0;

  for (const { keep, drop, keywords } of MERGES) {
    const keeper = await SubCategory.findOne({ slug: keep });
    const loser = await SubCategory.findOne({ slug: drop });

    if (!keeper) {
      console.log(`  ⚠️  keeper "${keep}" not found — skipping`);
      continue;
    }
    if (!loser) {
      console.log(`  ⏭️  "${drop}" already gone`);
      continue;
    }
    if (String(keeper._id) === String(loser._id)) {
      console.log(`  ⚠️  "${keep}" and "${drop}" are the same doc — skipping`);
      continue;
    }

    const productCount = await Product.countDocuments({ subCategory: loser._id });
    const flavorCount = await Flavor.countDocuments({ subCategory: loser._id });
    console.log(
      `  ${loser.name} (${drop}) → ${keeper.name} (${keep})` +
        ` — ${productCount} product(s), ${flavorCount} flavor(s)`,
    );

    if (APPLY) {
      await Product.updateMany({ subCategory: loser._id }, { $set: { subCategory: keeper._id } });
      await Flavor.updateMany({ subCategory: loser._id }, { $set: { subCategory: keeper._id } });
      await Category.updateMany(
        { subCategories: loser._id },
        { $pull: { subCategories: loser._id } },
      );
      await SubCategory.updateMany(
        { relatedSubCategories: loser._id },
        { $pull: { relatedSubCategories: loser._id } },
      );
      await SubCategory.findByIdAndUpdate(keeper._id, {
        $addToSet: { metaKeywords: { $each: [loser.name.toLowerCase(), ...(keywords || [])] } },
      });
      await Category.findByIdAndUpdate(keeper.parent, {
        $addToSet: { subCategories: keeper._id },
      });
      await SubCategory.deleteOne({ _id: loser._id });
    }

    merged++;
    movedProducts += productCount;
  }

  console.log('');
  for (const { slug, name } of RENAMES) {
    const doc = await SubCategory.findOne({ slug });
    if (!doc) {
      console.log(`  ⏭️  rename target "${slug}" not found`);
      continue;
    }
    if (doc.name === name) {
      console.log(`  ⏭️  ${slug} already named "${name}"`);
      continue;
    }
    console.log(`  ✏️  ${doc.name} → ${name} (${slug})`);
    if (APPLY) await SubCategory.findByIdAndUpdate(doc._id, { $set: { name } });
  }

  console.log(
    `\n${APPLY ? 'Merged' : 'Would merge'} ${merged} duplicate(s), ` +
      `repointing ${movedProducts} product(s).`,
  );
  if (!APPLY) console.log('Re-run with --apply to write.');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
