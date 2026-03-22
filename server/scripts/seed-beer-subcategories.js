// seed-subcategories.js - Seed Beer subcategories with specific IDs
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Category = require("../models/Category");

const BEER_CATEGORY_ID = "698f5fa1d7cae2c5c8248e52";

const beerSubcategories = [
  {
    _id: "698f5fa1d7cae2c5c8248eaf",
    name: "Lager",
    slug: "beer-lager",
    type: "beer",
    icon: "🍺",
    color: "#F59E0B",
  },
  {
    _id: "698f5fa1d7cae2c5c8248eb2",
    name: "Ale",
    slug: "beer-ale",
    type: "beer",
    icon: "🍺",
    color: "#D97706",
  },
  {
    _id: "698f5fa1d7cae2c5c8248eb5",
    name: "IPA",
    slug: "beer-ipa",
    type: "beer",
    icon: "🍺",
    color: "#B45309",
  },
  {
    _id: "698f5fa1d7cae2c5c8248eb8",
    name: "Stout",
    slug: "beer-stout",
    type: "beer",
    icon: "🍺",
    color: "#78350F",
  },
  {
    _id: "698f5fa1d7cae2c5c8248ebb",
    name: "Pilsner",
    slug: "beer-pilsner",
    type: "beer",
    icon: "🍺",
    color: "#EAB308",
  },
  {
    _id: "698f5fa1d7cae2c5c8248ebe",
    name: "Wheat Beer",
    slug: "beer-wheat",
    type: "beer",
    icon: "🍺",
    color: "#FCD34D",
  },
  {
    _id: "698f5fa1d7cae2c5c8248ec1",
    name: "Pale Ale",
    slug: "beer-pale-ale",
    type: "beer",
    icon: "🍺",
    color: "#F59E0B",
  },
  {
    _id: "698f5fa1d7cae2c5c8248ec4",
    name: "Porter",
    slug: "beer-porter",
    type: "beer",
    icon: "🍺",
    color: "#451A03",
  },
  {
    _id: "698f5fa1d7cae2c5c8248ec7",
    name: "Sour Beer",
    slug: "beer-sour",
    type: "beer",
    icon: "🍺",
    color: "#84CC16",
  },
  {
    _id: "698f5fa1d7cae2c5c8248eca",
    name: "Belgian Beer",
    slug: "beer-belgian",
    type: "beer",
    icon: "🍺",
    color: "#F97316",
  },
  {
    _id: "698f5fa1d7cae2c5c8248ecd",
    name: "German Beer",
    slug: "beer-german",
    type: "beer",
    icon: "🍺",
    color: "#1D4ED8",
  },
  {
    _id: "698f5fa1d7cae2c5c8248ed0",
    name: "American Craft",
    slug: "beer-american-craft",
    type: "beer",
    icon: "🍺",
    color: "#7C3AED",
  },
  {
    _id: "698f5fa1d7cae2c5c8248ed3",
    name: "Imported Beer",
    slug: "beer-imported",
    type: "beer",
    icon: "🍺",
    color: "#0891B2",
  },
  {
    _id: "698f5fa1d7cae2c5c8248ed6",
    name: "Local Beer",
    slug: "beer-local",
    type: "beer",
    icon: "🍺",
    color: "#059669",
  },
  {
    _id: "698f5fa1d7cae2c5c8248ed9",
    name: "Low Alcohol",
    slug: "beer-low-alcohol",
    type: "beer",
    icon: "🍺",
    color: "#10B981",
  },
  {
    _id: "698f5fa1d7cae2c5c8248edc",
    name: "Non-Alcoholic Beer",
    slug: "beer-non-alcoholic",
    type: "beer",
    icon: "🍺",
    color: "#06B6D4",
  },
  {
    _id: "698f5fa1d7cae2c5c8248edf",
    name: "Seasonal Beer",
    slug: "beer-seasonal",
    type: "beer",
    icon: "🍺",
    color: "#DC2626",
  },
  {
    _id: "698f5fa1d7cae2c5c8248ee2",
    name: "Limited Edition",
    slug: "beer-limited",
    type: "beer",
    icon: "🍺",
    color: "#7C3AED",
  },
  {
    _id: "698f5fa1d7cae2c5c8248ee5",
    name: "Value Pack",
    slug: "beer-value-pack",
    type: "beer",
    icon: "🍺",
    color: "#4B5563",
  },
  {
    _id: "698f5fa1d7cae2c5c8248ee8",
    name: "Premium Beer",
    slug: "beer-premium",
    type: "beer",
    icon: "🍺",
    color: "#F59E0B",
  },
];

async function seedSubcategories() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/drinksharbour",
    );
    console.log("Connected to MongoDB");

    // Check if Beer category exists
    const beerCategory = await Category.findById(BEER_CATEGORY_ID);
    if (!beerCategory) {
      console.log("Beer category not found with ID:", BEER_CATEGORY_ID);
      process.exit(1);
    }
    console.log("Found Beer category:", beerCategory.name);

    // Create subcategories
    let created = 0;
    let skipped = 0;

    for (const subData of beerSubcategories) {
      const existing = await Category.findById(subData._id);
      if (existing) {
        console.log(`  Skipping ${subData.name} (already exists)`);
        skipped++;
        continue;
      }

      const subcategory = new Category({
        _id: subData._id,
        name: subData.name,
        slug: subData.slug,
        type: subData.type,
        icon: subData.icon,
        color: subData.color,
        parent: BEER_CATEGORY_ID,
        level: 1,
        status: "published",
        alcoholCategory: "alcoholic",
        shortDescription: `${subData.name} beers - Explore our selection of ${subData.name.toLowerCase()} styles`,
        tagline: `Premium ${subData.name}`,
        displayOrder: beerSubcategories.indexOf(subData),
      });

      await subcategory.save();
      console.log(`  Created: ${subData.name}`);
      created++;
    }

    console.log(
      `\nDone! Created ${created} subcategories, skipped ${skipped} existing`,
    );

    // Update Beer category subCategories array
    await Category.findByIdAndUpdate(BEER_CATEGORY_ID, {
      subCategories: beerSubcategories.map((s) => s._id),
    });
    console.log("Updated Beer category subCategories array");

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

seedSubcategories();
