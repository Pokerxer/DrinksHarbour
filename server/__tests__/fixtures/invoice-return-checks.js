const assert = require("node:assert/strict");
async function verify({
  db,
  ids,
  posting,
  salesInvoice,
  posInvoice,
  syncSource,
}) {
  const Invoice = require("../../models/CustomerInvoice");
  const browse = require("../../services/customerInvoice/browse");
  const syncSales = () =>
    syncSource({ tenantId: ids.tenant, source: "sales", sourceId: ids.sales });
  const snapshot = [
    salesInvoice.number,
    salesInvoice.total,
    salesInvoice.snapshotHash,
    JSON.stringify(salesInvoice.items),
  ];
  // Fully refunded linked receipt must remain associated with the canonical invoice.
  await db
    .collection("orders")
    .updateOne(
      { _id: ids.pos },
      {
        $set: {
          paymentStatus: "refunded",
          refunds: [
            {
              _id: ids.refund,
              receiptNumber: "RET-LINK",
              totalRefunded: 100,
              refundedAt: new Date(),
              items: [
                { orderItemIndex: 0, quantity: 10, restockedQuantity: 10 },
              ],
            },
          ],
        },
      },
    );
  await posting(ids.refund, "OrderRefund", "refund", "1300", "1000", 100);
  let current = await syncSales();
  assert.equal(current.refundedAmount, 100);
  assert.equal(current.receipts.length, 1);
  assert.equal(current.amountPaid, 0);
  assert.equal(
    current.outstanding,
    100,
    "cash refund does not invent the missing Sales credit",
  );
  assert.equal(current.reconciliationIssue, "");
  const returns = await browse.listInvoices(ids.tenant, {
    returnStatus: "full",
    limit: 1,
  });
  assert.equal(returns.total, 1);
  assert.equal(returns.data[0].returnSummary.returnedUnits, 10);
  assert.equal(returns.data[0].returnSummary.status, "full");
  assert.equal(
    (await browse.listInvoices(ids.other, { returnStatus: "returned" })).total,
    0,
  );
  assert.equal(
    (await browse.getInvoice(ids.tenant, salesInvoice._id)).returnSummary.lines
      .length,
    1,
  );
  const credit =
    await require("../../services/creditNote.service").createCreditNote({
      tenantId: ids.tenant,
      data: { salesOrder: ids.sales, amount: 100, reason: "Returned goods" },
    });
  current = await syncSales();
  assert.equal(
    current.creditedAmount,
    0,
    "draft credit leaves balances unchanged",
  );
  await require("../../services/creditNote.service").postCreditNote({
    tenantId: ids.tenant,
    id: credit._id,
  });
  current = await syncSales();
  assert.equal(current.creditedAmount, 100);
  assert.equal(current.creditNoteAmount, 100);
  assert.equal(current.outstanding, 0);
  assert.deepEqual(
    [
      current.number,
      current.total,
      current.snapshotHash,
      JSON.stringify(current.items),
    ],
    snapshot,
  );
  const count = await db.collection("journalentries").countDocuments();
  await syncSales();
  await browse.getInvoice(ids.tenant, salesInvoice._id);
  assert.equal(await db.collection("journalentries").countDocuments(), count);
  assert.equal(
    await Invoice.countDocuments({ tenant: ids.tenant, sourceId: ids.sales }),
    1,
  );
  // An unposted standalone refund cannot silently clear revenue/payment evidence.
  await db
    .collection("orders")
    .updateOne(
      { _id: ids.standalone },
      {
        $set: {
          paymentStatus: "partially_refunded",
          refunds: [
            {
              _id: ids.refund2,
              receiptNumber: "RET-ONLY",
              totalRefunded: 20,
              refundedAt: new Date(),
              items: [{ orderItemIndex: 0, quantity: 2, restock: false }],
            },
          ],
        },
      },
    );
  current = await syncSource({
    tenantId: ids.tenant,
    source: "pos",
    sourceId: ids.standalone,
  });
  assert.equal(current.refundedAmount, 0);
  assert.match(current.reconciliationIssue, /refund posting/i);
  const refundJournal = await posting(
    ids.refund2,
    "OrderRefund",
    "refund",
    "4000",
    "1000",
    20,
  );
  await require("../../services/customerInvoice/hooks").journalSaved({
    tenant: ids.tenant,
    refDoc: ids.refund2,
    refDocType: "OrderRefund",
    entryType: "refund",
  });
  current = await Invoice.findOne({ _id: posInvoice._id, tenant: ids.tenant });
  assert.equal(current.refundedAmount, 20);
  assert.equal(current.creditedAmount, 20);
  assert.equal(current.amountPaid, 80);
  assert.equal(current.outstanding, 0);
  await posting(refundJournal, "JournalEntry", "reversal", "1000", "4000", 20);
  current = await syncSource({
    tenantId: ids.tenant,
    source: "pos",
    sourceId: ids.standalone,
  });
  assert.equal(current.refundedAmount, 0);
  assert.match(current.reconciliationIssue, /reversed/);
}
module.exports = { verify };
async function verifyStockCredits({ db, ids, item, posting, syncSource }) {
  const mongoose = require("mongoose");
  const source = new mongoose.Types.ObjectId();
  const Invoice = require("../../models/CustomerInvoice");
  await db
    .collection("salesorders")
    .insertOne({
      _id: source,
      tenant: ids.tenant,
      soNumber: "SO-STOCK",
      docType: "order",
      orderStatus: "fulfilled",
      paymentStatus: "paid",
      amountPaid: 100,
      creditedAmount: 0,
      subtotal: 100,
      total: 100,
      currency: "NGN",
      customer: ids.customer,
      customerSnapshot: { name: "Ada", customerId: ids.customer },
      items: [{ ...item, returnedQty: 10 }],
      createdAt: new Date("2026-10-14"),
    });
  await posting(source, "SalesOrder", "sales_revenue", "1000", "4000", 100);
  const first = await syncSource({
    tenantId: ids.tenant,
    source: "sales",
    sourceId: source,
  });
  assert.equal(first.amountPaid, 100);
  assert.equal(first.creditedAmount, 0);
  const svc = require("../../services/creditNote.service");
  const note = await svc.createCreditNote({
    tenantId: ids.tenant,
    data: { salesOrder: source, amount: 100, reason: "Stock return" },
  });
  assert.equal((await Invoice.findOne({ _id: first._id })).creditNoteAmount, 0);
  await svc.postCreditNote({ tenantId: ids.tenant, id: note._id });
  let changed = await Invoice.findOne({ _id: first._id });
  assert.equal(
    changed.creditNoteAmount,
    100,
    "named credit on a paid invoice syncs even without allocations",
  );
  assert.equal(changed.amountPaid, 100);
  assert.equal(changed.creditedAmount, 0);
  assert.equal(changed.total, first.total);
  await svc.cancelCreditNote({ tenantId: ids.tenant, id: note._id });
  changed = await Invoice.findOne({ _id: first._id });
  assert.equal(changed.creditNoteAmount, 0);
  const inventory =
    await require("../../services/customerReturns/browse").listCustomerReturns(
      ids.tenant,
      { invoice: String(first._id) },
    );
  assert.equal(inventory.total, 1);
  assert.equal(inventory.rows[0].sourceNumber, "SO-STOCK");
  await assert.rejects(
    require("../../services/customerReturns/browse").listCustomerReturns(
      ids.other,
      { invoice: String(first._id) },
    ),
    /not found/,
  );
  // Linked Sales/POS legacy overlap is one goods return, not two.
  await db
    .collection("salesorders")
    .updateOne({ _id: ids.sales }, { $set: { "items.0.returnedQty": 3 } });
  await db
    .collection("orders")
    .updateOne(
      { _id: ids.pos },
      { $set: { "refunds.0.items.0.salesReturnedQuantity": 3 } },
    );
  const page =
    await require("../../services/customerInvoice/browse").listInvoices(
      ids.tenant,
      { returnStatus: "full", limit: 1 },
    );
  assert.equal(page.total, 2);
  assert.equal(page.data.length, 1);
  const original = await Invoice.findOne({
    sourceId: ids.sales,
    tenant: ids.tenant,
  });
  const detail =
    await require("../../services/customerInvoice/browse").getInvoice(
      ids.tenant,
      original._id,
    );
  assert.equal(detail.returnSummary.recordedUnits, 10);
  const standalone =
    await require("../../services/customerInvoice/browse").listInvoices(
      ids.tenant,
      { returnStatus: "partial" },
    );
  assert.equal(standalone.total, 1);
  await db
    .collection("orders")
    .updateOne({ _id: ids.pos }, { $set: { "refunds.0.totalRefunded": 110 } });
  await db.collection("journalentries").updateOne(
    { tenant: ids.tenant, refDoc: ids.refund, entryType: "refund" },
    {
      $set: {
        lines: [
          { account: "1300", debit: 110, credit: 0 },
          { account: "1000", debit: 0, credit: 110 },
        ],
      },
    },
  );
  const excess = await syncSource({
    tenantId: ids.tenant,
    source: "sales",
    sourceId: ids.sales,
  });
  assert.match(excess.reconciliationIssue, /refund exceeds/i);
  const review = await svc.createCreditNote({
    tenantId: ids.tenant,
    data: { salesOrder: ids.sales, amount: 10 },
  });
  await assert.rejects(
    svc.postCreditNote({ tenantId: ids.tenant, id: review._id }),
    /Reconcile/,
  );
}
module.exports.verifyStockCredits = verifyStockCredits;
