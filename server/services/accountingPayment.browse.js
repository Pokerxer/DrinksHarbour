// Tenant-scoped read model only; payment posting/reversal remains in the service.
const mongoose = require('mongoose');
const CustomerPayment = require('../models/CustomerPayment');
const VendorPayment = require('../models/VendorPayment');
const Customer = require('../models/POSCustomer');
const Vendor = require('../models/Vendor');
const Invoice = require('../models/CustomerInvoice');
const Bill = require('../models/VendorBill');
const PurchaseOrder = require('../models/PurchaseOrder');
const { round2 } = require('./accounting.helpers');
const { bad, dateRange, escapeSearch } = require('./accounting.query');
const methods = ['cash', 'bank_transfer', 'card', 'pos', 'wallet', 'cheque', 'other', 'split'];
async function filterFor(tenant, side, { status, method, search, from, to, vendor } = {}) {
  if (!['customer', 'vendor'].includes(side)) throw bad('Invalid payment side');
  if (status && !['active', 'cancelled'].includes(status)) throw bad('Invalid payment status');
  if (method && !methods.includes(method)) throw bad('Invalid payment method');
  const filter = { tenant: new mongoose.Types.ObjectId(String(tenant)) };
  if (vendor) {
    if (side !== 'vendor' || !mongoose.isValidObjectId(vendor)) throw bad('Invalid vendor filter');
    filter.vendor = new mongoose.Types.ObjectId(String(vendor));
  }
  if (status) filter.status = status;
  if (method) filter.method = method;
  const dates = dateRange({ from, to }); if (dates) filter.date = dates;
  if (search?.trim()) {
    const rx = new RegExp(escapeSearch(search.trim()), 'i');
    const ar = side === 'customer';
    const partyFilter = ar ? { $or: [{ firstName: rx }, { lastName: rx }, { email: rx }] } : { name: rx };
    const parties = await (ar ? Customer : Vendor).find({ tenant, ...partyFilter }).select('_id').lean();
    filter.$or = [{ number: rx }, { reference: rx }, { [ar ? 'customerName' : 'vendorName']: rx }, { [ar ? 'customer' : 'vendor']: { $in: parties.map((p) => p._id) } }];
  }
  return filter;
}
function summaryPipeline(filter) {
  const allocated = { $reduce: { input: { $ifNull: ['$allocations', []] }, initialValue: 0, in: { $add: ['$$value', '$$this.amount'] } } };
  const active = (amount) => ({ $sum: { $cond: [{ $eq: ['$status', 'active'] }, amount, 0] } });
  return [{ $match: filter }, { $group: { _id: null,
    activeAmount: active('$amount'), allocated: active(allocated),
    unallocated: active({ $max: [0, { $subtract: ['$amount', allocated] }] }),
    cancelledAmount: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, '$amount', 0] } },
  } }];
}
async function linksFor(tenant, side, rows) {
  const ar = side === 'customer';
  const ids = rows.flatMap((r) => (r.allocations || []).map((a) => a[ar ? 'salesOrder' : 'vendorBill'])).filter(Boolean);
  if (!ids.length) return rows;
  const docs = await (ar ? Invoice : Bill).find({ tenant, ...(ar ? { source: 'sales', sourceId: { $in: ids } } : { _id: { $in: ids } }) }).select(ar ? '_id number sourceId' : '_id billNumber status totalAmount paidAmount purchaseOrder').lean();
  const orderIds = ar ? [] : docs.map((d) => d.purchaseOrder).filter(Boolean);
  const orders = orderIds.length ? await PurchaseOrder.find({ tenant, _id: { $in: orderIds } }).select('_id poNumber').lean() : [];
  const orderLinks = new Map(orders.map((o) => [String(o._id), { id: String(o._id), label: o.poNumber, href: `/purchases/${o._id}` }]));
  const links = new Map(docs.map((d) => [String(ar ? d.sourceId : d._id), {
    document: { id: String(d._id), label: ar ? d.number : d.billNumber, href: `${ar ? '/accounting/invoices' : '/purchases/bills'}/${d._id}`,
      ...(!ar ? { status: d.status, outstanding: Math.max(0, round2((d.totalAmount || 0) - (d.paidAmount || 0))) } : {}) },
    ...(!ar ? { purchaseOrder: orderLinks.get(String(d.purchaseOrder)) } : {}),
  }]));
  return rows.map((r) => ({ ...r, allocations: (r.allocations || []).map((a) => ({ ...a, ...links.get(String(a[ar ? 'salesOrder' : 'vendorBill'])) })) }));
}
async function listPayments(tenant, side, options = {}) {
  const filter = await filterFor(tenant, side, options);
  const Model = side === 'customer' ? CustomerPayment : VendorPayment;
  const page = Math.max(1, Math.floor(Number(options.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(options.limit) || 25)));
  if (side === 'customer') {
    const sourceRows = await require('./accountingPayment/sourceReceipts').readSourceReceipts(tenant);
    if (sourceRows.length) {
      const manual = await Model.find(filter).sort({ date: -1, _id: -1 })
        .populate({ path: 'customer', select: 'firstName lastName', match: { tenant } }).lean();
      const dates = dateRange(options);
      const rx = options.search?.trim() ? new RegExp(escapeSearch(options.search.trim()), 'i') : null;
      const matching = sourceRows.filter((row) => {
        if (options.status && row.status !== options.status || options.method && row.method !== options.method) return false;
        const date = new Date(row.date);
        if (dates && (!Number.isFinite(date.getTime()) || dates.$gte && date < dates.$gte || dates.$lt && date >= dates.$lt || dates.$lte && date > dates.$lte)) return false;
        const partyIds = filter.$or?.at(-1)?.customer?.$in || [];
        return !rx || [row.number, row.reference, row.customerName, row.invoice?.label].some((value) => rx.test(value || '')) || partyIds.some((id) => String(id) === String(row.customer?._id));
      });
      const rows = [...manual, ...matching].sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0) || String(b._id).localeCompare(String(a._id)));
      return { data: await linksFor(tenant, side, rows.slice((page - 1) * limit, page * limit)),
        total: rows.length, page, pages: Math.ceil(rows.length / limit) || 1,
        paymentSummary: require('./accountingPayment/sourceRows').sourceSummary(rows) };
    }
  }
  const [data, total, summary] = await Promise.all([
    Model.find(filter).sort({ date: -1, _id: -1 }).skip((page - 1) * limit).limit(limit)
      .populate({ path: side, select: side === 'customer' ? 'firstName lastName' : 'name', match: { tenant } }).lean(),
    Model.countDocuments(filter), Model.aggregate(summaryPipeline(filter)),
  ]);
  return { data: await linksFor(tenant, side, data), total, page, pages: Math.ceil(total / limit) || 1,
    paymentSummary: summary[0] || { activeAmount: 0, allocated: 0, unallocated: 0, cancelledAmount: 0 } };
}
module.exports = { listPayments, linksFor };
