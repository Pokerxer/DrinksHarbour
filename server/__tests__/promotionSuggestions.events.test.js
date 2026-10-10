const test = require("node:test");
const assert = require("node:assert/strict");
const { occasions } = require("../services/promotionSuggestions/occasions");
const { planSuggestions } = require("../services/promotionSuggestions/planner");
test("world drinks dates follow verified fixed and weekday rules", () => {
  const may = occasions(new Date("2026-05-01"));
  assert.equal(
    may.find((e) => e.name === "World Whisky Day")?.date,
    "2026-05-16",
  );
  assert.equal(
    may.find((e) => e.name === "International Tea Day")?.date,
    "2026-05-21",
  );
  assert.equal(may.find((e) => e.name === "World Gin Day")?.date, "2026-06-13");
  assert.equal(
    occasions(new Date("2027-05-01")).find((e) => e.name === "World Whisky Day")
      ?.date,
    "2027-05-15",
  );
  assert.equal(
    occasions(new Date("2026-07-01")).find(
      (e) => e.name === "International Beer Day",
    )?.date,
    "2026-08-07",
  );
  assert.equal(
    occasions(new Date("2026-09-01")).find(
      (e) => e.name === "International Coffee Day",
    )?.date,
    "2026-10-01",
  );
});
test("published Champagne date is not extrapolated and Beaujolais uses third Thursday", () => {
  const october = occasions(new Date("2026-10-10"));
  const champagne = october.find((e) => e.name === "Champagne Day");
  assert.equal(champagne?.date, "2026-10-23");
  assert.ok(champagne.sourceUrl.startsWith("https://"));
  assert.equal(
    october.find((e) => e.name === "Beaujolais Nouveau Day")?.date,
    "2026-11-19",
  );
  assert.ok(
    !occasions(new Date("2027-10-10")).some((e) => e.name === "Champagne Day"),
  );
});
const variant = (key, type, name = key) => ({
  key,
  productName: name,
  drinkType: type,
  catalogueName: name,
  warehouseId: "w",
  available: 100,
  protected: 5,
  units: 1,
  currency: "NGN",
  price: 100,
  cost: 50,
});
test("automatic themed events apply only to relevant drinks, including non-alcoholic types", () => {
  const plan = planSuggestions({
    variants: [
      variant("whisky", "scotch"),
      variant("tea", "green_tea"),
      variant("beer", "ginger_beer"),
    ],
    baskets: [],
    days: 30,
    canPrice: true,
    now: new Date("2026-05-01"),
  });
  assert.equal(
    plan.suggestions.find((s) => s.products[0].key === "whisky").occasion?.name,
    "World Whisky Day",
  );
  assert.equal(
    plan.suggestions.find((s) => s.products[0].key === "tea").occasion?.name,
    "International Tea Day",
  );
  assert.equal(
    plan.suggestions.find((s) => s.products[0].key === "beer").occasion,
    null,
  );
});
test("choosing a known drinks event retains its verified identity and product relevance", () => {
  const plan = planSuggestions({
    variants: [variant("champagne", "champagne"), variant("gin", "gin")],
    baskets: [],
    days: 30,
    canPrice: true,
    now: new Date("2026-10-10"),
    eventName: "Champagne Day",
    eventDate: "2026-10-23",
  });
  assert.equal(
    plan.suggestions.find((s) => s.products[0].key === "champagne").occasion
      ?.kind,
    "drinks",
  );
  assert.equal(
    plan.suggestions.find((s) => s.products[0].key === "gin").occasion,
    null,
  );
  assert.equal(
    plan.occasions.filter((e) => e.name === "Champagne Day").length,
    1,
  );
});
