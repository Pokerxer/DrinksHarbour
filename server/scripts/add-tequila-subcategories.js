// add-tequila-subcategories.js - Add more subcategories under the Tequila category
// Subcategories live in the `subcategories` collection (SubCategory model) with
// parent = tequila Category id — matching the existing docs (Blanco Tequila,
// Reposado Tequila, ...). Also cleans up an earlier bad run that inserted these
// as level-1 Category docs (slugs tequila-*).
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Category = require("../models/Category");
const SubCategory = require("../models/SubCategory");

// name / slug / type follow the existing style: "Blanco Tequila" / blanco-tequila / blanco_tequila
const NEW_SUBCATEGORIES = [
  "Gold Tequila",
  "Cristalino Tequila",
  "Flavored Tequila",
  "100% Agave Tequila",
  "Sipping Tequila",
  "Tequila Liqueur",
  "Small Batch Tequila",
  "Mezcal",
];

const generateSlug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function run() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/drinksharbour",
    );
    console.log("Connected to MongoDB\n");

    const tequila = await Category.findOne({ slug: "tequila", parent: null });
    if (!tequila) {
      console.error("❌ Tequila top-level category not found");
      process.exit(1);
    }

    // ── Cleanup: remove the wrongly created level-1 Category docs ────────────
    const badCats = await Category.find({ parent: tequila._id, slug: /^tequila-/ });
    if (badCats.length > 0) {
      const badIds = badCats.map((c) => c._id);
      await Category.deleteMany({ _id: { $in: badIds } });
      await Category.findByIdAndUpdate(tequila._id, {
        $pull: { subCategories: { $in: badIds } },
      });
      console.log(`🧹 Removed ${badCats.length} wrongly-created Category docs: ${badCats.map((c) => c.name).join(", ")}\n`);
    }

    const existing = await SubCategory.find({ parent: tequila._id }).select("name slug");
    console.log(`📁 Tequila (${tequila._id}) — ${existing.length} existing subcategories: ${existing.map((s) => s.name).join(", ")}\n`);

    let created = 0;
    let skipped = 0;
    const newIds = [];

    for (const name of NEW_SUBCATEGORIES) {
      const slug = generateSlug(name);
      const found = await SubCategory.findOne({ slug });
      if (found) {
        console.log(`  ⏭️  ${name} (exists)`);
        newIds.push(found._id);
        skipped++;
        continue;
      }

      const sub = await SubCategory.create({
        name,
        slug,
        parent: tequila._id,
        type: slug.replace(/-/g, "_"),
        status: "published",
      });
      newIds.push(sub._id);
      console.log(`  ✅ ${name} (${slug})`);
      created++;
    }

    if (newIds.length > 0) {
      await Category.findByIdAndUpdate(tequila._id, {
        $addToSet: { subCategories: { $each: newIds } },
      });
    }

    const total = await SubCategory.countDocuments({ parent: tequila._id });
    console.log(`\nDone! Created ${created}, skipped ${skipped} existing.`);
    console.log(`Tequila now has ${total} subcategories.`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

run();
