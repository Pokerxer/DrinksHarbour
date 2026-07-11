// add-port-wine-categories.js - Add a top-level Port Wine category with its
// style subcategories. Wine styles are top-level Category docs in this catalog
// (red-wine, white-wine, ...), so Port Wine follows the same convention;
// styles (Tawny, Ruby, Vintage, ...) live in the `subcategories` collection
// with parent = Port Wine category id — same layout as the Tequila script.
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Category = require("../models/Category");
const SubCategory = require("../models/SubCategory");

const PORT_CATEGORY = {
  name: "Port Wine",
  slug: "port-wine",
  type: "fortified_wine",
  alcoholCategory: "alcoholic",
  status: "published",
};

const NEW_SUBCATEGORIES = [
  "Tawny Port",
  "Ruby Port",
  "Vintage Port",
  "Late Bottled Vintage Port",
  "White Port",
  "Rosé Port",
  "Colheita Port",
  "Crusted Port",
];

const generateSlug = (name) =>
  name
    .toLowerCase()
    .replace(/[éèêë]/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function run() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/drinksharbour",
    );
    console.log("Connected to MongoDB\n");

    let port = await Category.findOne({ slug: PORT_CATEGORY.slug });
    if (port) {
      console.log(`📁 Port Wine category exists (${port._id})`);
    } else {
      port = await Category.create(PORT_CATEGORY);
      console.log(`✅ Created top-level category Port Wine (${port._id})`);
    }

    const existing = await SubCategory.find({ parent: port._id }).select("name");
    console.log(`   ${existing.length} existing subcategories: ${existing.map((s) => s.name).join(", ") || "(none)"}\n`);

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
        parent: port._id,
        type: slug.replace(/-/g, "_"),
        status: "published",
      });
      newIds.push(sub._id);
      console.log(`  ✅ ${name} (${slug})`);
      created++;
    }

    if (newIds.length > 0) {
      await Category.findByIdAndUpdate(port._id, {
        $addToSet: { subCategories: { $each: newIds } },
      });
    }

    const total = await SubCategory.countDocuments({ parent: port._id });
    console.log(`\nDone! Created ${created}, skipped ${skipped} existing.`);
    console.log(`Port Wine now has ${total} subcategories.`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

run();
