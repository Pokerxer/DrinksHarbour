// backfill-beverage-field-zeros.js
// Clean products that pre-date the Product normalisation hook and still carry
// invalid zero/negative values in min-gated beverage fields — e.g.
// `servingsPerContainer: 0` (`min: 1`) or `volumeMl: 0` (`min: 1`) — or that
// hold beverage-only attributes on a non-beverage type. These used to fail
// PUT /api/products/:id with "some of the values submitted are invalid."
//
// Uses the SAME normalisation as the live save path: it loads each dirty
// document and calls .save(), which runs the Product `pre('validate')` hook
// (models/Product.js). That keeps the backfill and the write path on one
// source of truth. Idempotent — safe to re-run. Dry-run by default; pass
// APPLY=1 to persist changes.
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Product = require("../models/Product");
const { isBeverageType } = require("../constants/productTypes");

const APPLY = process.env.APPLY === "1";
// Mirror models/Product.js NON_BEVERAGE_CLEAR_PATHS so the dirty-check agrees
// with the hook.
const NON_BEVERAGE_CLEAR_PATHS = [
  "appellation",
  "vintage",
  "age",
  "ageStatement",
  "distilleryName",
  "wineryName",
  "breweryName",
  "productionMethod",
  "caskType",
  "finish",
  "servingSize",
  "servingsPerContainer",
  "volumeMl",
  "abv",
  "proof",
  "tastingNotes.nose",
  "tastingNotes.aroma",
  "tastingNotes.palate",
  "tastingNotes.taste",
  "tastingNotes.finish",
  "tastingNotes.mouthfeel",
  "tastingNotes.appearance",
  "tastingNotes.color",
  "servingSuggestions.temperature",
  "servingSuggestions.glassware",
  "servingSuggestions.garnish",
  "servingSuggestions.mixers",
  "foodPairings",
  "flavorProfile",
];

const isSet = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const isDirty = (product) => {
  if (!isBeverageType(product.type)) {
    if (product.isAlcoholic) return true;
    return NON_BEVERAGE_CLEAR_PATHS.some((p) => isSet(product.get(p)));
  }
  const y = new Date().getFullYear();
  if (product.servingsPerContainer != null && product.servingsPerContainer < 1) return true;
  if (product.volumeMl != null && product.volumeMl < 1) return true;
  if (product.vintage != null && (product.vintage < 1800 || product.vintage > y + 1)) return true;
  return false;
};

async function run() {
  await mongoose.connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/drinksharbour"
  );

  const total = await Product.countDocuments({});
  const cursor = Product.find({}).cursor();
  let scanned = 0;
  let cleaned = 0;
  const examples = [];

  for await (const product of cursor) {
    scanned += 1;
    if (!isDirty(product)) continue;

    if (examples.length < 5) {
      examples.push(
        `${product.type} ${product.name}: servingsPerContainer=${product.servingsPerContainer} volumeMl=${product.volumeMl}`
      );
    }
    if (APPLY) {
      await product.save();
    }
    cleaned += 1;
  }

  console.log(`[backfill] scanned ${scanned}/${total} products`);
  console.log(`[backfill] ${APPLY ? "cleaned" : "would clean"} ${cleaned} products`);
  if (examples.length) {
    console.log("[backfill] examples:");
    for (const e of examples) console.log(`  - ${e}`);
  }
  if (!APPLY) {
    console.log("[backfill] dry run — re-run with APPLY=1 to persist.");
  }
  await mongoose.disconnect();
}

run().catch(async (e) => {
  console.error("[backfill] FAILED:", e.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});