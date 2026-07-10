// add-tequila-subcategories.js - Add more subcategories under the Tequila category
// Follows the same document shape as seed-all-subcategories.js (Category docs,
// level 1, slug prefixed with the parent slug, parent.subCategories updated).
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Category = require("../models/Category");

const NEW_SUBCATEGORIES = [
  "Joven",
  "Gold Tequila",
  "Cristalino",
  "Flavored Tequila",
  "100% Agave",
  "Sipping Tequila",
  "Tequila Liqueur",
  "Small Batch Tequila",
];

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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

    const existingCount = (tequila.subCategories || []).length;
    console.log(`📁 Tequila (${tequila._id}) — ${existingCount} existing subcategories\n`);

    let created = 0;
    let skipped = 0;
    const newIds = [];

    for (let i = 0; i < NEW_SUBCATEGORIES.length; i++) {
      const name = NEW_SUBCATEGORIES[i];
      const slug = `tequila-${generateSlug(name)}`;

      const existing = await Category.findOne({ slug });
      if (existing) {
        console.log(`  ⏭️  ${name} (exists)`);
        newIds.push(existing._id);
        skipped++;
        continue;
      }

      const subcategory = new Category({
        _id: new mongoose.Types.ObjectId(),
        name,
        slug,
        type: tequila.type || "tequila",
        icon: tequila.icon || "🥃",
        color: tequila.color || "#F59E0B",
        parent: tequila._id,
        level: 1,
        status: "published",
        alcoholCategory: tequila.alcoholCategory || "alcoholic",
        shortDescription: `${name} - Premium ${name.toLowerCase()} selection`,
        tagline: `Explore ${name}`,
        displayOrder: existingCount + i,
        showInMenu: true,
      });

      await subcategory.save();
      newIds.push(subcategory._id);
      console.log(`  ✅ ${name} (${slug})`);
      created++;
    }

    if (newIds.length > 0) {
      await Category.findByIdAndUpdate(tequila._id, {
        $addToSet: { subCategories: { $each: newIds } },
      });
    }

    const updated = await Category.findById(tequila._id).select("subCategories");
    console.log(`\nDone! Created ${created}, skipped ${skipped} existing.`);
    console.log(`Tequila now has ${updated.subCategories.length} subcategories.`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

run();
