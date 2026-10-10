const { readEvidence } = require("../restock/reader");
const { buildPlan } = require("../restock/plan");
const { dayStart, DAY } = require("../restock/series");
const { validateDateRange } = require("../../utils/notificationDateRange");
const { stockProductImage } = require("../stockProductImage");
const { groupBaskets } = require("./baskets");
const { localDiscountConflict, promotionMatches } = require("./conflicts");
const { AppError } = require("../../utils/errors");
const id = (v) => String(v?._id || v || "");
async function bounded(q, limit) {
  const rows = await q
    .limit(limit + 1)
    .maxTimeMS(15000)
    .lean();
  if (rows.length > limit)
    throw new AppError(
      "Promotion evidence exceeds safe capacity; narrow the scope.",
      422,
    );
  return rows;
}
async function readSuggestions(tenantId, opts, now, canPrice) {
  const Size = require("../../models/Size"),
    SubProduct = require("../../models/SubProduct"),
    Promotion = require("../../models/Promotion");
  const e = await readEvidence(tenantId, {
    ...opts,
    now,
    baskets: true,
    purchasing: false,
  });
  const range = validateDateRange(opts, now, true);
  const end = range?.end || dayStart(now),
    start = range?.start || new Date(+end - 90 * DAY),
    days = Math.round((+end - +start) / DAY);
  const ids = e.products.map((p) => p._id);
  const [sizes, prices, promotions] = await Promise.all([
    bounded(
      Size.find({
        tenant: tenantId,
        subproduct: { $in: ids },
        status: { $in: ["active", "seasonal", "limited_edition"] },
        availability: { $in: ["available", "low_stock"] },
      }).select(
        "subproduct sellingPrice costPrice currency discountValue discountType discountStart discountEnd",
      ),
      10000,
    ),
    bounded(
      SubProduct.find({
        tenant: tenantId,
        _id: { $in: ids },
        status: { $in: ["active", "low_stock"] },
      })
        .select(
          "product baseSellingPrice costPrice currency discount discountStart discountEnd flashSale bundleDeals loyaltyDiscount",
        )
        .populate("product", "category brand name type subType"),
      5000,
    ),
    bounded(
      Promotion.find({
        tenant: tenantId,
        $or: [{ isActive: true }, { status: { $in: ["active", "scheduled"] } }],
        startDate: { $lte: new Date(+now + 60 * DAY) },
        $and: [{ $or: [{ endDate: null }, { endDate: { $gte: now } }] }],
      }).select(
        "applyTo subProducts sizes categories brands excludedSubProducts excludedSizes",
      ),
      1000,
    ),
  ]);
  const plan = buildPlan(e, { now, coverDays: 14 });
  const sizeMap = new Map(
    sizes.map((s) => [`${id(s.subproduct)}:${id(s)}`, s]),
  );
  const priceMap = new Map(prices.map((p) => [id(p), p]));
  const productMap = new Map(e.products.map((p) => [id(p), p]));
  const eligible = new Set(
    e.products.filter((p) => !e.sales.uncertain.has(id(p))).map(id),
  );
  const totals = new Map();
  for (const r of e.sales.rows) {
    if (
      Date.parse(r.at) < +start ||
      Date.parse(r.at) >= +end ||
      (opts.warehouseId && r.warehouseId !== opts.warehouseId)
    )
      continue;
    const key = `${r.subProductId}:${r.sizeId}:${r.warehouseId}`;
    totals.set(key, (totals.get(key) || 0) + r.units);
  }
  const variants = plan.lines
    .filter(
      (l) =>
        l.warehouseId &&
        (!opts.warehouseId || l.warehouseId === opts.warehouseId) &&
        priceMap.has(l.subProductId) &&
        (!l.sizeId || sizeMap.has(`${l.subProductId}:${l.sizeId}`)),
    )
    .map((l) => {
      const variantKey = `${l.subProductId}:${l.sizeId}`,
        size = sizeMap.get(variantKey);
      const sp = priceMap.get(l.subProductId),
        raw = productMap.get(l.subProductId);
      const conflict =
        localDiscountConflict(sp, size, now) ||
        promotions.some((p) =>
          promotionMatches(p, {
            subProductId: l.subProductId,
            sizeId: l.sizeId,
            product: sp.product,
          }),
        );
      return {
        key: l.key,
        variantKey,
        subProductId: l.subProductId,
        sizeId: l.sizeId,
        productName: l.productName,
        drinkType: sp.product?.type,
        drinkSubType: sp.product?.subType,
        catalogueName: sp.product?.name,
        sizeName: l.sizeName,
        sku: l.sku,
        image: stockProductImage(raw),
        warehouseId: l.warehouseId,
        warehouseName: l.warehouseName,
        available:
          l.transferPlan?.availableAfterCommitments ??
          (l.available === null
            ? null
            : l.available - (l.committedOutboundUnits || 0)),
        protected: Math.max(
          l.threshold || 0,
          l.transferPlan?.protectedUnits || 0,
        ),
        critical: ["urgent", "high"].includes(l.urgency),
        incomplete:
          !eligible.has(l.subProductId) ||
          l.salesDataStatus?.startsWith("incomplete"),
        units: totals.get(l.key) || 0,
        price: size?.sellingPrice ?? (l.sizeId ? null : sp?.baseSellingPrice),
        cost: size?.costPrice ?? (l.sizeId ? null : sp?.costPrice),
        currency: size?.currency || sp?.currency || "NGN",
        conflict,
      };
    });
  const allowed = new Set(
    variants.filter((p) => !p.incomplete).map((p) => p.variantKey),
  );
  return {
    variants,
    baskets: groupBaskets(e.sales.rows, allowed, start, end, opts.warehouseId),
    days,
    warehouses: plan.warehouses,
    start: start.toISOString(),
    end: end.toISOString(),
    canPrice,
    warnings: [
      "Suggestions are previews; they do not activate promotions or predict guaranteed sales uplift.",
      "Prices use recorded retail/cost amounts; verify their tax basis before activation.",
      "Unassigned locations and incomplete sales evidence cannot support a learned combo.",
    ],
  };
}
module.exports = { readSuggestions };
