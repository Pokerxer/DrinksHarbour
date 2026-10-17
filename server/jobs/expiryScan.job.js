const cron = require('node-cron');
const Tenant = require('../models/Tenant');
const { buildExpiryNotification } = require('../services/expiryAlerts/payload');
const {
  createExpiryDependencies,
} = require('../services/expiryAlerts/dependencies');
const {
  ensureNotificationDedupIndex,
} = require('../services/tenantNotificationIndexes');
async function scanTenant(tenant, now, deps) {
  const configured = tenant?.inventorySettings?.expiryWarningDays;
  const windowDays = Number.isFinite(configured)
    ? Math.min(365, Math.max(1, configured))
    : 90;
  const cutoff = new Date(+now + windowDays * 86400000);
  const batches = (await deps.findExpiringBatches(tenant._id, cutoff)).filter(
    (b) =>
      Number.isFinite(b.quantity) &&
      b.quantity > 0 &&
      Number.isFinite(Date.parse(b.expiryDate)) &&
      Date.parse(b.expiryDate) <= +cutoff &&
      (!b.tenant || String(b.tenant) === String(tenant._id)),
  );
  const recipients = await deps.getRecipients(tenant._id);
  if (!recipients.length) return { created: 0 };
  if (deps.upsertMany)
    await deps.upsertMany(
      tenant._id,
      batches.map((batch) =>
        buildExpiryNotification(
          { ...batch, tenant: tenant._id },
          recipients,
          now,
        ),
      ),
      recipients,
      now,
    );
  else
    for (const batch of batches)
      await deps.upsert(
        buildExpiryNotification(
          { ...batch, tenant: tenant._id },
          recipients,
          now,
        ),
        batch,
        now,
      );
  await deps.archiveStale(
    tenant._id,
    batches.map((b) => String(b._id)),
    now,
  );
  return { created: batches.length };
}
let running = false,
  scheduled = false;
async function scanExpiringBatches(now = new Date()) {
  if (running) return;
  running = true;
  try {
    await ensureNotificationDedupIndex();
    const deps = createExpiryDependencies();
    for await (const tenant of Tenant.find({ status: 'approved' })
      .select('_id inventorySettings')
      .lean()
      .cursor()) {
      try {
        await scanTenant(tenant, now, deps);
      } catch {
        console.error(
          '[expiry] tenant scan failed; retry on next scheduled scan',
        );
      }
    }
  } finally {
    running = false;
  }
}
function startExpiryCron() {
  if (scheduled) return;
  cron.schedule(
    '0 2 * * *',
    () =>
      scanExpiringBatches().catch(() => console.error('[expiry] scan failed')),
    { timezone: 'Africa/Lagos' },
  );
  scheduled = true;
}
module.exports = {
  buildExpiryNotification,
  scanTenant,
  scanExpiringBatches,
  startExpiryCron,
};
