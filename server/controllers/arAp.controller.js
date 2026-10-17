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
const paymentService = require('../services/accountingPayment.service');
const batchService = require('../services/batchPayment.service');
const { withDbRetry } = require('../utils/db-retry');

function paged(req) {
  return {
    page: Math.max(parseInt(req.query.page, 10) || 1, 1),
    limit: Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100),
  };
}

function envelope(req, res, { data, total, page, pages }) {
  res.json({ success: true, data, pagination: { page, limit: paged(req).limit, total, pages } });
}

// ── Summaries + open documents ───────────────────────────────────────────────

exports.receivablesSummary = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await withDbRetry(() => arApService.summary(req.tenant._id, 'ar')) });
});

exports.payablesSummary = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await withDbRetry(() => arApService.summary(req.tenant._id, 'ap')) });
});

exports.savedInvoiceSummary = asyncHandler(async (req, res) => {
  const tenant = require('../utils/tenantContext').getTenantId(req);
  res.json({ success: true, data: await withDbRetry(() => require('../services/customerInvoice/summary').invoiceSummary(tenant)) });
});

exports.listInvoices = asyncHandler(async (req, res) => {
  const options = { ...paged(req), status: req.query.status, from: req.query.from, to: req.query.to, search: req.query.search, returnStatus: req.query.returnStatus, customer: req.query.customer };
  envelope(req, res, await withDbRetry(() => arApService.listInvoices(req.tenant._id, { ...options, scope: req.query.scope })));
});

exports.listBills = asyncHandler(async (req, res) => {
  envelope(req, res, await withDbRetry(() => arApService.listOpenDocs(req.tenant._id, 'ap', { ...paged(req), status: req.query.status, from: req.query.from, to: req.query.to, search: req.query.search, vendor: req.query.vendor })));
});

// ── Credit notes ─────────────────────────────────────────────────────────────

exports.listCreditNotes = asyncHandler(async (req, res) => {
  const tenant = require('../utils/tenantContext').getTenantId(req);
  const result = await withDbRetry(() => creditNoteService.listCreditNotes(tenant, {
    ...paged(req), status: req.query.status, from: req.query.from,
    to: req.query.to, customer: req.query.customer, search: req.query.search,
  }));
  res.json({ success: true, data: result.data, summary: result.summary,
    pagination: { page: result.page, limit: paged(req).limit, total: result.total, pages: result.pages } });
});

exports.createCreditNote = asyncHandler(async (req, res) => {
  const { amount, taxAmount, post } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'amount must be positive' });
  }

  // Creating is a draft by default. `post: true` is the one-step path for a
  // caller that has already reviewed the split; otherwise nothing reaches the
  // ledger until an explicit POST /:id/post.
  const data = { ...req.body };
  if (data.salesOrder) data.salesOrder = await require('../services/customerInvoice/browse').salesSourceId(req.tenant._id, data.salesOrder);
  const draft = await creditNoteService.createCreditNote({
    tenantId: req.tenant._id,
    data,
    userId: req.user._id,
  });
  const creditNote = post
    ? await creditNoteService.postCreditNote({
      tenantId: req.tenant._id,
      id: draft._id,
      userId: req.user._id,
    })
    : draft;

  await logPrivilegedAction(req, 'accounting.credit_note', post ? 'post' : 'create', {
    targetType: 'CreditNote',
    targetId: creditNote._id,
    targetTenantId: req.tenant._id,
    changes: { after: { amount, taxAmount, status: creditNote.status, unappliedAmount: creditNote.unappliedAmount } },
  });
  res.status(201).json({ success: true, data: creditNote });
});

exports.postCreditNote = asyncHandler(async (req, res) => {
  const creditNote = await creditNoteService.postCreditNote({
    tenantId: req.tenant._id,
    id: req.params.id,
    userId: req.user._id,
  });
  await logPrivilegedAction(req, 'accounting.credit_note', 'post', {
    targetType: 'CreditNote',
    targetId: req.params.id,
    targetTenantId: req.tenant._id,
    changes: { after: { unappliedAmount: creditNote.unappliedAmount, number: creditNote.number } },
  });
  res.json({ success: true, data: creditNote });
});

exports.applyCreditNote = asyncHandler(async (req, res) => {
  const { salesOrder, amount, customer } = req.body;
  const result = await creditNoteService.applyCredit({
    tenantId: req.tenant._id,
    customer,
    salesOrder: await require('../services/customerInvoice/browse').salesSourceId(req.tenant._id, salesOrder),
    amount,
    userId: req.user._id,
  });
  // Applying credit moves no journal entry — it only records which invoice the
  // credit settled — so there is no GL reversal to log, just the allocation.
  await logPrivilegedAction(req, 'accounting.credit_note_apply', 'update', {
    targetType: 'SalesOrder',
    targetId: result.salesOrder,
    targetTenantId: req.tenant._id,
    changes: { after: { applied: result.applied, notes: result.notes } },
  });
  res.json({ success: true, data: result });
});

exports.getCustomerCredits = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await creditNoteService.customerCredits(req.tenant._id, req.params.customerId, paged(req)),
  });
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
  const querySide = req.query.side;
  const bodySide = req.body?.side;
  const allowed = ['customer', 'vendor'];
  if ((querySide && !allowed.includes(querySide)) || (bodySide && !allowed.includes(bodySide)))
    throw require('../services/accounting.query').bad('Invalid payment side');
  if (querySide && bodySide && querySide !== bodySide)
    throw require('../services/accounting.query').bad('Conflicting payment side');
  return querySide || bodySide || 'customer';
}

exports.listPayments = asyncHandler(async (req, res) => {
  const tenant = require('../utils/tenantContext').getTenantId(req);
  const result = await withDbRetry(() => paymentService.listPayments(tenant, sideOf(req), {
    ...paged(req), status: req.query.status, method: req.query.method,
    from: req.query.from, to: req.query.to, search: req.query.search,
    vendor: req.query.vendor,
  }));
  res.json({ success: true, data: result.data, paymentSummary: result.paymentSummary,
    pagination: { page: result.page, limit: paged(req).limit, total: result.total, pages: result.pages } });
});

exports.createPayment = asyncHandler(async (req, res) => {
  const direction = sideOf(req);
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'amount must be positive' });
  }
  const data = { ...req.body };
  if (direction === 'customer' && Array.isArray(data.allocations)) {
    data.allocations = [];
    for (const allocation of req.body.allocations) data.allocations.push({ ...allocation,
      salesOrder: await require('../services/customerInvoice/browse').salesSourceId(req.tenant._id, allocation.salesOrder) });
  }
  const doc = await paymentService.createPayment({
    tenantId: req.tenant._id,
    direction,
    data,
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
  const result = await withDbRetry(() => batchService.listBatches(require('../utils/tenantContext').getTenantId(req), {
    ...paged(req), direction: req.query.direction, status: req.query.status,
    account: req.query.account, search: req.query.search, from: req.query.from, to: req.query.to,
  }));
  res.json({ success: true, data: result.data, batchSummary: result.batchSummary,
    pagination: { page: result.page, limit: paged(req).limit, total: result.total, pages: result.pages } });
});

exports.listUnbatched = asyncHandler(async (req, res) => {
  envelope(req, res, await withDbRetry(() => batchService.listUnbatched(require('../utils/tenantContext').getTenantId(req), sideOf(req), { ...paged(req), account: req.query.account, search: req.query.search })));
});

exports.createBatch = asyncHandler(async (req, res) => {
  const tenantId = require('../utils/tenantContext').getTenantId(req);
  const batch = await batchService.createBatch({
    tenantId,
    direction: req.body.direction,
    paymentIds: req.body.paymentIds,
    account: req.body.account,
    expectedMembers: req.body.expectedMembers,
    userId: req.user._id,
  });
  await logPrivilegedAction(req, 'accounting.batch_create', 'create', {
    targetType: 'BatchPayment',
    targetId: batch._id,
    targetTenantId: tenantId,
  });
  res.status(201).json({ success: true, data: batch });
});

exports.previewBatchSelection = asyncHandler(async (req, res) => {
  const data = await withDbRetry(() => batchService.previewSelection({
    tenantId: require('../utils/tenantContext').getTenantId(req), direction: req.body.direction,
    account: req.body.account, paymentIds: req.body.paymentIds,
  }));
  res.json({ success: true, data });
});

exports.depositBatch = asyncHandler(async (req, res) => {
  const tenantId = require('../utils/tenantContext').getTenantId(req);
  const batch = await batchService.depositBatch({ tenantId, id: req.params.id });
  await logPrivilegedAction(req, 'accounting.batch_deposit', 'update', {
    targetType: 'BatchPayment',
    targetId: req.params.id,
    targetTenantId: tenantId,
  });
  res.json({ success: true, data: batch });
});

exports.cancelBatch = asyncHandler(async (req, res) => {
  const tenantId = require('../utils/tenantContext').getTenantId(req);
  const batch = await batchService.cancelBatch({ tenantId, id: req.params.id });
  await logPrivilegedAction(req, 'accounting.batch_cancel', 'delete', {
    targetType: 'BatchPayment',
    targetId: req.params.id,
    targetTenantId: tenantId,
  });
  res.json({ success: true, data: batch });
});

// ── Directories ──────────────────────────────────────────────────────────────

exports.listCustomers = asyncHandler(async (req, res) => {
  const [list, balances, credits] = await Promise.all([
    arApService.customersList(req.tenant._id, { ...paged(req), search: req.query.search }),
    arApService.customerBalances(req.tenant._id),
    // One aggregate for the whole page, not one per row.
    creditNoteService.unappliedBalances(
      req.tenant._id,
      (list.data || []).map((c) => String(c._id)),
    ),
  ]);
  const balanceById = new Map(balances.map((b) => [String(b.customerId), b]));
  envelope(req, res, {
    ...list,
    data: list.data.map((c) => ({
      ...c,
      outstanding: balanceById.get(String(c._id))?.outstanding ?? 0,
      openInvoices: balanceById.get(String(c._id))?.openInvoices ?? 0,
      // Credit the customer holds and has not spent. Distinct from
      // `outstanding`, which is what they owe.
      creditBalance: credits.get(String(c._id)) ?? 0,
    })),
  });
});

exports.listVendors = asyncHandler(async (req, res) => {
  const [list, balances] = await Promise.all([
    arApService.vendorsList(req.tenant._id, { ...paged(req), search: req.query.search }),
    arApService.vendorBalances(req.tenant._id),
  ]);
  const balanceById = new Map(balances.map((b) => [String(b.vendorId), b]));
  envelope(req, res, {
    ...list,
    data: list.data.map((v) => ({
      ...v,
      outstanding: balanceById.get(String(v._id))?.outstanding ?? 0,
      openBills: balanceById.get(String(v._id))?.openBills ?? 0,
    })),
  });
});

exports.listProducts = asyncHandler(async (req, res) => {
  envelope(req, res, await arApService.productsList(req.tenant._id, { ...paged(req), search: req.query.search }));
});

exports.issueInvoice = asyncHandler(async (req, res) => {
  const id = await require('../services/customerInvoice/browse').salesSourceId(req.tenant._id, req.params.id, { allowDraft: true });
  const doc = await require('../services/accountingInvoice.service').issueInvoice({
    tenantId: req.tenant._id, id, dueDate: req.body.dueDate, userId: req.user._id,
  });
  await require('../services/tax.service').captureDocumentTax({ sourceType: 'sales_order', doc, postedBy: req.user._id });
  res.json({ success: true, data: doc });
});
exports.getInvoice = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await withDbRetry(() => require('../services/customerInvoice/browse').getInvoice(req.tenant._id, req.params.id)) });
});
exports.saveInvoiceDraft = asyncHandler(async (req, res) => {
  const doc = await require('../services/accountingInvoice.service').saveDraft({ tenantId: req.tenant._id, id: req.body.sourceId });
  res.json({ success: true, data: doc });
});
exports.reconcileInvoice = asyncHandler(async (req, res) => {
  const doc = await require('../services/customerInvoice/browse').getInvoice(req.tenant._id, req.params.id);
  const saved = await require('../services/customerInvoice/sync').syncSource({ tenantId: req.tenant._id, source: doc.source, sourceId: doc.sourceId });
  if (!saved) return res.status(404).json({ success: false, message: 'Source document is not available' });
  res.json({ success: true, data: saved });
});
