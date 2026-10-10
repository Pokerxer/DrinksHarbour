const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeOrderUnits,
  normalizeSalesUnits,
} = require("../services/tenantProductInsights.sales");
const { incomingSupply } = require("../services/restock/supply");
const now = new Date("2026-10-09");
test("POS location comes from persisted line, with returns netted once", () => {
  const row = normalizeOrderUnits(
    {
      source: "pos",
      tenant: "t",
      status: "completed",
      paymentStatus: "paid",
      paidAt: now,
      items: [{ subproduct: "p", size: "s", warehouse: "w", quantity: 10 }],
      refunds: [{ items: [{ orderItemIndex: 0, quantity: 2 }] }],
    },
    "t",
    { locations: true },
  )[0];
  assert.equal(row.warehouseId, "w");
  assert.equal(row.units, 8);
});
test("Sales location comes from posted fulfillment, not current default", () => {
  const rows = normalizeSalesUnits(
    {
      tenant: "t",
      docType: "order",
      orderStatus: "fulfilled",
      paymentStatus: "paid",
      warehouseId: "wrong",
      items: [{ _id: "line", subproduct: "p", size: "s", fulfilledQty: 8 }],
      fulfillments: [
        { at: now, warehouseId: "actual", items: [{ lineId: "line", qty: 8 }] },
      ],
    },
    [],
    "t",
    { locations: true },
  );
  assert.equal(rows[0].warehouseId, "actual");
});
test("ambiguous returns across locations suppress local allocation", () => {
  const rows = normalizeSalesUnits(
    {
      tenant: "t",
      docType: "order",
      orderStatus: "fulfilled",
      paymentStatus: "paid",
      items: [
        {
          _id: "line",
          subproduct: "p",
          size: "s",
          fulfilledQty: 8,
          returnedQty: 1,
        },
      ],
      fulfillments: ["a", "b"].map((w) => ({
        at: now,
        warehouseId: w,
        items: [{ lineId: "line", qty: 4 }],
      })),
    },
    [],
    "t",
    { locations: true },
  );
  assert.ok(rows.every((r) => r.warehouseId === "" && r.locationUncertain));
  assert.equal(
    rows.reduce((n, r) => n + r.units, 0),
    7,
  );
});
test("unposted PO supply includes accepted receipt once, returns do not reopen it", () => {
  const po = {
    _id: "po",
    type: "po",
    status: "confirmed",
    warehouse: "w",
    expectedArrival: "2026-10-12",
    items: [
      {
        subProductId: "p",
        sizeId: "s",
        quantity: 20,
        receivedQty: 10,
        postedQty: 8,
        returnedQty: 2,
      },
    ],
  };
  const rows = incomingSupply([po], [], now);
  assert.equal(
    rows.reduce((n, r) => n + r.quantity, 0),
    10,
  );
  assert.equal(rows[0].warehouseId, "w");
  const returned = {
    ...po,
    items: [
      {
        ...po.items[0],
        quantity: 20,
        receivedQty: 15,
        postedQty: 15,
        returnedQty: 5,
      },
    ],
  };
  assert.equal(incomingSupply([returned], [], now).length, 0);
});
test("drafts and RFQs are not supply, incomplete transfers stay dated/uncertain", () => {
  const item = { subProductId: "p", sizeId: "s", quantity: 12 };
  assert.equal(
    incomingSupply(
      [
        { status: "draft", items: [item] },
        { type: "rfq", status: "confirmed", items: [item] },
      ],
      [],
      now,
    ).length,
    0,
  );
  const rows = incomingSupply(
    [],
    [
      {
        _id: "x",
        status: "in_transit",
        destinationWarehouse: "other",
        items: [{ ...item, transferredQty: 10, receivedQty: 3 }],
      },
    ],
    now,
  );
  assert.equal(rows[0].quantity, 7);
  assert.equal(rows[0].arrival, null);
  assert.equal(rows[0].warehouseId, "other");
});
test("modern dispatched transfers remain incoming before any receipts, and partial receipts net only once", () => {
  const t = {
    _id: "x",
    status: "in_transit",
    sourceWarehouse: "source",
    destinationWarehouse: "w",
    dispatchedAt: "2026-10-08",
    items: [
      {
        subProductId: "p",
        sizeId: "s",
        quantity: 12,
        transferredQty: 0,
        receivedQty: 0,
      },
    ],
  };
  assert.equal(incomingSupply([], [t], now)[0]?.quantity, 12);
  const partial = {
    ...t,
    status: "partially_received",
    items: [
      { ...t.items[0], transferredQty: 3, receivedQty: 3, returnedQty: 1 },
    ],
  };
  assert.equal(incomingSupply([], [partial], now)[0]?.quantity, 9);
});
test("observed vendor lead times only use completed purchases in the past", () => {
  const { vendorLeadTimes } = require("../services/restock/supply");
  const past = Array.from({ length: 3 }, () => ({
    vendor: "v",
    status: "received",
    confirmationDate: "2026-10-01",
    fullyReceivedDate: "2026-10-03",
  }));
  const future = Array.from({ length: 4 }, () => ({
    vendor: "v",
    status: "received",
    confirmationDate: "2026-10-10",
    fullyReceivedDate: "2026-10-30",
  }));
  assert.equal(vendorLeadTimes([...past, ...future], now).get("v"), 2);
});
