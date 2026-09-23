// Shared physical-store retail basis. Website markup and sales never enter it.
function retailPriceBasis(sp, size) {
  return {
    sellingPrice:
      (size?.sellingPrice > 0 ? size.sellingPrice : null) ??
      sp.basePriceBeforePricelist ??
      sp.baseSellingPrice ??
      0,
    costPrice: (size?.costPrice > 0 ? size.costPrice : null) ?? sp.costPrice ?? 0,
  };
}
module.exports = { retailPriceBasis };
