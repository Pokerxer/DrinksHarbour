const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildPrompt,
  normalizeDraft,
} = require("../services/subproductGenerationPrompt");
const {
  createSubproductGenerator,
} = require("../services/subproductGeneration.service");
const id = "69d1f1970aef5189677bf137";
test("central content prompt and output contain only central description fields", () => {
  const prompt = buildPrompt(
    { name: "Lamp", type: "home_lighting" },
    {},
    "content",
    "product",
  );
  assert.ok(!prompt.includes("tenantNotes"));
  const result = normalizeDraft(
    {
      shortDescription: "Desk lamp",
      description: "A recorded lamp.",
      tenantNotes: "private",
      isPublished: true,
    },
    "content",
    "product",
  );
  assert.deepEqual(result, {
    shortDescription: "Desk lamp",
    description: "A recorded lamp.",
  });
});
test("tenant callers cannot generate a central-catalog draft", async () => {
  const handler = createSubproductGenerator({
    Product: {},
    SubProduct: {},
    generate: () => assert.fail("Should not call AI"),
    model: "test",
  });
  await assert.rejects(
    handler(
      {
        body: { target: "product", productId: id },
        user: { role: "tenant_admin", tenant: "own" },
      },
      {},
    ),
    (e) => e.statusCode === 403,
  );
});
test("central draft requires an existing product rather than inline or listing identity", async () => {
  const handler = createSubproductGenerator({
    Product: {},
    SubProduct: {},
    generate: () => assert.fail("Should not call AI"),
    model: "test",
  });
  for (const body of [
    { target: "product", inlineContext: { name: "Lamp" } },
    { target: "product", productId: id, subProductId: id },
  ])
    await assert.rejects(
      handler({ body, user: { role: "admin" } }, {}),
      (e) => e.statusCode === 400,
    );
});
test("platform admin generates from the saved central product and only returns central fields", async () => {
  const product = { name: "Chair", type: "home_furniture" };
  let filter, output, prompt;
  const query = {
    populate() {
      return this;
    },
    lean: async () => product,
  };
  const handler = createSubproductGenerator({
    Product: {
      findOne: (value) => {
        filter = value;
        return query;
      },
    },
    SubProduct: {},
    model: "test-model",
    generate: async (value) => {
      prompt = value;
      return {
        shortDescription: "Chair",
        description: "Recorded chair.",
        tenantNotes: "discard",
        status: "published",
      };
    },
  });
  await handler(
    { body: { target: "product", productId: id }, user: { role: "admin" } },
    {
      json: (value) => {
        output = value;
      },
    },
  );
  assert.deepEqual(filter, { _id: id });
  assert.ok(prompt.includes("Home & Living"));
  assert.deepEqual(output.data, {
    shortDescription: "Chair",
    description: "Recorded chair.",
  });
  assert.equal(output.metadata.target, "product");
});
