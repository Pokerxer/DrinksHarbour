const linkedReturns = require('../services/linkedReturns.service');
const quotationReturns = require('../services/salesQuotationReturns');
const { salespersonIdentity, mySalespersonQuery, saveSalesEdit } = require('../services/salesSalesperson');
const orderPolicy = require('../services/salesOrderPolicy');
const reservations = require('../services/salesReservations');
Object.assign(exports, require('./salesOrderLock.controller'));
// server/controllers/salesOrder.controller.js
const asyncHandler = require("express-async-handler");
const { withDbRetry } = require('../utils/db-retry');
const crypto = require('crypto');
const SalesOrder = require('../models/SalesOrder');
const Tenant = require('../models/Tenant');
const Activity = require('../models/Activity');
const CustomField = require('../models/CustomField');
const svc = require('../services/salesOrder.service');
const salesImportSvc = require('../services/salesImport.service');
const salesFulfillSvc = require('../services/salesFulfill.service');
const salesLog = require('../services/salesActivity.service');
const { captureDocumentTax, reverseDocumentTax, effectiveTaxForFlow } = require('../services/tax.service');
const { postDocumentEntry, reverseDocumentEntry } = require('../services/accounting.posting');
const { logPrivilegedAction } = require('../utils/auditLog');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { paginatedResponse } = require('../utils/response');
const { printableBankAccounts } = require('../utils/bankAccounts');

// Platform roles that can operate across tenants (via ?tenant=/x-tenant-slug).
const PLATFORM_ROLES = ['super_admin', 'admin'];

// F2: every super_admin/admin mutation that touches a tenant's sales data must
// be audited (actor, target tenant, justification). Tenant-scoped users
// (owner/admin/staff) act only within their own tenant and are not audited
// here. Fire-and-forget — auditing never blocks or fails the request.
function auditPrivilegedSalesAction(req, action, actionCategory, so) {
  if (!PLATFORM_ROLES.includes(req.user?.role)) return;
  void logPrivilegedAction(req, action, actionCategory, {
    targetType: 'SalesOrder',
    targetId: so?._id,
    targetTenantId: req.tenant?._id,
    justification: req.body?.justification,
  });
}

// I2: every handler that scopes a query/mutation by tenantId MUST refuse to run
// when tenantId is unresolved. Without this, Mongoose silently strips an
// `undefined` value out of a filter (`{ tenant: undefined }` becomes `{}`),
// turning a tenant-scoped read/write into a cross-tenant one.
function requireResolvedTenant(tenantId, res) {
  if (!tenantId) {
    res.status(401).json({ success: false, message: 'Tenant not resolved' });
    return false;
  }
  return true;
}

// Remittance accounts for a printed sales invoice.
//
// ONLY the `bankAccounts` array — the "Invoice Bank Accounts" list in Settings.
// The tenant's other bank fields (`bankName` / `bankAccountName` /
// `bankAccountNumber`) are the *settlement* account, which the tenant form
// describes as "where this tenant's payouts are sent" and explicitly keeps
// "separate from" the invoice accounts. That is the account Paystack pays the
// tenant OUT to; it is not a place a customer should transfer an invoice
// payment to, and printing it as one risks directing a large remittance
// somewhere it does not belong. Same rule as the POS receipt (posStore()).
//
// A row needs a bank name AND a number to be payable; half a row would print as
// "Account Number: 0123456789" with no bank, which is not a usable instruction.
// Settings enforces the same rule, so this filter is a belt-and-braces guard.
//
// The selected fulfilment warehouse is the issuing *entity* on paper but it
// carries no bank details (see models/Warehouse.js), so the tenant — the
// merchant of record — is the only source of a remittance account.

exports.createSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const assignment = salespersonIdentity(req.user);
  // Snapshot the effective taxRate for any line carrying a configured Tax ref
  // before the service normalises/copies the lines (mapLine reads item.taxRate).
  if (Array.isArray(req.body?.items)) {
    for (const item of req.body.items) {
      if (!item || !item.tax) continue;
      if (item.lineType && item.lineType !== 'product') continue;
      let resolved;
      try {
        resolved = await effectiveTaxForFlow({ tenantId, taxId: item.tax, sourceType: 'sales_order' });
      } catch (e) {
        return res.status(400).json({ success: false, message: e.message });
      }
      if (resolved && resolved.taxRate !== null) item.taxRate = resolved.taxRate;
    }
  }
  const so = await svc.createSalesOrderDoc({ tenantId, ...assignment, body: req.body });
  auditPrivilegedSalesAction(req, 'SALES_ORDER_CREATE', 'create', so);
  await salesLog.logActivity(tenantId, so._id, {
    subject: so.docType === 'quotation' ? 'Quotation created' : 'Sales Order created',
    userId: req.user?._id,
  });
  res.status(201).json({ success: true, data: so });
});

exports.getSalesOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { search, page, limit, dateFrom, dateTo, warehouse, paymentMethod, paymentStatus, salesperson, docType, status, customer, currency, paymentTerms, pricelist, tags, filters, groupBy, groupBySubOption } = req.query;
  let q = { tenant: tenantId };
  if (search) {
    q.$or = [
      { soNumber: { $regex: search, $options: 'i' } },
      { 'customerSnapshot.name': { $regex: search, $options: 'i' } },
    ];
  }
  if (dateFrom || dateTo) {
    q.createdAt = {};
    if (dateFrom) q.createdAt.$gte = new Date(dateFrom);
    if (dateTo) q.createdAt.$lte = new Date(dateTo);
  }
  if (warehouse) q.warehouseId = warehouse;
  if (paymentMethod) q.paymentMethod = paymentMethod;
  if (paymentStatus) q.paymentStatus = paymentStatus;
  if (salesperson) q.salesperson = salesperson;
  if (docType) q.docType = docType;
  if (customer) q.customer = customer;
  if (currency) q.currency = currency;
  if (paymentTerms) q.paymentTerms = paymentTerms;
  if (pricelist) q.pricelist = pricelist;
  if (tags) q.tags = { $in: Array.isArray(tags) ? tags : [tags] };
  if (status && docType === 'quotation') q.quoteStatus = status;
  if (status && docType === 'order') q.orderStatus = status;
  const filterQuery = svc.buildFilterQuery(filters);
  Object.assign(q, filterQuery);
  // Belt and braces: buildFilterQuery already refuses to name `tenant`, but the
  // filter query is merged OVER this one, so re-assert the scope afterwards.
  // Nothing a caller sends may decide which tenant's orders come back.
  q.tenant = tenantId;
  // Add ownership after advanced filters so it cannot overwrite tenant/search
  // predicates or be overridden by client-supplied document fields.
  if (req.query.myQuotations === '1')
    q.$and = [...(q.$and || []), mySalespersonQuery(req.user)];

  let returnedIds = new Set();
  if (q.docType === 'quotation' && req.query.includeReturnedOrders === '1') {
    const expanded = await quotationReturns.includeReturnedOrders(q);
    q = expanded.query;
    returnedIds = new Set(expanded.ids.map(String));
  }
  const markReturns = doc => returnedIds.has(String(doc._id))
    ? { ...doc, hasReturns: true } : doc;

  // Group-by path: server-side grouping, no pagination
  if (groupBy && groupBy !== 'none' && groupBy !== '') {
    const { groups, truncated, fetched, total } = await svc.getGroupedOrders({
      matchQuery: q, groupBy, groupBySubOption,
    });
    // `truncated` is not decoration — the grouped path is unpaginated, so
    // without it a capped result is indistinguishable from a complete one.
    return res.json({ success: true, groups: groups.map(group => ({
      ...group, docs: group.docs.map(markReturns),
    })), truncated, fetched, total });
  }

  const { skip, limit: pageLimit, page: pageNum } = parsePagination(page, limit);
  // Wrapped because this is the read that a dead `<monitor>` connection used to
  // turn into a 500: `connection <monitor> to <ip>:27017 closed` means the query
  // never reached Mongo, so re-sending it cannot duplicate anything. See
  // utils/db-retry.js for why these error codes and no others are retried.
  const [data, total] = await withDbRetry(() =>
    Promise.all([
      SalesOrder.find(q).sort({ createdAt: -1 }).populate('warehouseId', 'name').skip(skip).limit(pageLimit).lean(),
      SalesOrder.countDocuments(q),
    ])
  );
  const rows = req.query.includeReturns === '1'
    ? await linkedReturns.projectSalesReturns(data, tenantId) : data;
  paginatedResponse(res, await reservations.projectReservations(rows.map(markReturns),tenantId), buildPaginationMeta(pageNum, pageLimit, total));
});

/**
 * Read a customer's marketplace cart, filtered to the lines this tenant sells,
 * so staff can pull it into a quotation. Query params:
 *   - `customer`: a tenant-scoped POSCustomer id (recommended when the sales
 *     screen already has one — the customer picker resolves it).
 *   - `email` (alternative): a marketplace User's email. When no matching
 *     POSCustomer exists for this tenant, one is auto-created and returned as
 *     `data.posCustomer` so the quotation can reference it.
 * The controller is behind requireOwnTenant + tenantUserOnly (see routes).
 */
exports.getCustomerCartForQuote = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { customer, email } = req.query;
  if (!customer && !email) {
    return res
      .status(400)
      .json({ success: false, message: 'customer (POSCustomer id) or email is required' });
  }
  const data = await svc.getCustomerCartForQuote({
    tenantId,
    posCustomerId: customer || undefined,
    email: email || undefined,
  });
  res.json({ success: true, data });
});

exports.getSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  // Populate what the detail page has to render as words: the source warehouse,
  // and per fulfilment the warehouse the stock left from and the person who
  // fulfilled it. Selecting only the display field keeps this from widening into
  // a second document's worth of payload.
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId })
    // warehouseId carries address/contact too — the printed quotation/invoice
    // presents the selected warehouse as the issuing entity (PO parity).
    .populate('warehouseId', 'name code type address contact')
    .populate('fulfillments.warehouseId', 'name')
    .populate('fulfillments.by', 'firstName lastName');
  if (!so) return res.status(404).json({ success: false, message: 'Sales order not found' });
  // The remittance accounts the printed invoice tells the customer to pay into.
  // Read server-side from the already-resolved tenant rather than trusting the
  // client or the public /slug/:slug branding payload (unauthenticated, kept
  // narrow on purpose). A sibling key, not a populate on `tenant`, so the
  // order's own tenant ref stays a ref.
  const payer = await Tenant.findById(tenantId)
    .select('bankAccounts')
    .lean();
  res.json({
    success: true,
    data: { ...(await reservations.projectReservations(await linkedReturns.projectSalesReturns([so], tenantId),tenantId))[0], issuerBankAccounts: printableBankAccounts(payer?.bankAccounts) },
  });
});

exports.updateSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  // Only the lookup is retried. The edit below (applyEdit + save) is deliberately
  // left alone: by the time it runs we hold a document, and a blind replay of a
  // save that may already have been acknowledged is how you double-post an order.
  const so = await withDbRetry(() =>
    SalesOrder.findOne({ _id: req.params.id, tenant: tenantId })
  );
  if (!so) return res.status(404).json({ success: false, message: 'Sales order not found' });
  if (!svc.canEdit(so)) {
    return res.status(409).json({ success: false, message: 'This document can no longer be edited' });
  }
  const before = {
    pricelistName: so.appliedPricelist?.pricelistName,
    total: so.total, subtotal: so.subtotal,
    discountTotal: so.discountTotal, promotionTotal: so.promotionTotal,
    customerName: so.customerSnapshot?.name,
    paymentTerms: so.paymentTerms,
    warehouseId: so.warehouseId?.toString(),
    validUntil: so.validUntil,
    notes: so.notes,
  };
  // Snapshot the effective taxRate for any line carrying a configured Tax ref
  // before applyEdit maps the payload lines (mapLine reads item.taxRate).
  if (Array.isArray(req.body?.items)) {
    for (const item of req.body.items) {
      if (!item || !item.tax) continue;
      if (item.lineType && item.lineType !== 'product') continue;
      let resolved;
      try {
        resolved = await effectiveTaxForFlow({ tenantId, taxId: item.tax, sourceType: 'sales_order' });
      } catch (e) {
        return res.status(400).json({ success: false, message: e.message });
      }
      if (resolved && resolved.taxRate !== null) item.taxRate = resolved.taxRate;
    }
  }
  await svc.applyEdit(so, req.body);
  await saveSalesEdit(so, req.user);
  auditPrivilegedSalesAction(req, 'SALES_ORDER_UPDATE', 'update', so);
  const plDiff = salesLog.diffPricelist(before.pricelistName, so.appliedPricelist?.pricelistName);
  if (plDiff) {
    await salesLog.logActivity(tenantId, so._id, {
      subject: `Pricelist: ${plDiff.from} → ${plDiff.to}`,
      meta: { field: 'pricelist', ...plDiff }, userId: req.user?._id,
    });
  }
  const tDiff = salesLog.diffTotals(before, so);
  if (tDiff && tDiff.total) {
    await salesLog.logActivity(tenantId, so._id, {
      subject: `Total ${salesLog.formatMoney(tDiff.total.from)} → ${salesLog.formatMoney(tDiff.total.to)}`,
      description: tDiff.untaxed ? `Untaxed ${salesLog.formatMoney(tDiff.untaxed.from)} → ${salesLog.formatMoney(tDiff.untaxed.to)}` : undefined,
      meta: { field: 'total', ...tDiff }, userId: req.user?._id,
    });
  }
  const newCustomerName = so.customerSnapshot?.name;
  if (before.customerName !== newCustomerName) {
    await salesLog.logActivity(tenantId, so._id, {
      subject: `Customer: ${before.customerName || '—'} → ${newCustomerName || '—'}`,
      userId: req.user?._id,
    });
  }
  if (before.paymentTerms !== so.paymentTerms) {
    await salesLog.logActivity(tenantId, so._id, {
      subject: `Payment terms: ${before.paymentTerms || '—'} → ${so.paymentTerms || '—'}`,
      userId: req.user?._id,
    });
  }
  if (before.warehouseId !== (so.warehouseId?.toString())) {
    await salesLog.logActivity(tenantId, so._id, {
      subject: 'Warehouse changed',
      userId: req.user?._id,
    });
  }
  if (String(before.validUntil) !== String(so.validUntil)) {
    await salesLog.logActivity(tenantId, so._id, {
      subject: 'Valid until updated',
      userId: req.user?._id,
    });
  }
  res.json({ success: true, data: so });
});

// Price draft lines through the same authoritative engine createSalesOrderDoc
// runs on save (resolveLinePricing → computeAuthoritativeLinePrices), without
// touching any document. The create/edit pages call this so the unit price the
// operator sees is exactly the one the saved order will carry; priceOverridden
// lines pass through verbatim. Tenant-scoped, read-only.
exports.priceLines = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { items, pricelist } = req.body || {};
  if (!Array.isArray(items)) {
    return res.status(400).json({ success: false, message: 'items must be an array' });
  }
  const priced = await svc.resolveLinePricing(items, {
    tenantId,
    pricelistId: pricelist || null,
  });
  const promoted = await svc.resolveLinePromotions(priced, {tenantId});
  res.json({ success: true, data: { items: promoted } });
});

// Recompute every product line's unit price from the order's current pricelist,
// clearing manual price overrides, then re-snapshot totals. Tenant-scoped.
exports.updatePrices = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId });
  if (!so) return res.status(404).json({ success: false, message: 'Sales order not found' });
  if (!svc.canEdit(so)) {
    return res.status(409).json({ success: false, message: 'This document can no longer be edited' });
  }
  const before = {
    total: so.total, subtotal: so.subtotal,
    discountTotal: so.discountTotal, promotionTotal: so.promotionTotal,
  };
  await svc.updatePricesForOrder(so, { tenantId });
  await saveSalesEdit(so, req.user);
  auditPrivilegedSalesAction(req, 'SALES_ORDER_UPDATE', 'update', so);
  await salesLog.logActivity(tenantId, so._id, {
    subject: `Product prices recomputed according to pricelist ${so.appliedPricelist?.pricelistName || 'base'}`,
    userId: req.user?._id,
  });
  const tDiff = salesLog.diffTotals(before, so);
  if (tDiff && tDiff.total) {
    await salesLog.logActivity(tenantId, so._id, {
      subject: `Total ${salesLog.formatMoney(tDiff.total.from)} → ${salesLog.formatMoney(tDiff.total.to)}`,
      description: tDiff.untaxed ? `Untaxed ${salesLog.formatMoney(tDiff.untaxed.from)} → ${salesLog.formatMoney(tDiff.untaxed.to)}` : undefined,
      meta: { field: 'total', ...tDiff }, userId: req.user?._id,
    });
  }
  res.json({ success: true, data: so });
});

// Apply (POST body {code}) or clear (body {code: null|''}) a coupon on an
// editable order. The code resolves against tenant Promotions (findByCode).
exports.applyCoupon = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId });
  if (!so) return res.status(404).json({ success: false, message: 'Sales order not found' });
  if (!svc.canEdit(so)) {
    return res.status(409).json({ success: false, message: 'This document can no longer be edited' });
  }
  const code = (req.body?.code ?? '').toString().trim();
  try {
    await svc.applyCouponToOrder(so, code);
  } catch (err) {
    return res
      .status(err.statusCode || 400)
      .json({ success: false, message: err.message || 'Could not apply coupon' });
  }
  await saveSalesEdit(so, req.user);
  await salesLog.logActivity(tenantId, so._id, {
    subject: code
      ? `Coupon ${so.couponCode} applied (−${salesLog.formatMoney(so.couponDiscount)})`
      : 'Coupon removed',
    userId: req.user?._id,
  });
  res.json({ success: true, data: so });
});

exports.deleteSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId });
  if (!so) return res.status(404).json({ success: false, message: 'Sales order not found' });
  if (!svc.canCancel(so)) {
    return res.status(409).json({ success: false, message: orderPolicy.cancellationReason(so) });
  }
  if (so.reservationVersion) {
    const cancelled = await reservations.cancelReservedOrder({tenantId,orderId:so._id,actorId:req.user?._id});
    so.orderStatus=cancelled.orderStatus;
  } else {
    if (so.docType === 'order') so.orderStatus = 'cancelled';
    else so.quoteStatus = 'rejected';
    await so.save();
  }
  if (so.docType === 'order') reverseDocumentTax({ sourceType: 'sales_order', doc: so, userId: req.user?._id });
  if (so.docType === 'order') reverseDocumentEntry({ sourceType: 'sales_order', doc: so, userId: req.user?._id });
  auditPrivilegedSalesAction(req, 'SALES_ORDER_CANCEL', 'delete', so);
  await salesLog.logActivity(tenantId, so._id, {
    subject: salesLog.statusSubject(so.docType, so.docType === 'order' ? 'cancelled' : 'rejected'),
    userId: req.user?._id,
  });
  res.json({ success: true, data: so });
});

// Helper: load a quotation scoped to tenant, 404 if missing/not a quotation
async function loadQuotation(req, res) {
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: req.tenant?._id });
  if (!so || so.docType !== 'quotation') {
    res.status(404).json({ success: false, message: 'Quotation not found' });
    return null;
  }
  if (so.locked) {
    res.status(409).json({success:false,message:'Unlock this document before changing it.'});
    return null;
  }
  return so;
}

exports.sendQuotation = asyncHandler(async (req, res) => {
  if (!requireResolvedTenant(req.tenant?._id, res)) return;
  const so = await loadQuotation(req, res); if (!so) return;
  if (so.quoteStatus !== 'draft') return res.status(409).json({ success: false, message: 'Only a draft quotation can be sent' });
  so.quoteStatus = 'sent'; await so.save();
  auditPrivilegedSalesAction(req, 'QUOTATION_SEND', 'update', so);
  await salesLog.logActivity(req.tenant?._id, so._id, {
    subject: salesLog.statusSubject(so.docType, 'sent'), userId: req.user?._id,
  });
  res.json({ success: true, data: so });
});

exports.acceptQuotation = asyncHandler(async (req, res) => {
  if (!requireResolvedTenant(req.tenant?._id, res)) return;
  const so = await loadQuotation(req, res); if (!so) return;
  if (so.quoteStatus !== 'sent') return res.status(409).json({ success: false, message: 'Only a sent quotation can be accepted' });
  so.quoteStatus = 'accepted'; await so.save();
  auditPrivilegedSalesAction(req, 'QUOTATION_ACCEPT', 'approve', so);
  await salesLog.logActivity(req.tenant?._id, so._id, {
    subject: salesLog.statusSubject(so.docType, 'accepted'), userId: req.user?._id,
  });
  res.json({ success: true, data: so });
});

exports.rejectQuotation = asyncHandler(async (req, res) => {
  if (!requireResolvedTenant(req.tenant?._id, res)) return;
  const so = await loadQuotation(req, res); if (!so) return;
  if (!['sent', 'draft'].includes(so.quoteStatus)) return res.status(409).json({ success: false, message: 'Quotation cannot be rejected' });
  so.quoteStatus = 'rejected'; await so.save();
  auditPrivilegedSalesAction(req, 'QUOTATION_REJECT', 'reject', so);
  await salesLog.logActivity(req.tenant?._id, so._id, {
    subject: salesLog.statusSubject(so.docType, 'rejected'), userId: req.user?._id,
  });
  res.json({ success: true, data: so });
});

exports.convertQuotation = asyncHandler(async (req, res) => {
  if (!requireResolvedTenant(req.tenant?._id, res)) return;
  const so = await loadQuotation(req, res); if (!so) return;
  if (['converted', 'rejected', 'expired'].includes(so.quoteStatus)) {
    return res.status(409).json({ success: false, message: 'Quotation cannot be converted' });
  }
  // In place: this IS the order now, same id and same number. Nothing was
  // created, so this is 200, and there is one document to log against — the
  // old second entry ("Created via conversion from quotation …") described an
  // event that no longer happens.
  const order = await svc.convertQuotationToOrder(so);
  auditPrivilegedSalesAction(req, 'QUOTATION_CONVERT', 'update', order);
  await salesLog.logActivity(req.tenant?._id, order._id, {
    subject: salesLog.statusSubject('quotation', 'converted'), userId: req.user?._id,
  });
  res.json({ success: true, data: order });
});

exports.confirmSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId, docType: 'order' });
  if (!so) return res.status(404).json({ success: false, message: 'Order not found' });
  if (so.locked && so.orderStatus === 'draft') return res.status(409).json({success:false,message:'Unlock this document before confirming.'});
  if (!req.body.paymentMethod) return res.status(400).json({success:false,message:'Payment method required'});
  if (so.orderStatus === 'draft') await reservations.confirmReservation({tenantId,orderId:so._id,
    warehouseId:so.warehouseId,actorId:req.user?._id||req.posUser?._id});
  const paid = await require('../services/salesReservations/payment').recordPayment({tenantId,orderId:so._id,
    actorId:req.user?._id||req.posUser?._id,payment:{paymentMethod:req.body.paymentMethod,
      amountTendered:req.body.amountTendered,splitPayments:req.body.splitPayments,redeemPoints:req.body.redeemPoints}});
  Object.assign(so,paid);
  captureDocumentTax({ sourceType: 'sales_order', doc: so, postedBy: req.user?._id });
  await postDocumentEntry({ sourceType: 'sales_order', doc: so, postedBy: req.user?._id });
  auditPrivilegedSalesAction(req, 'SALES_ORDER_CONFIRM', 'update', so);
  await salesLog.logActivity(tenantId, so._id, {
    subject: salesLog.statusSubject(so.docType, 'confirmed'), userId: req.user?._id,
  });
  res.json({ success: true, data: so });
});

exports.fulfillSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId, docType: 'order' });
  if (!so) return res.status(404).json({ success: false, message: 'Order not found' });
  if (!so.reservationVersion && !['confirmed', 'partially_fulfilled'].includes(so.orderStatus)) {
    return res.status(409).json({ success: false, message: 'Only a confirmed order can be fulfilled' });
  }
  let { warehouseId, items: fulfillLines } = req.body;
  // Fallback: order-level warehouseId → tenant default warehouse
  if (!warehouseId && so.warehouseId) warehouseId = so.warehouseId;
  if (!warehouseId) {
    const Warehouse = require('../models/Warehouse');
    const def = await Warehouse.findOne({ tenant: tenantId, isDefault: true }).select('_id').lean();
    if (def) warehouseId = def._id;
  }
  if (!warehouseId) return res.status(400).json({ success: false, message: 'No warehouse set — configure a default warehouse first' });

  // C1: revenue + paymentMethod feed buildSalesRow so every Sales-required
  // field (finalItemPrice, revenueModelUsed, platformAmount, tenantAmount,
  // paymentMethod) is populated. revenueModel/markupPercentage/commissionPercentage
  // ARE selected onto req.tenant by attachTenant.
  const revenue = {
    revenueModel: req.tenant?.revenueModel,
    markupPct: req.tenant?.markupPercentage,
    commissionPct: req.tenant?.commissionPercentage,
  };
  const { order, posting } = so.reservationVersion ? await reservations.fulfillReservedOrder({
    tenantId,orderId:so._id,warehouseId,items:fulfillLines||[],requestId:req.body.requestId,actorId:req.user?._id||req.posUser?._id,
    actor:req.user||req.posUser,
  }) : await salesFulfillSvc.fulfillOrder({
    salesOrder: so, tenantId, warehouseId, fulfillLines: fulfillLines || [],
    userId: req.user?._id || req.posUser?._id, deps: {},
    actor: req.user || req.posUser,
    revenue, paymentMethod: so.paymentMethod,
  });
  auditPrivilegedSalesAction(req, 'SALES_ORDER_FULFILL', 'transfer', order);
  res.json({ success: true, data: order, posting });
  await salesLog.logActivity(tenantId, so._id, {
    subject: 'Sales Order fulfilled',
    userId: req.user?._id || req.posUser?._id,
  });
});

exports.returnSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId, docType: 'order' });
  if (!so) return res.status(404).json({ success: false, message: 'Order not found' });
  if (!['partially_fulfilled', 'fulfilled'].includes(so.orderStatus)) {
    return res.status(409).json({ success: false, message: 'Only a fulfilled order can be returned' });
  }
  const { warehouseId, items: returnLines } = req.body;
  if (!warehouseId) return res.status(400).json({ success: false, message: 'Restock warehouse required' });

  const recordMovement = async (m) => {
    const InventoryMovement = require('../models/InventoryMovement');
    await InventoryMovement.create({
      subProduct: m.subProduct,
      tenant: m.tenant,
      product: m.product,
      size: m.size,
      warehouse: m.warehouse,
      type: 'return',
      category: 'in',
      quantity: m.quantity,
      quantityBefore: Number.isFinite(m.balanceAfter) ? m.balanceAfter - m.quantity : 0,
      quantityAfter: Number.isFinite(m.balanceAfter) ? m.balanceAfter : m.quantity,
      reference: m.reference,
      referenceType: 'return',
      relatedSalesOrder: m.relatedSalesOrder,
      performedBy: m.performedBy,
      source: 'return',
      status: 'confirmed',
      notes: `Sales return: ${m.reference}`,
    });
  };

  const { posReturnedByLine } = await linkedReturns.posReturnState(so, tenantId);
  const { order, restock } = await salesFulfillSvc.returnOrder({
    posReturnedByLine,
    salesOrder: so, tenantId, warehouseId, returnLines: returnLines || [],
    userId: req.user?._id || req.posUser?._id, deps: { recordMovement },
  });
  auditPrivilegedSalesAction(req, 'SALES_ORDER_RETURN', 'transfer', order);
  res.json({ success: true, data: order, restock });
  await salesLog.logActivity(tenantId, so._id, {
    subject: 'Return processed',
    userId: req.user?._id || req.posUser?._id,
  });
});

// ─── Task 2: Duplicate ───────────────────────────────────────────────────────
exports.duplicateSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId });
  if (!so) return res.status(404).json({ success: false, message: 'Sales order not found' });
  const dup = await svc.duplicateSalesOrderDoc(so);
  auditPrivilegedSalesAction(req, 'SALES_ORDER_DUPLICATE', 'create', dup);
  res.status(201).json({ success: true, data: dup });
  await salesLog.logActivity(tenantId, so._id, {
    subject: `Duplicated — new document ${dup.soNumber}`,
    description: `Sales order was duplicated. New document: ${dup.soNumber}`,
    userId: req.user?._id,
  });
});

// ─── Task 3: Import CSV ──────────────────────────────────────────────────────
exports.importSalesOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { csv } = req.body;
  if (!csv) return res.status(400).json({ success: false, message: 'CSV text is required in body.csv' });
  const orders = salesImportSvc.parseSalesCsv(csv, tenantId);
  const result = await salesImportSvc.bulkImportSales(orders, tenantId, salespersonIdentity(req.user));
  auditPrivilegedSalesAction(req, 'SALES_IMPORT', 'create', null);
  res.json({ success: true, data: result });
});

// ─── Task 4a: Payment Link ────────────────────────────────────────────────────
exports.generatePaymentLink = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId, docType: 'order' });
  if (!so) return res.status(404).json({ success: false, message: 'Order not found' });
  if (so.orderStatus !== 'draft') return res.status(409).json({ success: false, message: 'Only a draft order can generate a payment link' });
  const paymentLink = `https://pay.drinksharbour.com/pay/${so._id}`;
  so.paymentLink = paymentLink;
  await so.save();
  res.json({ success: true, data: { paymentLink } });
  await salesLog.logActivity(tenantId, so._id, {
    subject: 'Payment link generated',
    userId: req.user?._id,
  });
});

// ─── Task 4b: Accrued Revenue ─────────────────────────────────────────────────
exports.accruedRevenueEntry = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId, docType: 'order' });
  if (!so) return res.status(404).json({ success: false, message: 'Order not found' });
  if (so.orderStatus !== 'confirmed') return res.status(409).json({ success: false, message: 'Only a confirmed order can record accrued revenue' });
  const entry = await postDocumentEntry({ sourceType: 'sales_order', doc: so, postedBy: req.user?._id });
  if (!entry) return res.status(503).json({ success: false, message: 'Journal posting failed; please retry' });
  auditPrivilegedSalesAction(req, 'ACCRUED_REVENUE', 'create', so);
  res.json({ success: true, data: { message: `Accrued revenue recorded for ${so.soNumber}`, total: so.total } });
});

// ─── Task 4c: Create Project ──────────────────────────────────────────────────
exports.createProjectFromOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId, docType: 'order' });
  if (!so) return res.status(404).json({ success: false, message: 'Order not found' });
  // Stub: real project creation integration will replace this
  const project = { projectId: so._id, name: so.soNumber, status: 'planned' };
  res.status(201).json({ success: true, data: project });
});

// ─── Task 5a: Activities ─────────────────────────────────────────────────────
exports.getActivities = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const data = await Activity.find({ tenant: tenantId, salesOrder: req.params.id }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data });
});

exports.createActivity = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const activity = await Activity.create({
    tenant: tenantId,
    salesOrder: req.params.id,
    type: req.body.type || 'note',
    subject: req.body.subject,
    description: req.body.description,
    createdBy: req.user?._id,
  });
  res.status(201).json({ success: true, data: activity });
});

// ─── Task 5b: Custom Fields ──────────────────────────────────────────────────
exports.getCustomFields = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const data = await CustomField.find({ tenant: tenantId, model: 'SalesOrder' }).sort({ fieldName: 1 }).lean();
  res.json({ success: true, data });
});

exports.createCustomField = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const field = await CustomField.create({
    tenant: tenantId,
    model: 'SalesOrder',
    fieldName: req.body.fieldName,
    fieldType: req.body.fieldType,
    options: req.body.options || [],
    isRequired: req.body.isRequired || false,
    createdBy: req.user?._id,
  });
  res.status(201).json({ success: true, data: field });
});

// ─── Task 6a: Send Email ─────────────────────────────────────────────────────
exports.sendOrderEmail = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId }).populate('warehouseId', 'name').lean();
  if (!so) return res.status(404).json({ success: false, message: 'Sales order not found' });

  const itemsHtml = (so.items || []).map((it) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${it.name || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:13px;">${it.quantity || 0}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;">₦${(it.unitPrice || 0).toLocaleString()}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;font-weight:600;">₦${(it.lineTotal || 0).toLocaleString()}</td>
    </tr>
  `).join('');

  const html = `
    <h2 style="margin:0 0 16px 0;">Sales Order: ${so.soNumber}</h2>
    <p><strong>Customer:</strong> ${so.customerSnapshot?.name || 'Walk-in'}</p>
    <p><strong>Status:</strong> ${so.docType === 'quotation' ? so.quoteStatus : so.orderStatus}</p>
    <p><strong>Total:</strong> ₦${(so.total || 0).toLocaleString()}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:10px 12px;text-align:left;font-size:12px;border-bottom:2px solid #e5e7eb;">Item</th>
        <th style="padding:10px 12px;text-align:center;font-size:12px;border-bottom:2px solid #e5e7eb;">Qty</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;border-bottom:2px solid #e5e7eb;">Price</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;border-bottom:2px solid #e5e7eb;">Total</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>`;

  try {
    const emailSvc = require('../services/email.service');
    await emailSvc.sendEmail({ to: req.body.to, subject: `Sales Order ${so.soNumber}`, html });
    res.json({ success: true, data: { emailSent: true } });
  } catch (err) {
    console.log('[SEND_ORDER_EMAIL] Email service unavailable:', err.message);
    res.json({ success: true, data: { emailSent: false, note: 'Email service not available — logged to console' } });
  }
});

// ─── Task 6b: Request Signature ──────────────────────────────────────────────
exports.requestSignature = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId });
  if (!so) return res.status(404).json({ success: false, message: 'Sales order not found' });
  const token = crypto.randomBytes(32).toString('hex');
  const signatureUrl = `https://app.drinksharbour.com/sign/${token}`;
  // Stub: store signatureToken on the order (model field optional — not persisted if field missing)
  try { so.signatureToken = token; await so.save(); } catch { /* model may not have field */ }

  try {
    const emailSvc = require('../services/email.service');
    const html = `<p>Please sign the sales order <strong>${so.soNumber}</strong>:</p><p><a href="${signatureUrl}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">Sign Document</a></p>`;
    await emailSvc.sendEmail({ to: req.body.to, subject: `Signature Request: ${so.soNumber}`, html });
  } catch (err) {
    console.log('[REQUEST_SIGNATURE] Email service unavailable:', err.message);
  }

  res.json({ success: true, data: { signatureUrl, token } });
});

// ─── Bulk actions ──────────────────────────────────────────────────────────────

async function processBulk(ids, tenantId, fn) {
  const docs = await SalesOrder.find({ _id: { $in: ids }, tenant: tenantId });
  const foundMap = new Map(docs.map((d) => [String(d._id), d]));
  const results = [];
  for (const id of ids) {
    const doc = foundMap.get(id);
    if (!doc) {
      results.push({ id, ok: false, error: 'Sales order not found' });
      continue;
    }
    try {
      const extra = (await fn(doc)) || {};
      results.push({ id, ok: true, ...extra });
    } catch (err) {
      results.push({ id, ok: false, error: err.message });
    }
  }
  return results;
}

exports.bulkMarkSent = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: 'ids must be a non-empty array' });
  const results = await processBulk(ids, tenantId, (doc) => svc.bulkMarkSent(doc));
  res.json({ success: true, results });
});

exports.bulkDuplicate = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: 'ids must be a non-empty array' });
  const results = await processBulk(ids, tenantId, (doc) => svc.bulkDuplicate(doc));
  res.json({ success: true, results });
});

exports.bulkDelete = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: 'ids must be a non-empty array' });
  const results = await processBulk(ids, tenantId, (doc) => svc.bulkDeleteDoc(doc));
  res.json({ success: true, results });
});

exports.bulkCancel = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: 'ids must be a non-empty array' });
  const results = await processBulk(ids, tenantId, async (doc) => {
    const out = await svc.bulkCancelDoc(doc);
    if (out && doc.docType === 'order') {
      reverseDocumentTax({ sourceType: 'sales_order', doc, userId: req.user?._id });
      reverseDocumentEntry({ sourceType: 'sales_order', doc, userId: req.user?._id });
    }
    return out;
  });
  res.json({ success: true, results });
});

exports.bulkCreateInvoice = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: 'ids must be a non-empty array' });
  const results = await processBulk(ids, tenantId, (doc) => svc.bulkCreateInvoice(doc));
  res.json({ success: true, results });
});

exports.bulkAccruedRevenue = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: 'ids must be a non-empty array' });
  const results = await processBulk(ids, tenantId, (doc) => svc.bulkAccruedRevenue(doc));
  res.json({ success: true, results });
});

exports.bulkFollowers = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { ids, action, userId } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: 'ids must be a non-empty array' });
  if (!['add', 'remove'].includes(action)) return res.status(400).json({ success: false, message: 'action must be "add" or "remove"' });
  if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });
  const results = await processBulk(ids, tenantId, (doc) => svc.bulkFollowers(doc, action, userId));
  res.json({ success: true, results });
});

exports.bulkSendEmail = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { ids, to, subject, body } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: 'ids must be a non-empty array' });
  if (!to) return res.status(400).json({ success: false, message: 'to (email address) is required' });
  const results = await processBulk(ids, tenantId, (doc) => svc.bulkSendEmail(doc, to, subject, body));
  res.json({ success: true, results });
});
