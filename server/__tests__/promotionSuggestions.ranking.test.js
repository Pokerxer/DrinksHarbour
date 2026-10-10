const test = require("node:test");
const assert = require("node:assert/strict");
const { planSuggestions } = require("../services/promotionSuggestions/planner");
const variant = (key, extra = {}) => ({
  key,
  variantKey: key,
  productName: key,
  warehouseId: "w",
  warehouseName: "Warehouse",
  available: 100,
  protected: 5,
  units: 1,
  price: 100,
  cost: 50,
  currency: "NGN",
  ...extra,
});
const options = { now: new Date("2026-10-10"), canPrice: true, days: 30 };
test("fractional spare stock cannot produce an offer with zero whole-unit capacity", () => {
  const result = planSuggestions({
    ...options,
    baskets: [],
    variants: [variant("a", { available: 5.5 })],
  });
  assert.deepEqual(result.suggestions, []);
});
test("ranking happens before the result cap, retaining stronger opportunities from later locations", () => {
  const variants = Array.from({ length: 501 }, (_, i) => [
    variant(`a:w${i}`, {
      variantKey: "a",
      warehouseId: `w${i}`,
      units: i === 500 ? 1 : 1000,
    }),
    variant(`b:w${i}`, {
      variantKey: "b",
      warehouseId: `w${i}`,
      units: i === 500 ? 1 : 1000,
    }),
  ]).flat();
  const baskets = Array.from({ length: 10 }, (_, i) => ({
    id: String(i),
    keys: i < 4 ? ["a", "b"] : i < 6 ? ["a"] : ["c"],
  }));
  const result = planSuggestions({ ...options, variants, baskets });
  assert.equal(result.truncated, true);
  assert.equal(result.suggestions.length, 500);
  assert.equal(result.suggestions[0].warehouseId, "w500");
  assert.ok(
    result.suggestions.every(
      (s, i, rows) => !i || rows[i - 1].score >= s.score,
    ),
  );
});
