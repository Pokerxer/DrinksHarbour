const Invoice = require("../../models/CustomerInvoice");
const { agingBucket, round2 } = require("../accounting.helpers");
const calendarDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit',
});
function overdueDays(dueDate, now) {
  const due = dueDate ? new Date(dueDate) : null;
  if (!due || !Number.isFinite(due.getTime())) return 0;
  return Math.max(0, Math.round((Date.parse(calendarDate.format(now)) -
    Date.parse(calendarDate.format(due))) / 86400000));
}
function summarizeSavedInvoices(docs, now = new Date()) {
  const result = {
    count: 0,
    totalOutstanding: 0,
    onAccount: 0,
    reviewCount: 0,
    reviewBalanceCount: 0,
    reviewOutstanding: 0,
    buckets: { current: 0, "16-30": 0, "31-60": 0, "61-90": 0, "90+": 0 },
  };
  for (const doc of docs) {
    if (
      doc.state === "draft" &&
      (!doc.currency || doc.currency === "NGN") &&
      doc.reconciliationIssue?.trim()
    ) {
      result.reviewCount++;
      if (Number.isFinite(doc.outstanding) && doc.outstanding > 0) {
        result.reviewBalanceCount++;
        result.reviewOutstanding = round2(result.reviewOutstanding + doc.outstanding);
      }
    }
    if (doc.state !== "posted" || (doc.currency && doc.currency !== "NGN") || !(doc.outstanding > 0))
      continue;
    const amount = round2(doc.outstanding);
    const days = overdueDays(doc.dueDate, now);
    result.count++;
    result.totalOutstanding = round2(result.totalOutstanding + amount);
    result.buckets[agingBucket(Number.isFinite(days) ? days : 0)] += amount;
    if (doc.source === "pos" || doc.statements?.length) result.onAccount = round2(result.onAccount + amount);
  }
  for (const bucket of Object.keys(result.buckets)) result.buckets[bucket] = round2(result.buckets[bucket]);
  return result;
}
async function invoiceSummary(tenant) {
  const docs = await Invoice.find({
    tenant,
    $or: [
      { state: "posted", outstanding: { $gt: 0 } },
      { state: "draft", reconciliationIssue: { $type: "string", $regex: /\S/ } },
    ],
    currency: { $in: ["NGN", null] },
  })
    .select("state currency source statements outstanding date dueDate reconciliationIssue")
    .lean();
  return summarizeSavedInvoices(docs);
}
module.exports = { invoiceSummary, summarizeSavedInvoices };
