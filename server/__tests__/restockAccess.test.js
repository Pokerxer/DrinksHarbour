const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  validateOptions,
  access,
  publicPlan,
} = require("../services/restock/access");
const user = {
  role: "tenant_staff",
  tenant: "t",
  status: "active",
  customPermissions: ["reports:read"],
};
test("planning queries reject pivots, malformed ids and unsupported cover", () => {
  for (const query of [
    { tenantId: "other" },
    { warehouseId: "other" },
    { coverDays: "15" },
    { refresh: "yes" },
    { coverDays: ["14"] },
  ])
    assert.throws(() => validateOptions(query), /Invalid|Unsupported/);
  assert.deepEqual(validateOptions({ coverDays: "30", refresh: "true" }), {
    coverDays: 30,
    warehouseId: "",
    subProductId: "",
    sizeId: "",
    refresh: true,
  });
});
test("own-tenant reporting does not grant purchasing access", () => {
  assert.equal(access(user).reports, true);
  assert.equal(access(user).purchase, false);
  assert.equal(access({ ...user, role: "tenant_owner" }).purchase, true);
  assert.throws(() => access({ ...user, tenant: null }), /Tenant/);
});
test("inventory-only and report-only views redact unauthorized evidence", () => {
  const plan = {
    lines: [
      {
        available: 5,
        threshold: 10,
        productName: "Drink",
        forecast: { model: "ridge" },
        units30: 30,
        dailySales: 1,
        incoming: [{ quantity: 20 }],
        selected: { unitPrice: 1000 },
        alternatives: [],
        suggestedUnits: 42,
        stockoutDate: "tomorrow",
      },
    ],
    groups: [],
  };
  const stock = publicPlan(plan, {
    inventory: true,
    reports: false,
    purchase: false,
  });
  assert.equal(stock.lines[0].units30, undefined);
  assert.equal(stock.lines[0].forecast, undefined);
  assert.equal(stock.lines[0].available, 5);
  assert.equal(stock.groups, undefined);
  const report = publicPlan(plan, {
    inventory: false,
    reports: true,
    purchase: false,
  });
  assert.equal(report.lines[0].available, undefined);
  assert.equal(report.lines[0].incoming, undefined);
  assert.equal(report.lines[0].stockoutDate, undefined);
  assert.equal(report.lines[0].selected, undefined);
  assert.equal(report.lines[0].units30, 30);
});
test("purchasing terms never leak stock or demand evidence through nested offers", () => {
  const offer = {
    quantity: 12,
    estimatedCost: 1200,
    unitPrice: 100,
    replenishment: { forecastUnits: 21, availableAfterCommitments: 5 },
    suggestedUnits: 12,
    daysOfCover: 5,
    incomingUnits: 10,
  };
  const plan = {
    lines: [{ selected: offer, alternatives: [offer] }],
    groups: [{ estimatedCost: 1200 }],
  };
  for (const a of [
    { purchase: true, inventory: false, reports: true },
    { purchase: true, inventory: true, reports: false },
  ]) {
    const publicOffer = publicPlan(plan, a).lines[0].selected;
    assert.equal(publicOffer.replenishment, undefined);
    assert.equal(publicOffer.suggestedUnits, undefined);
    assert.equal(publicOffer.quantity, 0);
    assert.equal(publicOffer.unitPrice, 100);
    assert.equal(publicPlan(plan, a).groups, undefined);
  }
  assert.equal(offer.quantity, 12);
});
