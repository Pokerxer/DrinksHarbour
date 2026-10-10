const { test } = require("node:test");
const assert = require("node:assert/strict");
const { projectReplenishment } = require("../services/restock/replenishment");
const now = new Date("2026-10-09T10:00:00Z");
const startDate = "2026-10-08T23:00:00Z";
const forecast = {
  method: "historical_baseline",
  startDate,
  daily: Array(90).fill(1),
};
const line = { available: 5, buffer: 2, committedOutboundUnits: 0 };
test("later incoming stock cannot conceal the quantity needed before it arrives", () => {
  const p = projectReplenishment(
    line,
    forecast,
    [{ quantity: 40, arrival: "2026-10-27T23:00:00Z" }],
    7,
    14,
    now,
  );
  assert.equal(p.horizonDays, 21);
  assert.equal(p.forecastUnits, 21);
  assert.equal(p.incomingUnits, 40);
  assert.equal(p.projectedEndingUnits, 26);
  assert.equal(p.suggestedUnits, 14); // twelve post-delivery units before incoming day 19, plus buffer 2
  assert.equal(p.shortfallBeforeDelivery, 2); // seven days before supplier arrival
});
test("an arrival at Lagos midnight belongs to the new day, not the preceding day", () => {
  const p = projectReplenishment(
    { available: 1, buffer: 0 },
    forecast,
    [{ quantity: 100, arrival: "2026-10-10T23:00:00Z" }],
    0,
    7,
    now,
  );
  assert.equal(p.suggestedUnits, 1); // first two days consume 2 before day-three arrival
  assert.equal(p.daysOfCover, 1);
});
test("overdue, undated and post-horizon arrivals are excluded with explained totals", () => {
  const p = projectReplenishment(
    line,
    forecast,
    [
      { quantity: 10, arrival: "2026-10-09T00:00:00Z" },
      { quantity: 20, arrival: null },
      { quantity: 30, arrival: "2026-12-01" },
    ],
    7,
    14,
    now,
  );
  assert.equal(p.incomingUnits, 0);
  assert.equal(p.excludedIncomingUnits, 60);
  assert.equal(p.suggestedUnits, 16);
});
test("outgoing commitments and active local minimum are protected in the order quantity", () => {
  const p = projectReplenishment(
    {
      ...line,
      available: 30,
      committedOutboundUnits: 25,
      threshold: 12,
      minimumPolicy: { status: "active" },
    },
    forecast,
    [],
    2,
    7,
    now,
  );
  assert.equal(p.availableAfterCommitments, 5);
  assert.equal(p.safetyUnits, 2);
  assert.equal(p.minimumTargetUnits, 13);
  assert.equal(p.suggestedUnits, 10); // minimum 13 at delivery minus 3 remaining; no double-counted lead demand
});
test("invalid, missing, short forecasts and negative balances require manual review", () => {
  for (const [stock, f] of [
    [{ available: null }, forecast],
    [{ available: -2 }, forecast],
    [line, { ...forecast, daily: [1, NaN] }],
    [line, { ...forecast, daily: Array(5).fill(1) }],
    [line, { ...forecast, startDate: "bad" }],
    [line, { ...forecast, method: "insufficient_history" }],
  ]) {
    const p = projectReplenishment(stock, f, [], 7, 14, now);
    assert.equal(p.suggestedUnits, null);
    assert.ok(p.manualReviewReason);
  }
});
test("zero recorded demand does not order merely to fill a configured buffer", () => {
  const p = projectReplenishment(
    { available: 0, buffer: 50 },
    { ...forecast, daily: Array(90).fill(0) },
    [],
    7,
    14,
    now,
  );
  assert.equal(p.suggestedUnits, 0);
  assert.equal(p.shortfallBeforeDelivery, 0);
});

test("missing demand preserves independently known warehouse and arrival facts", () => {
  const p = projectReplenishment(
    {
      available: 12,
      committedOutboundUnits: 3,
      buffer: 2,
      threshold: 4,
      minimumPolicy: { status: "active" },
    },
    { ...forecast, method: "insufficient_history", daily: [] },
    [
      { quantity: 6, arrival: "2026-10-12T10:00:00Z" },
      { quantity: 4, arrival: null },
    ],
    7,
    14,
    now,
  );
  assert.equal(p.availableAfterCommitments, 9);
  assert.equal(p.safetyUnits, 2);
  assert.equal(p.minimumTargetUnits, 5);
  assert.equal(p.incomingUnits, 6);
  assert.equal(p.excludedIncomingUnits, 4);
  assert.equal(p.forecastUnits, null);
  assert.equal(p.projectedEndingUnits, null);
  assert.equal(p.suggestedUnits, null);
});

test("unavailable forecast dates never label an arrival as timely supply", () => {
  const p = projectReplenishment(
    line,
    { ...forecast, startDate: "bad" },
    [{ quantity: 6, arrival: "2026-10-12T10:00:00Z" }],
    7,
    14,
    now,
  );
  assert.equal(p.incomingUnits, 0);
  assert.equal(p.excludedIncomingUnits, 6);
});

test("orders exclude forecast sales missed before supplier arrival", () => {
  const p = projectReplenishment(
    { available: 0, buffer: 2 },
    forecast,
    [],
    7,
    14,
    now,
  );
  assert.equal(p.shortfallBeforeDelivery, 7);
  assert.equal(p.suggestedUnits, 16); // 14 future units plus 2 reserve, not 21 plus 2
  assert.equal(p.projectedEndingUnits, -14);
  assert.equal(p.forecastAfterDeliveryUnits, 14);
});
test("pre-delivery receipts reduce missed sales without making them a future order backlog", () => {
  const p = projectReplenishment(
    { available: 0, buffer: 2 },
    forecast,
    [{ quantity: 2, arrival: "2026-10-14T00:00:00Z" }],
    7,
    14,
    now,
  );
  assert.equal(p.shortfallBeforeDelivery, 5);
  assert.equal(p.suggestedUnits, 16);
});
test("uncovered outgoing commitments remain real obligations alongside future demand", () => {
  const p = projectReplenishment(
    { available: 2, committedOutboundUnits: 5, buffer: 2 },
    forecast,
    [],
    7,
    14,
    now,
  );
  assert.equal(p.availableAfterCommitments, -3);
  assert.equal(p.shortfallBeforeDelivery, 7);
  assert.equal(p.suggestedUnits, 19); // 3 reserved units plus 14 future demand plus 2 reserve
});
test("a supplier order does not replenish forecast demand that exists only before delivery", () => {
  const p = projectReplenishment(
    { available: 0, buffer: 2 },
    { ...forecast, daily: [...Array(7).fill(1), ...Array(83).fill(0)] },
    [],
    7,
    14,
    now,
  );
  assert.equal(p.shortfallBeforeDelivery, 7);
  assert.equal(p.suggestedUnits, 0);
});
