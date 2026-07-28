// dedupe-wine-subcategories.js - Merge duplicate wine subcategories
//
// The Red/White Wine subcategory lists accumulated exact duplicates (two
// "Sangiovese" docs, two "Riesling" docs, ...) plus two pairs where the same
// grape was entered twice under different names, one of them with a slug that
// lost its separator ("Grenache/Garnacha" -> `grenachegarnacha`,
// "Pinot Grigio/Pinot Gris" -> `pinot-grigiopinot-gris`).
//
// Duplicates split filter facets on /shop and publish two near-identical
// subcategory URLs for the same grape, which is the thin/duplicate-content
// pattern the last crawl flagged.
//
// For each pair the loser's products and flavors are repointed at the keeper,
// the loser is pulled out of every reference (Category.subCategories,
// SubCategory.relatedSubCategories) and then deleted. The keeper inherits the
// loser's metaKeywords plus the alternate spelling, so searches for the dropped
// name still resolve.
//
// Runs read-only by default. Pass --apply to write.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Product = require('../models/Product');
const Flavor = require('../models/Flavor');

const APPLY = process.argv.includes('--apply');

// keep = slug that survives, drop = slug that gets merged into it.
// `name` renames the keeper (used where the surviving doc should take a cleaner
// label), `keywords` are added to the keeper so the dropped spelling stays
// searchable.
const MERGES = [
  // ── Red Wine ──────────────────────────────────────────────────────────────
  { keep: 'sangiovese', drop: 'sangiovese-1' },
  { keep: 'barbera', drop: 'barbera-1' },
  { keep: 'tempranillo', drop: 'tempranillo-1' },
  {
    keep: 'grenache',
    drop: 'grenachegarnacha',
    keywords: ['garnacha', 'grenache noir', 'cannonau'],
  },

  // ── White Wine ────────────────────────────────────────────────────────────
  { keep: 'riesling', drop: 'riesling-1' },
  { keep: 'viognier', drop: 'viognier-1' },
  { keep: 'gruner-veltliner', drop: 'gruner-veltliner-1' },
  { keep: 'albarino', drop: 'albarino-1', name: 'Albariño', keywords: ['albarino', 'alvarinho'] },
  {
    keep: 'pinot-grigio',
    drop: 'pinot-grigiopinot-gris',
    keywords: ['pinot gris', 'grauburgunder', 'ruländer'],
  },
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/drinksharbour');
  console.log(`Connected to MongoDB — ${APPLY ? 'APPLY (writing)' : 'DRY RUN (read-only)'}\n`);

  let merged = 0;
  let movedProducts = 0;

  for (const { keep, drop, name, keywords } of MERGES) {
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
      console.log(`  ⚠️  "${keep}" and "${drop}" resolve to the same doc — skipping`);
      continue;
    }

    const productCount = await Product.countDocuments({ subCategory: loser._id });
    const flavorCount = await Flavor.countDocuments({ subCategory: loser._id });
    console.log(
      `  ${loser.name} (${drop}) → ${name || keeper.name} (${keep})` +
        ` — ${productCount} product(s), ${flavorCount} flavor(s)`,
    );

    if (APPLY) {
      await Product.updateMany({ subCategory: loser._id }, { $set: { subCategory: keeper._id } });
      await Flavor.updateMany({ subCategory: loser._id }, { $set: { subCategory: keeper._id } });

      // Drop every dangling reference before deleting the doc.
      await Category.updateMany(
        { subCategories: loser._id },
        { $pull: { subCategories: loser._id } },
      );
      await SubCategory.updateMany(
        { relatedSubCategories: loser._id },
        { $pull: { relatedSubCategories: loser._id } },
      );

      const update = {
        $addToSet: {
          metaKeywords: { $each: [loser.name.toLowerCase(), ...(keywords || [])] },
        },
      };
      if (name) update.$set = { name };
      await SubCategory.findByIdAndUpdate(keeper._id, update);

      // The keeper must be listed on its parent, which the loser may have owned.
      await Category.findByIdAndUpdate(keeper.parent, {
        $addToSet: { subCategories: keeper._id },
      });

      await SubCategory.deleteOne({ _id: loser._id });
    }

    merged++;
    movedProducts += productCount;
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
