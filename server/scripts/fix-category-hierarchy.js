// fix-category-hierarchy.js - Fix category hierarchy and add subcategories
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;
const Category = require("../models/Category");

const hierarchyConfig = {
  // Whiskey should be parent of Scotch, Bourbon, Rye
  Whiskey: ["Scotch", "Bourbon", "Rye Whiskey"],
  // Create Wine parent for wine types (if not exists, we'll use Red Wine as placeholder)
};

const subcategoryTemplates = {
  Vodka: [
    "Classic Vodka",
    "Flavored Vodka",
    "Premium Vodka",
    "Russian Vodka",
    "Polish Vodka",
    "Swedish Vodka",
    "Imported Vodka",
    "Local Vodka",
  ],
  Gin: [
    "London Dry Gin",
    "Old Tom Gin",
    "Plymouth Gin",
    "Navy Gin",
    "Sloe Gin",
    "Flavored Gin",
    "Japanese Gin",
    "Premium Gin",
  ],
  Rum: [
    "White Rum",
    "Dark Rum",
    "Spiced Rum",
    "Aged Rum",
    "Rhum Agricole",
    "Overproof Rum",
    "Flavored Rum",
    "Premium Rum",
  ],
  Tequila: [
    "Blanco",
    "Reposado",
    "Añejo",
    "Extra Añejo",
    "Mezcal",
    "Premium Tequila",
    "Imported Tequila",
    "Organic Tequila",
  ],
  Brandy: [
    "Cognac",
    "Armagnac",
    "Calvados",
    "Pisco",
    "Metaxa",
    "Spanish Brandy",
    "American Brandy",
    "Premium Brandy",
  ],
  Champagne: [
    "Brut",
    "Extra Brut",
    "Sec",
    "Demi-Sec",
    "Rosé Champagne",
    "Vintage Champagne",
    "Blanc de Blancs",
    "Prestige Cuvée",
  ],
  Scotch: [
    "Single Malt",
    "Blended Scotch",
    "Speyside",
    "Islay",
    "Highland",
    "Lowland",
    "Island",
    "Limited Edition",
  ],
  Bourbon: [
    "Straight Bourbon",
    "Small Batch",
    "Single Barrel",
    "Rye Bourbon",
    "Wheated Bourbon",
    "High Rye",
    "Craft Bourbon",
    "Vintage",
  ],
  "Rye Whiskey": [
    "Straight Rye",
    "Small Batch Rye",
    "Single Barrel Rye",
    "Canadian Rye",
    "Overproof Rye",
    "Flavored Rye",
    "Premium Rye",
    "Limited Rye",
  ],
  "Red Wine": [
    "Cabernet Sauvignon",
    "Merlot",
    "Pinot Noir",
    "Shiraz",
    "Malbec",
    "Zinfandel",
    "Sangiovese",
    "Blend",
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
  ],
  "Rosé Wine": [
    "Provence Rosé",
    "Spanish Rosé",
    "White Zinfandel",
    "Sparkling Rosé",
    "Dark Rosé",
    "Premium Rosé",
    "Organic Rosé",
    "Blend",
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
  ],
};

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fixHierarchy() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/drinksharbour",
    );
    console.log("Connected to MongoDB\n");

    let fixed = 0;
    let subcatsCreated = 0;

    // First, fix hierarchy for Whiskey children
    console.log("=== Fixing Category Hierarchy ===\n");

    const whiskey = await Category.findOne({ name: "Whiskey" });
    if (whiskey) {
      const whiskeyChildren = ["Scotch", "Bourbon", "Rye Whiskey"];
      for (const childName of whiskeyChildren) {
        const child = await Category.findOne({ name: childName });
        if (child && !child.parent) {
          child.parent = whiskey._id;
          child.level = 1;
          await child.save();
          console.log(`  ✅ ${childName} -> Whiskey`);
          fixed++;
        }
      }
    }

    // Now add subcategories to categories that don't have them
    console.log("\n=== Adding Subcategories ===\n");

    const topLevelCats = await Category.find({ parent: null, level: 0 });
    console.log(`Found ${topLevelCats.length} top-level categories\n`);

    for (const cat of topLevelCats) {
      // Check if this category has children
      const children = await Category.find({ parent: cat._id });

      if (children.length > 0) {
        console.log(`⏭️  ${cat.name}: Already has ${children.length} children`);

        // Update subCategories array on parent
        await Category.findByIdAndUpdate(cat._id, {
          subCategories: children.map((c) => c._id),
        });
        continue;
      }

      // Get template for this category
      let subNames = subcategoryTemplates[cat.name];
      if (!subNames) {
        subNames = [
          "Premium",
          "Classic",
          "Budget",
          "Imported",
          "Local",
          "Organic",
          "Value Pack",
          "Limited Edition",
        ];
      }

      console.log(`📁 ${cat.name}:`);
      console.log(`  Creating ${subNames.length} subcategories...`);

      const subIds = [];

      for (let i = 0; i < subNames.length; i++) {
        const subName = subNames[i];
        const subSlug = `${cat.slug}-${generateSlug(subName)}`;

        // Check if subcategory with this slug already exists
        let existing = await Category.findOne({ slug: subSlug });

        if (existing) {
          // Link it to this parent if not already linked
          if (!existing.parent) {
            existing.parent = cat._id;
            existing.level = 1;
            await existing.save();
          }
          subIds.push(existing._id);
          console.log(`    ✅ ${subName} (linked)`);
        } else {
          // Create new subcategory
          const subcategory = new Category({
            _id: new ObjectId(),
            name: subName,
            slug: subSlug,
            type: cat.type || "other",
            icon: cat.icon || "🍷",
            color: cat.color || "#F59E0B",
            parent: cat._id,
            level: 1,
            status: "published",
            alcoholCategory: cat.alcoholCategory || "alcoholic",
            shortDescription: `${subName} - Premium ${cat.name.toLowerCase()} selection`,
            tagline: `Explore ${subName}`,
            displayOrder: i,
            showInMenu: true,
          });

          await subcategory.save();
          subIds.push(subcategory._id);
          console.log(`    ✅ ${subName}`);
          subcatsCreated++;
        }
      }

      // Update parent category
      await Category.findByIdAndUpdate(cat._id, {
        subCategories: subIds,
      });
      console.log(`  Updated ${cat.name} with ${subIds.length} subcategories`);
    }

    console.log("\n========================================");
    console.log(`Fixed ${fixed} hierarchy issues`);
    console.log(`Created ${subcatsCreated} new subcategories`);
    console.log("========================================");

    // Verify final state
    console.log("\n=== Final Verification ===\n");
    const finalCats = await Category.find({ parent: null, level: 0 });
    console.log(`Top-level categories: ${finalCats.length}`);

    for (const cat of finalCats) {
      const subs = await Category.find({ parent: cat._id });
      const subIds = cat.subCategories || [];
      if (subs.length > 0) {
        console.log(`  ✅ ${cat.name}: ${subs.length} subcategories`);
      } else {
        console.log(
          `  ⚠️  ${cat.name}: No subcategories (${subIds.length} in array)`,
        );
      }
    }

    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

fixHierarchy();
