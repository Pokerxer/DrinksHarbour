// add-sweet-wine-subcategories.js - Sweet/dessert styles under the wine categories
//
// The catalog already carries a real sweet range — 7 ice wines (Asconi, Reif
// Estate), a Monbazillac, late-harvest Vidal, Malvasia Dolce, a spread of
// Moscato and Muscat — and almost none of it had a subcategory, because the
// wine lists were varietal-only and sweetness is a *style*, not a grape.
//
// These are added in place: nothing changes category, so an Asconi Ice Wine
// stays browsable under White Wine. Sparkling deliberately gets nothing new —
// Doux, Demi-Sec, Asti Spumante, Moscato d'Asti and Brachetto already cover it.
//
// Muscat is NOT added: the existing `moscato` subcategory is the same grape
// family, so the alternate spellings become keywords on it instead of a
// competing near-duplicate page.
//
// Runs read-only by default. Pass --apply to write.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');

const APPLY = process.argv.includes('--apply');

const PLAN = {
  'red-wine': {
    suffix: 'Wine',
    entries: [
      { name: 'Recioto', keywords: ['recioto della valpolicella', 'sweet red', 'appassimento'],
        blurb: "Valpolicella's sweet counterpart to Amarone — dried grapes fermented only partway, leaving rich cherry and chocolate sweetness." },
      { name: 'Sweet Red Wine', keywords: ['sweet red', 'dessert red wine', 'semi sweet red'],
        blurb: 'Soft, fruit-forward reds with noticeable sweetness — easy drinking on their own and a popular match for spiced food and desserts.' },
    ],
  },

  'white-wine': {
    suffix: 'Wine',
    entries: [
      { name: 'Icewine', keywords: ['ice wine', 'eiswein', 'vidal icewine', 'riesling icewine'],
        blurb: 'Made from grapes left to freeze on the vine and pressed while still frozen, concentrating intense honeyed sweetness against bracing acidity.' },
      { name: 'Late Harvest', keywords: ['late harvest', 'vendange tardive', 'spatlese'],
        blurb: 'Grapes picked well after normal harvest, so the extra ripeness gives a richer, sweeter wine that still keeps its freshness.' },
      { name: 'Noble Rot', keywords: ['botrytis', 'botrytis cinerea', 'noble rot', 'sweet white'],
        blurb: 'Wines from botrytis-affected grapes, where noble rot shrivels the fruit and concentrates it into honey, apricot and marmalade richness.' },
      { name: 'Sauternes', keywords: ['bordeaux sweet wine', 'barsac', 'semillon', 'botrytis'],
        blurb: "Bordeaux's celebrated botrytised sweet wine from Sémillon and Sauvignon Blanc — unctuous, honeyed and famously long-lived." },
      { name: 'Monbazillac', keywords: ['bergerac', 'south west france', 'botrytis'],
        blurb: 'A botrytised sweet white from Bergerac in south-west France, offering Sauternes-like honey and apricot at a friendlier price.' },
      { name: 'Tokaji', keywords: ['tokaj', 'aszu', 'hungary', 'furmint'],
        blurb: "Hungary's historic sweet wine from Furmint, graded in puttonyos — layered with apricot, orange peel and a piercing acid backbone." },
      { name: 'Vin Santo', keywords: ['tuscany', 'holy wine', 'italian dessert wine'],
        blurb: "Tuscany's amber dessert wine, aged for years in small barrels — nutty, caramelised and the traditional partner for cantucci." },
      { name: 'Passito', keywords: ['appassimento', 'dried grape wine', 'italian dessert wine'],
        blurb: 'Italian sweet wine from grapes dried on mats before pressing, giving deep raisin, fig and honey concentration.' },
      { name: 'Moscatel', keywords: ['moscatel', 'muscat', 'moscatel de setubal', 'sweet muscat'],
        blurb: 'The sweet Iberian style of Muscat — grapey and floral with orange-blossom lift and a rich, syrupy palate.' },
      { name: 'Sweet White Wine', keywords: ['sweet white', 'medium sweet wine', 'dessert wine'],
        blurb: 'Whites made in an openly sweet style, from gently off-dry through to full dessert sweetness — the easiest place to start with sweet wine.' },
    ],
  },

  'rose-wine': {
    suffix: 'Rosé',
    entries: [
      { name: 'Sweet Rosé', keywords: ['sweet rose', 'semi sweet rose', 'blush wine'],
        blurb: 'Rosé made with noticeable residual sugar — soft, berry-sweet and best served well chilled.' },
      { name: 'Rosé Icewine', keywords: ['rose ice wine', 'cabernet icewine', 'eiswein rose'],
        blurb: 'Ice wine pressed from frozen red grapes with brief skin contact, giving a pink dessert wine of intense strawberry and honey.' },
    ],
  },
};

// Existing subcategories that should absorb alternate spellings rather than
// have a near-duplicate created alongside them.
const KEYWORD_TOPUPS = [
  {
    slug: 'moscato',
    keywords: ['muscat', 'moscato bianco', 'muscat blanc', 'muskat', 'sweet white'],
  },
];

// Names that already say what they are — "Icewine Wine" and "Sweet Rosé Rosé"
// are what a naive suffix produces. Deliberately no word boundaries so
// "Icewine" and "Sweet White Wine" both match.
const SELF_DESCRIBING = /wine|ros[eé]|rosato|chiaretto|bianco|rosso|ramato/i;

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

  let created = 0;
  let skipped = 0;

  for (const [categorySlug, { suffix, entries }] of Object.entries(PLAN)) {
    const category = await Category.findOne({ slug: categorySlug, parent: null });
    if (!category) {
      console.error(`❌ Category "${categorySlug}" not found — skipping`);
      continue;
    }

    const existing = await SubCategory.find({ parent: category._id }).select('displayOrder');
    let order = existing.reduce(
      (max, s) =>
        Math.max(max, Number.isFinite(s.displayOrder) && s.displayOrder < 900 ? s.displayOrder : 0),
      0,
    );

    console.log(`📁 ${category.name} — ${existing.length} existing, adding ${entries.length}`);

    const newIds = [];
    for (const { name, blurb, keywords } of entries) {
      const slug = generateSlug(name);
      const found = await SubCategory.findOne({ slug });
      if (found) {
        console.log(`  ⏭️  ${name} (slug "${slug}" already taken)`);
        skipped++;
        continue;
      }

      const label = SELF_DESCRIBING.test(name) ? name : `${name} ${suffix}`;
      const doc = {
        name,
        slug,
        parent: category._id,
        parentPath: category.slug,
        type: slug.replace(/-/g, '_'),
        subType: 'sweet_style',
        status: 'published',
        displayOrder: ++order,
        shortDescription: blurb,
        seoH1: `${label} in Nigeria`,
        metaTitle: `Buy ${label} Online in Nigeria`,
        metaDescription: `${blurb} Shop ${label} at DrinksHarbour with fast delivery in Abuja and nationwide across Nigeria.`,
        metaKeywords: [name.toLowerCase(), ...(keywords || []), 'sweet wine', 'dessert wine'],
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
    console.log('');
  }

  for (const { slug, keywords } of KEYWORD_TOPUPS) {
    const doc = await SubCategory.findOne({ slug });
    if (!doc) {
      console.log(`  ⏭️  keyword top-up target "${slug}" not found`);
      continue;
    }
    console.log(`  🔑 ${doc.name} (${slug}) += ${keywords.join(', ')}`);
    if (APPLY) {
      await SubCategory.findByIdAndUpdate(doc._id, {
        $addToSet: { metaKeywords: { $each: keywords } },
      });
    }
  }

  console.log(`\n${APPLY ? 'Created' : 'Would create'} ${created}, skipped ${skipped} existing.`);
  if (!APPLY) console.log('Re-run with --apply to write.');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
