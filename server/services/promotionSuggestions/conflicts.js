function scheduledDiscount(value, start, end, now) {
  return (
    value > 0 &&
    (!end || +new Date(end) >= +now) &&
    (!start || +new Date(start) <= +now + 60 * 86400000)
  );
}
function localDiscountConflict(sp, size, now) {
  return (
    scheduledDiscount(
      size?.discountValue,
      size?.discountStart,
      size?.discountEnd,
      now,
    ) ||
    scheduledDiscount(sp?.discount, sp?.discountStart, sp?.discountEnd, now) ||
    (sp?.flashSale?.isActive &&
      (!sp.flashSale.endDate || +new Date(sp.flashSale.endDate) >= +now)) ||
    sp?.bundleDeals?.some(
      (d) => d.active && (!d.validUntil || +new Date(d.validUntil) >= +now),
    ) ||
    sp?.loyaltyDiscount?.enabled ||
    false
  );
}
const id = (v) => String(v?._id || v || "");
function promotionMatches(p, target) {
  const includes = (values, value) =>
    (values || []).some((v) => id(v) === id(value));
  if (
    includes(p.excludedSubProducts, target.subProductId) ||
    includes(p.excludedSizes, target.sizeId)
  )
    return false;
  if (p.sizes?.length && !includes(p.sizes, target.sizeId)) return false;
  if (p.applyTo === "all") return true;
  if (p.applyTo === "specific_products")
    return p.subProducts?.length
      ? includes(p.subProducts, target.subProductId)
      : !!p.sizes?.length;
  if (p.applyTo === "specific_categories" || p.applyTo === "specific_brands") {
    const field = p.applyTo === "specific_categories" ? "category" : "brand";
    // Missing catalogue taxonomy cannot prove that stacking is safe.
    if (!target.product?.[field]) return true;
    return includes(
      p[field === "category" ? "categories" : "brands"],
      target.product[field],
    );
  }
  return true;
}
module.exports = { localDiscountConflict, promotionMatches };
