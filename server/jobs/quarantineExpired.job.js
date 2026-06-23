// server/jobs/quarantineExpired.job.js
// Daily sweep that quarantines expired batches for tenants who opted in via
// warehouseSettings.autoQuarantineExpired. Quarantined lots are flagged and
// carved out of available stock (see batch.service.quarantineExpiredBatches).
const cron = require('node-cron');
const Tenant = require('../models/Tenant');
const { quarantineExpiredBatches } = require('../services/batch.service');

/**
 * Run the quarantine sweep for every tenant that has autoQuarantineExpired on.
 * Deps injected for testing: { findTenants, sweep }.
 */
async function sweepExpiredBatches(now = new Date(), deps = {}) {
  const findTenants =
    deps.findTenants ||
    (() =>
      Tenant.find({ 'warehouseSettings.autoQuarantineExpired': true })
        .select('_id')
        .lean());
  const sweep = deps.sweep || quarantineExpiredBatches;

  const tenants = await findTenants();
  let total = 0;
  for (const tenant of tenants) {
    try {
      const { quarantinedCount } = await sweep({ tenantId: tenant._id, now });
      total += quarantinedCount;
    } catch (err) {
      console.error(`quarantine sweep failed for tenant ${tenant._id}: ${err.message}`);
    }
  }
  return { tenants: tenants.length, quarantined: total };
}

/** Start the daily cron (guarded by the caller). Runs at 02:30, after expiry scan. */
function startQuarantineCron() {
  cron.schedule('30 2 * * *', () => {
    sweepExpiredBatches().catch((e) =>
      console.error('quarantine cron error:', e.message)
    );
  });
  console.log('🧪 Auto-quarantine expired-batch sweep scheduled (daily 02:30)');
}

module.exports = { sweepExpiredBatches, startQuarantineCron };
