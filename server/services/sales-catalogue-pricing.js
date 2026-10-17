// Catalogue candidates are independent quotes, never an artificial cart of all
// visible products (which would incorrectly activate cross-product offers).
const mongoose = require("mongoose");
const Tenant = require("../models/Tenant");
const Pricelist = require("../models/Pricelist");
const { loadPricingRecords, idOf } = require("./salesPricing-data");
const { computeLinePricing } = require("./salesPricing.service");
const { ValidationError, NotFoundError } = require("../utils/errors");

function quantitiesOf(input) {
  try {
    const values = input ? JSON.parse(input) : {};
    if (!values || typeof values !== "object" || Array.isArray(values))
      throw Error();
    if (Object.keys(values).length > 2000) throw Error();
    for (const [key, quantity] of Object.entries(values)) {
      if (
        !/^[a-f\d]{24}\|(?:[a-f\d]{24})?$/i.test(key) ||
        !Number.isSafeInteger(quantity) ||
        quantity < 0 ||
        quantity > 1000000
      )
        throw Error();
    }
    return values;
  } catch {
    throw new ValidationError("Invalid catalogue quantities");
  }
}

async function priceCataloguePage(products, tenantId, options = {}) {
  if (!mongoose.isValidObjectId(tenantId))
    throw new ValidationError("Select a tenant before pricing the catalogue");
  const quantities = quantitiesOf(options.quantities);
  if (options.pricelistId && !mongoose.isValidObjectId(options.pricelistId))
    throw new ValidationError("Invalid catalogue pricelist");
  const [tenant, pricelist] = await Promise.all([
    Tenant.findById(tenantId)
      .select("revenueModel markupPercentage commissionPercentage")
      .lean(),
    options.pricelistId
      ? Pricelist.findOne({ _id: options.pricelistId, tenant: tenantId }).lean()
      : null,
  ]);
  if (options.pricelistId && !pricelist)
    throw new NotFoundError("Pricelist not found for this tenant");
  const items = products.flatMap((product) =>
    !product.sellWithoutSizeVariants && product.sizes?.length
      ? product.sizes.map((size) => ({
          subproduct: product._id,
          size: size._id,
        }))
      : [{ subproduct: product._id }],
  );
  const records = await loadPricingRecords(items, tenantId);
  async function quote(subproduct, size) {
    const quantity = Math.max(
      1,
      quantities[`${idOf(subproduct)}|${idOf(size)}`] || 1,
    );
    const pricing = await computeLinePricing({
      subProductId: subproduct,
      sizeId: size,
      quantity,
      pricelist,
      tenant,
      records,
    });
    if (!pricing || !Number.isFinite(pricing.unitPrice))
      throw new ValidationError(
        "Unable to calculate catalogue prices. Please retry.",
      );
    return { unitPrice: pricing.unitPrice, quantity };
  }
  return Promise.all(
    products.map(async (product) => {
      if (product.sellWithoutSizeVariants || !product.sizes?.length)
        return { ...product, salesPricing: await quote(product._id) };
      return {
        ...product,
        sizes: await Promise.all(
          product.sizes.map(async (size) => ({
            ...size,
            salesPricing: await quote(product._id, size._id),
          })),
        ),
      };
    }),
  );
}

module.exports = { priceCataloguePage };
