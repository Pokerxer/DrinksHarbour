// add-smoking-categories.js
// Seed age-restricted, beverage-adjacent categories: Cigars & Smoking
// Accessories and Vapes & E-cigarettes. Same idempotent layout as
// add-accessories-categories.js. NOTE: these are age-restricted product
// classes — ensure age-gating and payment-processor compliance before listing.
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Category = require("../models/Category");
const SubCategory = require("../models/SubCategory");

// Continue displayOrder after the accessory categories (which end ~290).
let ORDER = 300;

const CATALOG = [
  {
    name: "Cigars & Smoking Accessories",
    slug: "cigars-smoking-accessories",
    type: "accessories",
    color: "#78350F",
    icon: "cigarette",
    tagline: "The perfect pairing for a fine spirit",
    shortDescription:
      "Cigars, cutters, lighters, humidors and ashtrays — the classic companions to a great whiskey, rum or cognac.",
    description:
      "A fine cigar and a measure of aged spirit belong together. Explore hand-rolled cigars and cigarillos alongside the accessories that keep them at their best — cutters and punches, torch lighters, humidors for perfect storage, and ashtrays and cases for the discerning smoker. Age-restricted; sold to adults only.",
    subs: [
      "Cigars",
      "Cigarillos",
      "Cigar Cutters",
      "Cigar Lighters",
      "Cigar Humidors",
      "Cigar Ashtrays",
      "Cigar Cases & Holders",
      "Cigar Punches",
    ],
  },
  {
    name: "Vapes & E-cigarettes",
    slug: "vapes-e-cigarettes",
    type: "accessories",
    color: "#0891B2",
    icon: "cigarette",
    tagline: "Kits, pods and e-liquids",
    shortDescription:
      "Vape kits, disposables, pods, e-liquids and accessories. Age-restricted — sold to adults only.",
    description:
      "Browse vape devices and everything that keeps them running — starter kits and disposables, refillable pods and cartridges, a range of e-liquids, plus coils, batteries and chargers. Age-restricted; sold to adults only and subject to local regulations.",
    subs: [
      "Vape Kits & Devices",
      "Disposable Vapes",
      "Vape Pods & Cartridges",
      "E-liquids & Vape Juice",
      "Vape Coils",
      "Vape Batteries & Chargers",
      "Nicotine Pouches",
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
    let cat = await Category.findOne({ slug: entry.slug });
    if (cat) {
      console.log(`📁 ${entry.name} exists (${cat._id})`);
    } else {
      cat = await Category.create({
        name: entry.name,
        slug: entry.slug,
        type: entry.type,
        alcoholCategory: "non_alcoholic",
        displayName: entry.name,
        tagline: entry.tagline,
        shortDescription: entry.shortDescription,
        description: entry.description,
        color: entry.color,
        icon: entry.icon,
        status: "published",
        showInMenu: true,
        displayOrder: ORDER,
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
        shortDescription: `Shop ${subName.toLowerCase()} at DrinksHarbour — part of our ${entry.name.toLowerCase()} range. Age-restricted; adults only.`,
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
