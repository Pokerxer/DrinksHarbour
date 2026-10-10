const { validateDateRange } = require("../../utils/notificationDateRange");
const { effectivePermissions } = require("../effectivePermissions.service");
const { ForbiddenError, ValidationError } = require("../../utils/errors");
function access(user) {
  if (
    !user?.tenant ||
    !["tenant_owner", "tenant_admin", "tenant_staff"].includes(user.role) ||
    user.status !== "active"
  )
    throw new ForbiddenError("Tenant planning access unavailable");
  const permissions = effectivePermissions(user),
    purchase = ["tenant_owner", "tenant_admin"].includes(user.role);
  return {
    inventory: permissions.includes("inventory:read"),
    reports: permissions.includes("reports:read"),
    purchase,
  };
}
function validateOptions(query = {}) {
  const keys = [
    "startDate",
    "endDate",
    "coverDays",
    "warehouseId",
    "subProductId",
    "sizeId",
    "refresh",
  ];
  if (Object.keys(query).some((k) => !keys.includes(k)))
    throw new ValidationError("Unsupported planning query");
  for (const k of ["warehouseId", "subProductId", "sizeId"])
    if (
      query[k] !== undefined &&
      (typeof query[k] !== "string" || !/^[a-f\d]{24}$/i.test(query[k]))
    )
      throw new ValidationError(`Invalid ${k}`);
  if (
    query.coverDays !== undefined &&
    !["7", "14", "30"].includes(query.coverDays)
  )
    throw new ValidationError("Invalid coverDays");
  if (query.refresh !== undefined && !["true", "false"].includes(query.refresh))
    throw new ValidationError("Invalid refresh");
  validateDateRange(query, new Date(), true);
  return {
    ...(query.startDate
      ? { startDate: query.startDate, endDate: query.endDate }
      : {}),
    coverDays: Number(query.coverDays || 14),
    warehouseId: query.warehouseId || "",
    subProductId: query.subProductId || "",
    sizeId: query.sizeId || "",
    refresh: query.refresh === "true",
  };
}
function publicPlan(plan, a) {
  const { groups, ...result } = plan;
  result.canSeeStock = a.inventory;
  result.canSeeDemand = a.reports;
  result.canPurchase = a.purchase;
  const publicLine = (row) => {
    const line = { ...row };
    delete line.stockRecordId;
    delete line.previousMinimumAt;
    if (!a.purchase)
      for (const k of ["selected", "alternatives"]) delete line[k];
    if (a.purchase && (!a.inventory || !a.reports)) {
      const hideProjection = (offer) => {
        if (!offer) return offer;
        const safe = {
          ...offer,
          quantity: 0,
          packs: 0,
          estimatedCost: 0,
          needsManualReview: true,
          manualReviewReason:
            "Inventory and report access are required for automatic restock quantities.",
        };
        for (const field of [
          "replenishment",
          "suggestedUnits",
          "daysOfCover",
          "stockoutDate",
          "incomingUnits",
          "purchaseAlternativeQuantity",
          "urgency",
        ])
          delete safe[field];
        return safe;
      };
      line.selected = hideProjection(line.selected);
      if (line.alternatives)
        line.alternatives = line.alternatives.map(hideProjection);
    }
    if (!a.inventory)
      for (const k of [
        "available",
        "threshold",
        "minimumPolicy",
        "buffer",
        "bufferSource",
        "incoming",
        "incomingUnits",
        "daysOfCover",
        "stockoutDate",
        "suggestedUnits",
        "urgency",
        "transferPlan",
        "committedOutboundUnits",
      ])
        delete line[k];
    if (!a.reports) {
      if (line.minimumPolicy)
        line.minimumPolicy = {
          status: line.minimumPolicy.status,
          confidence: line.minimumPolicy.confidence,
          demandBasis: line.minimumPolicy.demandBasis,
          units: line.minimumPolicy.units,
          calculatedAt: line.minimumPolicy.calculatedAt,
        };
      if (line.transferPlan?.basis === "forecast") delete line.transferPlan;
      for (const k of [
        "forecast",
        "periodUnits",
        "periodPreviousUnits",
        "periodDemandUnits",
        "units30",
        "recordedUnits30",
        "transferUnits30",
        "demandUnits30",
        "demandBasis",
        "transferDataStatus",
        "salesDataStatus",
        "units7",
        "previousUnits7",
        "dailySales",
        "assignmentCoverage",
        "historyStart",
        "daysOfCover",
        "stockoutDate",
        "suggestedUnits",
        "forecastUnits",
        "buffer",
        "bufferSource",
        "incoming",
        "incomingUnits",
        "limitations",
      ])
        delete line[k];
      line.urgency =
        Number.isFinite(line.available) && line.available <= line.threshold
          ? line.available <= 0
            ? "urgent"
            : "normal"
          : "monitor";
    }
    return line;
  };
  result.lines = plan.lines.map(publicLine);
  if (plan.summaries) result.summaries = plan.summaries.map(publicLine);
  if (a.purchase && a.inventory && a.reports && groups) result.groups = groups;
  return result;
}
module.exports = { access, validateOptions, publicPlan };
