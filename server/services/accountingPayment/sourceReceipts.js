const Journal = require("../../models/JournalEntry");
const Sales = require("../../models/SalesOrder");
const Order = require("../../models/Order");
const Invoice = require("../../models/CustomerInvoice");
const { sourceRow, sum, tenderAccounts } = require("./sourceRows");
const id = (value) => String(value?._id || value || "");
async function readSourceReceipts(tenant, { session } = {}) {
  const read = (Model, filter, fields) => {
    const query = Model.find(filter).select(fields);
    if (session) query.session(session);
    return query.lean();
  };
  const entries = await read(
    Journal,
    {
      tenant,
      status: "posted",
      $or: [
        { refDocType: "SalesOrder", entryType: "sales_revenue" },
        { refDocType: "Order", entryType: { $in: ["sales_revenue", "customer_payment"] } },
      ],
    },
    "_id refDoc refDocType entryType date lines",
  );
  const salesIds = entries.filter((e) => e.refDocType === "SalesOrder").map((e) => e.refDoc);
  const orderIds = entries.filter((e) => e.refDocType === "Order").map((e) => e.refDoc);
  const sales = await read(
    Sales,
    { tenant, _id: { $in: salesIds } },
    "soNumber total currency paymentMethod customer customerSnapshot createdAt docType convertedTo",
  );
  const invoiceSalesIds = [
    ...salesIds,
    ...sales.filter((s) => s.docType === "quotation" && s.convertedTo).map((s) => s.convertedTo),
  ];
  const proofReads = [
    () =>
      read(
        Order,
        { tenant, source: "pos", tableServiceBooking: null, _id: { $in: orderIds } },
        "orderNumber receiptNumber totalAmount currency paymentMethod paymentDetails.customer customerInfo customerName customerSnapshot deliveryAddress paidAt createdAt linkedSalesOrder refunds refundDetails",
      ),
    () =>
      read(
        Journal,
        { tenant, entryType: "reversal", status: "posted", refDoc: { $in: entries.map((e) => e._id) } },
        "refDoc",
      ),
    () =>
      read(
        Invoice,
        {
          tenant,
          $or: [
            { source: "sales", sourceId: { $in: invoiceSalesIds } },
            { source: "pos", sourceId: { $in: orderIds } },
            { receipts: { $in: orderIds } },
          ],
        },
        "_id number source sourceId receipts",
      ),
  ];
  // MongoDB forbids concurrent operations on a shared transaction session.
  const proof = [];
  if (session) {
    for (const readProof of proofReads) proof.push(await readProof());
  } else proof.push(...(await Promise.all(proofReads.map((readProof) => readProof()))));
  const [orders, reversed, invoices] = proof;
  const sources = new Map([...sales, ...orders].map((s) => [id(s._id), s]));
  const reversals = new Set(reversed.map((e) => id(e.refDoc)));
  const invoiceMap = new Map();
  for (const invoice of invoices) {
    invoiceMap.set(`${invoice.source}:${id(invoice.sourceId)}`, invoice);
    for (const receipt of invoice.receipts || []) invoiceMap.set(`pos:${id(receipt)}`, invoice);
  }
  for (const sale of sales) {
    if (sale.docType !== "quotation" || !sale.convertedTo || invoiceMap.has(`sales:${id(sale._id)}`))
      continue;
    const converted = invoiceMap.get(`sales:${id(sale.convertedTo)}`);
    if (converted) invoiceMap.set(`sales:${id(sale._id)}`, converted);
  }
  const counts = new Map();
  for (const entry of entries) {
    const key = `${entry.refDocType}:${id(entry.refDoc)}:${entry.entryType}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const rows = [];
  for (const entry of entries) {
    if (counts.get(`${entry.refDocType}:${id(entry.refDoc)}:${entry.entryType}`) !== 1) continue;
    const source = sources.get(id(entry.refDoc));
    if (!source) continue;
    const pos = entry.refDocType === "Order";
    const row = sourceRow(entry, source, {
      invoice: invoiceMap.get(`${pos ? "pos" : "sales"}:${id(source._id)}`),
      reversed: reversals.has(id(entry._id)),
    });
    if (!row) continue;
    if (pos && ((source.refunds || []).length || source.refundDetails?.amount)) {
      const evidence = await require("../customerInvoice/refundEvidence").refundEvidence(
        tenant,
        source,
        session,
      );
      const refunds = evidence.journalEntries.length
        ? await read(Journal, { tenant, _id: { $in: evidence.journalEntries } }, "lines")
        : [];
      row.refundsByAccount = Object.fromEntries(
        tenderAccounts.map((account) => [
          account,
          refunds.reduce((n, refund) => n + sum(refund.lines, "credit", [account]), 0),
        ]),
      );
      row.refundedAmount = refunds.reduce((n, refund) => n + sum(refund.lines, "credit", tenderAccounts), 0);
      row.refundIssue =
        evidence.issue ||
        (row.refundedAmount > row.amount + 0.01
          ? "Refund exceeds captured tender; review the source receipt"
          : "");
    }
    rows.push(row);
  }
  return rows;
}
module.exports = { readSourceReceipts };
