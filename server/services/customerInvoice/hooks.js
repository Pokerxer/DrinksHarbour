const mongoose = require("mongoose");
const { safelySync } = require("./sync");
async function sourceSaved(doc, source) {
  if (mongoose.connection.readyState !== 1 || !doc.tenant) return;
  return safelySync({
    tenantId: doc.tenant,
    source,
    sourceId: doc._id,
    session: doc.$session?.(),
  });
}
async function journalSaved(entry, session) {
  if (mongoose.connection.readyState !== 1 || !entry?.refDoc) return;
  if (
    !["sales_revenue", "customer_payment", "refund"].includes(entry.entryType)
  )
    return;
  if (entry.refDocType === "SalesOrder")
    return safelySync({
      tenantId: entry.tenant,
      source: "sales",
      sourceId: entry.refDoc,
      session,
    });
  if (entry.refDocType === "OrderRefund") {
    const receipt = await require("../../models/Order")
      .findOne({
        tenant: entry.tenant,
        source: "pos",
        "refunds._id": entry.refDoc,
      })
      .session(session || null)
      .lean();
    if (receipt)
      return safelySync({
        tenantId: entry.tenant,
        source: "pos",
        sourceId: receipt._id,
        session,
      });
  }
  if (entry.refDocType === "Order")
    return safelySync({
      tenantId: entry.tenant,
      source: "pos",
      sourceId: entry.refDoc,
      session,
    });
  if (entry.refDocType === "CustomerPayment") {
    const payment = await require("../../models/CustomerPayment")
      .findOne({ tenant: entry.tenant, _id: entry.refDoc })
      .session(session || null)
      .lean();
    for (const allocation of payment?.allocations || [])
      await safelySync({
        tenantId: entry.tenant,
        source: "sales",
        sourceId: allocation.salesOrder,
        session,
      });
    if (payment?.customer)
      await customerLedgerSaved({
        tenant: entry.tenant,
        customer: payment.customer,
        $session: () => session,
      });
  }
  if (entry.refDocType === "CreditNote") {
    const note = await require("../../models/CreditNote")
      .findOne({ tenant: entry.tenant, _id: entry.refDoc })
      .session(session || null)
      .lean();
    await allocationsSaved(note, session);
  }
}
async function allocationsSaved(doc, session = doc?.$session?.()) {
  if (mongoose.connection.readyState !== 1 || !doc) return;
  try {
    const targets = new Set(
      [doc.salesOrder, ...(doc.allocations || []).map((a) => a.salesOrder)]
        .filter(Boolean)
        .map(String),
    );
    for (const sourceId of targets)
      await safelySync({
        tenantId: doc.tenant,
        source: "sales",
        sourceId,
        session,
      });
  } catch (err) {
    console.error("invoiceAllocationSyncFailed", { message: err.message });
  }
}
async function customerLedgerSaved(doc) {
  if (mongoose.connection.readyState !== 1) return;
  const receipts = await require("../../models/Order")
    .find({
      tenant: doc.tenant,
      source: "pos",
      "paymentDetails.customer.customerId": doc.customer,
      "paymentDetails.accountCharge": { $gt: 0 },
    })
    .select("_id")
    .session(doc.$session?.() || null)
    .lean();
  for (const receipt of receipts)
    await safelySync({
      tenantId: doc.tenant,
      source: "pos",
      sourceId: receipt._id,
      session: doc.$session?.(),
    });
}
module.exports = {
  sourceSaved,
  journalSaved,
  customerLedgerSaved,
  allocationsSaved,
};
