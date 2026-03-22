// connect-subcategories.js - Connect subcategories to parent categories using parent field
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Category = require("../models/Category");

const MONGODB_URI =
  "mongodb+srv://jrwaldehzx:NWXdpyCMP7yB7a4N@cluster0.ukrr40p.mongodb.net/drinksharbour?retryWrites=true&w=majority";

async function connectSubcategories() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB\n");

    // Get all categories
    const allCategories = await Category.find({}).lean();
    console.log(`Total categories: ${allCategories.length}\n`);

    // Create lookup maps
    const categoryById = {};
    const topLevelCategories = []; // categories with parent: null

    allCategories.forEach((cat) => {
      categoryById[cat._id.toString()] = cat;
      if (!cat.parent && cat.level === 0) {
        topLevelCategories.push(cat);
      }
    });

    console.log(`Top-level categories: ${topLevelCategories.length}\n`);

    let updated = 0;
    let totalSubcats = 0;

    // For each top-level category, find all subcategories by parent field
    for (const topCat of topLevelCategories) {
      const topCatId = topCat._id.toString();

      // Find all categories where parent equals this top-level category's _id
      const subcategories = allCategories.filter((cat) => {
        if (!cat.parent) return false;
        return cat.parent.toString() === topCatId;
      });

      if (subcategories.length === 0) {
        console.log(`⏭️  ${topCat.name}: No subcategories found`);
        continue;
      }

      // Get existing subCategories array
      const existingSubIds = topCat.subCategories || [];
      const existingIdsSet = new Set(existingSubIds.map((id) => id.toString()));

      // Get IDs from subcategories
      const actualSubIds = subcategories.map((sub) => sub._id);
      const actualIdsSet = new Set(actualSubIds.map((id) => id.toString()));

      // Check if they match
      const existingSet = new Set(existingSubIds.map((id) => id.toString()));
      const isMatch =
        actualIdsSet.size === existingSet.size &&
        [...actualIdsSet].every((id) => existingSet.has(id));

      if (isMatch) {
        console.log(
          `✅ ${topCat.name}: Already connected (${subcategories.length} subcategories)`,
        );
      } else {
        // Update the subCategories array
        await Category.findByIdAndUpdate(topCat._id, {
          subCategories: actualSubIds,
        });
        console.log(
          `🔗 ${topCat.name}: Connected ${subcategories.length} subcategories`,
        );
        updated++;
      }

      totalSubcats += subcategories.length;

      // Show first few subcategories
      const preview = subcategories
        .slice(0, 3)
        .map((s) => s.name)
        .join(", ");
      console.log(`   └─ ${preview}${subcategories.length > 3 ? "..." : ""}`);
    }

    console.log("\n========================================");
    console.log(`Categories updated: ${updated}`);
    console.log(`Total subcategories: ${totalSubcats}`);
    console.log("========================================");

    // Verify all subcategories are properly linked
    console.log("\n=== Verification ===\n");

    const allWithParent = await Category.countDocuments({
      parent: { $ne: null },
    });
    console.log(`Categories with parent: ${allWithParent}`);

    // Check categories that should be top-level but have subCategories array empty
    let missingSubcats = 0;
    for (const cat of topLevelCategories) {
      if (!cat.subCategories || cat.subCategories.length === 0) {
        const subs = allCategories.filter(
          (c) => c.parent && c.parent.toString() === cat._id.toString(),
        );
        if (subs.length > 0) {
          missingSubcats++;
          console.log(
            `⚠️  ${cat.name}: Has ${subs.length} children but no subCategories array`,
          );
        }
      }
    }

    if (missingSubcats === 0) {
      console.log("\n✅ All subcategories are properly connected!");
    }

    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

connectSubcategories();
