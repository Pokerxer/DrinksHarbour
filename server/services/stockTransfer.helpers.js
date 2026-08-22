// services/stockTransfer.helpers.js
//
// One rule, in one place: what a warehouse-to-warehouse transfer line is worth
// when the operator has not typed a price.
//
// A transfer moves stock between two warehouses of the SAME tenant, so the line
// is valued internally rather than sold. The wholesale price is the tenant's own
// B2B rate and is the closest thing they already hold to an internal transfer
// price; when it is absent, fall back to what the stock actually cost.
//
//   wholesale price → cost price → 0
//
// `wholesalePrice` lives on **Size**, not on SubProduct. A sub-product sold
// without size variants still owns a `defaultSize` Size document, so both
// shapes resolve through the same lookup — see enrichItems() in
// controllers/stockTransfer.controller.js.

const positive = (n) =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;

/**
 * Default unit cost for one transfer line.
 * @param {{ size?: object|null, subProduct?: object|null }} arg
 * @returns {number} a non-negative unit price (0 when nothing is priced)
 */
function resolveTransferUnitCost({ size, subProduct } = {}) {
  return (
    positive(size?.wholesalePrice) ??
    positive(size?.costPrice) ??
    positive(subProduct?.costPrice) ??
    0
  );
}

/**
 * Did the client actually choose a price? `0`, null and undefined all read as
 * "not supplied": the create form seeds every new line at 0, so a zero here
 * means nothing was chosen, not that the transfer is free.
 */
function hasExplicitUnitCost(value) {
  return positive(Number(value)) !== null;
}

module.exports = { resolveTransferUnitCost, hasExplicitUnitCost };
