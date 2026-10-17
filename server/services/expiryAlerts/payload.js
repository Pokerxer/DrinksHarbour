const { expiryAlertPriority } = require('../batch.helpers');
const id = (v) => String(v?._id || v || '');
function buildExpiryNotification(batch, recipients, now = new Date()) {
  const date = new Date(batch.expiryDate),
    expired = +date <= +now;
  const productName =
    batch.subProduct?.product?.name ||
    batch.subProduct?.name ||
    batch.subProduct?.sku ||
    'Product';
  const quarantineStatus = batch.quarantined
    ? 'quarantined'
    : 'not_quarantined';
  const state = expired
    ? 'expired'
    : batch.quarantined
      ? 'quarantined'
      : 'upcoming';
  const guidance = expired
    ? 'Review quarantine and removal from usable stock.'
    : batch.quarantined
      ? 'Review the quarantine before any picking or stock movement.'
      : 'Review eligible batch picking in expiry order and confirm current stock.';
  return {
    type: 'batch_expiry_alert',
    identity: `expiry:${id(batch)}`,
    title: expired
      ? 'Batch expired'
      : batch.quarantined
        ? 'Batch quarantined'
        : 'Batch nearing expiry',
    message: `${productName} · Batch ${batch.batchNumber}: ${batch.quantity} units remaining. ${expired ? 'Has expired' : 'Expiry date'}: ${new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' }).format(date)}. ${guidance}`,
    priority: expired ? 'urgent' : expiryAlertPriority(date, now),
    tenant: batch.tenant,
    subProduct: id(batch.subProduct) || undefined,
    product: id(batch.product) || undefined,
    recipients,
    actionUrl: '/inventory/stock',
    actionLabel: 'Review batch stock',
    metadata: {
      batchId: id(batch),
      batchNumber: batch.batchNumber,
      productName,
      sizeName: batch.size?.displayName || batch.size?.size,
      warehouseName: batch.warehouse?.name,
      expiryDate: date.toISOString(),
      quantity: batch.quantity,
      quarantineStatus,
      expiryState: state,
      scanUpdatedAt: now.toISOString(),
    },
  };
}
function presentExpiryNotice(notice, now = new Date()) {
  if (notice.type !== 'batch_expiry_alert') return notice;
  const expiry = Date.parse(String(notice.metadata.expiryDate || ''));
  if (Number.isFinite(expiry) && expiry <= +now)
    return {
      ...notice,
      title: 'Batch expired',
      priority: 'urgent',
      message:
        'This recorded batch has expired. Review quarantine and removal from usable stock.',
    };
  if (notice.metadata.quarantineStatus === 'quarantined')
    return {
      ...notice,
      title: 'Batch quarantined',
      message: 'Review the quarantine before picking or moving this batch.',
    };
  return notice;
}
module.exports = { buildExpiryNotification, presentExpiryNotice };
