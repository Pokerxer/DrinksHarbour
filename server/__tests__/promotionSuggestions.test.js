const test = require("node:test");
const assert = require("node:assert/strict");
const { affinity } = require("../services/promotionSuggestions/affinity");
const { pricePreview } = require("../services/promotionSuggestions/pricing");
const { occasions } = require("../services/promotionSuggestions/occasions");
const { planSuggestions } = require("../services/promotionSuggestions/planner");
const {
  localDiscountConflict,
} = require("../services/promotionSuggestions/conflicts");
test("current/scheduled discount and bundle/loyalty conflicts require manual pricing", () => {
  const now = new Date("2026-10-10");
  assert.equal(localDiscountConflict({ discount: 10 }, null, now), true);
  assert.equal(
    localDiscountConflict({ bundleDeals: [{ active: true }] }, null, now),
    true,
  );
  assert.equal(
    localDiscountConflict(
      {},
      { discountValue: 5, discountStart: "2026-10-20" },
      now,
    ),
    true,
  );
  assert.equal(
    localDiscountConflict(
      { discount: 5, discountEnd: "2026-01-01" },
      null,
      now,
    ),
    false,
  );
});
const {
  basketAliases,
  orderBasketId,
  groupBaskets,
} = require("../services/promotionSuggestions/baskets");
test("linked POS receipts and original/converted sales share one basket; returned/foreign variants are excluded", () => {
  const aliases = basketAliases([{ _id: "s", convertedFrom: "old" }]);
  assert.equal(
    orderBasketId({ _id: "r", linkedSalesOrder: "old" }, aliases),
    "sales:s",
  );
  const shuffled = basketAliases([
    { _id: "s", convertedFrom: "old" },
    { _id: "old" },
  ]);
  assert.equal(shuffled.get("old"), "sales:s");
  const rows = [1, 0, 2].map((units, i) => ({
    basketId: "sales:s",
    subProductId: i === 2 ? "foreign" : "p",
    sizeId: "v",
    units,
    at: "2026-10-01",
  }));
  assert.deepEqual(
    groupBaskets(
      rows,
      new Set(["p:v"]),
      new Date("2026-09-01"),
      new Date("2026-10-02"),
    ),
    [{ id: "sales:s", keys: ["p:v"] }],
  );
});
test("learns joint baskets rather than mistaking independent popularity for affinity", () => {
  const baskets = [
    ["a", "b"],
    ["a", "b"],
    ["a", "b"],
    ["a", "b"],
    ["a"],
    ["b"],
    ["c"],
    ["c"],
    ["c"],
    ["c"],
  ];
  const result = affinity(baskets.map((keys, i) => ({ id: String(i), keys })));
  assert.equal(result[0].jointBaskets, 4);
  assert.ok(result[0].lift > 1);
  assert.equal(
    affinity(
      Array.from({ length: 5 }, (_, i) => ({
        id: String(i),
        keys: ["a", "b"],
      })),
    ).length,
    0,
  );
});
test("deduplicates repeated basket IDs and duplicate product lines", () => {
  assert.equal(
    affinity([
      { id: "a", keys: ["x", "y", "x"] },
      { id: "a", keys: ["x", "y"] },
    ]).length,
    0,
  );
});
test("oversized excluded baskets cannot manufacture affinity for universally paired products", () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    id: String(i),
    keys: ["a", "b"],
  }));
  rows.push({
    id: "oversized",
    keys: Array.from({ length: 60 }, (_, i) => `p${i}`),
  });
  assert.equal(affinity(rows).length, 0);
});
test("discount preview protects margin and rounds up price, with missing costs/manual evidence", () => {
  const preview = pricePreview(
    [{ price: 100, cost: 70, currency: "NGN" }],
    20,
    25,
  );
  assert.ok(preview.offerPrice >= 70 / 0.75);
  assert.ok(preview.discountPercent <= 6.66);
  assert.equal(
    pricePreview([{ price: 100, cost: null, currency: "NGN" }], 10, 20)
      .offerPrice,
    null,
  );
  assert.equal(
    pricePreview([{ price: 100, cost: 0, currency: "NGN" }], 10, 20).offerPrice,
    null,
  );
  assert.equal(
    pricePreview(
      [
        { price: 100, cost: 50, currency: "NGN" },
        { price: 10, cost: 5, currency: "USD" },
      ],
      10,
      20,
    ).offerPrice,
    null,
  );
});
test("occasions use upcoming Lagos dates and custom days, never guessed movable holidays", () => {
  const result = occasions(new Date("2026-12-24T23:30:00Z"), {
    eventName: "Shop anniversary",
    eventDate: "2026-12-26",
  });
  assert.ok(result.some((e) => e.name === "Christmas" && e.daysAway === 0));
  assert.ok(result.some((e) => e.name === "Shop anniversary"));
  assert.ok(!result.some((e) => /Eid|Easter/.test(e.name)));
});
test("unknown or protected stock cannot become a bundle and costs are redacted without pricing authority", () => {
  const variants = ["a", "b"].map((key) => ({
    key,
    productName: key,
    price: 100,
    cost: 50,
    currency: "NGN",
    available: 30,
    protected: 5,
    units: 3,
    warehouseId: "w",
  }));
  const baskets = Array.from({ length: 10 }, (_, i) => ({
    id: String(i),
    keys: i < 4 ? ["a", "b"] : i < 6 ? ["a"] : ["c"],
  }));
  const args = {
    variants,
    baskets,
    now: new Date("2026-10-10"),
    canPrice: false,
    days: 30,
  };
  const result = planSuggestions(args);
  assert.ok(result.suggestions.some((s) => s.type === "combo"));
  assert.equal(result.suggestions[0].pricing.offerPrice, null);
  assert.ok(!JSON.stringify(result).includes('"cost"'));
  variants[0].available = null;
  assert.ok(!planSuggestions(args).suggestions.some((s) => s.type === "combo"));
});
