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

const { AR_FILTER, AP_FILTER, openFilter, normalizeOpenDoc, summarizeOpenDocs, escapeSearch } = require('./accounting.query');
const outstandingOf = {
  ar: doc => normalizeOpenDoc(doc, 'ar').outstanding,
  ap: doc => normalizeOpenDoc(doc, 'ap').outstanding,
};

async function summary(tenantId, side) {
  const docs = await (side === 'ar' ? SalesOrder : VendorBill)
    .find(openFilter(tenantId, side))
    .select('total amountPaid creditedAmount totalAmount paidAmount createdAt billDate dueDate').lean();
  return summarizeOpenDocs(docs, side);
}

/** Paged open documents for the Invoices / Bills browsers. */
async function listOpenDocs(tenantId, side, { status, from, to, search, page = 1, limit = 25 } = {}) {
  const Model = side === 'ar' ? SalesOrder : VendorBill;
  const filter = openFilter(tenantId, side, { status, from, to, search });
  const select = side === 'ar'
    ? 'soNumber createdAt customer customerSnapshot total amountPaid creditedAmount paymentStatus orderStatus dueDate currency'
    : 'billNumber billDate vendor vendorName totalAmount paidAmount status dueDate purchaseOrder currency';
  const [data, total] = await Promise.all([
    Model.find(filter)
      .sort({ [side === 'ar' ? 'createdAt' : 'billDate']: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(select)
      .populate({ path: side === 'ar' ? 'customer' : 'vendor', select: side === 'ar' ? 'firstName lastName' : 'name', match: { tenant: tenantId } })
      .lean(),
    Model.countDocuments(filter),
  ]);
  const rows = data.map((d) => normalizeOpenDoc(d, side));
  return { data: rows, total, page, pages: Math.ceil(total / limit) || 1 };
}

/** Per-customer outstanding balances (AR). */
async function customerBalances(tenantId) {
  const orders = await SalesOrder.find({ tenant: tenantId, ...AR_FILTER })
    .select('customer customerSnapshot total amountPaid creditedAmount')
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
  const customers = await POSCustomer.find({ tenant: tenantId, _id: { $in: ids } }).select('firstName lastName email phone').lean();
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
  const vendors = await Vendor.find({ tenant: tenantId, _id: { $in: [...byVendor.keys()] } }).select('name email phone').lean();
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
    { firstName: new RegExp(escapeSearch(search), 'i') },
    { lastName: new RegExp(escapeSearch(search), 'i') },
    { email: new RegExp(escapeSearch(search), 'i') },
    { phone: new RegExp(escapeSearch(search), 'i') },
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
  if (search) filter.name = new RegExp(escapeSearch(search), 'i');
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
    { name: new RegExp(escapeSearch(search), 'i') },
    { sku: new RegExp(escapeSearch(search), 'i') },
  ];
  const [data, total] = await Promise.all([
    SubProduct.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('product sku baseSellingPrice totalStock availableStock status')
      .populate('product', 'name')
      .lean(),
    SubProduct.countDocuments(filter),
  ]);
  return { data: data.map(sp => ({ ...sp, name: sp.product?.name || sp.sku, sellingPrice: sp.baseSellingPrice || 0, stockQuantity: sp.availableStock ?? sp.totalStock ?? 0, availability: sp.status === 'active' })), total, page, pages: Math.ceil(total / limit) || 1 };
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
