const { reportingWindows } = require('../tenantProductInsights.rules');
const {
  deliverInsights,
  resolveStockEpisodes,
} = require('../tenantNotificationDelivery');
const { getTenantRecipients } = require('../tenantNotificationRecipients');
const {
  ensureNotificationDedupIndex,
} = require('../tenantNotificationIndexes');
function forecastDrafts(plan, now) {
  const drafts = [],
    suggested = new Map(),
    w = reportingWindows(now);
  for (const l of plan.lines) {
    if (!l.warehouseId || !Number.isFinite(l.available)) continue;
    const threshold = l.available <= l.threshold,
      risk =
        ['urgent', 'high'].includes(l.urgency) &&
        l.forecast?.method !== 'insufficient_history';
    if (threshold || risk)
      drafts.push({
        type: 'low_stock_alert',
        identity: `stock:${l.subProductId}:${l.sizeId}:${l.warehouseId}`,
        subProduct: l.subProductId,
        title: threshold
          ? 'Warehouse stock running low'
          : 'Warehouse stockout risk',
        message: `${l.productName} · ${l.warehouseName}: ${l.available} units available. Review this warehouse's stock and replenishment needs.`,
        priority: l.urgency === 'urgent' ? 'urgent' : risk ? 'high' : 'normal',
        actionUrl: `/notifications/warehouses?warehouseId=${l.warehouseId}&subProductId=${l.subProductId}`,
        actionLabel: 'Review warehouse',
        forecastValidUntil: new Date(now.getTime() + (risk ? 86400000 : 0)),
        metadata: {
          productName: l.productName,
          sizeName: l.sizeName,
          warehouseName: l.warehouseName,
          available: l.available,
          threshold: l.threshold,
          daysOfCover: l.daysOfCover,
          units30: l.units30,
          model: l.forecast?.model,
          method: l.forecast?.method,
          stockoutDate: l.stockoutDate,
          forecastGeneratedAt: plan.generatedAt,
          rule: threshold ? 'low_stock' : 'forecast_stock',
        },
      });
    if (l.suggestedUnits > 0) {
      const old = suggested.get(l.subProductId) || {
        name: l.productName,
        quantity: 0,
      };
      old.quantity += l.suggestedUnits;
      suggested.set(l.subProductId, old);
    }
  }
  for (const [product, l] of suggested)
    drafts.push({
      type: 'product_suggestion',
      identity: `restock:${product}:${w.weekKey}`,
      subProduct: product,
      title: 'Review restock recommendations',
      message: `${l.name}: review ${l.quantity} suggested units across its recorded warehouse needs. Supplier terms and pack sizes are applied in the order plan.`,
      priority: 'normal',
      actionUrl: `/notifications/restock?subProductId=${product}`,
      actionLabel: 'Review restock',
      purchaseOnly: true,
      metadata: {
        productName: l.name,
        suggestedUnits: l.quantity,
        periodStart: w.start,
        periodEnd: w.end,
        rule: 'forecast_restock',
      },
    });
  return drafts;
}
const synced = new Map(),
  running = new Map();
async function syncForecastNotifications(
  tenantId,
  plan,
  now = new Date(),
  recipientId,
) {
  const key = `${tenantId}:${recipientId || '*'}`;
  if (synced.get(key) === plan.generatedAt) return { delivered: 0 };
  if (running.has(key)) return running.get(key);
  const work = performSync(tenantId, plan, now, recipientId);
  running.set(key, work);
  try {
    const result = await work;
    if (synced.size >= 1000) synced.delete(synced.keys().next().value);
    synced.set(key, plan.generatedAt);
    return result;
  } finally {
    running.delete(key);
  }
}
async function performSync(tenantId, plan, now, recipientId) {
  await ensureNotificationDedupIndex();
  const recipients = await getTenantRecipients(tenantId, recipientId),
    drafts = forecastDrafts(plan, now);
  const active = drafts
    .filter((d) => d.type === 'low_stock_alert')
    .map((d) => d.identity);
  const unknown = plan.lines
    .filter(
      (l) =>
        l.available == null || l.forecast?.method === 'insufficient_history',
    )
    .map((l) => l.subProductId);
  await deliverInsights(tenantId, drafts, recipients, now);
  const clear = plan.lines
    .filter(
      (l) =>
        l.available != null &&
        l.forecast?.method !== 'insufficient_history' &&
        !active.includes(
          `stock:${l.subProductId}:${l.sizeId}:${l.warehouseId}`,
        ),
    )
    .map((l) => `stock:${l.subProductId}:${l.sizeId}:${l.warehouseId}`);
  if (clear.length)
    await require('../../models/Notification').updateMany(
      {
        tenant: tenantId,
        ...(recipientId ? { recipient: recipientId } : {}),
        type: 'low_stock_alert',
        dedupKey: { $in: clear },
      },
      { $set: { forecastValidUntil: now } },
    );
  await resolveStockEpisodes(
    tenantId,
    active,
    unknown,
    now,
    undefined,
    recipientId,
  );
  return { delivered: drafts.length };
}
module.exports = { forecastDrafts, syncForecastNotifications };
