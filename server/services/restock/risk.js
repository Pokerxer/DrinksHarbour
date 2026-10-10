const { DAY } = require('./series');
const rank = { urgent: 0, high: 1, normal: 2, monitor: 3, unknown: 4 };
function projectRisk(line, f, incoming = [], leadDays = 7, cover = 14) {
  const unknown = {
    urgency: 'unknown',
    daysOfCover: null,
    stockoutDate: null,
    suggestedUnits: null,
    incomingUnits: 0,
    forecastUnits: null,
  };
  if (!Number.isFinite(line.available) || !f.daily?.length) return unknown;
  const start = Date.parse(f.startDate) || 0,
    horizon = Math.ceil(leadDays + cover);
  if (horizon > f.daily.length)
    return {
      ...unknown,
      limitation: 'Supplier horizon exceeds available forecast',
    };
  const supply = incoming
    .filter(
      (r) =>
        Number.isFinite(r.quantity) &&
        r.quantity > 0 &&
        Number.isFinite(Date.parse(r.arrival)) &&
        Date.parse(r.arrival) >= start,
    )
    .map((r) => ({
      ...r,
      day: Math.max(1, Math.ceil((Date.parse(r.arrival) - start) / DAY)),
    }));
  const available = line.available - (line.committedOutboundUnits || 0);
  let balance = available,
    day = null;
  const hasDemand = f.daily.some((n) => n > 0);
  if (balance <= 0 && hasDemand) day = 0;
  for (let i = 0; i < f.daily.length && day === null; i++) {
    balance += supply
      .filter((r) => r.day === i + 1)
      .reduce((n, r) => n + r.quantity, 0);
    balance -= f.daily[i];
    if (balance <= 1e-8 && hasDemand) day = i + 1;
  }
  const incomingUnits = supply
    .filter((r) => r.day <= horizon)
    .reduce((n, r) => n + r.quantity, 0);
  const forecastUnits = f.daily.slice(0, horizon).reduce((a, b) => a + b, 0);
  let suggestedUnits = hasDemand
    ? Math.max(
        0,
        Math.ceil(
          forecastUnits + (line.buffer || 0) - available - incomingUnits - 1e-8,
        ),
      )
    : 0;
  if (hasDemand && line.minimumPolicy?.status === 'active')
    suggestedUnits = Math.max(
      suggestedUnits,
      Math.max(0, Math.ceil(line.threshold + 1 - available - incomingUnits)),
    );
  const urgency =
    day !== null && day < leadDays
      ? 'urgent'
      : day !== null && day <= leadDays + 3
        ? 'high'
        : suggestedUnits > 0
          ? 'normal'
          : 'monitor';
  return {
    urgency,
    daysOfCover: day,
    stockoutDate:
      day === null ? null : new Date(start + day * DAY).toISOString(),
    suggestedUnits,
    incomingUnits,
    forecastUnits,
  };
}
function compareRisk(a, b) {
  return (
    (rank[a.urgency] ?? 4) - (rank[b.urgency] ?? 4) ||
    (a.daysOfCover ?? Infinity) - (b.daysOfCover ?? Infinity) ||
    (b.demandUnits30 ?? b.units30 ?? 0) - (a.demandUnits30 ?? a.units30 ?? 0) ||
    String(a.key || '').localeCompare(String(b.key || ''))
  );
}
module.exports = { projectRisk, compareRisk };
