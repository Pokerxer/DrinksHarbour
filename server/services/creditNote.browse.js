// Read-only credit workspace. Posting and allocation remain in creditNote.service.
const mongoose = require('mongoose');
const CreditNote = require('../models/CreditNote');
const Customer = require('../models/POSCustomer');
const Invoice = require('../models/CustomerInvoice');
const { bad, dateRange, escapeSearch } = require('./accounting.query');
const gross = { $add: [{ $ifNull: ['$amount', 0] }, { $ifNull: ['$taxAmount', 0] }] };

async function creditFilter(tenant, { status, from, to, customer, search } = {}) {
  if (status && !['draft', 'applied', 'cancelled', 'available', 'partial', 'full'].includes(status)) throw bad('Invalid credit status');
  if (customer && !mongoose.isValidObjectId(customer)) throw bad('Invalid customer');
  const filter = { tenant: new mongoose.Types.ObjectId(String(tenant)) };
  if (customer) filter.customer = new mongoose.Types.ObjectId(customer);
  if (['available', 'partial', 'full'].includes(status)) {
    filter.status = 'applied';
    filter.unappliedAmount = status === 'full' ? { $lte: 0.005 } : { $gt: 0.005 };
    if (status !== 'full') filter.$expr = { [status === 'partial' ? '$lt' : '$gte']: ['$unappliedAmount', { $subtract: [gross, 0.005] }] };
  } else if (status) filter.status = status;
  const range = dateRange({ from, to });
  if (range) filter.date = range;
  if (search?.trim()) {
    const rx = new RegExp(escapeSearch(search.trim()), 'i');
    const customers = await Customer.find({ tenant, $or: [{ firstName: rx }, { lastName: rx }, { email: rx }] }).select('_id').lean();
    filter.$or = [{ number: rx }, { reason: rx }, { customerName: rx }, { customer: { $in: customers.map((c) => c._id) } }];
  }
  return filter;
}
const sumIf = (status, value) => ({ $sum: { $cond: [{ $eq: ['$status', status] }, value, 0] } });
function summaryPipeline(filter) {
  return [{ $match: filter }, { $group: {
    _id: null, count: { $sum: 1 }, postedTotal: sumIf('applied', gross),
    available: sumIf('applied', { $ifNull: ['$unappliedAmount', 0] }),
    draftTotal: sumIf('draft', gross),
    appliedTotal: sumIf('applied', { $subtract: [gross, { $ifNull: ['$unappliedAmount', 0] }] }),
  } }];
}
async function invoiceLinks(tenant, notes) {
  const ids = notes.flatMap((n) => [n.salesOrder, ...(n.allocations || []).map((a) => a.salesOrder)]).filter(Boolean);
  if (!ids.length) return notes;
  const docs = await Invoice.find({ tenant, source: 'sales', sourceId: { $in: ids } }).select('_id number sourceId').lean();
  const links = new Map(docs.map((doc) => [String(doc.sourceId), { id: String(doc._id), number: doc.number }]));
  return notes.map((note) => ({ ...note, invoice: links.get(String(note.salesOrder)), allocations: (note.allocations || []).map((a) => ({ ...a, invoice: links.get(String(a.salesOrder)) })) }));
}
async function listCreditNotes(tenant, options = {}) {
  const filter = await creditFilter(tenant, options);
  const page = Math.max(1, Math.floor(Number(options.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(options.limit) || 25)));
  const [notes, total, summary] = await Promise.all([
    CreditNote.find(filter).sort({ date: -1, _id: -1 }).skip((page - 1) * limit).limit(limit)
      .populate({ path: 'customer', select: 'firstName lastName', match: { tenant } }).lean(),
    CreditNote.countDocuments(filter), CreditNote.aggregate(summaryPipeline(filter)),
  ]);
  return { data: await invoiceLinks(tenant, notes), total, page, pages: Math.ceil(total / limit) || 1,
    summary: summary[0] || { count: 0, postedTotal: 0, available: 0, draftTotal: 0, appliedTotal: 0 } };
}
module.exports = { listCreditNotes, creditFilter, summaryPipeline };
