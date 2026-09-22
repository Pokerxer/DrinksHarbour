// seed-ckay-taxonomy.js
// Add gift & lifestyle taxonomy shelves so the 90+ products imported under the
// ckay tenant (glassware, decanters, mugs, bar tools, gift sets, beauty &
// grooming, home & living, snacks) can be properly categorized when edited.
//
// Creates three new top-level Categories — Snacks & Treats (type snack),
// Beauty & Grooming (type beauty), Home & Living (type home) — plus new
// SubCategories under both the new categories and existing accessory ones.
// Follows the add-accessories-categories.js layout and is idempotent — safe
// to re-run. Requires 'snack' | 'beauty' | 'home' in Category.type (added to
// server/models/Category.js).
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Category = require("../models/Category");
const SubCategory = require("../models/SubCategory");

// New top-level categories — displayOrder keeps them after the accessory family
// (cigars/vapes top out at 310).
const NEW_CATEGORIES = [
  {
    name: "Snacks & Treats",
    slug: "snacks-treats",
    type: "snack",
    alcoholCategory: "non_alcoholic",
    color: "#D97706",
    icon: "cookie",
    tagline: "Bite-sized treats for every occasion",
    shortDescription:
      "Nuts, biscuits, fudge and confectionery — the perfect nibbles to pair with a pour or wrap into a gift.",
    description:
      "Well-stocked shelves deserve well-chosen treats. From roasted nuts and crisp biscuits to luxury themed fudge, our snacks & treats range rounds out any order — and makes the ideal finishing touch inside a gift box or hamper.",
    displayOrder: 320,
    subs: [
      { name: "Nuts & Seeds", slug: "nuts-and-seeds" },
      { name: "Biscuits & Cookies", slug: "biscuits-and-cookies" },
      { name: "Chocolates & Fudge", slug: "chocolates-and-fudge" },
    ],
  },
  {
    name: "Beauty & Grooming",
    slug: "beauty-grooming",
    type: "beauty",
    alcoholCategory: "non_alcoholic",
    color: "#DB2777",
    icon: "sparkles",
    tagline: "Pamper, groom and polish",
    shortDescription:
      "Hair care tools, bath and body gifts and grooming essentials for premium gift sets and hampers.",
    description:
      "Beauty and grooming staples that make gifting personal. Discover styling tools, bath and body treats and pampering essentials — ready to stand alone or be bundled into a curated gift set.",
    displayOrder: 330,
    subs: [
      { name: "Hair Care & Styling Tools", slug: "hair-care-and-styling-tools" },
      { name: "Bath & Body", slug: "bath-and-body" },
    ],
  },
  {
    name: "Home & Living",
    slug: "home-living",
    type: "home",
    alcoholCategory: "non_alcoholic",
    color: "#059669",
    icon: "home",
    tagline: "Elevate everyday spaces",
    shortDescription:
      "Home fragrance, kitchen and dining pieces and utility items for a well-lived home.",
    description:
      "From refreshing diffusers to clever kitchen and utility helpers, our home & living range brings practicality and polish to everyday spaces — and always finds a home in a thoughtful gift.",
    displayOrder: 340,
    subs: [
      { name: "Home Fragrance", slug: "home-fragrance" },
      { name: "Kitchen & Dining", slug: "kitchen-and-dining" },
      { name: "Cleaning & Utility", slug: "cleaning-and-utility" },
    ],
  },
];

// New subcategories added to EXISTING top-level categories that ckay products
// match. keyed by the existing category slug.
const PATCH_SUBCATEGORIES = [
  {
    categorySlug: "glassware",
    color: "#7C3AED",
    subs: [
      { name: "Mugs & Coffee Cups", slug: "mugs-and-coffee-cups", type: "glassware" },
      { name: "Glassware Sets", slug: "glassware-sets", type: "glassware" },
    ],
  },
  {
    categorySlug: "drinkware-flasks",
    color: "#334155",
    subs: [{ name: "Water Bottles", slug: "water-bottles", type: "glassware" }],
  },
  {
    categorySlug: "bar-tools-equipment",
    color: "#B45309",
    subs: [
      { name: "Shot Boards & Shot Frames", slug: "shot-boards-and-shot-frames", type: "bar_tools" },
      { name: "Barrels & Bar Décor", slug: "barrels-and-bar-decor", type: "bar_tools" },
    ],
  },
  {
    categorySlug: "gift-sets-hampers",
    color: "#A21CAF",
    subs: [
      { name: "Gift Boxes & Packaging", slug: "gift-boxes-and-packaging", type: "gift_set" },
      { name: "Beauty & Pamper Gift Sets", slug: "beauty-and-pamper-gift-sets", type: "gift_set" },
      { name: "Home & Bath Gift Sets", slug: "home-and-bath-gift-sets", type: "gift_set" },
      { name: "Plush Toys & Gifts", slug: "plush-toys-and-gifts", type: "gift_set" },
    ],
  },
];

const generateSlug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/drinksharbour");
  console.log("Connected to MongoDB\n");

  let catsCreated = 0;
  let subsCreated = 0;
  let subsSkipped = 0;

  // ── New top-level categories + their subcategories ─────────────────────────
  for (const entry of NEW_CATEGORIES) {
    let cat = await Category.findOne({ slug: entry.slug, parent: null });
    if (cat) {
      console.log(`📁 ${entry.name} exists (${cat._id})`);
    } else {
      cat = await Category.create({
        name: entry.name,
        slug: entry.slug,
        type: entry.type,
        alcoholCategory: entry.alcoholCategory || "non_alcoholic",
        displayName: entry.name,
        tagline: entry.tagline,
        shortDescription: entry.shortDescription,
        description: entry.description,
        color: entry.color,
        icon: entry.icon,
        featuredImage: { isActive: true },
        status: "published",
        showInMenu: true,
        displayOrder: entry.displayOrder,
        metaTitle: `${entry.name} | DrinksHarbour`,
        metaDescription: entry.shortDescription.slice(0, 300),
        metaKeywords: entry.name.toLowerCase().split(/\s*&\s*|\s+/).filter(Boolean),
      });
      console.log(`✅ Created category ${entry.name} (${cat._id})`);
      catsCreated++;
    }

    let subOrder = 1;
    const newIds = [];
    for (const subSpec of entry.subs) {
      const slug = subSpec.slug || generateSlug(subSpec.name);
      let sub = await SubCategory.findOne({ slug });
      if (sub) {
        console.log(`  ⏭️  ${subSpec.name} (${slug}) exists`);
        newIds.push(sub._id);
        subsSkipped++;
        subOrder++;
        continue;
      }
      sub = await SubCategory.create({
        name: subSpec.name,
        slug,
        parent: cat._id,
        type: entry.type,
        displayName: subSpec.name,
        shortDescription: `Shop ${subSpec.name.toLowerCase()} at DrinksHarbour — part of our ${entry.name.toLowerCase()} range.`,
        color: entry.color,
        status: "published",
        showInMenu: true,
        displayOrder: subOrder,
        metaTitle: `${subSpec.name} | ${entry.name} | DrinksHarbour`,
        metaDescription: `Browse ${subSpec.name.toLowerCase()} and more ${entry.name.toLowerCase()} at DrinksHarbour.`,
      });
      newIds.push(sub._id);
      console.log(`  ✅ ${subSpec.name} (${slug})`);
      subsCreated++;
      subOrder++;
    }

    if (newIds.length > 0) {
      await Category.findByIdAndUpdate(cat._id, {
        $addToSet: { subCategories: { $each: newIds } },
      });
    }
  }

  // ── New subcategories under existing categories ────────────────────────────
  for (const patch of PATCH_SUBCATEGORIES) {
    const cat = await Category.findOne({ slug: patch.categorySlug, parent: null });
    if (!cat) {
      console.warn(`⚠️  Category ${patch.categorySlug} not found — skipping its subcategories`);
      continue;
    }
    let subOrder = 1;
    const newIds = [];
    for (const subSpec of patch.subs) {
      const slug = subSpec.slug || generateSlug(subSpec.name);
      let sub = await SubCategory.findOne({ slug, parent: cat._id });
      if (sub) {
        console.log(`  ⏭️  [${patch.categorySlug}] ${subSpec.name} (${slug}) exists`);
        newIds.push(sub._id);
        subsSkipped++;
        subOrder++;
        continue;
      }
      sub = await SubCategory.create({
        name: subSpec.name,
        slug,
        parent: cat._id,
        type: subSpec.type,
        displayName: subSpec.name,
        shortDescription: `Shop ${subSpec.name.toLowerCase()} at DrinksHarbour — part of our ${cat.name.toLowerCase()} range.`,
        color: subSpec.color || patch.color,
        status: "published",
        showInMenu: true,
        displayOrder: subOrder,
        metaTitle: `${subSpec.name} | ${cat.name} | DrinksHarbour`,
        metaDescription: `Browse ${subSpec.name.toLowerCase()} and more ${cat.name.toLowerCase()} at DrinksHarbour.`,
      });
      newIds.push(sub._id);
      console.log(`  ✅ [${patch.categorySlug}] ${subSpec.name} (${slug})`);
      subsCreated++;
      subOrder++;
    }
    const total = await SubCategory.countDocuments({ parent: cat._id });
    console.log(`   → ${cat.name}: ${total} subcategories\n`);
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