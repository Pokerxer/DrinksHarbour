// Default is read-only preview. --apply persists genuine alerts for approved tenants.
const path = require('node:path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  quiet: true,
});
const mongoose = require('mongoose');
if (process.env.NODE_DNS_SERVERS?.trim()) {
  require('node:dns').promises.setServers(
    process.env.NODE_DNS_SERVERS.split(',').map((s) => s.trim()),
  );
}
const Tenant = require('../models/Tenant');
const SubProduct = require('../models/SubProduct');
require('../models/Product');
const Notification = require('../models/Notification');
const {
  ensureNotificationDedupIndex,
} = require('../services/tenantNotificationIndexes');
const {
  getStockSnapshots,
} = require('../services/tenantProductInsights.stock');
const {
  getTenantRecipients,
  allowedTypes,
} = require('../services/tenantNotificationRecipients');
const { scanTenantProducts } = require('../jobs/tenantProductInsights.job');
async function main() {
  const args = process.argv.slice(2),
    apply = args.includes('--apply');
  if (
    args.some((arg) => arg !== '--apply' && !/^--tenant=[a-z0-9-]+$/.test(arg))
  )
    throw Error('Invalid options');
  const slug = args.find((arg) => arg.startsWith('--tenant='))?.slice(9);
  if (!process.env.MONGODB_URI) throw Error('Missing database configuration');
  await mongoose.connect(process.env.MONGODB_URI, {
    maxPoolSize: 2,
    serverSelectionTimeoutMS: 10000,
    autoIndex: false,
  });
  const tenants = await Tenant.find({
    status: 'approved',
    ...(slug ? { slug } : {}),
  })
    .select('_id name slug')
    .lean();
  if (slug && !tenants.length) throw Error('Approved tenant not found');
  if (apply) await ensureNotificationDedupIndex();
  for (const tenant of tenants) {
    const recipients = await getTenantRecipients(tenant._id);
    const eligible = recipients.filter((r) =>
      allowedTypes(r).includes('low_stock_alert'),
    ).length;
    const products = await SubProduct.find({
      tenant: tenant._id,
      status: { $nin: ['archived', 'discontinued', 'deleted'] },
    })
      .select('_id availableStock lowStockThreshold')
      .lean();
    const stocks = await getStockSnapshots(tenant._id, products);
    const lowStockEntries = Array.from(stocks.values()).reduce(
      (count, s) =>
        count +
        s.stock.filter(
          (r) => Number.isFinite(r.available) && r.available <= r.threshold,
        ).length,
      0,
    );
    const scope = {
      tenant: tenant._id,
      type: 'low_stock_alert',
      isArchived: false,
    };
    const before = await Notification.countDocuments(scope);
    console.log(
      JSON.stringify({
        mode: apply ? 'apply' : 'preview',
        tenant: tenant.slug,
        lowStockEntries,
        eligibleRecipients: eligible,
        alertsBefore: before,
      }),
    );
    if (apply) {
      const result = await scanTenantProducts(tenant._id, {
        includeSales: false,
      });
      const after = await Notification.countDocuments(scope);
      console.log(
        JSON.stringify({
          tenant: tenant.slug,
          alertWrites: result.delivered,
          alertsAfter: after,
          newAlerts: after - before,
        }),
      );
    }
  }
}
main()
  .catch((error) => {
    // Do not log connection strings or database error payloads.
    console.error(
      JSON.stringify({ failure: error.name, code: error.code || null }),
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
