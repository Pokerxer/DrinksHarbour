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
const chain = (value) => ({
  select() {
    return this;
  },
  populate() {
    return this;
  },
  lean: async () => value,
});

for (const scenario of [
  "sales base",
  "wholesale formula",
  "wholesale pack",
  "percentage bundle",
]) {
  test(`catalogue matches sales editor for ${scenario}`, async (t) => {
    const {
      priceCataloguePage,
    } = require("../services/sales-catalogue-pricing");
    const tenant = oid(),
      sub = oid(),
      size = oid(),
      list = oid();
    const sizeDoc = {
      _id: size,
      subproduct: sub,
      sellingPrice: 35000,
      costPrice: 9120,
      wholesalePrice: 17328,
      unitsPerPack: 6,
      isDefault: true,
    };
    const sp = {
      _id: sub,
      product: { platformMarkup: 15 },
      baseSellingPrice: 35000,
      costPrice: 9120,
      sizes: [sizeDoc],
      bundleDeals: [],
    };
    const rules =
      scenario === "wholesale formula"
        ? [
            {
              priceType: "formula",
              markupBase: "wholesale",
              markupPercentage: 47.5,
            },
          ]
        : scenario === "wholesale pack"
          ? [
              {
                priceType: "bundle",
                bundleQuantity: 2,
                bundleUnitsMode: "pack",
                bundleDiscountType: "markup_on_cost",
                bundleMarkupBase: "wholesale",
                bundleDiscount: 47.5,
              },
            ]
          : scenario === "percentage bundle"
            ? [
                {
                  priceType: "bundle",
                  bundleQuantity: 6,
                  bundleDiscountType: "percentage",
                  bundleDiscount: 10,
                },
              ]
            : [];
    t.mock.method(Tenant, "findById", () =>
      chain({ _id: tenant, revenueModel: "markup", markupPercentage: 25 }),
    );
    t.mock.method(Pricelist, "findOne", (query) => {
      assert.equal(String(query.tenant), String(tenant));
      return chain({ _id: list, rules });
    });
    t.mock.method(SubProduct, "find", (query) => {
      assert.equal(String(query.tenant), String(tenant));
      return chain([sp]);
    });
    t.mock.method(Size, "find", () => chain([sizeDoc]));
    const rows = [{ ...sp, sizes: [{ ...sizeDoc }] }];
    const key = `${sub}|${size}`;
    const priced = await priceCataloguePage(rows, String(tenant), {
      pricelistId: String(list),
      quantities: JSON.stringify({ [key]: 6 }),
    });
    const [line] = await computeAuthoritativeLinePrices(
      [{ subproduct: sub, size, quantity: 6, unitPrice: 35000 }],
      { tenantId: tenant, pricelistId: list },
    );
    assert.equal(priced[0].sizes[0].salesPricing.unitPrice, line.unitPrice);
    assert.equal(priced[0].sizes[0].salesPricing.quantity, 6);
    assert.notEqual(line.unitPrice, 35000);
    if (scenario === "wholesale pack") assert.equal(line.unitPrice, 25600);
  });
}

test("catalogue refuses foreign pricelists and invalid quantity data", async (t) => {
  const { priceCataloguePage } = require("../services/sales-catalogue-pricing");
  t.mock.method(Pricelist, "findOne", () => chain(null));
  t.mock.method(Tenant, "findById", () => chain({}));
  await assert.rejects(
    priceCataloguePage([], String(oid()), { pricelistId: String(oid()) }),
    /Pricelist not found/,
  );
  await assert.rejects(
    priceCataloguePage([], String(oid()), { quantities: "invalid" }),
    /Invalid catalogue quantities/,
  );
});
