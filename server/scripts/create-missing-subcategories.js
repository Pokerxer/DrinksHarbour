// create-missing-subcategories.js - Create missing subcategory documents
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;
const Category = require("../models/Category");

const MONGODB_URI =
  "mongodb+srv://jrwaldehzx:NWXdpyCMP7yB7a4N@cluster0.ukrr40p.mongodb.net/drinksharbour?retryWrites=true&w=majority";

// Subcategory name templates by category
const subcategoryTemplates = {
  Bourbon: [
    "Straight Bourbon",
    "Small Batch",
    "Single Barrel",
    "Rye Bourbon",
    "Wheated Bourbon",
    "High Rye",
  ],
  "Rye Whiskey": [
    "Straight Rye",
    "Small Batch Rye",
    "Single Barrel Rye",
    "Canadian Rye",
  ],
  Rum: [
    "White Rum",
    "Dark Rum",
    "Spiced Rum",
    "Aged Rum",
    "Rhum Agricole",
    "Overproof Rum",
    "Flavored Rum",
  ],
  "Rosé Wine": [
    "Provence Rosé",
    "Spanish Rosé",
    "White Zinfandel",
    "Sparkling Rosé",
    "Rosé Champagne",
  ],
  Tequila: ["Blanco", "Reposado", "Añejo", "Extra Añejo", "Mezcal"],
  Brandy: [
    "Cognac",
    "Armagnac",
    "Calvados",
    "Pisco",
    "Metaxa",
    "Spanish Brandy",
    "American Brandy",
    "Premium Brandy",
    "Vintage Brandy",
    "XO Brandy",
  ],
  Water: [
    "Still Water",
    "Sparkling Water",
    "Mineral Water",
    "Spring Water",
    "Alkaline Water",
    "Flavored Water",
    "Large Bottle",
  ],
  "Sparkling Wine": [
    "Prosecco",
    "Cava",
    "Crémant",
    "Champagne Method",
    "Asti",
    "DOCG",
    "Vintage",
    "Non-Vintage",
    "Blanc de Blancs",
  ],
  Gin: [
    "London Dry",
    "Old Tom",
    "Plymouth",
    "Navy Gin",
    "Sloe Gin",
    "Flavored Gin",
  ],
  Vodka: [
    "Classic Vodka",
    "Flavored Vodka",
    "Premium Vodka",
    "Russian Vodka",
    "Polish Vodka",
    "Swedish Vodka",
    "Imported",
  ],
  "White Wine": [
    "Chardonnay",
    "Sauvignon Blanc",
    "Riesling",
    "Pinot Grigio",
    "Gewürztraminer",
    "Viognier",
    "Moscato",
    "Blend",
    "Organic",
    "Premium",
  ],
};

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function createMissingSubcategories() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB\n");

    const allCats = await Category.find({}).lean();
    const categoryById = {};
    allCats.forEach((c) => {
      categoryById[c._id.toString()] = c;
    });

    // Get top-level categories
    const topLevel = allCats.filter((c) => !c.parent && c.level === 0);

    let created = 0;
    let skipped = 0;

    console.log("=== Creating Missing Subcategories ===\n");

    for (const top of topLevel) {
      const topId = top._id.toString();
      const children = allCats.filter(
        (c) => c.parent && c.parent.toString() === topId,
      );

      // Skip if already has children
      if (children.length > 0) {
        continue;
      }

      // Get subCategories IDs
      const subCatIds = top.subCategories || [];
      if (subCatIds.length === 0) {
        continue;
      }

      // Get template for this category
      const template = subcategoryTemplates[top.name] || [
        "Premium",
        "Classic",
        "Budget",
        "Imported",
        "Local",
        "Organic",
        "Value Pack",
        "Limited Edition",
      ];

      console.log(`${top.name}:`);
      console.log(`  Creating ${subCatIds.length} subcategories...`);

      for (let i = 0; i < subCatIds.length; i++) {
        const subId = subCatIds[i];

        // Check if document already exists
        const existing = await Category.findById(subId);
        if (existing) {
          console.log(`    ⏭️  ${existing.name} (exists)`);
          skipped++;
          continue;
        }

        // Get name from template or generate
        const name = template[i] || `Type ${i + 1}`;
        const slug = `${top.slug}-${generateSlug(name)}`;

        const subcategory = new Category({
          _id: new ObjectId(subId),
          name: name,
          slug: slug,
          type: top.type || "other",
          icon: top.icon || "🍷",
          color: top.color || "#F59E0B",
          parent: top._id,
          level: 1,
          status: "published",
          alcoholCategory: top.alcoholCategory || "alcoholic",
          shortDescription: `${name} - Premium ${top.name.toLowerCase()} selection`,
          tagline: `Explore ${name}`,
          displayOrder: i,
          showInMenu: true,
        });

        await subcategory.save();
        console.log(`    ✅ ${name}`);
        created++;
      }
    }

    console.log("\n========================================");
    console.log(`Created ${created} subcategories`);
    console.log(`Skipped ${skipped} existing`);
    console.log("========================================");

    // Verify
    console.log("\n=== Final Verification ===\n");

    const finalCats = await Category.find({}).lean();
    const finalTopLevel = finalCats.filter((c) => !c.parent && c.level === 0);
    const finalWithParent = finalCats.filter((c) => c.parent).length;

    console.log(`Total categories: ${finalCats.length}`);
    console.log(`Top-level: ${finalTopLevel.length}`);
    console.log(`With parent: ${finalWithParent}`);
    console.log();

    let allConnected = true;
    for (const top of finalTopLevel) {
      const children = finalCats.filter(
        (c) => c.parent && c.parent.toString() === top._id.toString(),
      );
      const hasArray = top.subCategories && top.subCategories.length > 0;

      if (children.length === 0 && hasArray) {
        console.log(
          `⚠️  ${top.name}: Array has ${top.subCategories.length} but no children`,
        );
        allConnected = false;
      }
    }

    if (allConnected) {
      console.log("✅ All subcategories are properly connected!");
    }

    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

createMissingSubcategories();
