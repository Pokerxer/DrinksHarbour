// add-italian-wine-subcategories.js - Italian subcategories for Red/White/Rosé Wine
//
// The wine subcategory lists were varietal-only, which leaves Italian wine badly
// served: shoppers search the appellation ("Chianti", "Barolo", "Amarone"), not
// the grape, and several widely-imported Italian grapes (Corvina, Negroamaro,
// Garganega, Verdicchio) had no home at all — which is how the Zenato Amarone
// ended up filed under Nebbiolo.
//
// So this seeds both: the missing Italian varietals AND the DOC/DOCG names the
// wines are actually labelled and sold under. Scope is deliberately commercial
// (what realistically gets imported) rather than exhaustive — every extra
// subcategory is another zero-product page for the crawler.
//
// Each doc gets shortDescription/metaTitle/metaDescription/seoH1 up front so the
// pages are never thin on arrival. The long `description` HTML is left empty for
// backfill-subcategory-seo.js to generate.
//
// Runs read-only by default. Pass --apply to write.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');

const APPLY = process.argv.includes('--apply');

// `kind` is documentation only — it records why each entry exists so a later
// reader does not "tidy" the appellations back out for being inconsistent.
const PLAN = {
  'red-wine': {
    suffix: 'Wine',
    entries: [
      // ── Italian grape varieties ──────────────────────────────────────────
      { name: 'Corvina', kind: 'grape', keywords: ['corvina veronese', 'valpolicella grape'],
        blurb: 'The backbone grape of Valpolicella and Amarone, giving bright sour-cherry fruit, light tannins and a distinctive almond finish.' },
      { name: 'Negroamaro', kind: 'grape', keywords: ['puglia red', 'salento'],
        blurb: "Puglia's dark, sun-ripened red — plummy and full-bodied with a warm, faintly bitter finish that stands up to grilled meat." },
      { name: 'Nerello Mascalese', kind: 'grape', keywords: ['etna red', 'sicilian red'],
        blurb: "Grown on Etna's volcanic slopes, this Sicilian red is pale and perfumed, with red-cherry fruit and a smoky mineral edge." },
      { name: 'Sagrantino', kind: 'grape', keywords: ['montefalco', 'umbria red'],
        blurb: "Umbria's powerhouse: one of the most tannic red grapes in the world, dense with blackberry and plum and built for long ageing." },
      { name: 'Lagrein', kind: 'grape', keywords: ['alto adige', 'south tyrol'],
        blurb: 'An Alto Adige speciality — deeply coloured and velvety, with dark berry fruit, violet aromatics and gentle tannins.' },
      { name: 'Teroldego', kind: 'grape', keywords: ['trentino', 'rotaliano'],
        blurb: "Trentino's signature red, juicy and dark-fruited with fresh acidity and a soft, approachable structure." },
      { name: 'Cannonau', kind: 'grape', keywords: ['sardinia', 'grenache', 'garnacha'],
        blurb: "Sardinia's take on Grenache: warm, herb-scented and generous, with ripe red fruit and supple tannins." },
      { name: 'Lambrusco', kind: 'grape', keywords: ['sparkling red', 'emilia romagna'],
        blurb: "Emilia-Romagna's sparkling red, served chilled — frothy and berry-scented, made from bone dry to lightly sweet." },

      // ── DOC/DOCG appellations ────────────────────────────────────────────
      { name: 'Chianti', kind: 'appellation', keywords: ['sangiovese', 'tuscany', 'tuscan red'],
        blurb: "Tuscany's best-known red, Sangiovese-led with tart cherry, dried herbs and the firm acidity that makes it a natural with tomato-based food." },
      { name: 'Chianti Classico', kind: 'appellation', keywords: ['gallo nero', 'black rooster', 'sangiovese'],
        blurb: 'The historic heart of Chianti between Florence and Siena, producing more structured, longer-ageing Sangiovese under the Black Rooster seal.' },
      { name: 'Brunello di Montalcino', kind: 'appellation', keywords: ['montalcino', 'sangiovese grosso'],
        blurb: "Tuscany's flagship DOCG: pure Sangiovese aged at least five years, powerful and cellar-worthy with dried cherry, leather and spice." },
      { name: 'Vino Nobile di Montepulciano', kind: 'appellation', keywords: ['prugnolo gentile', 'tuscany'],
        blurb: 'A Tuscan DOCG built on Sangiovese, polished and savoury — sitting between Chianti Classico and Brunello in weight.' },
      { name: 'Super Tuscan', kind: 'appellation', keywords: ['toscana igt', 'cabernet blend', 'sassicaia', 'tignanello'],
        blurb: 'Bordeaux-influenced Tuscan reds that broke the old rules, blending Cabernet Sauvignon, Merlot and Sangiovese into rich, age-worthy wines.' },
      { name: 'Bolgheri', kind: 'appellation', keywords: ['maremma', 'super tuscan', 'tuscan coast'],
        blurb: "The Tuscan coastal DOC behind Italy's most celebrated Cabernet and Merlot blends — ripe dark fruit with polished, Bordeaux-like structure." },
      { name: 'Barolo', kind: 'appellation', keywords: ['nebbiolo', 'piedmont', 'langhe'],
        blurb: "Piedmont's 'king of wines' — pure Nebbiolo, austere in youth and famed for the rose, tar and cherry aromas that unfold with age." },
      { name: 'Barbaresco', kind: 'appellation', keywords: ['nebbiolo', 'piedmont', 'langhe'],
        blurb: "Nebbiolo from Piedmont's Barbaresco zone: perfumed and elegant, softer and earlier-drinking than neighbouring Barolo." },
      { name: 'Amarone della Valpolicella', kind: 'appellation', keywords: ['amarone', 'appassimento', 'veneto'],
        blurb: 'Made from grapes dried for months before pressing, Amarone is rich and high in alcohol, layered with raisin, cherry and dark chocolate.' },
      { name: 'Valpolicella Ripasso', kind: 'appellation', keywords: ['ripasso', 'baby amarone', 'veneto'],
        blurb: "Valpolicella refermented on Amarone skins, gaining extra body, depth and warmth without Amarone's price tag." },
      { name: "Montepulciano d'Abruzzo", kind: 'appellation', keywords: ['abruzzo', 'italian red'],
        blurb: "Abruzzo's everyday red — soft, juicy and deeply coloured, with plum fruit and mellow tannins." },
      { name: 'Etna Rosso', kind: 'appellation', keywords: ['etna', 'sicily', 'volcanic wine'],
        blurb: 'Volcanic Sicilian red from Nerello Mascalese and Nerello Cappuccio, prized for its finesse, red-fruit purity and mineral drive.' },
    ],
  },

  'white-wine': {
    suffix: 'Wine',
    entries: [
      // ── Italian grape varieties ──────────────────────────────────────────
      { name: 'Garganega', kind: 'grape', keywords: ['soave', 'veneto white'],
        blurb: 'The grape behind Soave — gentle and textured, with white peach, almond and a lightly saline finish.' },
      { name: 'Verdicchio', kind: 'grape', keywords: ['castelli di jesi', 'marche'],
        blurb: "One of Italy's finest white grapes, from the Marche: crisp citrus and green apple over a signature bitter-almond note." },
      { name: 'Trebbiano', kind: 'grape', keywords: ['ugni blanc', 'italian white'],
        blurb: "Italy's most widely planted white — light, fresh and easy-drinking, with lemon and green apple." },
      { name: 'Falanghina', kind: 'grape', keywords: ['campania', 'southern italy'],
        blurb: 'A revived ancient grape from Campania, offering vivid citrus, white flowers and lively acidity.' },
      { name: 'Pecorino', kind: 'grape', keywords: ['abruzzo', 'marche', 'offida'],
        blurb: 'A characterful Abruzzo and Marche white with pear, fresh herbs and more body than most Italian whites.' },
      { name: 'Grechetto', kind: 'grape', keywords: ['umbria', 'orvieto'],
        blurb: "Umbria's textured white and the backbone of Orvieto, with pear, hazelnut and a refreshing grip." },
      { name: 'Grillo', kind: 'grape', keywords: ['sicily', 'marsala'],
        blurb: "Sicily's bright, citrus-driven white, originally grown for Marsala and now a fresh, aromatic dry wine." },
      { name: 'Catarratto', kind: 'grape', keywords: ['sicily', 'sicilian white'],
        blurb: "Sicily's most planted white grape — soft and citrus-and-melon flavoured with a gentle herbal lift." },
      { name: 'Carricante', kind: 'grape', keywords: ['etna bianco', 'volcanic wine'],
        blurb: 'The white grape of Mount Etna, giving taut, mineral wines with lemon, green apple and volcanic salinity.' },
      { name: 'Ribolla Gialla', kind: 'grape', keywords: ['friuli', 'orange wine', 'skin contact'],
        blurb: 'A Friulian white with delicate floral aromas and crisp acidity — and real texture in its skin-contact versions.' },
      { name: 'Friulano', kind: 'grape', keywords: ['tocai', 'friuli'],
        blurb: "Friuli's signature white, gently nutty and pear-scented with a characteristic almond finish." },
      { name: 'Malvasia', kind: 'grape', keywords: ['aromatic white', 'italian white'],
        blurb: 'A family of aromatic Italian whites ranging from dry and floral to richly sweet.' },
      { name: 'Pinot Bianco', kind: 'grape', keywords: ['pinot blanc', 'alto adige'],
        blurb: "Italy's Pinot Blanc — clean, subtle and food-friendly, with apple, almond and fresh acidity." },

      // ── DOC/DOCG appellations ────────────────────────────────────────────
      { name: 'Soave', kind: 'appellation', keywords: ['garganega', 'veneto'],
        blurb: "The Veneto's classic dry white from Garganega: soft, almond-tinged and quietly elegant." },
      { name: 'Gavi', kind: 'appellation', keywords: ['cortese', 'piedmont', 'gavi di gavi'],
        blurb: "Piedmont's crisp Cortese-based white — dry, citrussy and mineral, a natural match for seafood." },
      { name: 'Orvieto', kind: 'appellation', keywords: ['umbria', 'grechetto'],
        blurb: "Umbria's historic white blend, light and pear-scented, made in styles from dry to gently sweet." },
      { name: 'Frascati', kind: 'appellation', keywords: ['lazio', 'rome'],
        blurb: 'The white of the Roman hills — light, fresh and easy, built for drinking young.' },
      { name: 'Etna Bianco', kind: 'appellation', keywords: ['carricante', 'sicily', 'volcanic wine'],
        blurb: 'Volcanic white from Mount Etna, led by Carricante, with piercing acidity and smoky mineral depth.' },
      { name: 'Lugana', kind: 'appellation', keywords: ['lake garda', 'turbiana'],
        blurb: 'Grown near Lake Garda, Lugana is a fuller, age-worthy white with citrus, stone fruit and a saline edge.' },
    ],
  },

  'rose-wine': {
    suffix: 'Rosé',
    entries: [
      { name: "Cerasuolo d'Abruzzo", kind: 'appellation', keywords: ['montepulciano rose', 'abruzzo'],
        blurb: "Abruzzo's deep cherry-pink rosé from Montepulciano grapes, with far more fruit and body than most rosés." },
      { name: 'Chiaretto', kind: 'appellation', keywords: ['bardolino', 'valtenesi', 'lake garda'],
        blurb: 'The pale, delicate rosé style of Lake Garda — dry and floral, with wild strawberry and citrus.' },
      { name: 'Etna Rosato', kind: 'appellation', keywords: ['sicily', 'volcanic rose'],
        blurb: 'Volcanic Sicilian rosé from Nerello Mascalese — pale, mineral and finely perfumed.' },
      { name: 'Salento Rosato', kind: 'appellation', keywords: ['puglia', 'southern italy'],
        blurb: "Puglia's warm-climate rosé, generous and full of ripe strawberry and red-cherry fruit." },
      { name: 'Negroamaro Rosato', kind: 'grape', keywords: ['puglia', 'negroamaro'],
        blurb: "Rosé from Puglia's Negroamaro grape: deeply coloured, savoury and refreshingly dry." },
      { name: 'Sangiovese Rosato', kind: 'grape', keywords: ['tuscany', 'sangiovese rose'],
        blurb: 'Tuscan-style rosé with tart cherry, dried herbs and bright, food-friendly acidity.' },
      { name: 'Primitivo Rosato', kind: 'grape', keywords: ['puglia', 'zinfandel rose'],
        blurb: 'A bold Puglian rosé — ripe, fruit-forward and rounder than most, from the Primitivo grape.' },
      { name: 'Nerello Mascalese Rosato', kind: 'grape', keywords: ['etna', 'sicily'],
        blurb: 'Elegant Sicilian rosé with red-berry aromatics, fine acidity and a smoky volcanic edge.' },
      { name: 'Lagrein Rosato', kind: 'grape', keywords: ['kretzer', 'alto adige'],
        blurb: 'Known locally as Kretzer, this Alto Adige rosé is crisp and dark-berried with alpine freshness.' },
      { name: 'Ramato', kind: 'appellation', keywords: ['pinot grigio ramato', 'friuli', 'skin contact'],
        blurb: 'The traditional copper-coloured Pinot Grigio of Friuli, given skin contact for extra texture and spice.' },
      { name: 'Rosato Toscano', kind: 'appellation', keywords: ['tuscany', 'sangiovese rose'],
        blurb: "Tuscany's dry rosé, usually Sangiovese-based, with cherry fruit and a clean savoury finish." },
    ],
  },
};

// Names that already say what kind of wine they are — appending the suffix
// would give "Etna Rosso Wine" or "Negroamaro Rosato Rosé".
const SELF_DESCRIBING = /\b(wine|rosato|ros[eé]|chiaretto|bianco|rosso|ramato)\b/i;

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
      (max, s) => Math.max(max, Number.isFinite(s.displayOrder) && s.displayOrder < 900 ? s.displayOrder : 0),
      0,
    );

    console.log(`📁 ${category.name} — ${existing.length} existing, adding ${entries.length}`);

    const newIds = [];
    for (const { name, kind, blurb, keywords } of entries) {
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
        subType: kind === 'appellation' ? 'italian_appellation' : 'italian_varietal',
        status: 'published',
        displayOrder: ++order,
        shortDescription: blurb,
        seoH1: `${label} in Nigeria`,
        metaTitle: `Buy ${label} Online in Nigeria`,
        metaDescription: `${blurb} Shop ${label} at DrinksHarbour with fast delivery in Abuja and nationwide across Nigeria.`,
        metaKeywords: [name.toLowerCase(), ...(keywords || []), 'italian wine'],
        publishedAt: new Date(),
      };

      if (APPLY) {
        const sub = await SubCategory.create(doc);
        newIds.push(sub._id);
      }
      console.log(`  ✅ ${name} (${slug}) — ${kind}`);
      created++;
    }

    if (APPLY && newIds.length > 0) {
      await Category.findByIdAndUpdate(category._id, {
        $addToSet: { subCategories: { $each: newIds } },
      });
    }
    console.log('');
  }

  console.log(`${APPLY ? 'Created' : 'Would create'} ${created}, skipped ${skipped} existing.`);
  if (!APPLY) console.log('Re-run with --apply to write.');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
