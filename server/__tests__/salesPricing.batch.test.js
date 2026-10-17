const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const SubProduct = require("../models/SubProduct");
const Size = require("../models/Size");
const Tenant = require("../models/Tenant");
const Pricelist = require("../models/Pricelist");
const {
  computeAuthoritativeLinePrices,
} = require("../services/salesPricing.service");
const oid = () => new mongoose.Types.ObjectId();
function query(value) {
  const q = { select: () => q, populate: () => q, lean: async () => value };
  return q;
}

test("prices twenty duplicate lines with one scoped product read and one scoped size read", async (t) => {
  const tenantId = oid(),
    productId = oid(),
    sizeId = oid(),
    pricelistId = oid();
  const product = {
    _id: productId,
    tenant: tenantId,
    product: { platformMarkup: 0 },
    baseSellingPrice: 1000,
    costPrice: 1000,
    sizes: [],
  };
  const size = {
    _id: sizeId,
    tenant: tenantId,
    subproduct: productId,
    sellingPrice: 1000,
    costPrice: 1000,
  };
  const productQueries = [],
    sizeQueries = [];
  t.mock.method(Tenant, "findById", () =>
    query({ revenueModel: "markup", markupPercentage: 0 }),
  );
  t.mock.method(Pricelist, "findOne", () =>
    query({
      rules: [
        {
          priceType: "discount",
          discountType: "fixed",
          discountAmount: 100,
          minQuantity: 0,
        },
      ],
    }),
  );
  // Legacy per-line lookups allow this test to fail on query count, without a live database.
  t.mock.method(SubProduct, "findById", () => query(product));
  t.mock.method(Size, "findById", () => query(size));
  t.mock.method(SubProduct, "find", (filter) => {
    productQueries.push(filter);
    return query([product]);
  });
  t.mock.method(Size, "find", (filter) => {
    sizeQueries.push(filter);
    return query([size]);
  });
  const items = Array.from({ length: 20 }, (_, i) => ({
    key: String(i),
    subproduct: productId,
    size: sizeId,
    quantity: i + 1,
    unitPrice: 1,
  }));
  items.push({
    key: "manual",
    subproduct: oid(),
    quantity: 1,
    unitPrice: 777,
    priceOverridden: true,
  });
  const result = await computeAuthoritativeLinePrices(items, {
    tenantId,
    pricelistId,
  });
  assert.deepEqual(
    result.map((i) => i.unitPrice),
    [...Array(20).fill(900), 777],
  );
  assert.deepEqual(
    result.map((i) => i.key),
    items.map((i) => i.key),
  );
  assert.equal(productQueries.length, 1);
  assert.equal(sizeQueries.length, 1);
  assert.deepEqual(productQueries[0], {
    tenant: tenantId,
    _id: { $in: [String(productId)] },
  });
  assert.deepEqual(sizeQueries[0], {
    tenant: tenantId,
    _id: { $in: [String(sizeId)] },
  });
  assert.equal(SubProduct.findById.mock.callCount(), 0);
  assert.equal(Size.findById.mock.callCount(), 0);
});

function fixture(t) {
  const tenantId = oid(),
    productId = oid(),
    sizeId = oid();
  const product = {
    _id: productId,
    tenant: tenantId,
    product: { platformMarkup: 0 },
    baseSellingPrice: 1000,
    costPrice: 1000,
    sizes: [],
  };
  const size = {
    _id: sizeId,
    subproduct: productId,
    costPrice: 1000,
    sellingPrice: 1000,
  };
  t.mock.method(Tenant, "findById", () =>
    query({ revenueModel: "markup", markupPercentage: 0 }),
  );
  t.mock.method(SubProduct, "find", () => query([product]));
  t.mock.method(Size, "find", () => query([size]));
  return { tenantId, productId, sizeId, product, size };
}

test("fresh requests see changed prices and missing products do not prevent other lines pricing", async (t) => {
  const f = fixture(t);
  const items = [
    { key: "found", subproduct: f.productId, quantity: 1, unitPrice: 1 },
    { key: "missing", subproduct: oid(), quantity: 1, unitPrice: 777 },
  ];
  const options = { tenantId: f.tenantId, pricelistId: null };
  assert.deepEqual(
    (await computeAuthoritativeLinePrices(items, options)).map(
      (it) => it.unitPrice,
    ),
    [1000, 777],
  );
  f.product.costPrice = 2000;
  f.product.baseSellingPrice = 2000;
  assert.deepEqual(
    (await computeAuthoritativeLinePrices(items, options)).map(
      (it) => it.unitPrice,
    ),
    [2000, 777],
  );
});

test("failed size reads preserve affected lines while sizeless lines still price", async (t) => {
  const f = fixture(t);
  t.mock.method(Size, "find", () => {
    const q = query([]);
    q.lean = async () => {
      throw new Error("offline");
    };
    return q;
  });
  const items = [
    { subproduct: f.productId, size: f.sizeId, quantity: 1, unitPrice: 777 },
    { subproduct: f.productId, quantity: 1, unitPrice: 1 },
  ];
  assert.deepEqual(
    (await computeAuthoritativeLinePrices(items, { tenantId: f.tenantId })).map(
      (it) => it.unitPrice,
    ),
    [777, 1000],
  );
});

test("a size belonging to another product cannot change a line price", async (t) => {
  const f = fixture(t);
  f.size.subproduct = oid();
  const items = [
    { subproduct: f.productId, size: f.sizeId, quantity: 1, unitPrice: 777 },
  ];
  assert.equal(
    (await computeAuthoritativeLinePrices(items, { tenantId: f.tenantId }))[0]
      .unitPrice,
    777,
  );
});

test("a synchronous product query failure preserves submitted lines", async (t) => {
  const f = fixture(t);
  t.mock.method(SubProduct, "find", () => {
    throw new Error("query unavailable");
  });
  const items = [{ subproduct: f.productId, quantity: 1, unitPrice: 777 }];
  assert.deepEqual(
    await computeAuthoritativeLinePrices(items, { tenantId: f.tenantId }),
    items,
  );
});

test("batched pricing retains cross-product bundles and manual trigger prices", async (t) => {
  const f = fixture(t);
  const triggerId = oid();
  t.mock.method(Pricelist, "findOne", () =>
    query({
      rules: [
        {
          priceType: "bundle",
          subProduct: triggerId,
          bundleTargetSubProduct: f.productId,
          bundleQuantity: 6,
          bundleDiscount: 10,
          bundleDiscountType: "percentage",
          minQuantity: 0,
        },
      ],
    }),
  );
  const items = [
    {
      key: "trigger",
      subproduct: triggerId,
      quantity: 6,
      unitPrice: 777,
      priceOverridden: true,
    },
    { key: "target", subproduct: f.productId, quantity: 2, unitPrice: 1 },
  ];
  assert.deepEqual(
    (
      await computeAuthoritativeLinePrices(items, {
        tenantId: f.tenantId,
        pricelistId: oid(),
      })
    ).map((it) => it.unitPrice),
    [777, 900],
  );
});

test("batch loading matches the sequential calculation with simulated database latency", async (t) => {
  const f = fixture(t);
  const delayed = (value) => {
    const q = query(value);
    q.lean = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return value;
    };
    return q;
  };
  t.mock.method(SubProduct, "findById", () => delayed(f.product));
  t.mock.method(Size, "findById", () => delayed(f.size));
  t.mock.method(SubProduct, "find", () => delayed([f.product]));
  t.mock.method(Size, "find", () => delayed([f.size]));
  const { computeLinePricing } = require("../services/salesPricing.service");
  const items = Array.from({ length: 20 }, (_, i) => ({
    key: String(i),
    subproduct: f.productId,
    size: f.sizeId,
    quantity: i + 1,
    unitPrice: 1,
  }));
  const start = performance.now();
  const baseline = [];
  for (const it of items)
    baseline.push(
      (
        await computeLinePricing({
          subProductId: it.subproduct,
          sizeId: it.size,
          quantity: it.quantity,
          tenant: { revenueModel: "markup", markupPercentage: 0 },
        })
      ).unitPrice,
    );
  const serialMs = performance.now() - start;
  const batchStart = performance.now();
  const result = await computeAuthoritativeLinePrices(items, {
    tenantId: f.tenantId,
  });
  const batchMs = performance.now() - batchStart;
  assert.deepEqual(
    result.map((it) => it.unitPrice),
    baseline,
  );
  t.diagnostic(
    `20-line fixture, 10 ms/read: sequential ${serialMs.toFixed(1)} ms; batched ${batchMs.toFixed(1)} ms. Simulated latency, not production timing.`,
  );
});
