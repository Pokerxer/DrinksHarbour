const { id, DAY, dayStart, dailySeries } = require("./series");
const { forecast } = require("./model");
const { stockProductImage } = require("../stockProductImage");
function buildSummaries(e, now) {
  const end = dayStart(now),
    from = end.getTime() - 180 * DAY;
  const groups = new Map();
  for (const row of e.sales.rows)
    if (Date.parse(row.at) >= from && Date.parse(row.at) < end.getTime()) {
      const k = `${row.subProductId}:${row.sizeId}`,
        rows = groups.get(k) || [];
      rows.push(row);
      groups.set(k, rows);
    }
  const summaries = [];
  for (const p of e.products) {
    const product = id(p),
      stock = e.snapshots.get(product)?.stock || [];
    const sizes = new Set([
      ...stock.map((r) => id(r.sizeId)),
      ...Array.from(groups.keys())
        .filter((k) => k.startsWith(`${product}:`))
        .map((k) => k.split(":")[1]),
    ]);
    for (const size of sizes) {
      const rows = groups.get(`${product}:${size}`) || [],
        ownStock = stock.filter((r) => id(r.sizeId) === size);
      const series = dailySeries(
        rows.map((r) => ({ ...r, warehouseId: "" })),
        `${product}:${size}:`,
        now,
      );
      const f = forecast(
        e.sales.uncertain.has(product) ? [] : series.values,
        90,
        end,
      );
      const since = (days) =>
        rows
          .filter((r) => Date.parse(r.at) >= end.getTime() - days * DAY)
          .reduce((n, r) => n + r.units, 0);
      const units30 = !e.sales.uncertain.has(product) ? since(30) : null;
      summaries.push({
        key: `${product}:${size}:tenant-summary`,
        summary: true,
        subProductId: product,
        sizeId: size,
        warehouseId: "",
        productName: p.product?.name || p.name || p.sku || "Product",
        productImage: stockProductImage(p),
        salesDataStatus: e.sales.uncertain.has(product)
          ? "incomplete_history"
          : rows.length
            ? "recorded"
            : "none",
        sku: p.sku || "",
        sizeName: ownStock[0]?.sizeName || "",
        warehouseName: "All locations · tenant total",
        available:
          ownStock.length && ownStock.every((r) => Number.isFinite(r.available))
            ? ownStock.reduce((n, r) => n + r.available, 0)
            : null,
        units30,
        units7: units30 === null ? null : since(7),
        previousUnits7: units30 === null ? null : since(14) - since(7),
        dailySales: units30 === null ? null : units30 / 30,
        forecast: f,
        historyStart: series.startDate,
        limitations: [
          ...f.limitations,
          "Tenant-wide forecast only; missing warehouse demand is not allocated to a location.",
        ],
      });
    }
  }
  return summaries;
}
module.exports = { buildSummaries };
