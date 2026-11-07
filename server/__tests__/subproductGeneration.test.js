const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildPrompt,
  normalizeDraft,
} = require("../services/subproductGenerationPrompt");
for (const [type, business] of [
  ["wine", "Beverages"],
  ["beauty_skincare", "Beauty"],
  ["home_furniture", "Home"],
  ["electronics_laptop", "Electronics"],
  ["fashion_dress", "Fashion"],
  ["foodservice_produce", "Food Service"],
  ["hospitality_linen", "Hospitality"],
]) {
  test(`${business} uses its own generation brief`, () => {
    const prompt = buildPrompt(
      { name: "Example", type, abv: 40 },
      {},
      "content",
    );
    assert.ok(prompt.includes(business));
    if (type !== "wine") assert.ok(!prompt.includes('"abv":40'));
    assert.ok(prompt.includes("Do not invent"));
  });
}
test("SEO draft excludes unexpected fields and enforces lengths", () => {
  const draft = normalizeDraft(
    {
      metaTitle: "a".repeat(100),
      metaDescription: "b".repeat(200),
      metaKeywords: ["LAMP", "lamp"],
      sellingPrice: 1,
    },
    "seo",
  );
  assert.equal(draft.metaTitle.length, 60);
  assert.equal(draft.metaDescription.length, 160);
  assert.deepEqual(draft.metaKeywords, ["lamp"]);
  assert.equal(draft.sellingPrice, undefined);
  assert.throws(() => normalizeDraft({}, "seo"), /empty/i);
});
