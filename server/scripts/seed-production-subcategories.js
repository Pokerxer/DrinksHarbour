// seed-production-subcategories.js - Create subcategories for production MongoDB
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;
const Category = require("../models/Category");

const subcategoryTemplates = {
  beer: [
    "Lager",
    "Ale",
    "IPA",
    "Stout",
    "Pilsner",
    "Wheat Beer",
    "Pale Ale",
    "Porter",
  ],
  whiskey: [
    "Scotch",
    "Bourbon",
    "Rye Whiskey",
    "Irish Whiskey",
    "Canadian Whiskey",
    "Japanese Whiskey",
    "Single Malt",
    "Blended",
  ],
  vodka: [
    "Classic Vodka",
    "Flavored Vodka",
    "Premium Vodka",
    "Russian Vodka",
    "Polish Vodka",
    "Swedish Vodka",
    "Imported Vodka",
    "Local Vodka",
  ],
  gin: [
    "London Dry Gin",
    "Old Tom Gin",
    "Plymouth Gin",
    "Navy Gin",
    "Sloe Gin",
    "Flavored Gin",
    "Japanese Gin",
    "Premium Gin",
  ],
  rum: [
    "White Rum",
    "Dark Rum",
    "Spiced Rum",
    "Aged Rum",
    "Rhum Agricole",
    "Overproof Rum",
    "Flavored Rum",
    "Premium Rum",
  ],
  tequila: [
    "Blanco",
    "Reposado",
    "Añejo",
    "Extra Añejo",
    "Mezcal",
    "Premium Tequila",
    "Imported Tequila",
    "Organic Tequila",
  ],
  brandy: [
    "Cognac",
    "Armagnac",
    "Calvados",
    "Pisco",
    "Metaxa",
    "Spanish Brandy",
    "American Brandy",
    "Premium Brandy",
  ],
  champagne: [
    "Brut",
    "Extra Brut",
    "Sec",
    "Demi-Sec",
    "Rosé Champagne",
    "Vintage Champagne",
    "Blanc de Blancs",
    "Prestige Cuvée",
  ],
  scotch: [
    "Single Malt",
    "Blended Scotch",
    "Speyside",
    "Islay",
    "Highland",
    "Lowland",
    "Island",
    "Limited Edition",
  ],
  bourbon: [
    "Straight Bourbon",
    "Small Batch",
    "Single Barrel",
    "Rye Bourbon",
    "Wheated Bourbon",
    "High Rye",
    "Craft Bourbon",
    "Vintage",
  ],
  "red-wine": [
    "Cabernet Sauvignon",
    "Merlot",
    "Pinot Noir",
    "Shiraz",
    "Malbec",
    "Zinfandel",
    "Sangiovese",
    "Blend",
  ],
  "white-wine": [
    "Chardonnay",
    "Sauvignon Blanc",
    "Riesling",
    "Pinot Grigio",
    "Gewürztraminer",
    "Viognier",
    "Moscato",
    "Blend",
  ],
  "rose-wine": [
    "Provence Rosé",
    "Spanish Rosé",
    "White Zinfandel",
    "Sparkling Rosé",
    "Dark Rosé",
    "Premium Rosé",
    "Organic Rosé",
    "Blend",
  ],
  "sparkling-wine": [
    "Prosecco",
    "Cava",
    "Crémant",
    "Champagne Method",
    "Asti",
    "DOCG",
    "Vintage",
    "Non-Vintage",
  ],
  rum: [
    "White Rum",
    "Dark Rum",
    "Spiced Rum",
    "Aged Rum",
    "Rhum Agricole",
    "Overproof Rum",
    "Flavored Rum",
    "Premium Rum",
  ],
  soju: [
    "Premium Soju",
    "Flavored Soju",
    "Classic Soju",
    "Imported Soju",
    "Local Soju",
    "Organic Soju",
    "Value Pack",
    "Limited Edition",
  ],
  baijiu: [
    "Premium Baijiu",
    "Classic Baijiu",
    "Moutai",
    "Imported Baijiu",
    "Local Baijiu",
    "Aged Baijiu",
    "Flavored Baijiu",
    "Value Pack",
  ],
  shochu: [
    "Premium Shochu",
    "Classic Shochu",
    "Imu Shochu",
    "Kokuto Shochu",
    "Barley Shochu",
    "Sweet Shochu",
    "Flavored Shochu",
    "Value Pack",
  ],
  liqueurs: [
    "Coffee Liqueur",
    "Fruit Liqueur",
    "Cream Liqueur",
    "Herbal Liqueur",
    "Chocolate Liqueur",
    "Nut Liqueur",
    "Floral Liqueur",
    "Spiced Liqueur",
  ],
  "cider-perry": [
    "Apple Cider",
    "Pear Cider",
    "Flavored Cider",
    "Sparkling Cider",
    "Dry Cider",
    "Sweet Cider",
    "Traditional Cider",
    "Artisan Cider",
  ],
  coffee: [
    "Espresso",
    "Cold Brew",
    "Latte",
    "Cappuccino",
    "Mocha",
    "Americano",
    "Flat White",
    "Cold Coffee",
  ],
  tea: [
    "Green Tea",
    "Black Tea",
    "Herbal Tea",
    "White Tea",
    "Oolong Tea",
    "Chai Tea",
    "Matcha",
    "Iced Tea",
  ],
  "soft-drinks": [
    "Cola",
    "Lemon Lime",
    "Ginger Ale",
    "Tonic Water",
    "Soda Water",
    "Energy Drink",
    "Flavored Soda",
    "Premium Soda",
  ],
  soda: [
    "Cola",
    "Lemon Lime",
    "Ginger Ale",
    "Tonic Water",
    "Soda Water",
    "Energy Drink",
    "Flavored Soda",
    "Premium Soda",
  ],
  juice: [
    "Orange Juice",
    "Apple Juice",
    "Grape Juice",
    "Berry Juice",
    "Tropical Juice",
    "Mixed Fruit",
    "Cold Pressed",
    "Organic Juice",
  ],
  water: [
    "Still Water",
    "Sparkling Water",
    "Mineral Water",
    "Spring Water",
    "Alkaline Water",
    "Flavored Water",
    "Large Bottle",
    "Small Bottle",
  ],
  milk: [
    "Fresh Milk",
    "Chocolate Milk",
    "Flavored Milk",
    "Oat Milk",
    "Almond Milk",
    "Soy Milk",
    "Coconut Milk",
    "Premium Milk",
  ],
  "yogurt-drink": [
    "Probiotic Yogurt",
    "Flavored Yogurt",
    "Greek Yogurt",
    "Drinkable Yogurt",
    "Kefir",
    "Ayran",
    "Lassi",
    "Premium Yogurt",
  ],
  "functional-drinks": [
    "Energy Drinks",
    "Sports Drinks",
    "Hydration Drinks",
    "Vitamin Drinks",
    "Protein Drinks",
    "Wellness Drinks",
    "Herbal Drinks",
    "Premium Functional",
  ],
  syrup: [
    "Coffee Syrup",
    "Cocktail Syrup",
    "Flavored Syrup",
    "Sweetened Syrup",
    "Unsweetened Syrup",
    "Organic Syrup",
    "Premium Syrup",
    "Value Pack",
  ],
  bitters: [
    "Orange Bitters",
    "Angostura Bitters",
    "Peychauds Bitters",
    "Aromatic Bitters",
    "Chocolate Bitters",
    "Fruit Bitters",
    "Herbal Bitters",
    "Craft Bitters",
  ],
};

const defaultSubs = [
  "Premium",
  "Classic",
  "Budget",
  "Imported",
  "Local",
  "Organic",
  "Value Pack",
  "Limited Edition",
];

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function seed() {
  try {
    // Connect to PRODUCTION MongoDB
    const MONGODB_URI =
      "mongodb+srv://jrwaldehzx:NWXdpyCMP7yB7a4N@cluster0.ukrr40p.mongodb.net/drinksharbour?retryWrites=true&w=majority";
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to PRODUCTION MongoDB\n");

    // Get all top-level categories
    const topCategories = await Category.find({ parent: null, level: 0 });
    console.log(`Found ${topCategories.length} top-level categories\n`);

    let totalCreated = 0;
    let totalLinked = 0;

    for (const cat of topCategories) {
      // Check existing subcategories count
      const existingSubs = await Category.find({ parent: cat._id });

      // Get subcategory IDs from parent category's subCategories array
      let subIdsFromParent = cat.subCategories || [];

      // Find categories that should be children based on subCategories IDs
      const validChildIds = [];

      if (subIdsFromParent.length > 0) {
        // Try to find those categories - they might not exist yet
        for (const subId of subIdsFromParent) {
          const existing = await Category.findById(subId);
          if (existing) {
            validChildIds.push(existing._id);
          }
        }
      }

      // If we have fewer than 8 subcategories, create more
      const currentCount = Math.max(existingSubs.length, validChildIds.length);

      if (currentCount >= 8) {
        console.log(
          `✅ ${cat.name}: Already has ${currentCount} subcategories`,
        );

        // Ensure the parent field is set on children
        for (const sub of existingSubs) {
          if (!sub.parent) {
            sub.parent = cat._id;
            sub.level = 1;
            await sub.save();
            totalLinked++;
          }
        }

        // Update parent's subCategories array
        await Category.findByIdAndUpdate(cat._id, {
          subCategories: existingSubs.map((s) => s._id),
        });
        continue;
      }

      console.log(`📁 ${cat.name}:`);
      console.log(
        `  Current: ${currentCount}, Creating ${8 - currentCount} more...`,
      );

      // Get template or use default
      let subNames = subcategoryTemplates[cat.slug] || defaultSubs;

      const newSubIds = [];
      let created = 0;

      for (let i = 0; i < 8; i++) {
        const subName = subNames[i % subNames.length];
        const subSlug = `${cat.slug}-${generateSlug(subName)}`;

        // Check if exists
        let existing = await Category.findOne({ slug: subSlug });

        if (existing) {
          // Link to parent if not already linked
          if (!existing.parent) {
            existing.parent = cat._id;
            existing.level = 1;
            await existing.save();
            totalLinked++;
          }
          newSubIds.push(existing._id);
          console.log(`    ✅ ${existing.name} (linked)`);
        } else if (existingSubs.length + created < 8) {
          // Create new
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
          newSubIds.push(subcategory._id);
          console.log(`    ✅ ${subName}`);
          created++;
          totalCreated++;
        }
      }

      // Update parent
      const allSubIds = [...existingSubs.map((s) => s._id), ...newSubIds];
      await Category.findByIdAndUpdate(cat._id, {
        subCategories: allSubIds.slice(0, 8),
      });

      if (created > 0) {
        console.log(`  Created ${created} new subcategories`);
      }
    }

    console.log("\n========================================");
    console.log(`Created ${totalCreated} subcategories`);
    console.log(`Linked ${totalLinked} existing categories`);
    console.log("========================================\n");

    // Final verification
    console.log("=== Final State ===\n");
    const allCats = await Category.find({});
    const topLevel = await Category.find({ parent: null, level: 0 });
    const withSubs = [];

    for (const cat of topLevel) {
      const subs = await Category.find({ parent: cat._id });
      const subCount = cat.subCategories?.length || 0;
      withSubs.push({
        name: cat.name,
        childrenCount: subs.length,
        arrayCount: subCount,
      });
    }

    console.log(`Total categories: ${allCats.length}`);
    console.log(`Top-level: ${topLevel.length}`);
    console.log(`\nCategories with subcategories:`);

    for (const c of withSubs) {
      const status = c.childrenCount >= 8 ? "✅" : "⚠️";
      console.log(
        `  ${status} ${c.name}: ${c.childrenCount} children, ${c.arrayCount} in array`,
      );
    }

    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

seed();
