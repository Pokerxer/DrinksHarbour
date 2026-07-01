// server/services/salesActivity.service.js
const Activity = require('../models/Activity');

function formatMoney(n) {
  const v = Number(n) || 0;
  return `${v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₦`;
}

function diffPricelist(from, to) {
  const a = from || '', b = to || '';
  if (a === b) return null;
  if (!a && !b) return null;
  return { from: a || '—', to: b || '—' };
}

function untaxedOf(t) {
  return (Number(t.subtotal) || 0) - (Number(t.discountTotal) || 0) - (Number(t.promotionTotal) || 0);
}

function diffTotals(prev, next) {
  const out = {};
  if ((Number(prev.total) || 0) !== (Number(next.total) || 0)) {
    out.total = { from: Number(prev.total) || 0, to: Number(next.total) || 0 };
  }
  const pu = untaxedOf(prev), nu = untaxedOf(next);
  if (pu !== nu) out.untaxed = { from: pu, to: nu };
  return Object.keys(out).length ? out : null;
}

const STATUS_SUBJECTS = {
  draft: 'Quotation created',
  sent: 'Quotation sent',
  accepted: 'Quotation accepted',
  rejected: 'Quotation rejected',
  converted: 'Converted to Sales Order',
  confirmed: 'Sales Order confirmed',
  cancelled: 'Cancelled',
  expired: 'Quotation expired',
};
function statusSubject(_docType, action) {
  return STATUS_SUBJECTS[action] || `Status: ${action}`;
}

async function logActivity(tenantId, salesOrderId, opts = {}) {
  try {
    return await Activity.create({
      tenant: tenantId,
      salesOrder: salesOrderId,
      type: opts.type || 'log',
      system: opts.system !== undefined ? opts.system : true,
      subject: opts.subject,
      description: opts.description,
      meta: opts.meta,
      createdBy: opts.userId,
    });
  } catch (err) {
    console.warn('[salesActivity] log failed:', err && err.message);
    return null;
  }
}

module.exports = { formatMoney, diffPricelist, diffTotals, untaxedOf, statusSubject, logActivity };
