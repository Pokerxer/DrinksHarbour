const { round2, agingBucket } = require('./accounting.helpers');
const bad = (message) => Object.assign(new Error(message), { status: 400, statusCode: 400 });
const escapeSearch = (value) => String(value).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const AR_FILTER = { currency: { $in: ['NGN', null] }, docType: 'order', orderStatus: { $in: ['confirmed', 'partially_fulfilled', 'fulfilled'] }, paymentStatus: { $in: ['unpaid', 'partial'] } };
const AP_FILTER = { currency: { $in: ['NGN', null] }, status: { $in: ['confirmed', 'partial', 'overdue'] } };
function dateRange({ from, to } = {}) {
  if (!from && !to) return undefined;
  const result = {};
  for (const [key, value] of Object.entries({ from, to })) {
    if (!value) continue;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || (/^\d{4}-\d{2}-\d{2}$/.test(value) && date.toISOString().slice(0, 10) !== value)) throw bad('Invalid date');
    if (key === 'from') result.$gte = date;
    else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) result.$lt = new Date(date.getTime() + 86400000);
    else result.$lte = date;
  }
  if (from && to && new Date(from) > new Date(to)) throw bad('Start date must be before end date');
  return result;
}
function openFilter(tenant, side, { status, from, to, search } = {}) {
  const filter = { tenant, ...(side === 'ar' ? AR_FILTER : AP_FILTER) };
  const allowed = side === 'ar' ? ['unpaid', 'partial'] : ['confirmed', 'partial', 'overdue'];
  if (status) {
    if (!allowed.includes(status)) throw bad('Invalid open document status');
    filter[side === 'ar' ? 'paymentStatus' : 'status'] = status;
  }
  const range = dateRange({ from, to });
  if (range) filter[side === 'ar' ? 'createdAt' : 'billDate'] = range;
  if (search) {
    const rx = new RegExp(escapeSearch(search), 'i');
    filter.$or = side === 'ar' ? [{ soNumber: rx }, { 'customerSnapshot.name': rx }] : [{ billNumber: rx }, { vendorName: rx }];
  }
  filter.$expr = { $gt: [
    { $subtract: [{ $ifNull: [side === 'ar' ? '$total' : '$totalAmount', 0] }, { $add: [{ $ifNull: [side === 'ar' ? '$amountPaid' : '$paidAmount', 0] }, side === 'ar' ? { $ifNull: ['$creditedAmount', 0] } : 0] }] }, 0,
  ] };
  return filter;
}
function normalizeOpenDoc(doc, side) {
  return { ...doc,
    ...(side === 'ar' ? { orderNumber: doc.soNumber, date: doc.createdAt } : { date: doc.billDate }),
    outstanding: Math.max(0, round2(side === 'ar' ? (doc.total || 0) - (doc.amountPaid || 0) - (doc.creditedAmount || 0) : (doc.totalAmount || 0) - (doc.paidAmount || 0))),
  };
}
function summarizeOpenDocs(docs, side, now = new Date()) {
  const result = { count: 0, totalOutstanding: 0, buckets: { current: 0, '16-30': 0, '31-60': 0, '61-90': 0, '90+': 0 } };
  for (const doc of docs) {
    const { outstanding, date } = normalizeOpenDoc(doc, side);
    if (!outstanding) continue;
    const due = new Date(doc.dueDate || date || now);
    const days = Math.max(0, Math.floor((now - due) / 86400000));
    const bucket = agingBucket(Number.isFinite(days) ? days : 0);
    result.count++;
    result.totalOutstanding = round2(result.totalOutstanding + outstanding);
    result.buckets[bucket] = round2(result.buckets[bucket] + outstanding);
  }
  return result;
}
/**
 * The equally long window immediately before `from`..`to`.
 *
 * A profit & loss read without a comparison says only that a number exists.
 * This is the period to read it against — same span, shifted back, so a 31-day
 * month is not compared with a 28-day one. Returns ISO strings because the
 * caller re-feeds them through the normal date filter.
 *
 * An open-ended window has no preceding period; returning null keeps the UI
 * from putting a fabricated figure beside the real one.
 */
function previousWindow(from, to) {
  if (!from || !to) return null;
  const range = dateRange({ from, to });
  if (!range?.$gte || !range.$lt) return null;
  const start = range.$gte.getTime();
  const end = range.$lt.getTime(); // exclusive
  const span = end - start;
  if (!(span > 0)) return null;
  const priorFrom = new Date(start - span);
  const priorTo = new Date(start - 1);
  return {
    from: priorFrom,
    to: priorTo,
    fromISO: priorFrom.toISOString(),
    toISO: priorTo.toISOString(),
  };
}

module.exports = { bad, dateRange, previousWindow, openFilter, normalizeOpenDoc, summarizeOpenDocs, AR_FILTER, AP_FILTER, escapeSearch };
