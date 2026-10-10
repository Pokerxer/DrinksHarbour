const Tenant = require('../models/Tenant');
const { ensureNotificationDedupIndex } = require('./tenantNotificationIndexes');
const { getTenantId } = require('../utils/tenantContext');
const { allowedTypes } = require('./tenantNotificationRecipients');
const { scanTenantProducts } = require('../jobs/tenantProductInsights.job');
const COOLDOWN_MS = 60_000;
function createStockAlertSync({
  approved,
  scan,
  prepare = async () => {},
  clock = Date.now,
  warn = console.warn,
}) {
  const successful = new Map(),
    running = new Map();
  return async function syncStock(req) {
    // A platform user's selected tenant must never create tenant inbox authority.
    if (
      !req.user?.tenant ||
      !req.user._id ||
      req.user.status !== 'active' ||
      !allowedTypes(req.user).includes('low_stock_alert')
    )
      return;
    const tenant = getTenantId(req);
    const recipientId = String(req.user._id);
    const key = `${tenant}:${recipientId}`;
    if (running.has(key)) return running.get(key);
    if (successful.has(key) && clock() - successful.get(key) < COOLDOWN_MS)
      return;
    const operation = Promise.resolve().then(async () => {
      try {
        if (!(await approved(tenant))) return;
        await prepare();
        await scan(tenant, { includeSales: false, recipientId });
        successful.set(key, clock());
        if (successful.size > 1000)
          successful.delete(successful.keys().next().value);
      } catch {
        // Preserve saved notifications and leave a failed scan retryable.
        warn('[stock alerts] inbox catch-up failed; retry on next inbox load');
      } finally {
        running.delete(key);
      }
    });
    running.set(key, operation);
    return operation;
  };
}
const syncTenantStockAlerts = createStockAlertSync({
  approved: async (tenant) =>
    !!(await Tenant.exists({ _id: tenant, status: 'approved' })),
  scan: scanTenantProducts,
  prepare: ensureNotificationDedupIndex,
});
module.exports = { createStockAlertSync, syncTenantStockAlerts };
