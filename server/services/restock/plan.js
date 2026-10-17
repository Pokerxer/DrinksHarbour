const { buildOrderGroups } = require("./groups");
const { attachPeriod } = require("./period");
const { validateDateRange } = require("../../utils/notificationDateRange");
const { id, key, DAY, dayStart } = require("./series");
const { transferDemand } = require("./transfer-demand");
const { localDemand, attachDemand } = require("./local-demand");
const { projectRisk, compareRisk } = require("./risk");
const { incomingSupply, vendorLeadTimes } = require("./supply");
const { attachSupplierPlan, reviewTransferSupply } = require("./supplier-plan");
const { buildSummaries } = require("./summaries");
const { applyTransferPlans } = require("./transfer-plan");
const { transferEvidence } = require("./transfer-evidence");
const { applyMinimum } = require("./minimum");
const { stockProductImage } = require("../stockProductImage");
function buildPlan(
  e,
  {
    now = new Date(),
    coverDays = 14,
    warehouseId = "",
    purchasing = false,
    useSavedMinimum = false,
    startDate,
    endDate,
  } = {},
) {
  const start = dayStart(now),
    end = start.getTime(),
    from = end - 180 * DAY;
  const sales = e.sales.rows.filter(
    (r) => Date.parse(r.at) >= from && Date.parse(r.at) < end,
  );
  const supply = incomingSupply(e.purchases, e.transfers, now),
    leadTimes = vendorLeadTimes(e.purchases, now);
  const byProduct = new Map(),
    bySupply = new Map();
  for (const row of sales) {
    const group = byProduct.get(row.subProductId) || [];
    group.push(row);
    byProduct.set(row.subProductId, group);
  }
  for (const row of supply) {
    const k = key(row),
      group = bySupply.get(k) || [];
    group.push(row);
    bySupply.set(k, group);
  }
  const transferFacts = transferEvidence(e, now);
  const periodRange = validateDateRange({ startDate, endDate }, now, true);
  const outflows = transferDemand(e, now, periodRange?.previous);
  const outbound = new Map();
  for (const row of transferFacts.pending)
    if (row.status !== "pending_approval") {
      const sourceKey = key({ ...row, warehouseId: row.sourceWarehouseId });
      outbound.set(sourceKey, (outbound.get(sourceKey) || 0) + row.quantity);
    }
  const lines = [];
  for (const product of e.products) {
    const productId = id(product),
      snapshot = e.snapshots.get(productId);
    const productSales = byProduct.get(productId) || [];
    const stocks = [...(snapshot?.stock || [])];
    const locationEvidence = [
      ...productSales.filter((r) => r.warehouseId),
      ...outflows.rows.filter((r) => r.subProductId === productId),
      ...transferFacts.pending
        .filter((r) => r.subProductId === productId)
        .flatMap((r) => [
          { ...r, warehouseId: r.destinationWarehouseId },
          { ...r, warehouseId: r.sourceWarehouseId },
        ]),
    ];
    for (const r of locationEvidence)
      if (
        !stocks.some(
          (s) =>
            id(s.sizeId) === r.sizeId && id(s.warehouseId) === r.warehouseId,
        )
      )
        stocks.push({
          sizeId: r.sizeId,
          warehouseId: r.warehouseId,
          available: null,
          threshold: product.lowStockThreshold ?? 10,
        });
    for (const stock of stocks) {
      const location = id(stock.warehouseId),
        size = id(stock.sizeId);

      const line = {
        key: key({
          subProductId: productId,
          sizeId: size,
          warehouseId: location,
        }),
        subProductId: productId,
        sizeId: size,
        warehouseId: location,
        productName:
          product.product?.name || product.name || product.sku || "Product",
        sku: product.sku || "",
        productImage: stockProductImage(product),
        sizeName: stock.sizeName || "",
        warehouseName:
          stock.warehouseName ||
          e.warehouses.find((w) => id(w) === location)?.name ||
          "Unassigned location",
        available: stock.available,
        threshold: stock.threshold ?? 10,
        buffer: product.reorderPoint ?? stock.threshold ?? 0,
        bufferSource: "configured_policy",
      };
      line.committedOutboundUnits = outbound.get(line.key) || 0;
      const own = productSales.filter((r) => r.sizeId === size);
      const assigned = own.filter((r) => r.warehouseId),
        allUnits = own.reduce((n, r) => n + r.units, 0);
      const incomplete =
        e.sales.uncertain.has(productId) ||
        own.some((r) => !r.warehouseId || r.locationUncertain);
      const demand = localDemand(own, outflows, line, now, incomplete);
      const { series, forecast: f } = demand;
      const local = own.filter((r) => r.warehouseId === location);
      const unitsSince = (days) =>
        local
          .filter((r) => Date.parse(r.at) >= end - days * DAY)
          .reduce((n, r) => n + r.units, 0);
      line.units30 = location && !incomplete ? unitsSince(30) : null;
      line.recordedUnits30 = location ? unitsSince(30) : null;
      line.salesDataStatus = e.sales.uncertain.has(productId)
        ? "incomplete_history"
        : incomplete
          ? "incomplete_location"
          : own.length
            ? "recorded"
            : "none";
      line.units7 = line.units30 === null ? null : unitsSince(7);
      line.previousUnits7 =
        line.units30 === null ? null : unitsSince(14) - line.units7;
      line.dailySales = line.units30 === null ? null : line.units30 / 30;
      line.assignmentCoverage =
        allUnits > 0
          ? assigned.reduce((n, r) => n + r.units, 0) / allUnits
          : null;
      line.limitations = [
        ...f.limitations,
        ...(incomplete
          ? [
              "Missing or ambiguous sales location evidence; local forecast is unavailable.",
            ]
          : []),
        ...(!location
          ? ["Receiving warehouse must be identified before ordering."]
          : []),
      ];
      attachDemand(line, demand);
      applyMinimum(line, stock, {
        useSavedMinimum,
        e,
        values: series.values,
        forecast: f,
        incomplete: demand.incomplete,
        facts: transferFacts,
        now,
      });
      line.incoming = bySupply.get(line.key) || [];
      Object.assign(
        line,
        projectRisk(
          line,
          f,
          line.incoming,
          line.minimumPolicy.status === "active"
            ? line.minimumPolicy.leadDays
            : 7,
          coverDays,
        ),
      );
      if (
        line.urgency === "unknown" &&
        Number.isFinite(line.available) &&
        line.available <= line.threshold
      )
        line.urgency = line.available <= 0 ? "urgent" : "normal";
      if (purchasing)
        attachSupplierPlan(line, e, { now, coverDays, leadTimes });
      // Stock depletion remains an alert even when no future demand is inferred.
      if (Number.isFinite(line.available) && line.available <= 0)
        line.urgency = "urgent";
      lines.push(line);
    }
  }
  lines.sort(compareRisk);
  applyTransferPlans(lines, e, { now, coverDays });
  if (purchasing) for (const line of lines) reviewTransferSupply(line);
  const visibleLines = warehouseId
    ? lines.filter((l) => l.warehouseId === warehouseId)
    : lines;
  const result = {
    generatedAt: now.toISOString(),
    historyEnd: start.toISOString(),
    coverDays,
    warehouses: e.warehouses.map((w) => ({ _id: id(w), name: w.name })),
    lines: visibleLines,
    summaries: buildSummaries(e, now),
    warnings: [
      "Recommendations reflect recorded net sales; stockout losses and missing evidence are not guessed.",
    ],
  };
  if (purchasing) result.groups = buildOrderGroups(visibleLines);
  attachPeriod(result, e, outflows, { startDate, endDate }, now);
  return result;
}
module.exports = { buildPlan };
