const test = require("node:test");
const assert = require("node:assert/strict");
const { validateDateRange } = require("../utils/notificationDateRange");
const { attachPeriod } = require("../services/restock/period");
test("validates real dates, paired endpoints, inclusive Lagos end and bounded ranges", () => {
  const range = validateDateRange(
    { startDate: "2026-09-01", endDate: "2026-09-30" },
    new Date("2026-10-09"),
  );
  assert.equal(range.start.toISOString(), "2026-08-31T23:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-09-30T23:00:00.000Z");
  assert.equal(range.days, 30);
  for (const q of [
    { startDate: "2026-09-01" },
    { startDate: "2026-02-30", endDate: "2026-03-05" },
    { startDate: "2026-09-10", endDate: "2026-09-01" },
    { startDate: "2026-09-01", endDate: "2027-01-01" },
    { startDate: "2024-01-01", endDate: "2026-01-01" },
  ])
    assert.throws(() => validateDateRange(q, new Date("2026-10-09")));
});
test("selected totals use inclusive dates, prior equal window and unknown local evidence", () => {
  const rows = [
    ["2026-08-31T22:59:59Z", 2],
    ["2026-08-31T23:00:00Z", 3],
    ["2026-09-30T22:59:59Z", 4],
    ["2026-09-30T23:00:00Z", 99],
  ].map(([at, units]) => ({
    subProductId: "p",
    sizeId: "s",
    warehouseId: "w",
    at,
    units,
  }));
  const lines = [
      { subProductId: "p", sizeId: "s", warehouseId: "w", key: "p:s:w" },
    ],
    summaries = [{ subProductId: "p", sizeId: "s", summary: true }];
  const args = [
    { lines, summaries },
    { sales: { rows, uncertain: new Set() } },
    { rows: [{ ...rows[1], units: 5 }], uncertain: new Set() },
    { startDate: "2026-09-01", endDate: "2026-09-30" },
    new Date("2026-10-09"),
  ];
  attachPeriod(...args);
  assert.equal(lines[0].periodUnits, 7);
  assert.equal(lines[0].periodPreviousUnits, 2);
  assert.equal(lines[0].periodDemandUnits, 12);
  assert.equal(summaries[0].periodUnits, 7);
  rows.push({ ...rows[1], warehouseId: "", units: 1 });
  attachPeriod(...args);
  assert.equal(lines[0].periodUnits, null);
  assert.equal(summaries[0].periodUnits, 8);
});
test("custom date fields are stripped from stock-only responses and query validation accepts dates", () => {
  const { publicPlan, validateOptions } = require("../services/restock/access");
  const plan = publicPlan(
    {
      lines: [{ periodUnits: 5, periodPreviousUnits: 3, periodDemandUnits: 8 }],
    },
    { inventory: true, reports: false, purchase: false },
  );
  assert.equal(plan.lines[0].periodUnits, undefined);
  assert.equal(plan.lines[0].periodDemandUnits, undefined);
  assert.equal(
    validateOptions({ startDate: "2026-09-01", endDate: "2026-09-30" })
      .startDate,
    "2026-09-01",
  );
});
test("planning cache separates custom ranges from each other and from defaults", async () => {
  const { createPlanningService } = require("../services/restock/service");
  let calls = 0;
  const reader = async () => {
    calls++;
    return {
      tenantId: "t",
      products: [],
      warehouses: [],
      snapshots: new Map(),
      sales: { rows: [], uncertain: new Set() },
      purchases: [],
      transfers: [],
      pricelists: [],
    };
  };
  const plan = createPlanningService(reader, () => new Date("2026-10-09"));
  await plan("t");
  await plan("t", { startDate: "2026-09-01", endDate: "2026-09-30" });
  await plan("t", { startDate: "2026-08-01", endDate: "2026-08-31" });
  await plan("t", { startDate: "2026-09-01", endDate: "2026-09-30" });
  assert.equal(calls, 3);
});
test("notification date filtering happens before pagination, counts and bulk reads", async () => {
  const {
    createInboxService,
  } = require("../services/tenantNotifications.service");
  let query, bulk;
  const cursor = {
    sort() {
      return this;
    },
    skip() {
      return this;
    },
    limit() {
      return this;
    },
    select() {
      return this;
    },
    async lean() {
      return [];
    },
  };
  const model = {
    find(q) {
      query = q;
      return cursor;
    },
    async countDocuments() {
      return 0;
    },
    async updateMany(q) {
      bulk = q;
      return { modifiedCount: 0 };
    },
  };
  const service = createInboxService(
    model,
    () => new Date("2026-10-09"),
    async () => {},
  );
  const req = {
    user: { _id: "u", tenant: "t", role: "tenant_admin", status: "active" },
    query: { startDate: "2026-09-01", endDate: "2026-09-30" },
  };
  await service.list(req);
  await service.markAllRead(req);
  assert.equal(query.createdAt.$gte.toISOString(), "2026-08-31T23:00:00.000Z");
  assert.equal(query.createdAt.$lt.toISOString(), "2026-09-30T23:00:00.000Z");
  assert.deepEqual(bulk.createdAt, query.createdAt);
  assert.equal(bulk.tenant, "t");
  assert.equal(bulk.recipient, "u");
});
