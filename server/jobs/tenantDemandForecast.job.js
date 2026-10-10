const cron = require('node-cron');
const Tenant = require('../models/Tenant');
const { getPlan } = require('../services/restock/service');
const {
  syncForecastNotifications,
} = require('../services/restock/notifications');
let running = false;
async function scanDemandForecasts() {
  if (running) return;
  running = true;
  try {
    for await (const tenant of Tenant.find({ status: 'approved' })
      .select('_id')
      .lean()
      .cursor()) {
      try {
        const plan = await getPlan(String(tenant._id), {
          coverDays: 14,
          refresh: true,
          includeSales: true,
          updateMinimum: true,
        });
        await syncForecastNotifications(tenant._id, plan);
      } catch {
        console.error(
          '[demand forecast] tenant refresh failed; retry on next scheduled scan',
        );
      }
    }
  } finally {
    running = false;
  }
}
function startTenantDemandForecastCron() {
  cron.schedule(
    '15 9 * * *',
    () =>
      scanDemandForecasts().catch(() =>
        console.error('[demand forecast] sweep failed'),
      ),
    { timezone: 'Africa/Lagos' },
  );
}
module.exports = { scanDemandForecasts, startTenantDemandForecastCron };
