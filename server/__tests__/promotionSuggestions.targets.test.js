const test = require("node:test");
const assert = require("node:assert/strict");
const {
  promotionMatches,
} = require("../services/promotionSuggestions/conflicts");
const target = {
  subProductId: "p",
  sizeId: "75cl",
  product: { category: { _id: "wine" }, brand: "brand-a" },
};
test("unrelated category and brand promotions do not block an otherwise priceable offer", () => {
  assert.equal(
    promotionMatches(
      { applyTo: "specific_categories", categories: ["beer"] },
      target,
    ),
    false,
  );
  assert.equal(
    promotionMatches(
      { applyTo: "specific_brands", brands: ["brand-b"] },
      target,
    ),
    false,
  );
  assert.equal(
    promotionMatches(
      { applyTo: "specific_categories", categories: ["wine"] },
      target,
    ),
    true,
  );
  assert.equal(
    promotionMatches(
      { applyTo: "specific_brands", brands: [{ _id: "brand-a" }] },
      target,
    ),
    true,
  );
});
test("product-targeted promotion respects exact size restrictions and explicit exclusions", () => {
  const promotion = {
    applyTo: "specific_products",
    subProducts: ["p"],
    sizes: ["1L"],
  };
  assert.equal(promotionMatches(promotion, target), false);
  assert.equal(
    promotionMatches({ ...promotion, sizes: ["75cl"] }, target),
    true,
  );
  assert.equal(
    promotionMatches({ applyTo: "all", excludedSubProducts: ["p"] }, target),
    false,
  );
  assert.equal(
    promotionMatches({ applyTo: "all", excludedSizes: ["75cl"] }, target),
    false,
  );
  assert.equal(
    promotionMatches(
      { ...promotion, subProducts: ["other"], sizes: ["75cl"] },
      target,
    ),
    false,
  );
});
test("unresolved category or brand targeting remains a manual stacking review", () => {
  assert.equal(
    promotionMatches(
      { applyTo: "specific_categories", categories: ["wine"] },
      { ...target, product: null },
    ),
    true,
  );
  assert.equal(
    promotionMatches(
      { applyTo: "specific_brands", brands: ["brand-a"] },
      { ...target, product: {} },
    ),
    true,
  );
});
