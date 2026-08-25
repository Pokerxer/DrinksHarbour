// services/arAp.service.js
//
// Receivables / payables intelligence over existing documents:
//   AR invoices = confirmed SalesOrders (outstanding = total − amountPaid)
//   AP bills    = VendorBills (outstanding = totalAmount − paidAmount)
// Plus customer/vendor balances, product and directory browsers.

const mongoose = require('mongoose');
const SalesOrder = require('../models/SalesOrder');
const VendorBill = require('../models/VendorBill');
const POSCustomer = require('../models/POSCustomer');
const Vendor = require('../models/Vendor');
const SubProduct = require('../models/SubProduct');
const { round2, agingBucket } = require('./accounting.helpers');

const AR_FILTER = {
  docType: 'order',
  orderStatus: { $ne: 'cancelled' },
  paymentStatus: { $ne: 'paid' },
};

const AP_FILTER = { status: { $in: ['confirmed', 'partial', 'overdue'] } };

const outstandingOf = {
  ar: (doc) => round2((doc.total || 0) - (doc.amountPaid || 0)),
  ap: (doc) => round2((doc.totalAmount || 0) - (doc.paidAmount || 0)),
};

/** Aging + totals for one side. */
async function summary(tenantId, side) {
  const filter = { tenant: tenantId, ...(side === 'ar' ? AR_FILTER : AP_FILTER) };
  const docs = await (side === 'ar' ? SalesOrder : VendorBill)
    .find(filter)
    .select(side === 'ar' ? 'total amountPaid date orderNumber customer' : 'totalAmount paidAmount date billNumber vendor')
    .lean();
  const now = Date.now();
  let totalOutstanding = 0;
  const buckets = { current: 0, '16-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  for (const d of docs) {
    const outstanding = outstandingOf[side](d);
    if (outstanding <= 0) continue;
    totalOutstanding = round2(totalOutstanding + outstanding);
    const days = Math.floor((now - new Date(d.date || d.createdAt).getTime()) / 86_400_000);
    buckets[agingBucket(days)] = round2(buckets[agingBucket(days)] + outstanding);
  }
  return { count: docs.length, totalOutstanding, buckets };
}

/** Paged open documents for the Invoices / Bills browsers. */
async function listOpenDocs(tenantId, side, { status, from, to, page = 1, limit = 25 } = {}) {
  const Model = side === 'ar' ? SalesOrder : VendorBill;
  const filter = { tenant: tenantId, ...(side === 'ar' ? AR_FILTER : AP_FILTER) };
  if (status) {
    if (side === 'ar') filter.paymentStatus = status;
    else filter.status = status;
  }
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  const select = side === 'ar'
    ? 'orderNumber date customer customerSnapshot total amountPaid paymentStatus orderStatus dueDate'
    : 'billNumber date vendor totalAmount paidAmount status dueDate';
  const [data, total] = await Promise.all([
    Model.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(select)
      .populate(side === 'ar' ? 'customer' : 'vendor', side === 'ar' ? 'firstName lastName' : 'name')
      .lean(),
    Model.countDocuments(filter),
  ]);
  const rows = data.map((d) => ({ ...d, outstanding: outstandingOf[side](d) }));
  return { data: rows, total, page, pages: Math.ceil(total / limit) || 1 };
}

/** Per-customer outstanding balances (AR). */
async function customerBalances(tenantId) {
  const orders = await SalesOrder.find({ tenant: tenantId, ...AR_FILTER })
    .select('customer customerSnapshot total amountPaid')
    .lean();
  const byCustomer = new Map();
  for (const o of orders) {
    const outstanding = outstandingOf.ar(o);
    if (outstanding <= 0) continue;
    const key = String(o.customer || o.customerSnapshot?.customerId || 'walk-in');
    const row = byCustomer.get(key) || {
      customerId: o.customer || o.customerSnapshot?.customerId || null,
      name:
        o.customerSnapshot?.name ||
        (o.customer ? undefined : 'Walk-in'),
      outstanding: 0,
      openInvoices: 0,
    };
    row.outstanding = round2(row.outstanding + outstanding);
    row.openInvoices += 1;
    byCustomer.set(key, row);
  }
  const ids = [...byCustomer.keys()].filter((k) => k !== 'walk-in' && mongoose.isValidObjectId(k));
  const customers = await POSCustomer.find({ _id: { $in: ids } }).select('firstName lastName email phone').lean();
  const nameById = new Map(customers.map((c) => [String(c._id), `${c.firstName} ${c.lastName}`.trim()]));
  return [...byCustomer.values()].map((r) => ({
    ...r,
    name: nameById.get(String(r.customerId)) || r.name || 'Unknown',
  }));
}

/** Per-vendor outstanding balances (AP). */
async function vendorBalances(tenantId) {
  const bills = await VendorBill.find({ tenant: tenantId, ...AP_FILTER })
    .select('vendor totalAmount paidAmount')
    .lean();
  const byVendor = new Map();
  for (const b of bills) {
    const outstanding = outstandingOf.ap(b);
    if (outstanding <= 0) continue;
    const key = String(b.vendor);
    const row = byVendor.get(key) || { vendorId: b.vendor, outstanding: 0, openBills: 0 };
    row.outstanding = round2(row.outstanding + outstanding);
    row.openBills += 1;
    byVendor.set(key, row);
  }
  const vendors = await Vendor.find({ _id: { $in: [...byVendor.keys()] } }).select('name email phone').lean();
  const byId = new Map(vendors.map((v) => [String(v._id), v]));
  return [...byVendor.values()].map((r) => ({
    ...r,
    name: byId.get(String(r.vendorId))?.name || 'Unknown',
    email: byId.get(String(r.vendorId))?.email,
    phone: byId.get(String(r.vendorId))?.phone,
  }));
}

async function customersList(tenantId, { search, page = 1, limit = 50 } = {}) {
  const filter = { tenant: tenantId };
  if (search) filter.$or = [
    { firstName: new RegExp(search, 'i') },
    { lastName: new RegExp(search, 'i') },
    { email: new RegExp(search, 'i') },
    { phone: new RegExp(search, 'i') },
  ];
  const [data, total] = await Promise.all([
    POSCustomer.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    POSCustomer.countDocuments(filter),
  ]);
  return { data, total, page, pages: Math.ceil(total / limit) || 1 };
}

async function vendorsList(tenantId, { search, page = 1, limit = 50 } = {}) {
  const filter = { tenant: tenantId };
  if (search) filter.name = new RegExp(search, 'i');
  const [data, total] = await Promise.all([
    Vendor.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('name vendorType email phone paymentTerms')
      .lean(),
    Vendor.countDocuments(filter),
  ]);
  return { data, total, page, pages: Math.ceil(total / limit) || 1 };
}

/** Light product browser for the accounting Products pages. */
async function productsList(tenantId, { search, page = 1, limit = 50 } = {}) {
  const filter = { tenant: tenantId, isPublished: true, status: 'active' };
  if (search) filter.$or = [
    { name: new RegExp(search, 'i') },
    { sku: new RegExp(search, 'i') },
  ];
  const [data, total] = await Promise.all([
    SubProduct.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('name sku sellingPrice stockQuantity availability sizeVariants')
      .lean(),
    SubProduct.countDocuments(filter),
  ]);
  return { data, total, page, pages: Math.ceil(total / limit) || 1 };
}

module.exports = {
  summary,
  listOpenDocs,
  customerBalances,
  vendorBalances,
  customersList,
  vendorsList,
  productsList,
};
