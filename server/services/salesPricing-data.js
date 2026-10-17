const mongoose = require("mongoose");
const SubProduct = require("../models/SubProduct");
const Size = require("../models/Size");

const PRODUCT_FIELDS =
  "product sku baseSellingPrice commissionPriceOverride basePriceBeforePricelist costPrice isOnSale saleType saleStartDate saleEndDate saleDiscountValue flashSale bundleDeals sizes";
const idOf = (id) => String(id?._id || id || "");
const uniqueIds = (values) => [
  ...new Set(values.map(idOf).filter((id) => mongoose.isValidObjectId(id))),
];

// Request-local snapshots only: changing a pricelist or saving always reads fresh data.
async function loadPricingRecords(items, tenantId) {
  const priceable = items.filter((it) => it.subproduct && !it.priceOverridden);
  const productIds = uniqueIds(priceable.map((it) => it.subproduct));
  const sizeIds = uniqueIds(priceable.map((it) => it.size));
  const [products, sizes] = await Promise.allSettled([
    Promise.resolve().then(() =>
      productIds.length
        ? SubProduct.find({ tenant: tenantId, _id: { $in: productIds } })
            .select(PRODUCT_FIELDS)
            .populate("product", "platformMarkup platformDiscount")
            .populate("sizes", "wholesalePrice isDefault unitsPerPack")
            .lean()
        : [],
    ),
    Promise.resolve().then(() =>
      sizeIds.length
        ? Size.find({ tenant: tenantId, _id: { $in: sizeIds } })
            .select(
              "subproduct costPrice sellingPrice commissionPriceOverride wholesalePrice unitsPerPack",
            )
            .lean()
        : [],
    ),
  ]);
  return {
    products: new Map(
      (products.status === "fulfilled" ? products.value : []).map((sp) => [
        idOf(sp._id),
        sp,
      ]),
    ),
    sizes: new Map(
      (sizes.status === "fulfilled" ? sizes.value : []).map((size) => [
        idOf(size._id),
        size,
      ]),
    ),
    sizeReadFailed: sizes.status === "rejected",
  };
}

module.exports = { PRODUCT_FIELDS, idOf, loadPricingRecords };
