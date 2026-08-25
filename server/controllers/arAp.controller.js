// controllers/arAp.controller.js
//
// Handlers for the Customers/Vendors accounting layer (screenshot menu):
// invoices, bills, credit notes, payments, batch payments, products,
// customers, vendors. Thin over arAp/creditNote/payment/batchPayment services;
// privileged actions write AuditLog entries.

const asyncHandler = require('../utils/asyncHandler');
const { logPrivilegedAction } = require('../utils/auditLog');
const arApService = require('../services/arAp.service');
const creditNoteService = require('../services/creditNote.service');
const paymentService = require('../services/payment.service');
const batchService = require('../services/batchPayment.service');

function paged(req) {
  return {
    page: Math.max(parseInt(req.query.page, 10) || 1, 1),
    limit: Math.min(parseInt(req.query.limit, 10) || 50, 500),
  };
}

function envelope(res, { data, total, page, pages }) {
  res.json({ success: true, data, pagination: { page, limit: Number(req.query.limit) || 50, total, pages } });
}

// ── Summaries + open documents ───────────────────────────────────────────────

exports.receivablesSummary = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await arApService.summary(req.tenant._id, 'ar') });
});

exports.payablesSummary = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await arApService.summary(req.tenant._id, 'ap') });
});

exports.listInvoices = asyncHandler(async (req, res) => {
  envelope(res, await arApService.listOpenDocs(req.tenant._id, 'ar', { ...paged(req), status: req.query.status, from: req.query.from, to: req.query.to }));
});

exports.listBills = asyncHandler(async (req, res) => {
  envelope(res, await arApService.listOpenDocs(req.tenant._id, 'ap', { ...paged(req), status: req.query.status, from: req.query.from, to: req.query.to }));
});

// ── Credit notes ─────────────────────────────────────────────────────────────

exports.listCreditNotes = asyncHandler(async (req, res) => {
  envelope(res, await creditNoteService.listCreditNotes(req.tenant._id, { ...paged(req), status: req.query.status, from: req.query.from, to: req.query.to }));
});

exports.createCreditNote = asyncHandler(async (req, res) => {
  const { amount, taxAmount } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'amount must be positive' });
  }
  const creditNote = await creditNoteService.createCreditNote({
    tenantId: req.tenant._id,
    data: req.body,
    userId: req.user._id,
  });
  await logPrivilegedAction(req, 'accounting.credit_note', 'create', {
    targetType: 'CreditNote',
    targetId: creditNote._id,
    targetTenantId: req.tenant._id,
    changes: { after: { amount, taxAmount } },
  });
  res.status(201).json({ success: true, data: creditNote });
});

exports.cancelCreditNote = asyncHandler(async (req, res) => {
  const creditNote = await creditNoteService.cancelCreditNote({
    tenantId: req.tenant._id,
    id: req.params.id,
    userId: req.user._id,
  });
  await logPrivilegedAction(req, 'accounting.credit_note_cancel', 'delete', {
    targetType: 'CreditNote',
    targetId: req.params.id,
    targetTenantId: req.tenant._id,
  });
  res.json({ success: true, data: creditNote });
});

// ── Payments (customer + vendor) ─────────────────────────────────────────────

function sideOf(req) {
  const side = req.query.side === 'vendor' ? 'vendor' : 'customer';
  return side;
}

exports.listPayments = asyncHandler(async (req, res) => {
  envelope(res, await paymentService.listPayments(req.tenant._id, sideOf(req), { ...paged(req), status: req.query.status, from: req.query.from, to: req.query.to }));
});

exports.createPayment = asyncHandler(async (req, res) => {
  const direction = sideOf(req);
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'amount must be positive' });
  }
  const doc = await paymentService.createPayment({
    tenantId: req.tenant._id,
    direction,
    data: req.body,
    userId: req.user._id,
  });
  await logPrivilegedAction(req, 'accounting.payment', 'create', {
    targetType: direction === 'customer' ? 'CustomerPayment' : 'VendorPayment',
    targetId: doc._id,
    targetTenantId: req.tenant._id,
    changes: { after: { amount, method: doc.method } },
  });
  res.status(201).json({ success: true, data: doc });
});

exports.cancelPayment = asyncHandler(async (req, res) => {
  const direction = sideOf(req);
  const doc = await paymentService.cancelPayment({
    tenantId: req.tenant._id,
    direction,
    id: req.params.id,
    userId: req.user._id,
  });
  await logPrivilegedAction(req, 'accounting.payment_cancel', 'delete', {
    targetType: direction === 'customer' ? 'CustomerPayment' : 'VendorPayment',
    targetId: req.params.id,
    targetTenantId: req.tenant._id,
  });
  res.json({ success: true, data: doc });
});

// ── Batch payments ───────────────────────────────────────────────────────────

exports.listBatches = asyncHandler(async (req, res) => {
  envelope(res, await batchService.listBatches(req.tenant._id, { ...paged(req), direction: req.query.direction, status: req.query.status }));
});

exports.listUnbatched = asyncHandler(async (req, res) => {
  envelope(res, await batchService.listUnbatched(req.tenant._id, sideOf(req), paged(req)));
});

exports.createBatch = asyncHandler(async (req, res) => {
  const batch = await batchService.createBatch({
    tenantId: req.tenant._id,
    direction: req.body.direction,
    paymentIds: req.body.paymentIds,
    account: req.body.account,
    userId: req.user._id,
  });
  await logPrivilegedAction(req, 'accounting.batch_create', 'create', {
    targetType: 'BatchPayment',
    targetId: batch._id,
    targetTenantId: req.tenant._id,
  });
  res.status(201).json({ success: true, data: batch });
});

exports.depositBatch = asyncHandler(async (req, res) => {
  const batch = await batchService.depositBatch({ tenantId: req.tenant._id, id: req.params.id });
  await logPrivilegedAction(req, 'accounting.batch_deposit', 'update', {
    targetType: 'BatchPayment',
    targetId: req.params.id,
    targetTenantId: req.tenant._id,
  });
  res.json({ success: true, data: batch });
});

exports.cancelBatch = asyncHandler(async (req, res) => {
  const batch = await batchService.cancelBatch({ tenantId: req.tenant._id, id: req.params.id });
  await logPrivilegedAction(req, 'accounting.batch_cancel', 'delete', {
    targetType: 'BatchPayment',
    targetId: req.params.id,
    targetTenantId: req.tenant._id,
  });
  res.json({ success: true, data: batch });
});

// ── Directories ──────────────────────────────────────────────────────────────

exports.listCustomers = asyncHandler(async (req, res) => {
  const [list, balances] = await Promise.all([
    arApService.customersList(req.tenant._id, { ...paged(req), search: req.query.search }),
    arApService.customerBalances(req.tenant._id),
  ]);
  const balanceById = new Map(balances.map((b) => [String(b.customerId), b]));
  envelope(res, {
    ...list,
    data: list.data.map((c) => ({
      ...c,
      outstanding: balanceById.get(String(c._id))?.outstanding ?? 0,
      openInvoices: balanceById.get(String(c._id))?.openInvoices ?? 0,
    })),
  });
});

exports.listVendors = asyncHandler(async (req, res) => {
  const [list, balances] = await Promise.all([
    arApService.vendorsList(req.tenant._id, { ...paged(req), search: req.query.search }),
    arApService.vendorBalances(req.tenant._id),
  ]);
  const balanceById = new Map(balances.map((b) => [String(b.vendorId), b]));
  envelope(res, {
    ...list,
    data: list.data.map((v) => ({
      ...v,
      outstanding: balanceById.get(String(v._id))?.outstanding ?? 0,
      openBills: balanceById.get(String(v._id))?.openBills ?? 0,
    })),
  });
});

exports.listProducts = asyncHandler(async (req, res) => {
  envelope(res, await arApService.productsList(req.tenant._id, { ...paged(req), search: req.query.search }));
});
