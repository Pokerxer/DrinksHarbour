const { test } = require("node:test");
const assert = require("node:assert/strict");
const { forecast } = require("../services/restock/model");
const { projectRisk, compareRisk } = require("../services/restock/risk");
const { dailySeries, dayStart, key } = require("../services/restock/series");
const now = new Date("2026-10-09T12:00:00Z");
test("Lagos completed day boundary does not include today", () => {
  assert.equal(dayStart(now).toISOString(), "2026-10-08T23:00:00.000Z");
  const rows = [
    {
      subProductId: "p",
      sizeId: "s",
      warehouseId: "w",
      at: "2026-09-01T12:00:00Z",
      units: 2,
    },
    {
      subProductId: "p",
      sizeId: "s",
      warehouseId: "w",
      at: "2026-10-08T23:01:00Z",
      units: 99,
    },
  ];
  const series = dailySeries(rows, key(rows[0]), now);
  assert.equal(
    series.values.reduce((a, b) => a + b, 0),
    2,
  );
  assert.equal(series.values.length, 38);
});
test("unassigned location cannot become another warehouse demand", () => {
  const rows = [
    {
      subProductId: "p",
      sizeId: "s",
      warehouseId: "",
      at: "2026-09-01",
      units: 30,
    },
  ];
  assert.deepEqual(dailySeries(rows, "p:s:w", now).values, []);
});
test("sparse and unknown history is explicitly unsupported", () => {
  assert.equal(
    forecast(Array(12).fill(1), 30, now).method,
    "insufficient_history",
  );
  assert.equal(
    forecast([null, ...Array(90).fill(1)], 30, now).method,
    "insufficient_history",
  );
});
test("baseline does not claim trained AI; zero sales does not invent demand", () => {
  const f = forecast(Array(40).fill(0), 30, now);
  assert.equal(f.method, "historical_baseline");
  assert.equal(f.model, null);
  assert.equal(
    f.daily.reduce((a, b) => a + b, 0),
    0,
  );
});
test("trained ridge beats seasonal baseline on sustained growth", () => {
  const f = forecast(
    Array.from({ length: 140 }, (_, i) => 2 + i * 0.2),
    30,
    now,
  );
  assert.equal(f.model, "dh-demand-ridge-v1");
  assert.equal(f.method, "trained_forecast");
  assert.ok(f.errors.mae < f.errors.baselineMae * 0.95);
  assert.ok(f.demand30 > f.demand7 * 4);
  assert.equal(f.daily.length, 30);
});
test("model selection and horizon are deterministic and bounded", () => {
  const values = Array.from({ length: 100 }, (_, i) => (i % 7 === 0 ? 4 : 1));
  assert.deepEqual(forecast(values, 30, now), forecast(values, 30, now));
  assert.throws(() => forecast(values, 91, now), /horizon/i);
});
test("user example ranks 30/month with 10 left above 5/month with 5 left", () => {
  const fast = projectRisk(
    { available: 10, units30: 30 },
    { daily: Array(30).fill(1) },
    [],
    7,
    14,
  );
  const slow = projectRisk(
    { available: 5, units30: 5 },
    { daily: Array(30).fill(1 / 6) },
    [],
    7,
    14,
  );
  assert.equal(fast.daysOfCover, 10);
  assert.equal(slow.daysOfCover, 30);
  assert.equal(fast.urgency, "high");
  assert.equal(slow.urgency, "monitor");
  assert.ok(compareRisk(fast, slow) < 0);
});
test("incoming supply reduces need once and only when timely", () => {
  const f = { daily: Array(30).fill(2), startDate: "2026-10-09T23:00:00Z" };
  const risk = projectRisk(
    { available: 10, buffer: 6 },
    f,
    [
      { quantity: 8, arrival: "2026-10-12T12:00:00Z" },
      { quantity: 100, arrival: "2026-12-01T12:00:00Z" },
      { quantity: 100, arrival: null },
    ],
    7,
    14,
  );
  assert.equal(risk.suggestedUnits, 30);
  assert.equal(risk.incomingUnits, 8);
});
test("zero demand and unknown stock do not manufacture an order", () => {
  assert.equal(
    projectRisk({ available: 0 }, { daily: Array(30).fill(0) }, [], 7, 14)
      .urgency,
    "monitor",
  );
  const risk = projectRisk(
    { available: null },
    { daily: Array(30).fill(2) },
    [],
    7,
    14,
  );
  assert.equal(risk.suggestedUnits, null);
  assert.equal(risk.daysOfCover, null);
});
test("overdue and undated supply does not conceal a shortage", () => {
  const r = projectRisk(
    { available: 1 },
    { daily: Array(30).fill(1), startDate: now.toISOString() },
    [
      { quantity: 30, arrival: "2026-10-01" },
      { quantity: 30, arrival: null },
    ],
    7,
    14,
  );
  assert.equal(r.urgency, "urgent");
  assert.equal(r.daysOfCover, 1);
});
test("negative available stock is already depleted, not a future one-day shortage", () => {
  const r = projectRisk(
    { available: -2 },
    { daily: Array(30).fill(1), startDate: now.toISOString() },
    [],
    7,
    14,
  );
  assert.equal(r.daysOfCover, 0);
  assert.equal(r.urgency, "urgent");
});
test("outbound commitments reduce forecast cover without changing physical stock", () => {
  const line = { available: 30, committedOutboundUnits: 25, buffer: 0 };
  const risk = projectRisk(
    line,
    { daily: Array(90).fill(1), startDate: "2026-10-09" },
    [],
    7,
    14,
  );
  assert.equal(risk.daysOfCover, 5);
  assert.equal(risk.suggestedUnits, 16);
  assert.equal(line.available, 30);
});
test("baseline forecasts are validated on the same estimator that is served", () => {
  const f = forecast(Array(42).fill(2), 90, now);
  assert.equal(f.method, "historical_baseline");
  assert.equal(f.errors.holdoutDays, 14);
  assert.equal(f.errors.mae, 0);
  assert.equal(f.validation.status, "good");
  assert.equal(f.demand30, 60);
});
test("short supported forecasts distinguish unvalidated evidence from missing history", () => {
  const f = forecast(Array(28).fill(2), 90, now);
  assert.equal(f.validation.status, "unvalidated");
  assert.equal(f.errors, null);
  const missing = forecast(Array(10).fill(2), 90, now);
  assert.equal(missing.validation.status, "unavailable");
  assert.ok(missing.limitations.some((s) => s.includes("28")));
});
