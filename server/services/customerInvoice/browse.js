const mongoose = require("mongoose");
const Invoice = require("../../models/CustomerInvoice");
const { invoiceReturnMap, noReturns, returnFilter } = require("./returns");
const { bad, dateRange, escapeSearch } = require("../accounting.query");
function view(doc, returns = new Map()) {
  return {
    ...doc,
    returnSummary: returns.get(String(doc._id)) || noReturns,
    persisted: true,
    orderNumber: doc.number,
    // UI uses a customer object; the captured name remains authoritative.
    customer: doc.customer ? { _id: doc.customer } : null,
  };
}
async function listInvoices(
  tenantId,
  { status, scope, from, to, search, returnStatus, customer, page = 1, limit = 25 } = {},
) {
  if (
    returnStatus &&
    !["none", "partial", "full", "returned", "review"].includes(returnStatus)
  )
    throw bad("Invalid invoice return status");
  if (
    status &&
    !["paid", "unpaid", "partial", "open", "draft", "cancelled"].includes(
      status,
    )
  )
    throw bad("Invalid invoice status");
  page = Math.max(1, Number(page) || 1);
  limit = Math.min(100, Math.max(1, Number(limit) || 25));
  const filter = { tenant: tenantId };
  if (customer) {
    if (!mongoose.isValidObjectId(customer)) throw bad("Invalid customer");
    filter.customer = customer;
  }
  if (scope === "credit")
    Object.assign(filter, {
      state: "posted", source: "sales", reconciliationIssue: "",
      currency: { $in: ["NGN", null] },
    });
  else
  if (scope === "open")
    Object.assign(filter, {
      state: "posted",
      source: "sales",
      outstanding: { $gt: 0 },
      reconciliationIssue: "",
    });
  else if (status === "open")
    Object.assign(filter, { state: "posted", outstanding: { $gt: 0 } });
  else if (["draft", "cancelled"].includes(status)) filter.state = status;
  else if (status)
    Object.assign(filter, { state: "posted", paymentStatus: status });
  const range = dateRange({ from, to });
  if (range) filter.date = range;
  if (search) {
    const rx = new RegExp(escapeSearch(search), "i");
    filter.$or = [
      { number: rx },
      { sourceNumber: rx },
      { "customerSnapshot.name": rx },
    ];
  }
  const returns = await invoiceReturnMap(tenantId);
  Object.assign(filter, returnFilter(returns, returnStatus));
  const [docs, total] = await Promise.all([
    Invoice.find(filter)
      .select("-items -invoiceAddress -notes -terms -snapshotHash")
      .sort({ date: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Invoice.countDocuments(filter),
  ]);
  return {
    data: docs.map((doc) => view(doc, returns)),
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
  };
}
async function getInvoice(tenantId, id) {
  const doc =
    mongoose.isValidObjectId(id) &&
    (await Invoice.findOne({ _id: id, tenant: tenantId }).lean());
  if (!doc) throw bad("Invoice not found");
  const source =
    doc.source === "sales" &&
    doc.state === "draft" &&
    (await require("../../models/SalesOrder")
      .findOne({
        _id: doc.sourceId,
        tenant: tenantId,
        invoiceDraft: true,
        invoiceIssuedAt: null,
      })
      .select("docType quoteStatus orderStatus")
      .lean());
  const editableDraft =
    !!source &&
    ((source.docType === "quotation" &&
      ["draft", "sent", "accepted"].includes(source.quoteStatus)) ||
      (source.docType === "order" && source.orderStatus === "draft"));
  const returns = await invoiceReturnMap(tenantId, [doc._id]);
  return {
    ...view(doc, returns),
    editableDraft,
    detailContext: await require("./detail").detailContext(tenantId, doc),
  };
}
// Existing payment/credit ledgers deliberately continue referencing SalesOrder.
async function salesSourceId(tenantId, id, { allowDraft = false } = {}) {
  if (!mongoose.isValidObjectId(id)) throw bad("Invalid invoice");
  const doc = await Invoice.findOne({ _id: id, tenant: tenantId }).lean();
  if (!doc) return id; // Legacy callers; their source query is also tenant-scoped.
  if (
    doc.source !== "sales" ||
    doc.state === "cancelled" ||
    (!allowDraft && (doc.state !== "posted" || doc.reconciliationIssue))
  )
    throw bad("Reconcile this invoice before allocating a payment or credit");
  return doc.sourceId;
}
module.exports = { listInvoices, getInvoice, salesSourceId };
