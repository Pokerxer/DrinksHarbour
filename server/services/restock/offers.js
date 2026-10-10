const { id } = require("./series");
const money = (v) => Math.round(v * 100) / 100;
const pct = (v) => Math.min(100, Math.max(0, Number(v) || 0));
function netPrice(item, discount = 0) {
  return money(
    money(item.unitPrice * (1 - pct(item.discountPercent) / 100)) *
      (1 - pct(discount) / 100),
  );
}
function validTerms(item) {
  const pack = item.packagingQty ?? 1,
    min = item.minQuantity ?? 1,
    max = item.maxQuantity;
  return (
    Number.isSafeInteger(pack) &&
    pack > 0 &&
    Number.isFinite(min) &&
    min >= 0 &&
    (max == null ||
      (Number.isFinite(max) &&
        max >= min &&
        Math.ceil(min / pack) * pack <= max))
  );
}
function roundOrder(need, item) {
  if (!Number.isFinite(need) || need < 0 || !validTerms(item)) return null;
  if (need === 0) return { quantity: 0, packs: 0 };
  const pack = item.packagingQty ?? 1,
    min = item.minQuantity ?? 1;
  if (!Number.isInteger(pack) || pack < 1 || !Number.isFinite(min) || min < 0)
    return null;
  const quantity = Math.ceil(Math.max(need, min) / pack) * pack;
  if (
    !Number.isSafeInteger(quantity) ||
    (item.maxQuantity != null && quantity > item.maxQuantity)
  )
    return null;
  return { quantity, packs: quantity / pack };
}
function matchOffers(line, lists, tenantId, now, leadTimes = new Map()) {
  const matches = [];
  for (const list of lists) {
    const vendor = list.vendor;
    if (
      id(list.tenant) !== id(tenantId) ||
      !list.isActive ||
      !vendor?.isActive ||
      id(vendor.tenant) !== id(tenantId)
    )
      continue;
    if (
      list.startDate &&
      (!Number.isFinite(Date.parse(list.startDate)) ||
        Date.parse(list.startDate) > now.getTime())
    )
      continue;
    if (
      list.endDate &&
      (!Number.isFinite(Date.parse(list.endDate)) ||
        Date.parse(list.endDate) < now.getTime())
    )
      continue;
    for (const item of list.items || []) {
      if (
        id(item.subProductId) !== line.subProductId ||
        id(item.sizeId) !== line.sizeId ||
        !Number.isFinite(item.unitPrice) ||
        item.unitPrice <= 0 ||
        !validTerms(item)
      )
        continue;
      const lead = leadTimes.get(id(vendor)) ?? item.leadTimeDays ?? 7;
      if (!Number.isFinite(lead) || lead < 0 || lead > 90) continue;
      matches.push({
        offerId: `${id(list)}:${id(item) || list.items.indexOf(item)}`,
        pricelistId: id(list),
        vendorId: id(vendor),
        vendorName: vendor.name,
        currency: list.currency || "NGN",
        unitPrice: netPrice(item, list.discountPercent),
        packagingQty: item.packagingQty ?? 1,
        packaging: item.packaging || "Units",
        minQuantity: item.minQuantity ?? 1,
        maxQuantity: item.maxQuantity ?? null,
        leadTimeDays: Math.ceil(lead),
        leadTimeSource: leadTimes.has(id(vendor))
          ? "observed_receipts"
          : "pricelist",
        isPreferred: !!item.isPreferred,
        source: list.autoManaged ? "purchase_history" : "manual",
        vendorProductCode: item.vendorProductCode || "",
      });
    }
  }
  return matches.filter(
    (o) =>
      o.source === "manual" ||
      !matches.some(
        (m) =>
          m.source === "manual" &&
          m.vendorId === o.vendorId &&
          m.currency === o.currency &&
          m.minQuantity === o.minQuantity &&
          m.maxQuantity === o.maxQuantity,
      ),
  );
}
function compareOffers(a, b, currency) {
  const allowed = (o) => (o.currency === currency ? 0 : 1);
  const timely = (o) =>
    o.daysOfCover === null || o.leadTimeDays <= o.daysOfCover;
  const preferred = (o) => (o.isPreferred && timely(o) ? 0 : 1);
  const urgent = a.urgency === "urgent" || b.urgency === "urgent";
  return (
    allowed(a) - allowed(b) ||
    Number(!!a.needsManualReview) - Number(!!b.needsManualReview) ||
    Number(!timely(a)) - Number(!timely(b)) ||
    preferred(a) - preferred(b) ||
    (urgent ? a.leadTimeDays - b.leadTimeDays : 0) ||
    a.estimatedCost - b.estimatedCost ||
    a.offerId.localeCompare(b.offerId)
  );
}
module.exports = { roundOrder, netPrice, matchOffers, compareOffers };
