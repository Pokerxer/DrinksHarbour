const { transferEvidence } = require('./transfer-evidence');
const { key, id } = require('./series');
const { compareRisk } = require('./risk');
const { transferFollowups } = require('./transfer-followups');
function applyTransferPlans(
  lines,
  e,
  { now = new Date(), coverDays = 14 } = {},
) {
  const facts = transferEvidence(e, now),
    outbound = new Map(),
    routes = new Map();
  for (const p of facts.pending)
    if (p.status !== 'pending_approval') {
      const k = key({ ...p, warehouseId: p.sourceWarehouseId });
      outbound.set(k, (outbound.get(k) || 0) + p.quantity);
    }
  for (const h of facts.history) {
    const k = `${h.subProductId}:${h.sizeId}:${h.destinationWarehouseId}:${h.sourceWarehouseId}`,
      route = routes.get(k) || [];
    route.push(h);
    routes.set(k, route);
  }
  const remaining = new Map();
  for (const line of lines) {
    const forecast = line.forecast?.daily || [];
    const reserve = Math.max(
      line.threshold || 0,
      (line.buffer || 0) +
        forecast.slice(0, coverDays).reduce((a, b) => a + b, 0),
    );
    remaining.set(
      line.key,
      Number.isFinite(line.available)
        ? Math.max(
            0,
            Math.floor(
              line.available - (outbound.get(line.key) || 0) - reserve,
            ),
          )
        : 0,
    );
    line.transferPlan = {
      availableAfterCommitments: Number.isFinite(line.available)
        ? Math.max(0, line.available - (outbound.get(line.key) || 0))
        : null,
      outboundUnits: outbound.get(line.key) || 0,
      protectedUnits: Math.ceil(reserve),
      sources: [],
      pending: [],
      usualSources: [],
      basis: 'configured_minimum',
      nextStep: 'monitor',
      needUnits: 0,
      pendingUnits: 0,
      additionalUnits: 0,
      uncoveredUnits: 0,
    };
  }
  transferFollowups(lines, e, facts, now);
  for (const line of [...lines].sort(compareRisk)) {
    const plan = line.transferPlan;
    const own = plan.pending;
    plan.pendingUnits = own
      .filter((p) => p.status !== 'pending_approval')
      .reduce((n, p) => n + p.quantity, 0);
    if (!line.warehouseId || !Number.isFinite(line.available)) {
      plan.nextStep = 'verify_stock';
      continue;
    }
    const hasForecast = Number.isFinite(line.suggestedUnits);
    plan.basis = hasForecast ? 'forecast' : 'configured_minimum';
    plan.needUnits = hasForecast
      ? line.suggestedUnits
      : Math.max(
          0,
          Math.ceil((line.threshold || 0) + 1 - plan.availableAfterCommitments),
        );
    if (plan.availableAfterCommitments > (line.threshold || 0) && !hasForecast)
      plan.needUnits = 0;
    plan.additionalUnits = Math.max(0, plan.needUnits - plan.pendingUnits);
    plan.uncoveredUnits = plan.additionalUnits;
    const candidates = lines.filter(
      (s) =>
        s.warehouseId &&
        s.warehouseId !== line.warehouseId &&
        s.subProductId === line.subProductId &&
        s.sizeId === line.sizeId,
    );
    const routeOf = (source) => {
      const history =
        routes.get(
          `${line.subProductId}:${line.sizeId}:${line.warehouseId}:${source.warehouseId}`,
        ) || [];
      const times = history
        .map((h) => h.transitDays)
        .filter((n) => n !== null)
        .sort((a, b) => a - b);
      return {
        sourceWarehouseId: source.warehouseId,
        sourceWarehouseName: source.warehouseName,
        deliveries: new Set(history.map((h) => h.transferId)).size,
        netUnits: history.reduce((n, h) => n + h.quantity, 0),
        lastReceivedAt:
          history
            .map((h) => h.at)
            .sort()
            .at(-1) || null,
        typicalTransitDays:
          times.length >= 3 ? times[Math.floor(times.length / 2)] : null,
      };
    };
    const routeFacts = candidates
      .map((s) => ({ ...routeOf(s), source: s }))
      .sort(
        (a, b) =>
          b.deliveries - a.deliveries ||
          b.netUnits - a.netUnits ||
          String(b.lastReceivedAt).localeCompare(String(a.lastReceivedAt)) ||
          a.source.key.localeCompare(b.source.key),
      );
    plan.usualSources = e.warehouses
      .filter((w) => id(w) !== line.warehouseId)
      .map((w) => routeOf({ warehouseId: id(w), warehouseName: w.name }))
      .filter((r) => r.deliveries >= 3)
      .sort((a, b) => b.deliveries - a.deliveries || b.netUnits - a.netUnits);
    if (own.some((p) => p.status === 'pending_approval')) {
      plan.nextStep = 'approval_review';
      continue;
    }
    if (!plan.additionalUnits) {
      plan.nextStep = plan.pendingUnits ? 'follow_up' : 'monitor';
      continue;
    }
    if (e.allowTransfers !== false)
      for (const r of routeFacts.sort(
        (a, b) =>
          Number(b.deliveries >= 3) - Number(a.deliveries >= 3) ||
          (remaining.get(b.source.key) || 0) -
            (remaining.get(a.source.key) || 0),
      )) {
        const safeSurplus = remaining.get(r.source.key) || 0;
        const quantity = Math.min(plan.uncoveredUnits, safeSurplus);
        if (quantity <= 0) continue;
        const { source, ...route } = r;
        plan.sources.push({
          ...route,
          usualSource: r.deliveries >= 3,
          safeSurplus,
          recommendedUnits: quantity,
          protectedUnits: source.transferPlan.protectedUnits,
          outboundUnits: source.transferPlan.outboundUnits,
          needsManualReview: !source.forecast?.daily?.length || !hasForecast,
        });
        remaining.set(source.key, safeSurplus - quantity);
        plan.uncoveredUnits -= quantity;
        if (!plan.uncoveredUnits) break;
      }
    plan.nextStep = plan.sources.length
      ? 'transfer_review'
      : plan.pendingUnits
        ? 'follow_up'
        : 'purchase_review';
    if (e.allowTransfers === false) plan.transfersDisabled = true;
  }
  return lines;
}
module.exports = { applyTransferPlans };
