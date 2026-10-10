const { DAY } = require("./series");
const EPS = 1e-8;
function projectReplenishment(
  line,
  f,
  incoming = [],
  leadDays = 7,
  cover = 14,
  now = new Date(),
) {
  const start = Date.parse(f?.startDate);
  const horizonDays = Math.ceil(leadDays + cover);
  const delivery = now.getTime() + leadDays * DAY;
  const result = {
    horizonDays,
    deliveryDate: Number.isFinite(delivery)
      ? new Date(delivery).toISOString()
      : null,
    availableAfterCommitments: null,
    forecastUnits: null,
    forecastAfterDeliveryUnits: null,
    safetyUnits: null,
    minimumTargetUnits: null,
    incomingUnits: 0,
    excludedIncomingUnits: 0,
    balanceAtDelivery: null,
    projectedEndingUnits: null,
    shortfallBeforeDelivery: null,
    suggestedUnits: null,
    daysOfCover: null,
    stockoutDate: null,
    urgency: "unknown",
  };
  const unavailable = (reason) => ({ ...result, manualReviewReason: reason });
  const commitments = line.committedOutboundUnits ?? 0;
  const available =
    Number.isFinite(line.available) &&
    Number.isFinite(commitments) &&
    commitments >= 0
      ? line.available - commitments
      : null;
  const safetyUnits = Number.isFinite(line.buffer)
    ? Math.max(0, line.buffer)
    : 0;
  const minimumTargetUnits =
    line.minimumPolicy?.status === "active" && Number.isFinite(line.threshold)
      ? Math.max(safetyUnits, line.threshold + 1)
      : safetyUnits;
  const buckets = new Map();
  let incomingUnits = 0,
    excludedIncomingUnits = 0;
  for (const row of incoming) {
    if (!Number.isFinite(row.quantity) || row.quantity <= 0) continue;
    const at = Date.parse(row.arrival);
    const day = Math.floor((at - start) / DAY);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(horizonDays) ||
      !Number.isFinite(at) ||
      at < Math.max(start, now.getTime()) ||
      day >= horizonDays
    ) {
      excludedIncomingUnits += row.quantity;
    } else incomingUnits += row.quantity;
    if (
      Number.isFinite(at) &&
      at >= Math.max(start, now.getTime()) &&
      day < (f?.daily?.length ?? 0)
    )
      buckets.set(day, (buckets.get(day) || 0) + row.quantity);
  }
  Object.assign(result, {
    availableAfterCommitments: available,
    safetyUnits,
    minimumTargetUnits,
    incomingUnits,
    excludedIncomingUnits,
  });
  if (!Number.isFinite(commitments) || commitments < 0)
    return unavailable("Verify outgoing stock commitments before ordering.");
  if (!Number.isFinite(line.available))
    return unavailable(
      "Verify the receiving warehouse stock balance before ordering.",
    );
  if (line.available < 0)
    return unavailable(
      "Verify the negative warehouse balance before ordering.",
    );
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(delivery) ||
    delivery < start ||
    !Number.isFinite(leadDays) ||
    leadDays < 0 ||
    !Number.isFinite(cover) ||
    cover <= 0 ||
    !f?.daily?.length ||
    f.method === "insufficient_history" ||
    horizonDays > f.daily.length ||
    f.daily.some((n) => !Number.isFinite(n) || n < 0)
  )
    return unavailable(
      "Complete demand history must support the supplier delivery plus stock-cover horizon.",
    );
  const deliveryDay = Math.floor((delivery - start) / DAY);
  const hasDemand = f.daily.slice(deliveryDay, horizonDays).some((n) => n > 0);
  const needsSupply = hasDemand || available < 0;
  const anyDemand = f.daily.some((n) => n > 0);
  let balance = available,
    daysOfCover =
      available <= 0 && f.daily.slice(0, horizonDays).some((n) => n > 0)
        ? 0
        : null;
  let shortfallBeforeDelivery = 0,
    suggestedUnits = 0,
    balanceAtDelivery = null,
    projectedEndingUnits = null;
  for (let day = 0; day < f.daily.length; day++) {
    balance += buckets.get(day) || 0;
    if (day === deliveryDay) {
      balanceAtDelivery = balance;
      if (needsSupply && line.minimumPolicy?.status === "active")
        suggestedUnits = Math.max(suggestedUnits, minimumTargetUnits - balance);
    }
    const beforeDemand = balance;
    balance -= f.daily[day];
    if (day < deliveryDay) {
      // Missed forecast sales are not customer backorders. Preserve only the
      // real deficit from recorded outbound commitments until stock arrives.
      shortfallBeforeDelivery += Math.max(
        0,
        f.daily[day] - Math.max(0, beforeDemand),
      );
      balance =
        Math.min(0, beforeDemand) +
        Math.max(0, Math.max(0, beforeDemand) - f.daily[day]);
    }
    if (daysOfCover === null && balance <= EPS && anyDemand)
      daysOfCover = day + 1;
    if (day >= deliveryDay && day < horizonDays && needsSupply)
      suggestedUnits = Math.max(suggestedUnits, safetyUnits - balance);
    if (day === horizonDays - 1) projectedEndingUnits = balance;
  }
  suggestedUnits = needsSupply
    ? Math.max(0, Math.ceil(suggestedUnits - EPS))
    : 0;
  shortfallBeforeDelivery = Math.max(
    0,
    Math.ceil(shortfallBeforeDelivery - EPS),
  );
  return {
    ...result,
    availableAfterCommitments: available,
    safetyUnits,
    minimumTargetUnits,
    incomingUnits,
    excludedIncomingUnits,
    balanceAtDelivery,
    projectedEndingUnits,
    shortfallBeforeDelivery,
    suggestedUnits,
    daysOfCover,
    forecastAfterDeliveryUnits: f.daily
      .slice(deliveryDay, horizonDays)
      .reduce((a, b) => a + b, 0),
    forecastUnits: f.daily.slice(0, horizonDays).reduce((a, b) => a + b, 0),
    stockoutDate:
      daysOfCover === null
        ? null
        : new Date(start + daysOfCover * DAY).toISOString(),
    urgency:
      shortfallBeforeDelivery > 0 || daysOfCover === 0
        ? "urgent"
        : daysOfCover !== null && daysOfCover <= leadDays + 3
          ? "high"
          : suggestedUnits > 0
            ? "normal"
            : "monitor",
  };
}
module.exports = { projectReplenishment };
