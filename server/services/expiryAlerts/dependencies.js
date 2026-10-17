const Batch = require('../../models/WarehouseBatch');
const Notification = require('../../models/Notification');
const {
  getTenantRecipients,
  allowedTypes,
} = require('../tenantNotificationRecipients');
const { deliverInsights } = require('../tenantNotificationDelivery');
const id = (v) => String(v?._id || v || '');
function createExpiryDependencies({
  batches = Batch,
  notices = Notification,
  recipients = getTenantRecipients,
  deliver = deliverInsights,
} = {}) {
  return {
    async findExpiringBatches(tenant, cutoff) {
      require('../../models/Product');
      require('../../models/SubProduct');
      require('../../models/Size');
      require('../../models/Warehouse');
      const rows = await batches
        .find({
          tenant,
          quantity: { $gt: 0 },
          expiryDate: { $ne: null, $lte: cutoff },
        })
        .select(
          'tenant warehouse subProduct size product batchNumber quantity expiryDate quarantined',
        )
        .populate({ path: 'warehouse', match: { tenant }, select: 'name' })
        .populate({
          path: 'subProduct',
          match: { tenant },
          select: 'name sku product',
          populate: { path: 'product', select: 'name' },
        })
        .populate({
          path: 'size',
          match: { tenant },
          select: 'size displayName subproduct',
        })
        .limit(20001)
        .maxTimeMS(15000)
        .lean();
      if (rows.length > 20000)
        throw Error('Expiry data exceeds safe scan capacity');
      return rows.map((r) => ({
        ...r,
        size:
          r.size && r.subProduct && id(r.size.subproduct) === id(r.subProduct)
            ? r.size
            : undefined,
      }));
    },
    async getRecipients(tenant) {
      return (await recipients(tenant)).filter((u) =>
        allowedTypes(u).includes('batch_expiry_alert'),
      );
    },
    async upsertMany(tenant, payloads, users, now) {
      return deliver(id(tenant), payloads, users, now, notices);
    },
    async upsert(payload, _batch, now) {
      return deliver(
        id(payload.tenant),
        [payload],
        payload.recipients,
        now,
        notices,
      );
    },
    async archiveStale(tenant, activeBatchIds, now) {
      return notices.updateMany(
        {
          tenant,
          type: 'batch_expiry_alert',
          isArchived: false,
          $or: [
            { 'metadata.batchId': { $nin: activeBatchIds } },
            { dedupKey: null },
          ],
        },
        {
          $set: { isArchived: true, archivedAt: now },
          $unset: { dedupKey: 1 },
        },
      );
    },
  };
}
module.exports = { createExpiryDependencies };
