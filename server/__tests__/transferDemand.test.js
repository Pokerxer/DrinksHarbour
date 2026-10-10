const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildPlan } = require("../services/restock/plan");
const now = new Date("2026-10-09T10:00:00Z");
const item = {
  subProductId: "p",
  sizeId: "s",
  quantity: 12,
  receivedQty: 12,
  returnedQty: 2,
};
const doc = {
  _id: "tr",
  tenant: "t",
  transferNumber: "TR-1",
  status: "completed",
  sourceWarehouse: "hub",
  destinationWarehouse: "shop",
  completedDate: "2026-10-01",
  items: [item],
};
function evidence(changes = {}) {
  return {
    tenantId: "t",
    products: [{ _id: "p", name: "Wine" }],
    warehouses: ["hub", "shop"].map((_id) => ({ _id, name: _id })),
    snapshots: new Map([
      [
        "p",
        {
          stock: ["hub", "shop"].map((warehouseId) => ({
            warehouseId,
            sizeId: "s",
            stockRecordId: warehouseId,
            available: 20,
            threshold: 10,
          })),
        },
      ],
    ]),
    sales: { rows: [], uncertain: new Set() },
    purchases: [],
    transfers: [doc],
    transferMovements: [],
    ...changes,
  };
}
function source(e) {
  return buildPlan(e, { now }).lines.find(
    (l) => l.warehouseId === "hub" && l.sizeId === "s",
  );
}
test("posted transfers count as source demand and activate minimum without customer sales", () => {
  const plan = buildPlan(evidence(), { now });
  const hub = plan.lines.find((l) => l.warehouseId === "hub"),
    shop = plan.lines.find((l) => l.warehouseId === "shop");
  assert.equal(hub.minimumPolicy.status, "active");
  assert.equal(hub.minimumPolicy.demandBasis, "transfers");
  assert.equal(hub.transferUnits30, 10);
  assert.equal(hub.units30, 0);
  assert.equal(hub.demandUnits30, 10);
  assert.equal(shop.transferUnits30, 0);
  assert.equal(shop.minimumPolicy.status, "learning");
});
test("sales and net transfers add to local demand without inflating tenant sales summary", () => {
  const e = evidence({
    sales: {
      uncertain: new Set(),
      rows: [
        {
          subProductId: "p",
          sizeId: "s",
          warehouseId: "hub",
          units: 4,
          at: "2026-10-01",
        },
      ],
    },
  });
  const hub = source(e);
  assert.equal(hub.units30, 4);
  assert.equal(hub.demandUnits30, 14);
  assert.equal(hub.minimumPolicy.demandBasis, "sales_and_transfers");
  assert.ok(hub.threshold > source(evidence()).threshold);
});
test("receipts establish actual partial transfer dates; approval and unreceived intent do not count", () => {
  const transfer = {
    ...doc,
    status: "partially_received",
    completedDate: null,
    items: [{ ...item, receivedQty: 5, returnedQty: 1 }],
    receipts: [
      { receivedAt: "2026-10-01", lines: [{ itemIndex: 0, quantity: 5 }] },
    ],
  };
  assert.equal(source(evidence({ transfers: [transfer] })).transferUnits30, 4);
  for (const status of [
    "draft",
    "pending_approval",
    "confirmed",
    "in_transit",
  ]) {
    const noReceipt = {
      ...doc,
      status,
      completedDate: null,
      items: [{ ...item, receivedQty: 0, transferredQty: 0 }],
      dispatchedAt: "2026-10-01",
    };
    assert.equal(
      source(evidence({ transfers: [noReceipt] })).transferUnits30,
      0,
    );
  }
});
test("document and mirrored warehouse movement count once; direct paired returns reduce demand", () => {
  const out = {
    _id: "out",
    tenant: "t",
    subProduct: "p",
    size: "s",
    warehouse: "hub",
    type: "transfer_out",
    quantity: 12,
    createdAt: "2026-10-01",
    reference: "Transfer TR-1",
  };
  assert.equal(
    source(evidence({ transferMovements: [out] })).transferUnits30,
    10,
  );
  const direct = { ...out, reference: "Direct", transferGroupId: "group" };
  const incoming = {
    ...direct,
    _id: "in",
    type: "transfer_in",
    warehouse: "shop",
  };
  const returned = {
    ...direct,
    _id: "return",
    warehouse: "shop",
    quantity: 3,
    parentMovement: "in",
  };
  assert.equal(
    source(
      evidence({
        transfers: [],
        transferMovements: [direct, incoming, returned],
      }),
    ).transferUnits30,
    9,
  );
});
test("outflow ignores foreign tenants, other sizes, future dates and return outflows", () => {
  const bad = [
    { ...doc, tenant: "other" },
    { ...doc, items: [{ ...item, sizeId: "other" }] },
    { ...doc, completedDate: "2026-10-20" },
  ];
  assert.equal(source(evidence({ transfers: bad })).transferUnits30, 0);
});
test("undated posted transfer quantities remain incomplete instead of creating a zero-history forecast", () => {
  const hub = source(
    evidence({ transfers: [{ ...doc, completedDate: null }] }),
  );
  assert.equal(hub.minimumPolicy.status, "incomplete");
  assert.equal(hub.demandUnits30, null);
});
test("receipt indices survive removal of an invalid earlier variant", () => {
  const transfer = {
    ...doc,
    items: [{ ...item, receiptItemIndex: 1 }],
    receipts: [
      {
        receivedAt: "2026-10-01",
        lines: [
          { itemIndex: 0, quantity: 999 },
          { itemIndex: 1, quantity: 12 },
        ],
      },
    ],
  };
  assert.equal(source(evidence({ transfers: [transfer] })).transferUnits30, 10);
});
test("longer outflow history forecasts source demand while tenant sales exclude internal transfers", () => {
  const transfers = Array.from({ length: 40 }, (_, i) => ({
    ...doc,
    _id: `tr${i}`,
    transferNumber: `TR-${i}`,
    completedDate: new Date(now.getTime() - (i + 1) * 86400000).toISOString(),
    items: [{ ...item, receivedQty: 2, returnedQty: 0 }],
  }));
  const plan = buildPlan(evidence({ transfers }), { now });
  const hub = plan.lines.find(
    (l) => l.warehouseId === "hub" && l.sizeId === "s",
  );
  assert.equal(hub.forecast.method, "historical_baseline");
  assert.equal(hub.forecast.demand7, 14);
  assert.equal(hub.minimumPolicy.units, 18);
  assert.equal(hub.demandUnits30, 60);
  assert.equal(plan.summaries.find((l) => l.sizeId === "s").units30, 0);
});
test("demand fields remain unavailable to inventory-only access", () => {
  const { publicPlan } = require("../services/restock/access");
  const result = publicPlan(buildPlan(evidence(), { now }), {
    inventory: true,
    reports: false,
    purchase: false,
  });
  const hub = result.lines.find((l) => l.warehouseId === "hub");
  assert.equal(hub.transferUnits30, undefined);
  assert.equal(hub.demandUnits30, undefined);
  assert.equal(hub.minimumPolicy.demandBasis, "transfers");
  assert.equal(hub.minimumPolicy.leadUnits, undefined);
});
test("a return parent shared by partial movement rows is deducted once", () => {
  const base = {
    tenant: "t",
    subProduct: "p",
    size: "s",
    transferGroupId: "group",
    reference: "direct",
    createdAt: "2026-10-01",
  };
  const movements = [
    { ...base, _id: "o1", type: "transfer_out", warehouse: "hub", quantity: 4 },
    { ...base, _id: "o2", type: "transfer_out", warehouse: "hub", quantity: 8 },
    { ...base, _id: "i", type: "transfer_in", warehouse: "shop", quantity: 12 },
    {
      ...base,
      _id: "r",
      type: "transfer_out",
      warehouse: "shop",
      quantity: 3,
      parentMovement: "i",
    },
  ];
  assert.equal(
    source(evidence({ transfers: [], transferMovements: movements }))
      .transferUnits30,
    9,
  );
});
test("posted return evidence is respected when an older document has no returned quantity", () => {
  const base = {
    tenant: "t",
    subProduct: "p",
    size: "s",
    reference: "Transfer TR-1",
    createdAt: "2026-10-01",
  };
  const movements = [
    { ...base, _id: "o", type: "transfer_out", warehouse: "hub", quantity: 12 },
    { ...base, _id: "i", type: "transfer_in", warehouse: "shop", quantity: 12 },
    {
      ...base,
      _id: "r",
      type: "transfer_out",
      warehouse: "shop",
      quantity: 3,
      parentMovement: "i",
    },
  ];
  assert.equal(
    source(
      evidence({
        transfers: [{ ...doc, items: [{ ...item, returnedQty: 0 }] }],
        transferMovements: movements,
      }),
    ).transferUnits30,
    9,
  );
});
test("a mismatched variant return cannot reduce another product variant’s source demand", () => {
  const base = {
    tenant: "t",
    subProduct: "p",
    size: "s",
    reference: "direct",
    transferGroupId: "group",
    createdAt: "2026-10-01",
  };
  const movements = [
    { ...base, _id: "o", type: "transfer_out", warehouse: "hub", quantity: 12 },
    { ...base, _id: "i", type: "transfer_in", warehouse: "shop", quantity: 12 },
    {
      ...base,
      _id: "r",
      size: "other",
      type: "transfer_out",
      warehouse: "shop",
      quantity: 3,
      parentMovement: "i",
    },
  ];
  assert.equal(
    source(evidence({ transfers: [], transferMovements: movements }))
      .transferUnits30,
    12,
  );
});
