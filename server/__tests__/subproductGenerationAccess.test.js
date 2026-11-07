const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createSubproductGenerator,
} = require("../services/subproductGeneration.service");
const p = "69d1f1970aef5189677bf137",
  s = "69d1f1970aef5189677bf138",
  other = "69d1f1970aef5189677bf139";
const query = (value) => ({
  select() {
    return this;
  },
  populate() {
    return this;
  },
  lean: async () => value,
});
function setup(listing, product = { name: "Lamp", type: "home_lighting" }) {
  const state = { calls: 0 };
  const handler = createSubproductGenerator({
    SubProduct: {
      findOne: (filter) => {
        state.listingFilter = filter;
        return query(listing);
      },
    },
    Product: {
      findOne: (filter) => {
        state.productFilter = filter;
        return query(product);
      },
    },
    model: "test-model",
    generate: async (prompt) => {
      state.calls++;
      state.prompt = prompt;
      return {
        metaTitle: "Lamp",
        metaDescription: "A lamp.",
        metaKeywords: ["lamp"],
        sellingPrice: 1,
      };
    },
  });
  const res = {
    json: (value) => {
      state.result = value;
    },
  };
  return { handler, state, res };
}
test("tenant listing lookup is scoped and only authorized facts reach AI", async () => {
  const { handler, state, res } = setup({ product: p, sizes: [] });
  await handler(
    {
      user: { role: "tenant_admin", tenant: "tenant-a" },
      body: { subProductId: s, mode: "seo" },
    },
    res,
  );
  assert.deepEqual(state.listingFilter, { _id: s, tenant: "tenant-a" });
  assert.equal(state.productFilter.$or[1].owningTenant, "tenant-a");
  assert.equal(state.result.data.sellingPrice, undefined);
  assert.equal(state.result.metadata.model, "test-model");
  assert.ok(state.prompt.includes("Home & Living"));
});
test("missing or foreign listing fails before AI", async () => {
  const { handler, state, res } = setup(null);
  await assert.rejects(
    handler(
      {
        user: { role: "tenant_admin", tenant: "tenant-a" },
        body: { subProductId: s },
      },
      res,
    ),
    (e) => e.statusCode === 404,
  );
  assert.equal(state.calls, 0);
});
test("mismatched parent and customer access fail before AI", async () => {
  const { handler, state, res } = setup({ product: p });
  await assert.rejects(
    handler(
      {
        user: { role: "tenant_admin", tenant: "tenant-a" },
        body: { subProductId: s, productId: other },
      },
      res,
    ),
    (e) => e.statusCode === 400,
  );
  await assert.rejects(
    handler({ user: { role: "customer" }, body: { productId: p } }, res),
    (e) => e.statusCode === 403,
  );
  assert.equal(state.calls, 0);
});
test("subproduct schema retains SEO without changing product identity", () => {
  const SubProduct = require("../models/SubProduct");
  const listing = new SubProduct({
    product: p,
    metaTitle: "Desk lamp",
    metaDescription: "A compact desk lamp.",
    seoH1: "Desk lamp",
    metaKeywords: ["lamp"],
  });
  assert.equal(listing.toObject().metaTitle, "Desk lamp");
  assert.equal(String(listing.product), p);
});
test("private parent products are not available through a direct product ID", async () => {
  const { handler, state, res } = setup(null, null);
  await assert.rejects(
    handler(
      {
        user: { role: "tenant_admin", tenant: "tenant-a" },
        body: { productId: p },
      },
      res,
    ),
    (e) => e.statusCode === 404,
  );
  assert.deepEqual(state.productFilter.$or, [
    { publicationScope: { $ne: "tenant_private" } },
    { owningTenant: "tenant-a" },
  ]);
  assert.equal(state.calls, 0);
});
test("invalid generation modes and IDs fail before model invocation", async () => {
  const { handler, state, res } = setup(null);
  for (const body of [
    { productId: p, mode: "prices" },
    { subProductId: "bad-id" },
  ])
    await assert.rejects(
      handler({ user: { role: "admin" }, body }, res),
      (e) => e.statusCode === 400,
    );
  assert.equal(state.calls, 0);
});
test("provider failures return an error rather than fabricated SEO", async () => {
  const handler = createSubproductGenerator({
    Product: {},
    SubProduct: {},
    model: "test",
    generate: async () => {
      throw new Error("provider unavailable");
    },
  });
  await assert.rejects(
    handler(
      {
        user: { role: "admin" },
        body: {
          inlineContext: { name: "Lamp", type: "home_lighting" },
          mode: "seo",
        },
      },
      { json: () => assert.fail("Should not return fake content") },
    ),
    (e) => e.statusCode === 502,
  );
});
