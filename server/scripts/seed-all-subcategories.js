// seed-all-subcategories.js - Seed subcategories for all parent categories
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;
const Category = require("../models/Category");

const subcategoryTemplates = {
  wine: [
    "Red Wine",
    "White Wine",
    "Rosé Wine",
    "Sparkling Wine",
    "Champagne",
    "Dessert Wine",
    "Fortified Wine",
    "Organic Wine",
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
    "American Vodka",
    "Imported Vodka",
  ],
  gin: [
    "London Dry Gin",
    "Old Tom Gin",
    "Plymouth Gin",
    "Navy Gin",
    "Sloe Gin",
    "Flavored Gin",
    "Premium Gin",
    "Japanese Gin",
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
    "Campbeltown",
    "Island",
  ],
  bourbon: [
    "Straight Bourbon",
    "Small Batch",
    "Single Barrel",
    "Rye Bourbon",
    "Wheated Bourbon",
    "High Rye",
    "Craft Bourbon",
    "Vintage Bourbon",
  ],
  liqueur: [
    "Coffee Liqueur",
    "Fruit Liqueur",
    "Cream Liqueur",
    "Herbal Liqueur",
    "Chocolate Liqueur",
    "Nut Liqueur",
    "Floral Liqueur",
    "Spiced Liqueur",
  ],
  cider: [
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
};

function generateNewObjectId() {
  return new mongoose.Types.ObjectId();
}

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function seedSubcategories() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/drinksharbour",
    );
    console.log("Connected to MongoDB\n");

    // Get all top-level categories
    const topCategories = await Category.find({ parent: null, level: 0 });
    console.log(`Found ${topCategories.length} top-level categories\n`);

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const category of topCategories) {
      // Skip if already has subcategories
      if (category.subCategories && category.subCategories.length > 0) {
        console.log(
          `⏭️  ${category.name}: Already has ${category.subCategories.length} subcategories`,
        );
        continue;
      }

      // Get template or create generic subcategories
      let subNames = subcategoryTemplates[category.slug];
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

      // Limit to 8 subcategories
      subNames = subNames.slice(0, 8);

      console.log(`\n📁 ${category.name}:`);
      console.log(`  Creating ${subNames.length} subcategories...`);

      const subcategoryIds = [];
      let created = 0;
      let skipped = 0;

      for (let i = 0; i < subNames.length; i++) {
        const subName = subNames[i];
        const subId = generateNewObjectId();

        // Check if exists by slug
        const existingSlug = `${category.slug}-${generateSlug(subName)}`;
        const existing = await Category.findOne({ slug: existingSlug });
        if (existing) {
          subcategoryIds.push(existing._id);
          console.log(`    ⏭️  ${subName} (exists)`);
          skipped++;
          continue;
        }

        const subcategory = new Category({
          _id: new ObjectId(subId),
          name: subName,
          slug: existingSlug,
          type: category.type || "other",
          icon: category.icon || "🍷",
          color: category.color || "#F59E0B",
          parent: category._id,
          level: 1,
          status: "published",
          alcoholCategory: category.alcoholCategory || "alcoholic",
          shortDescription: `${subName} - Premium ${subName.toLowerCase()} selection`,
          tagline: `Explore ${subName}`,
          displayOrder: i,
          showInMenu: true,
        });

        await subcategory.save();
        subcategoryIds.push(subcategory._id);
        console.log(`    ✅ ${subName}`);
        created++;
      }

      // Update parent category
      if (subcategoryIds.length > 0) {
        await Category.findByIdAndUpdate(category._id, {
          subCategories: subcategoryIds,
        });
        console.log(
          `  Updated ${category.name} with ${subcategoryIds.length} subcategories`,
        );
      }

      totalCreated += created;
      totalSkipped += skipped;
    }

    console.log(`\n========================================`);
    console.log(`Done! Created ${totalCreated} subcategories`);
    console.log(`Skipped ${totalSkipped} existing`);
    console.log(`========================================`);

    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

seedSubcategories();
