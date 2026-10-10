const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  roundOrder,
  netPrice,
  matchOffers,
} = require("../services/restock/offers");
const now = new Date("2026-10-09"),
  line = { subProductId: "p", sizeId: "s", warehouseId: "w", available: 10 };
const offer = {
  subProductId: "p",
  sizeId: "s",
  unitPrice: 1000,
  packagingQty: 12,
  minQuantity: 1,
};
const list = {
  _id: "l",
  tenant: "t",
  vendor: { _id: "v", tenant: "t", name: "Supplier", isActive: true },
  isActive: true,
  currency: "NGN",
  items: [offer],
};
test("positive need rounds packs; zero does not trigger MOQ", () => {
  assert.deepEqual(roundOrder(30, offer), { quantity: 36, packs: 3 });
  assert.deepEqual(roundOrder(0, { ...offer, minQuantity: 100 }), {
    quantity: 0,
    packs: 0,
  });
  assert.equal(roundOrder(30, { ...offer, maxQuantity: 35 }), null);
});
test("discounts compound using actual unit pricing", () => {
  assert.equal(netPrice({ unitPrice: 1000, discountPercent: 10 }, 10), 810);
});
test("offers require exact variant, tenant vendor and valid window", () => {
  assert.equal(matchOffers(line, [list], "t", now).length, 1);
  for (const altered of [
    { ...list, endDate: "2026-10-01" },
    { ...list, vendor: { ...list.vendor, tenant: "other" } },
    { ...list, items: [{ ...offer, sizeId: "other" }] },
    { ...list, items: [{ ...offer, sizeId: null }] },
  ])
    assert.equal(matchOffers(line, [altered], "t", now).length, 0);
});
test("manual terms supersede auto history only for matching tier", () => {
  const auto = {
    ...list,
    _id: "a",
    autoManaged: true,
    items: [{ ...offer, unitPrice: 1 }],
  };
  const matches = matchOffers(line, [auto, list], "t", now);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].pricelistId, "l");
});
test("a usable automatic offer ranks ahead of a cheaper manual-review tier", () => {
  const { compareOffers } = require("../services/restock/offers");
  const ready = {
    currency: "NGN",
    offerId: "ready",
    leadTimeDays: 7,
    daysOfCover: 10,
    estimatedCost: 500,
    needsManualReview: false,
  };
  const blocked = {
    ...ready,
    offerId: "blocked",
    isPreferred: true,
    estimatedCost: 100,
    needsManualReview: true,
  };
  assert.ok(compareOffers(ready, blocked, "NGN") < 0);
});
test("invalid pack or quantity terms cannot enter recommendations or rounded purchases", () => {
  for (const patch of [
    { packagingQty: 0 },
    { minQuantity: -1 },
    { maxQuantity: NaN },
    { minQuantity: 13, maxQuantity: 12 },
  ]) {
    assert.equal(roundOrder(0, { ...offer, ...patch }), null);
    assert.equal(
      matchOffers(
        line,
        [{ ...list, items: [{ ...offer, ...patch }] }],
        "t",
        now,
      ).length,
      0,
    );
  }
});
