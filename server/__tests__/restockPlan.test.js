const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildPlan } = require("../services/restock/plan");
const now = new Date("2026-10-09T10:00:00Z");
function evidence() {
  const rows = [];
  for (let i = 0; i < 40; i++)
    rows.push({
      subProductId: "p",
      sizeId: "s",
      warehouseId: "w",
      units: 2,
      at: new Date(now.getTime() - (i + 1) * 86400000).toISOString(),
    });
  return {
    tenantId: "t",
    products: [{ _id: "p", name: "Drink", lowStockThreshold: 0 }],
    warehouses: [{ _id: "w", name: "Main" }],
    snapshots: new Map([
      [
        "p",
        {
          stock: [
            {
              sizeId: "s",
              warehouseId: "w",
              warehouseName: "Main",
              sizeName: "Bottle",
              available: 10,
              threshold: 0,
            },
          ],
        },
      ],
    ]),
    sales: { rows, uncertain: new Set() },
    purchases: [],
    transfers: [],
    pricelists: [
      {
        _id: "list",
        tenant: "t",
        isActive: true,
        currency: "NGN",
        vendor: { _id: "v", tenant: "t", name: "Supplier", isActive: true },
        items: [
          {
            subProductId: "p",
            sizeId: "s",
            unitPrice: 2000,
            packagingQty: 12,
            leadTimeDays: 7,
          },
        ],
      },
    ],
  };
}
test("plan uses actual rounded quantities for cost and destination groups", () => {
  const plan = buildPlan(evidence(), { now, coverDays: 14, purchasing: true });
  assert.equal(plan.lines[0].selected.quantity, 36);
  assert.equal(plan.groups[0].estimatedCost, 72000);
  assert.equal(plan.groups[0].warehouseId, "w");
});
test("supply to another warehouse cannot suppress a local shortage", () => {
  const e = evidence();
  e.purchases = [
    {
      type: "po",
      status: "confirmed",
      warehouse: "other",
      expectedArrival: "2026-10-10",
      items: [{ subProductId: "p", sizeId: "s", quantity: 100 }],
    },
  ];
  const plan = buildPlan(e, { now, coverDays: 14, purchasing: true });
  assert.equal(plan.lines[0].selected.quantity, 36);
});
test("unassigned sales prevents a confident location recommendation", () => {
  const e = evidence();
  e.sales.rows.push({ ...e.sales.rows[0], warehouseId: "", units: 3 });
  const line = buildPlan(e, {
    now,
    coverDays: 14,
    purchasing: true,
  }).lines.find((l) => l.warehouseId === "w");
  assert.equal(line.forecast.method, "insufficient_history");
  assert.equal(line.selected.quantity, 0);
  assert.equal(line.selected.needsManualReview, true);
  assert.ok(line.limitations.some((s) => s.includes("location")));
});
test("report plan does not expose offers, vendor costs or purchasing groups", () => {
  const plan = buildPlan(evidence(), { now, coverDays: 14, purchasing: false });
  assert.equal(plan.groups, undefined);
  assert.equal(plan.lines[0].alternatives, undefined);
  assert.ok(!JSON.stringify(plan).includes("unitPrice"));
});
test("changing supplier changes horizon, cost and urgency; currencies separate", () => {
  const e = evidence();
  e.pricelists.push({
    ...e.pricelists[0],
    _id: "fast",
    vendor: { _id: "fastv", tenant: "t", name: "Fast", isActive: true },
    items: [
      {
        ...e.pricelists[0].items[0],
        leadTimeDays: 2,
        isPreferred: true,
        unitPrice: 2500,
      },
    ],
  });
  const line = buildPlan(e, { now, coverDays: 14, purchasing: true }).lines[0];
  assert.equal(line.selected.vendorId, "fastv");
  assert.equal(line.selected.quantity, 36);
  assert.equal(line.alternatives.length, 2);
});
test("known supplier terms remain visible when history cannot support quantities", () => {
  const e = evidence();
  e.sales.rows = e.sales.rows.slice(0, 5);
  const plan = buildPlan(e, { now, coverDays: 14, purchasing: true }),
    line = plan.lines[0];
  assert.equal(line.alternatives.length, 1);
  assert.equal(line.selected.quantity, 0);
  assert.equal(line.selected.needsManualReview, true);
  assert.equal(plan.groups.length, 0);
});
test("negative stock remains urgent when local sales cannot support forecasting", () => {
  const e = evidence();
  e.sales.rows = [];
  for (const snapshot of e.snapshots.values())
    for (const stock of snapshot.stock) stock.available = -2;
  const plan = buildPlan(e, { now, coverDays: 14 });
  assert.equal(plan.lines[0].urgency, "urgent");
  assert.equal(plan.lines[0].suggestedUnits, null);
});
test("zero stock stays urgent even when recorded demand is zero, without inventing an order", () => {
  const e = evidence();
  e.sales.rows = e.sales.rows.map((r) => ({ ...r, units: 0 }));
  for (const snapshot of e.snapshots.values())
    for (const stock of snapshot.stock) stock.available = 0;
  const plan = buildPlan(e, { now, coverDays: 14, purchasing: true });
  assert.equal(plan.lines[0].urgency, "urgent");
  assert.equal(plan.lines[0].suggestedUnits, 0);
  assert.equal(plan.groups.length, 0);
});
test("pending internal supply requires transfer review before suggesting a duplicate supplier order", () => {
  const e = evidence();
  e.warehouses.push({ _id: "hub", name: "Hub" });
  e.transfers = [
    {
      _id: "transfer",
      tenant: "t",
      status: "in_transit",
      sourceWarehouse: "hub",
      destinationWarehouse: "w",
      dispatchedAt: "2026-10-08",
      items: [
        {
          subProductId: "p",
          sizeId: "s",
          quantity: 50,
          receivedQty: 0,
          transferredQty: 0,
        },
      ],
    },
  ];
  const plan = buildPlan(e, { now, coverDays: 14, purchasing: true });
  assert.equal(plan.lines[0].transferPlan.nextStep, "follow_up");
  assert.equal(plan.lines[0].selected.quantity, 0);
  assert.equal(plan.lines[0].selected.needsManualReview, true);
  assert.equal(plan.groups.length, 0);
  assert.equal(plan.lines[0].suggestedUnits, 32);
});
test("warehouse filtering retains safe donors from other locations", () => {
  const e = evidence();
  e.warehouses.push({ _id: "hub", name: "Hub" });
  e.snapshots.get("p").stock.push({
    sizeId: "s",
    warehouseId: "hub",
    warehouseName: "Hub",
    available: 100,
    threshold: 10,
  });
  const plan = buildPlan(e, { now, warehouseId: "w", coverDays: 14 });
  assert.equal(plan.lines.length, 1);
  assert.equal(plan.lines[0].warehouseId, "w");
  assert.equal(plan.lines[0].transferPlan.sources[0].sourceWarehouseId, "hub");
  assert.equal(plan.lines[0].transferPlan.sources[0].recommendedUnits, 36);
});
test("pending destination with no balance remains unknown rather than replenished", () => {
  const e = evidence();
  e.warehouses.push({ _id: "new", name: "New" });
  e.transfers = [
    {
      _id: "tr",
      tenant: "t",
      status: "confirmed",
      sourceWarehouse: "w",
      destinationWarehouse: "new",
      items: [{ subProductId: "p", sizeId: "s", quantity: 4 }],
    },
  ];
  const line = buildPlan(e, { now }).lines.find((l) => l.warehouseId === "new");
  assert.equal(line.available, null);
  assert.equal(line.transferPlan.nextStep, "verify_stock");
  assert.equal(line.transferPlan.pendingUnits, 4);
  assert.deepEqual(line.transferPlan.sources, []);
});
test("pending source without a stock ledger is visible with outgoing evidence", () => {
  const e = evidence();
  e.warehouses.push({ _id: "hub", name: "Hub" });
  e.transfers = [
    {
      _id: "tr",
      tenant: "t",
      status: "confirmed",
      sourceWarehouse: "hub",
      destinationWarehouse: "w",
      items: [{ subProductId: "p", sizeId: "s", quantity: 4 }],
    },
  ];
  const source = buildPlan(e, { now }).lines.find(
    (l) => l.warehouseId === "hub",
  );
  assert.equal(source?.available, null);
  assert.equal(source?.transferPlan.outgoing[0].transferId, "tr");
  assert.match(source?.transferPlan.outgoing[0].followUpReason, /unknown/);
});
test("no recorded sales is zero, while missing source evidence remains unknown", () => {
  const e = evidence();
  e.sales.rows = [];
  let line = buildPlan(e, { now }).lines[0];
  assert.equal(line.units30, 0);
  assert.equal(line.dailySales, 0);
  assert.equal(line.forecast.method, "insufficient_history");
  e.sales.uncertain.add("p");
  line = buildPlan(e, { now }).lines[0];
  assert.equal(line.units30, null);
});
test("unassigned sales cannot be displayed as zero local sales", () => {
  const e = evidence();
  e.sales.rows = e.sales.rows.map((r) => ({ ...r, warehouseId: "" }));
  const line = buildPlan(e, { now }).lines.find((l) => l.warehouseId === "w");
  assert.equal(line.units30, null);
});
test("missing-location sales stay limitations rather than duplicate stock locations", () => {
  const e = evidence();
  e.sales.rows.push({ ...e.sales.rows[0], warehouseId: "", units: 3 });
  const plan = buildPlan(e, { now });
  assert.equal(plan.lines.length, 1);
  assert.equal(plan.lines[0].warehouseId, "w");
  assert.equal(plan.lines[0].salesDataStatus, "incomplete_location");
  assert.equal(plan.lines[0].units30, null);
  assert.equal(plan.summaries[0].units30, 63);
});

test("supplier tier limits stay visible for manual review instead of becoming a missing match", () => {
  const e = evidence();
  e.pricelists[0].items[0].maxQuantity = 12;
  const plan = buildPlan(e, { now, coverDays: 14, purchasing: true });
  const offer = plan.lines[0].selected;
  assert.ok(offer);
  assert.equal(offer.quantity, 0);
  assert.equal(offer.needsManualReview, true);
  assert.match(offer.manualReviewReason, /maximum|tier/i);
  assert.equal(plan.groups.length, 0);
});
test("negative warehouse balances are verified before automatic supplier ordering", () => {
  const e = evidence();
  e.snapshots.get("p").stock[0].available = -2;
  const offer = buildPlan(e, { now, purchasing: true }).lines[0].selected;
  assert.equal(offer.quantity, 0);
  assert.equal(offer.needsManualReview, true);
  assert.match(offer.manualReviewReason, /negative|balance/i);
});
test("unconfirmed purchases and unposted receipts require follow-up before another supplier order", () => {
  for (const items of [
    [{ subProductId: "p", sizeId: "s", quantity: 100 }],
    [
      {
        subProductId: "p",
        sizeId: "s",
        quantity: 100,
        receivedQty: 100,
        postedQty: 0,
      },
    ],
  ]) {
    const e = evidence();
    e.purchases = [
      { _id: "po", status: "confirmed", type: "po", warehouse: "w", items },
    ];
    const offer = buildPlan(e, { now, purchasing: true }).lines[0].selected;
    assert.equal(offer.quantity, 0);
    assert.equal(offer.needsManualReview, true);
    assert.match(offer.manualReviewReason, /purchase|posting/i);
  }
});
