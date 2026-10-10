const { test } = require("node:test");
const assert = require("node:assert/strict");
const { assignmentPlan } = require("../services/warehouseAssignmentPlan");
const base = () => ({
  tenantId: "t",
  warehouse: { _id: "w", tenant: "t", isActive: true },
  manifest: [
    { productId: "p", sizeId: "s", stock: true },
    { productId: "other", sizeId: "other-size", stock: false },
  ],
  products: [
    { _id: "p", tenant: "t", availableStock: 0 },
    { _id: "other", tenant: "t" },
  ],
  sizes: [
    { _id: "s", tenant: "t", subproduct: "p", stock: 0, reservedStock: 0 },
  ],
  stocks: [],
});
test("assigns missing defaults and creates only audited zero stock locations", () => {
  const plan = assignmentPlan(base());
  assert.equal(plan.defaults.length, 2);
  assert.equal(plan.stock.length, 1);
  assert.equal(plan.stock[0].currentQuantity, 0);
  assert.equal(plan.stock[0].reservedQuantity, 0);
});
test("reruns preserve assigned defaults and stock without creating duplicates", () => {
  const e = base();
  e.products[0].warehouse = "w";
  e.stocks = [
    {
      tenant: "t",
      warehouse: "w",
      subProduct: "p",
      size: "s",
      currentQuantity: 7,
      reservedQuantity: 2,
    },
  ];
  const plan = assignmentPlan(e);
  assert.equal(plan.defaults.length, 1);
  assert.equal(plan.stock.length, 0);
  assert.equal(e.stocks[0].currentQuantity, 7);
});
test("history-only product default does not relocate its existing stock", () => {
  const e = base();
  e.stocks = [
    {
      tenant: "t",
      warehouse: "cloud",
      subProduct: "other",
      size: "other-size",
      currentQuantity: 30,
    },
  ];
  const plan = assignmentPlan(e);
  assert.equal(plan.defaults.length, 2);
  assert.equal(plan.stock.length, 1);
});
test("foreign tenant or mismatched variant cannot receive an assignment", () => {
  for (const change of [
    (e) => (e.warehouse.tenant = "foreign"),
    (e) => (e.products[0].tenant = "foreign"),
    (e) => (e.sizes[0].subproduct = "other"),
  ]) {
    const e = base();
    change(e);
    assert.throws(() => assignmentPlan(e), /tenant|variant/i);
  }
});
test("new nonzero aggregate stock stops the zero-row assignment for reconciliation", () => {
  const e = base();
  e.sizes[0].stock = 4;
  assert.throws(() => assignmentPlan(e), /zero/i);
});
test("a changed existing default or stock location is preserved by aborting", () => {
  const e = base();
  e.products[0].warehouse = "elsewhere";
  assert.throws(() => assignmentPlan(e), /warehouse/i);
  e.products[0].warehouse = null;
  e.stocks = [
    { tenant: "t", warehouse: "elsewhere", subProduct: "p", size: "s" },
  ];
  assert.throws(() => assignmentPlan(e), /warehouse/i);
});
