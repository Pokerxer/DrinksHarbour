// server/jobs/expiryScan.job.js
const cron = require('node-cron');
const WarehouseBatch = require('../models/WarehouseBatch');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { createNotification } = require('../services/notification.service');
const { expiryAlertPriority, daysUntil } = require('../services/batch.helpers');

const RECIPIENT_ROLES = ['tenant_owner', 'tenant_admin', 'tenant_staff'];

/** Build the notification payload for one expiring batch (pure). */
function buildExpiryNotification(batch, recipients, now = new Date()) {
  const d = daysUntil(batch.expiryDate, now);
  const when = d < 0 ? `expired ${-d} day(s) ago` : `expires in ${d} day(s)`;
  return {
    type: 'batch_expiry_alert',
    title: 'Batch nearing expiry',
    message: `Batch ${batch.batchNumber} (${batch.quantity} left) ${when}. Deplete it before it expires.`,
    priority: expiryAlertPriority(batch.expiryDate, now),
    subProduct: batch.subProduct,
    product: batch.product,
    tenant: batch.tenant,
    recipients,
    metadata: { batchId: String(batch._id), expiryDate: batch.expiryDate, quantity: batch.quantity },
  };
}

/**
 * Scan one tenant's batches and upsert/refresh deduped notifications.
 * Deps injected for testing: { findExpiringBatches, getRecipients, upsert, archiveStale }.
 */
async function scanTenant(tenant, now, deps) {
  const windowDays = tenant?.inventorySettings?.expiryWarningDays ?? 90;
  const cutoff = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);
  const batches = await deps.findExpiringBatches(tenant._id, cutoff);
  const recipients = await deps.getRecipients(tenant._id);
  if (!recipients.length) return { created: 0 };
  let created = 0;
  for (const batch of batches) {
    await deps.upsert(buildExpiryNotification(batch, recipients, now), batch);
    created += 1;
  }
  await deps.archiveStale(tenant._id, batches.map((b) => String(b._id)));
  return { created };
}

// ── DB-backed default deps ───────────────────────────────────────────
async function findExpiringBatches(tenantId, cutoff) {
  return WarehouseBatch.find({
    tenant: tenantId, quantity: { $gt: 0 }, expiryDate: { $ne: null, $lte: cutoff },
  }).lean();
}

async function getRecipients(tenantId) {
  const users = await User.find({ tenant: tenantId, role: { $in: RECIPIENT_ROLES }, status: 'active' })
    .select('_id').lean();
  return users.map((u) => u._id);
}

// Dedup: one active (non-archived) notification per batchId. Refresh if present.
async function upsertNotification(payload, batch) {
  const existing = await Notification.findOne({
    type: 'batch_expiry_alert', 'metadata.batchId': String(batch._id), isArchived: false,
  });
  if (existing) {
    existing.message = payload.message;
    existing.priority = payload.priority;
    existing.metadata = payload.metadata;
    existing.isRead = false;
    await existing.save();
    return existing;
  }
  return createNotification(payload);
}

// Archive this tenant's expiry notifications whose batch is no longer expiring
// (depleted or pushed out of the window).
async function archiveStale(tenantId, activeBatchIds) {
  await Notification.updateMany(
    {
      type: 'batch_expiry_alert', isArchived: false, tenant: tenantId,
      'metadata.batchId': { $nin: activeBatchIds },
    },
    { isArchived: true, archivedAt: new Date() }
  );
}

async function scanExpiringBatches(now = new Date()) {
  const tenants = await Tenant.find({}).select('_id inventorySettings').lean();
  const deps = { findExpiringBatches, getRecipients, upsert: upsertNotification, archiveStale };
  for (const tenant of tenants) {
    try {
      await scanTenant(tenant, now, deps);
    } catch (err) {
      console.error(`expiry scan failed for tenant ${tenant._id}: ${err.message}`);
    }
  }
}

/** Start the daily cron (guarded by the caller). */
function startExpiryCron() {
  cron.schedule('0 2 * * *', () => {
    scanExpiringBatches().catch((e) => console.error('expiry cron error:', e.message));
  });
  console.log('🕑 Expiry-batch scan scheduled (daily 02:00)');
}

module.exports = { buildExpiryNotification, scanTenant, scanExpiringBatches, startExpiryCron };
