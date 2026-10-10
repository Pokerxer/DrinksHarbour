const test = require("node:test");
const assert = require("node:assert/strict");
const restockReader = require("../services/restock/reader");
const SubProduct = require("../models/SubProduct");
const Size = require("../models/Size");
const Promotion = require("../models/Promotion");
require("../models/Product");
function query(rows, populated) {
  let populatedProduct = false;
  const q = {
    select() {
      return q;
    },
    limit() {
      return q;
    },
    maxTimeMS() {
      return q;
    },
    populate(path, fields) {
      populatedProduct =
        path === "product" &&
        fields.includes("category") &&
        fields.includes("brand");
      return q;
    },
    async lean() {
      return populated && populatedProduct ? populated : rows;
    },
  };
  return q;
}
test("reader uses tenant-scoped central taxonomy to avoid false promotion conflicts", async (t) => {
  const product = {
    _id: "p",
    name: "Wine",
    sku: "W",
    product: { name: "Wine" },
  };
  t.mock.method(restockReader, "readEvidence", async (tenant, opts) => {
    assert.equal(tenant, "own");
    assert.equal(opts.baskets, true);
    return {
      tenantId: tenant,
      products: [product],
      warehouses: [{ _id: "w", name: "Shop" }],
      snapshots: new Map([
        [
          "p",
          {
            stock: [
              { sizeId: "s", warehouseId: "w", available: 100, threshold: 5 },
            ],
          },
        ],
      ]),
      sales: { rows: [], uncertain: new Set() },
      purchases: [],
      transfers: [],
      transferMovements: [],
      pricelists: [],
    };
  });
  t.mock.method(Size, "find", (filter) => {
    assert.equal(filter.tenant, "own");
    return query([
      {
        _id: "s",
        subproduct: "p",
        sellingPrice: 100,
        costPrice: 50,
        currency: "NGN",
      },
    ]);
  });
  t.mock.method(SubProduct, "find", (filter) => {
    assert.equal(filter.tenant, "own");
    const price = { _id: "p", product: "central", currency: "NGN" };
    return query(
      [price],
      [{ ...price, product: { category: "wine", brand: "brand-a" } }],
    );
  });
  t.mock.method(Promotion, "find", (filter) => {
    assert.equal(filter.tenant, "own");
    return query([{ applyTo: "specific_categories", categories: ["beer"] }]);
  });
  const path = require.resolve("../services/promotionSuggestions/reader");
  delete require.cache[path];
  t.after(() => {
    delete require.cache[path];
  });
  const { readSuggestions } = require(path);
  const evidence = await readSuggestions(
    "own",
    {},
    new Date("2026-10-10T12:00:00Z"),
    true,
  );
  assert.equal(evidence.variants.length, 1);
  assert.equal(evidence.variants[0].conflict, false);
  assert.equal(evidence.variants[0].price, 100);
});
