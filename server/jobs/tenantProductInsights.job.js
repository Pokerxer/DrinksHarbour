const cron = require('node-cron');
const {
  reportingWindows,
  buildProductInsights,
} = require('../services/tenantProductInsights.rules');
const {
  getStockSnapshots,
} = require('../services/tenantProductInsights.stock');
const { getNetSales } = require('../services/tenantProductInsights.sales');
const {
  getTenantRecipients,
} = require('../services/tenantNotificationRecipients');
const {
  deliverInsights,
  resolveStockEpisodes,
} = require('../services/tenantNotificationDelivery');
require('../models/Product');
const SubProduct = require('../models/SubProduct');
const Tenant = require('../models/Tenant');
const {
  ensureNotificationDedupIndex,
} = require('../services/tenantNotificationIndexes');
const defaultDeps = {
  page: (tenant, last) =>
    SubProduct.find({ tenant, ...(last ? { _id: { $gt: last } } : {}) })
      .select(
        'product sku availableStock lowStockThreshold reorderQuantity createdAt status',
      )
      .populate('product', 'name')
      .sort({ _id: 1 })
      .limit(100)
      .lean(),
  stock: getStockSnapshots,
  sales: getNetSales,
  recipients: getTenantRecipients,
  deliver: deliverInsights,
  resolve: resolveStockEpisodes,
};
async function scanTenantProducts(
  tenantId,
  { now = new Date(), includeSales = false, recipientId } = {},
  deps = defaultDeps,
) {
  const w = reportingWindows(now),
    recipients = await deps.recipients(tenantId, recipientId);
  if (!recipients.length) return { delivered: 0 };
  let last,
    delivered = 0;
  const active = [],
    unknown = [];
  while (true) {
    const products = await deps.page(tenantId, last);
    if (!products.length) break;
    const stock = await deps.stock(tenantId, products);
    const sales = includeSales
      ? await deps.sales(
          tenantId,
          products.map((p) => p._id),
          w,
        )
      : new Map();
    const drafts = [];
    for (const p of products) {
      if (['archived', 'discontinued', 'deleted'].includes(p.status)) continue;
      const key = String(p._id),
        snapshot = stock.get(key);
      if (!snapshot || snapshot.stock.some((r) => r.available === null))
        unknown.push(p._id);
      const evidence = sales.get(key) || {
        currentUnits: 0,
        previousUnits: 0,
        units30: 0,
      };
      const notices = buildProductInsights(
        {
          subProductId: p._id,
          name: p.product?.name || p.sku || 'Product',
          stock: snapshot?.stock || [],
          reorderQuantity: p.reorderQuantity,
          observedSince: p.createdAt,
          ...(includeSales
            ? evidence
            : { currentUnits: null, previousUnits: null, units30: null }),
        },
        w,
      );
      active.push(
        ...notices
          .filter((n) => n.type === 'low_stock_alert')
          .map((n) => n.identity),
      );
      drafts.push(...notices);
    }
    delivered += (await deps.deliver(tenantId, drafts, recipients, now))
      .delivered;
    last = products[products.length - 1]._id;
  }
  await deps.resolve(tenantId, active, unknown, now, undefined, recipientId);
  return { delivered };
}
// A daily insight sweep must survive overlap with a long stock sweep.
function createSweep(work) {
  let running = false,
    pendingSales = false;
  return async function sweep(includeSales = false) {
    if (running) {
      pendingSales ||= includeSales;
      return;
    }
    running = true;
    try {
      let sales = includeSales;
      do {
        pendingSales = false;
        await work(sales);
        sales = pendingSales;
      } while (pendingSales);
    } finally {
      running = false;
    }
  };
}
const scanAllTenants = createSweep(async (includeSales) => {
  await ensureNotificationDedupIndex();
  for await (const t of Tenant.find({ status: 'approved' })
    .select('_id')
    .lean()
    .cursor()) {
    try {
      await scanTenantProducts(t._id, { includeSales });
    } catch {
      console.error(
        `[product insights] tenant ${t._id} scan failed; retry on next scheduled scan`,
      );
    }
  }
});
function startTenantProductInsightsCron() {
  require('./tenantDemandForecast.job').startTenantDemandForecastCron();
  const run = (includeSales) => () =>
    scanAllTenants(includeSales).catch(() =>
      console.error('[product insights] sweep failed'),
    );
  cron.schedule('*/15 * * * *', run(false), { timezone: 'Africa/Lagos' });
  cron.schedule('0 9 * * *', run(true), { timezone: 'Africa/Lagos' });
}
module.exports = {
  scanTenantProducts,
  scanAllTenants,
  startTenantProductInsightsCron,
  createSweep,
};
