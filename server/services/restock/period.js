const { validateDateRange } = require("../../utils/notificationDateRange");
function attachPeriod(plan, evidence, outflows, options, now) {
  const range = validateDateRange(options, now, true);
  if (!range) return;
  const totals = new Map(),
    unknown = new Set();
  const add = (identity, period, units) => {
    const values = totals.get(identity) || [0, 0];
    values[period] += units;
    totals.set(identity, values);
  };
  for (const row of evidence.sales.rows) {
    const at = Date.parse(row.at);
    if (at < +range.previous || at >= +range.end || !Number.isFinite(at))
      continue;
    const product = `${row.subProductId}:${row.sizeId}`,
      location = `${product}:${row.warehouseId}`;
    const period = at >= +range.start ? 0 : 1;
    add(product, period, row.units);
    add(location, period, row.units);
    if (!row.warehouseId || row.locationUncertain) unknown.add(product);
  }
  const transfers = new Map();
  for (const row of outflows.rows) {
    const at = Date.parse(row.at);
    if (at >= +range.start && at < +range.end) {
      const identity = `${row.subProductId}:${row.sizeId}:${row.warehouseId}`;
      transfers.set(identity, (transfers.get(identity) || 0) + row.units);
    }
  }
  for (const line of [...plan.lines, ...(plan.summaries || [])]) {
    const product = `${line.subProductId}:${line.sizeId}`,
      identity = line.summary ? product : `${product}:${line.warehouseId}`;
    const blocked =
      evidence.sales.uncertain.has(line.subProductId) ||
      (!line.summary && (!line.warehouseId || unknown.has(product)));
    const values = totals.get(identity) || [0, 0];
    line.periodUnits = blocked ? null : values[0];
    line.periodPreviousUnits = blocked ? null : values[1];
    line.periodDemandUnits =
      blocked || (!line.summary && outflows.uncertain.has(line.key))
        ? null
        : values[0] + (line.summary ? 0 : transfers.get(identity) || 0);
  }
  plan.period = {
    startDate: range.startDate,
    endDate: range.endDate,
    days: range.days,
  };
}
module.exports = { attachPeriod };
