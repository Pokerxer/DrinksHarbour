// Deterministic advice. Quantities are sellable units, never money or pack counts.
const DAY = 86400000;
const known = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
function reportingWindows(now = new Date()) {
  const civil = new Date(now.getTime() + 3600000);
  const midnight = Date.UTC(
    civil.getUTCFullYear(),
    civil.getUTCMonth(),
    civil.getUTCDate(),
  );
  const end = midnight - 3600000;
  const monday = midnight - ((civil.getUTCDay() + 6) % 7) * DAY;
  return {
    end: new Date(end).toISOString(),
    start: new Date(end - 7 * DAY).toISOString(),
    previousStart: new Date(end - 14 * DAY).toISOString(),
    monthStart: new Date(end - 30 * DAY).toISOString(),
    weekKey: new Date(monday).toISOString().slice(0, 10),
  };
}
function buildProductInsights(s, w) {
  const notices = [];
  const add = (type, title, message, priority, identity, metadata) =>
    notices.push({
      type,
      title,
      message,
      priority,
      identity,
      subProduct: s.subProductId,
      actionUrl:
        type === 'low_stock_alert'
          ? metadata.warehouseId &&
            /^[a-f\d]{24}$/i.test(String(metadata.warehouseId))
            ? `/notifications/warehouses?warehouseId=${metadata.warehouseId}`
            : '/notifications/stock'
          : '/notifications/performance',
      actionLabel: 'Review stock',
      metadata: {
        productName: s.name,
        ...(type === 'low_stock_alert'
          ? {}
          : { periodStart: w.start, periodEnd: w.end }),
        ...metadata,
      },
    });
  const rows = (s.stock || []).filter(
    (r) => known(r.available) && known(r.threshold),
  );
  for (const r of rows) {
    if (r.available > r.threshold) continue;
    const label = [s.name, r.sizeName, r.warehouseName]
      .filter(Boolean)
      .join(' · ');
    add(
      'low_stock_alert',
      r.available <= 0 ? 'Out of stock' : 'Stock running low',
      `${label}: ${r.available} units available (${r.minimumSource === 'automatic' ? 'automatic minimum' : 'alert threshold'} ${r.threshold}). Review your stock and restock.`,
      r.available <= 0 ? 'urgent' : 'high',
      `stock:${s.subProductId}:${r.sizeId || ''}:${r.warehouseId || ''}`,
      {
        available: r.available,
        threshold: r.threshold,
        minimumSource: r.minimumSource,
        minimumConfidence: r.minimumConfidence,
        minimumUpdatedAt: r.minimumUpdatedAt,
        sizeId: r.sizeId,
        warehouseId: r.warehouseId,
        sizeName: r.sizeName,
        warehouseName: r.warehouseName,
        rule: 'low_stock',
      },
    );
  }
  if (!known(s.currentUnits) || !known(s.previousUnits) || !known(s.units30))
    return notices;
  const current = s.currentUnits,
    previous = s.previousUnits;
  if (
    current >= 5 &&
    (previous === 0 || (previous >= 5 && current >= previous * 1.25))
  ) {
    const comparison =
      previous === 0
        ? 'There were no net sales in the previous seven days.'
        : `Up ${Math.round((current / previous - 1) * 100)}% from ${previous} in the previous seven days.`;
    add(
      'product_performance',
      'Selling well',
      `${s.name}: ${current} net units sold in the last seven complete days. ${comparison}`,
      'normal',
      `performance:${s.subProductId}:${w.weekKey}`,
      { currentUnits: current, previousUnits: previous, rule: 'growth' },
    );
  }
  // Missing stock is not zero. Advice needs a complete, known stock snapshot.
  if (!rows.length || rows.length !== (s.stock || []).length) return notices;
  const available = rows.reduce((n, r) => n + r.available, 0);
  if (current > 0 && available / (current / 7) < 7) {
    const suggested = Math.max(
      known(s.reorderQuantity) ? s.reorderQuantity : 0,
      Math.ceil(2 * current - available),
    );
    add(
      'product_suggestion',
      'Plan a restock',
      `${s.name}: ${available} units available and ${current} net units sold in seven days. Consider ${suggested} units to cover 14 days at this pace.`,
      'normal',
      `restock:${s.subProductId}:${w.weekKey}`,
      {
        available,
        currentUnits: current,
        suggestedUnits: suggested,
        rule: 'restock',
      },
    );
  }
  if (
    available > 0 &&
    s.units30 === 0 &&
    s.observedSince &&
    new Date(s.observedSince).getTime() <= new Date(w.monthStart).getTime()
  ) {
    add(
      'product_suggestion',
      'Review a slow-moving product',
      `${s.name}: ${available} units in stock with no net sales in the last 30 complete days. Review visibility, placement and pricing before buying more.`,
      'low',
      `slow:${s.subProductId}:${w.weekKey}`,
      { available, units30: 0, rule: 'slow_mover', periodStart: w.monthStart },
    );
  }
  return notices;
}
module.exports = { buildProductInsights, reportingWindows, known };
