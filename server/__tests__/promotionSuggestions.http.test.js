const test = require("node:test");
const assert = require("node:assert/strict");
const { options } = require("../services/promotionSuggestions/options");
const {
  promotionSuggestionsController,
} = require("../services/promotionSuggestions/controller");
test("validates bounded financial controls, location identity and paired real special-day dates", () => {
  for (const q of [
    { maxDiscount: "51" },
    { marginFloor: "100" },
    { warehouseId: "other" },
    { eventName: "Birthday" },
    { eventName: "Birthday", eventDate: "2026-02-30" },
    { tenantId: "foreign" },
  ])
    assert.throws(() => options(q));
  assert.equal(options({ maxDiscount: "12.5" }).maxDiscount, 12.5);
});
test("special days must be upcoming within the advertised planning window", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  for (const eventDate of ["2026-10-09", "2027-04-01"])
    assert.throws(() => options({ eventName: "Anniversary", eventDate }, now));
});
async function call(user, reader) {
  let result;
  await new Promise((resolve, reject) => {
    const handler = promotionSuggestionsController(
      reader,
      () => new Date("2026-10-10"),
    );
    handler(
      { user, query: {} },
      {
        json: (r) => {
          result = r;
          resolve();
        },
      },
      reject,
    );
  });
  return result;
}
test("passes only JWT tenant authority and redacts staff pricing", async () => {
  const evidence = {
    variants: [],
    baskets: [],
    days: 30,
    warehouses: [],
    warnings: [],
    start: "2026-09-01",
    end: "2026-10-01",
  };
  const user = {
    tenant: "own",
    status: "active",
    role: "tenant_staff",
    customPermissions: ["inventory:read", "reports:read", "subproducts:read"],
  };
  const result = await call(user, async (tenant, opts, now, canPrice) => {
    assert.equal(tenant, "own");
    assert.equal(canPrice, false);
    return evidence;
  });
  assert.equal(result.data.canPrice, false);
});
test("missing report permission stops before reading evidence", async () => {
  await assert.rejects(
    call(
      {
        tenant: "t",
        status: "active",
        role: "tenant_staff",
        customPermissions: [],
      },
      async () => {
        throw Error("must not read");
      },
    ),
    /access are required/,
  );
});
