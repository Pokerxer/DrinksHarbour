const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildSummaries } = require("../services/restock/summaries");
const now = new Date("2026-10-09T12:00:00Z");
test("tenant forecast combines known demand without guessing local allocation or duplicating purchases", () => {
  const rows = Array.from({ length: 120 }, (_, i) => ({
    subProductId: "p",
    sizeId: "s",
    warehouseId: i % 2 ? "w" : "",
    units: 2 + i * 0.2,
    at: new Date(now.getTime() - (120 - i) * 86400000).toISOString(),
  }));
  const e = {
    products: [{ _id: "p", name: "Drink" }],
    snapshots: new Map([
      [
        "p",
        {
          stock: [
            { sizeId: "s", available: 10 },
            { sizeId: "s", available: 5 },
          ],
        },
      ],
    ]),
    sales: { rows, uncertain: new Set() },
  };
  const summary = buildSummaries(e, now)[0];
  assert.equal(summary.forecast.method, "trained_forecast");
  assert.equal(summary.available, 15);
  assert.equal(summary.summary, true);
  assert.equal(summary.warehouseId, "");
  assert.equal(summary.selected, undefined);
  assert.equal(summary.suggestedUnits, undefined);
  assert.equal(
    summary.units30,
    rows.slice(-30).reduce((n, r) => n + r.units, 0),
  );
});
test("unknown totals stay unknown instead of adding only the known stock", () => {
  const e = {
    products: [{ _id: "p", name: "Drink" }],
    snapshots: new Map([
      [
        "p",
        {
          stock: [
            { sizeId: "s", available: 10 },
            { sizeId: "s", available: null },
          ],
        },
      ],
    ]),
    sales: { rows: [], uncertain: new Set() },
  };
  assert.equal(buildSummaries(e, now)[0].available, null);
});
test("complete empty sales have zero totals and a clear no-sales status", () => {
  const e = {
    products: [
      {
        _id: "p",
        name: "Drink",
        imagesOverride: [{ url: "https://example.com/tenant.jpg" }],
      },
    ],
    snapshots: new Map([["p", { stock: [{ sizeId: "s", available: 10 }] }]]),
    sales: { rows: [], uncertain: new Set() },
  };
  const line = buildSummaries(e, now)[0];
  assert.equal(line.units30, 0);
  assert.equal(line.units7, 0);
  assert.equal(line.dailySales, 0);
  assert.equal(line.salesDataStatus, "none");
  assert.equal(line.productImage, "https://example.com/tenant.jpg");
  e.sales.uncertain.add("p");
  const incomplete = buildSummaries(e, now)[0];
  assert.equal(incomplete.units30, null);
  assert.equal(incomplete.salesDataStatus, "incomplete_history");
});
