// add-accessories-categories.js
// Seed non-beverage, beverage-adjacent categories + subcategories:
// glassware, decanters, bar tools, wine accessories, serving accessories,
// drinkware/flasks, coolers & ice, gift sets, and cocktail mixers.
//
// Follows the same layout as add-port-wine-categories.js: each entry is a
// top-level Category doc, and its styles/variants live in the `subcategories`
// collection with parent = category id. Idempotent — safe to re-run.
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Category = require("../models/Category");
const SubCategory = require("../models/SubCategory");

// Base displayOrder so accessory sections sort AFTER the 34 beverage categories.
let ORDER = 200;

const CATALOG = [
  {
    name: "Glassware",
    slug: "glassware",
    type: "glassware",
    color: "#7C3AED",
    icon: "wine",
    tagline: "The right glass for every pour",
    shortDescription:
      "Wine glasses, tumblers, flutes and specialty glassware designed to bring out the best in every drink.",
    description:
      "The shape of a glass changes how a drink smells, tastes and feels. Our glassware collection covers every occasion — from stemmed wine glasses and crystal flutes to heavy-based rocks glasses and cocktail coupes. Whether you are setting a formal table or building a home bar, the right glass elevates the pour.",
    subs: [
      "Wine Glasses",
      "Champagne Flutes & Coupes",
      "Whiskey & Rocks Glasses",
      "Beer Glasses & Pints",
      "Cocktail & Martini Glasses",
      "Highball & Collins Glasses",
      "Shot Glasses",
      "Brandy Snifters",
      "Gin Copa Glasses",
      "Stemless Glasses",
      "Tumblers & Water Glasses",
      "Sherry & Liqueur Glasses",
    ],
  },
  {
    name: "Decanters & Carafes",
    slug: "decanters-carafes",
    type: "glassware",
    color: "#B45309",
    icon: "flask-conical",
    tagline: "Let it breathe, serve it beautifully",
    shortDescription:
      "Wine and spirit decanters, carafes and aerators that open up aromas and make serving a centrepiece.",
    description:
      "Decanting separates a wine from its sediment and lets it breathe, softening tannins and releasing aroma. For spirits, a crystal decanter turns a bottle into a display piece. Explore wine decanters, whiskey decanter sets, carafes and aerators for both everyday pouring and special occasions.",
    subs: [
      "Wine Decanters",
      "Whiskey Decanters",
      "Spirit Decanter Sets",
      "Wine Carafes",
      "Water Carafes",
      "Crystal Decanters",
      "Wine Aerators",
    ],
  },
  {
    name: "Bar Tools & Equipment",
    slug: "bar-tools-equipment",
    type: "bar_tools",
    color: "#0F766E",
    icon: "hammer",
    tagline: "Everything you need to mix like a pro",
    shortDescription:
      "Shakers, jiggers, strainers, muddlers and complete bar kits for crafting cocktails at home.",
    description:
      "A well-stocked bar starts with the right tools. From cocktail shakers and jiggers to muddlers, strainers and mixing glasses, our bar equipment range gives home mixologists everything they need to build balanced, professional-quality drinks.",
    subs: [
      "Cocktail Shakers",
      "Jiggers & Measures",
      "Bar Spoons",
      "Muddlers",
      "Cocktail Strainers",
      "Mixing Glasses",
      "Pour Spouts",
      "Bottle Openers",
      "Ice Tongs & Scoops",
      "Citrus Juicers & Presses",
      "Bar Tool Sets",
      "Bar Mats & Rails",
    ],
  },
  {
    name: "Wine Accessories",
    slug: "wine-accessories",
    type: "accessories",
    color: "#9F1239",
    icon: "wine-off",
    tagline: "Open, pour, preserve",
    shortDescription:
      "Corkscrews, stoppers, aerators and preservers to open, serve and keep your wine at its best.",
    description:
      "From effortless openings to keeping an unfinished bottle fresh, wine accessories make every bottle better. Browse corkscrews and electric openers, vacuum preservers and stoppers, aerating pourers, foil cutters and racks for the wine lover's kit.",
    subs: [
      "Corkscrews & Wine Openers",
      "Electric Wine Openers",
      "Wine Stoppers",
      "Wine Preservers & Vacuum Pumps",
      "Aerating Pourers",
      "Foil Cutters",
      "Wine Drip Rings",
      "Wine Racks & Storage",
      "Wine Charms & Markers",
    ],
  },
  {
    name: "Cocktail & Serving Accessories",
    slug: "cocktail-serving-accessories",
    type: "accessories",
    color: "#C2410C",
    icon: "utensils",
    tagline: "The finishing touches",
    shortDescription:
      "Coasters, trays, picks, stirrers, straws and garnish tools that complete the serve.",
    description:
      "The details make the drink. Dress your table and bar with coasters and serving trays, cocktail picks and stirrers, reusable straws, napkins, garnish tools and ice molds — the finishing touches that turn a pour into a presentation.",
    subs: [
      "Coasters",
      "Serving Trays",
      "Cocktail Picks & Skewers",
      "Drink Stirrers",
      "Reusable & Paper Straws",
      "Cocktail Napkins",
      "Garnish Tools & Zesters",
      "Ice Cube Trays & Molds",
      "Drink Dispensers & Beverage Tubs",
    ],
  },
  {
    name: "Drinkware & Flasks",
    slug: "drinkware-flasks",
    type: "glassware",
    color: "#334155",
    icon: "cup-soda",
    tagline: "Take the drinks with you",
    shortDescription:
      "Hip flasks, insulated tumblers, travel mugs and reusable cups for drinks on the move.",
    description:
      "For the outdoors, the office or the road, drinkware keeps your drinks with you. Discover stainless hip flasks, vacuum-insulated tumblers, travel mugs and reusable cups built to keep drinks cold or hot for hours.",
    subs: [
      "Hip Flasks",
      "Insulated Tumblers",
      "Travel Mugs",
      "Reusable Cups",
      "Mason Jars & Lids",
      "Wine Tumblers",
    ],
  },
  {
    name: "Coolers & Ice",
    slug: "coolers-ice",
    type: "accessories",
    color: "#0369A1",
    icon: "snowflake",
    tagline: "Keep it perfectly chilled",
    shortDescription:
      "Ice buckets, wine chillers, champagne buckets and chilling stones to serve at the perfect temperature.",
    description:
      "Temperature is everything. Keep bottles and glasses at their ideal serving temperature with ice buckets, wine and champagne chillers, whiskey stones that cool without dilution, and insulated cooler bags for taking drinks anywhere.",
    subs: [
      "Ice Buckets",
      "Wine Chillers & Coolers",
      "Champagne Buckets",
      "Whiskey Stones & Chilling Cubes",
      "Cooler Bags & Totes",
      "Bottle Sleeves",
    ],
  },
  {
    name: "Gift Sets & Hampers",
    slug: "gift-sets-hampers",
    type: "gift_set",
    color: "#A21CAF",
    icon: "gift",
    tagline: "Ready-to-give, beautifully packed",
    shortDescription:
      "Curated spirit, wine and cocktail gift sets, glassware bundles and hampers for every occasion.",
    description:
      "Take the guesswork out of gifting. Our gift sets and hampers pair premium drinks with glassware, tools and treats in ready-to-give packaging — from cocktail kits and spirit sets to celebration hampers for birthdays, weddings and the festive season.",
    occasions: ["christmas", "new_year", "wedding", "birthday", "anniversary", "corporate_event"],
    subs: [
      "Spirit Gift Sets",
      "Wine Gift Sets",
      "Cocktail Kits",
      "Beer Gift Packs",
      "Glassware Gift Sets",
      "Gift Hampers",
      "Personalized Gifts",
    ],
  },
  {
    name: "Cocktail Mixers",
    slug: "cocktail-mixers",
    type: "soft_drink",
    alcoholCategory: "non_alcoholic",
    color: "#65A30D",
    icon: "citrus",
    tagline: "The other half of every cocktail",
    shortDescription:
      "Tonics, sodas, ginger beer and ready mixes to build cocktails and long drinks at home.",
    description:
      "Every great cocktail is a partnership. Stock up on premium tonic waters, sodas and ginger beer, plus ready-made margarita, sour and Bloody Mary mixes and cordials — the mixers that turn a bottle of spirit into a round of drinks.",
    subs: [
      "Tonic Water",
      "Club Soda & Soda Water",
      "Ginger Beer & Ginger Ale",
      "Grenadine & Cocktail Syrups",
      "Margarita & Cocktail Mixes",
      "Sour Mix",
      "Bloody Mary Mix",
      "Cordials & Cocktail Garnishes",
    ],
  },
];

const generateSlug = (name) =>
  name
    .toLowerCase()
    .replace(/[éèêë]/g, "e")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/drinksharbour");
  console.log("Connected to MongoDB\n");

  let catsCreated = 0;
  let subsCreated = 0;
  let subsSkipped = 0;

  for (const entry of CATALOG) {
    const alcoholCategory = entry.alcoholCategory || "non_alcoholic";

    let cat = await Category.findOne({ slug: entry.slug });
    if (cat) {
      console.log(`📁 ${entry.name} exists (${cat._id})`);
    } else {
      cat = await Category.create({
        name: entry.name,
        slug: entry.slug,
        type: entry.type,
        alcoholCategory,
        displayName: entry.name,
        tagline: entry.tagline,
        shortDescription: entry.shortDescription,
        description: entry.description,
        color: entry.color,
        icon: entry.icon,
        status: "published",
        showInMenu: true,
        displayOrder: ORDER,
        occasions: entry.occasions || [],
        metaTitle: `${entry.name} | DrinksHarbour`,
        metaDescription: entry.shortDescription.slice(0, 300),
        metaKeywords: entry.name.toLowerCase().split(/\s*&\s*|\s+/).filter(Boolean),
      });
      console.log(`✅ Created category ${entry.name} (${cat._id})`);
      catsCreated++;
    }
    ORDER += 10;

    let subOrder = 1;
    const newIds = [];
    for (const subName of entry.subs) {
      const slug = generateSlug(subName);
      let sub = await SubCategory.findOne({ slug });
      if (sub) {
        console.log(`  ⏭️  ${subName} (exists)`);
        newIds.push(sub._id);
        subsSkipped++;
        subOrder++;
        continue;
      }
      sub = await SubCategory.create({
        name: subName,
        slug,
        parent: cat._id,
        type: entry.type,
        displayName: subName,
        shortDescription: `Shop ${subName.toLowerCase()} at DrinksHarbour — part of our ${entry.name.toLowerCase()} range.`,
        color: entry.color,
        status: "published",
        showInMenu: true,
        displayOrder: subOrder,
        metaTitle: `${subName} | ${entry.name} | DrinksHarbour`,
        metaDescription: `Browse ${subName.toLowerCase()} and more ${entry.name.toLowerCase()} at DrinksHarbour.`,
      });
      newIds.push(sub._id);
      console.log(`  ✅ ${subName} (${slug})`);
      subsCreated++;
      subOrder++;
    }

    if (newIds.length > 0) {
      await Category.findByIdAndUpdate(cat._id, {
        $addToSet: { subCategories: { $each: newIds } },
      });
    }
    const total = await SubCategory.countDocuments({ parent: cat._id });
    console.log(`   → ${entry.name}: ${total} subcategories\n`);
  }

  console.log(
    `Done! Categories created: ${catsCreated}. Subcategories created: ${subsCreated}, skipped: ${subsSkipped}.`,
  );
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
