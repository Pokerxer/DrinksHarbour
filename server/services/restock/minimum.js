const { DAY, dayStart } = require('./series');
const VERSION = 'dh-stock-min-v1';
function freshMinimum(value, now = new Date()) {
  return value?.version === VERSION &&
    Number.isSafeInteger(value.units) &&
    value.units > 0 &&
    Date.parse(value.calculatedAt) <= now.getTime() &&
    Date.parse(value.validUntil) > now.getTime()
    ? value
    : null;
}
function automaticMinimum({
  values = [],
  forecast = {},
  incomplete = false,
  fallback = 10,
  previous,
  lead = { days: 7, source: 'planning_default' },
  now = new Date(),
}) {
  const saved = freshMinimum(previous, now);
  const base = {
    version: VERSION,
    status: incomplete ? 'incomplete' : 'learning',
    units: saved?.units ?? fallback,
    safetyUnits: saved?.safetyUnits ?? fallback,
    leadDays: lead.days,
    leadSource: lead.source,
    historyDays: values.length,
    calculatedAt: now.toISOString(),
    validUntil: new Date(now.getTime() + 2 * DAY).toISOString(),
  };
  if (
    incomplete ||
    values.length < 7 ||
    values.some((v) => !Number.isFinite(v) || v < 0) ||
    !values.some((v) => v > 0)
  )
    return base;
  const early = values.length < 28;
  const baseline = values.slice(-28);
  const demand = forecast.daily?.length
    ? forecast.daily
    : early
      ? Array(90).fill(baseline.reduce((a, b) => a + b, 0) / baseline.length)
      : [];
  if (demand.length < lead.days) return base;
  const recent = values.slice(-56),
    mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const deviation = Math.sqrt(
    recent.reduce((n, v) => n + (v - mean) ** 2, 0) / recent.length,
  );
  const safetyUnits = Math.ceil(
    2 * mean + 1.65 * deviation * Math.sqrt(lead.days),
  );
  const leadUnits = demand.slice(0, lead.days).reduce((a, b) => a + b, 0);
  let units = Math.max(1, Math.ceil(leadUnits + safetyUnits - 1e-8));
  if (saved && units < saved.units)
    units = Math.max(
      units,
      dayStart(saved.calculatedAt).getTime() === dayStart(now).getTime()
        ? saved.units
        : Math.ceil(saved.units * 0.75),
    );
  return {
    ...base,
    status: 'active',
    confidence: early ? 'early' : 'established',
    units,
    safetyUnits,
    leadUnits,
    dailySales: mean,
    salesStdDev: deviation,
    reviewDays: 2,
    serviceFactor: 1.65,
    method: early ? 'short_history_baseline' : forecast.method,
    model: forecast.model || null,
  };
}
module.exports = { automaticMinimum, freshMinimum, VERSION };

function applyMinimum(
  line,
  stock,
  { e, values, forecast, incomplete, facts, now, useSavedMinimum = false },
) {
  line.stockRecordId = stock.stockRecordId;
  line.previousMinimumAt = stock.automaticMinimum?.calculatedAt;
  line.minimumPolicy =
    e.salesIncluded === false || useSavedMinimum
      ? freshMinimum(stock.automaticMinimum, now) || {
          status: 'learning',
          units: line.threshold,
        }
      : automaticMinimum({
          values,
          forecast,
          incomplete: incomplete || !line.warehouseId,
          fallback: stock.configuredThreshold ?? stock.threshold ?? 10,
          previous: stock.automaticMinimum,
          lead: require('./minimum-lead').minimumLead(line, e, facts, now),
          now,
        });
  line.threshold = line.minimumPolicy.units;
  line.minimumPolicy = {
    ...line.minimumPolicy,
    demandBasis: line.minimumPolicy.demandBasis || line.demandBasis,
  };
  if (line.minimumPolicy.status === 'active') {
    line.buffer = line.minimumPolicy.safetyUnits;
    line.bufferSource = 'automatic_sales_policy';
  }
}
module.exports.applyMinimum = applyMinimum;

function stockMinimumFields(row, now = new Date()) {
  const saved = freshMinimum(row.automaticMinimum, now);
  return {
    minStockLevel: saved?.units ?? row.minStockLevel ?? 0,
    configuredMinStockLevel: row.minStockLevel ?? 0,
    minimumSource: saved ? 'automatic' : 'configured',
    minimumConfidence: saved?.confidence ?? null,
    minimumUpdatedAt: saved?.calculatedAt ?? null,
  };
}
module.exports.stockMinimumFields = stockMinimumFields;
