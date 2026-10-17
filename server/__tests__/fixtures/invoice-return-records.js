const mongoose = require("mongoose");
const oid = () => new mongoose.Types.ObjectId();
async function seed(db) {
  const ids = Object.fromEntries(
    [
      "tenant",
      "other",
      "customer",
      "sales",
      "pos",
      "standalone",
      "refund",
      "refund2",
      "sub",
      "product",
      "line",
    ].map((key) => [key, oid()]),
  );
  const item = {
    _id: ids.line,
    subproduct: ids.sub,
    product: ids.product,
    lineType: "product",
    name: "Wine",
    quantity: 10,
    fulfilledQty: 10,
    returnedQty: 0,
    unitPrice: 10,
    lineTotal: 100,
  };
  await db
    .collection("salesorders")
    .insertOne({
      _id: ids.sales,
      tenant: ids.tenant,
      soNumber: "SO-RETURN",
      docType: "order",
      orderStatus: "fulfilled",
      paymentStatus: "paid",
      amountPaid: 100,
      creditedAmount: 0,
      total: 100,
      subtotal: 100,
      currency: "NGN",
      items: [item],
      customer: ids.customer,
      customerSnapshot: { name: "Ada", customerId: ids.customer },
      createdAt: new Date("2026-10-14"),
    });
  await db
    .collection("poscustomers")
    .insertOne({ _id: ids.customer, tenant: ids.tenant, firstName: "Ada" });
  await db.collection("orders").insertMany([
    {
      _id: ids.pos,
      tenant: ids.tenant,
      source: "pos",
      orderNumber: "POS-LINK",
      receiptNumber: "RCP-LINK",
      linkedSalesOrder: ids.sales,
      paymentStatus: "paid",
      accountingStatus: "posted",
      totalAmount: 100,
      subtotal: 100,
      paymentMethod: "cash",
      items: [{ ...item, priceAtPurchase: 10, itemSubtotal: 100 }],
      createdAt: new Date("2026-10-14"),
    },
    {
      _id: ids.standalone,
      tenant: ids.tenant,
      source: "pos",
      orderNumber: "POS-ONLY",
      receiptNumber: "RCP-ONLY",
      paymentStatus: "paid",
      accountingStatus: "posted",
      totalAmount: 100,
      subtotal: 100,
      paymentMethod: "cash",
      items: [{ ...item, priceAtPurchase: 10, itemSubtotal: 100 }],
      createdAt: new Date("2026-10-14"),
    },
  ]);
  const posting = async (
    refDoc,
    refDocType,
    entryType,
    debitAccount,
    creditAccount,
    amount,
    extra = {},
  ) => {
    const _id = oid();
    await db.collection("journalentries").insertOne({
      _id,
      tenant: ids.tenant,
      refDoc,
      refDocType,
      entryType,
      status: "posted",
      lines: [
        { account: debitAccount, debit: amount, credit: 0 },
        { account: creditAccount, debit: 0, credit: amount },
      ],
      ...extra,
    });
    return _id;
  };
  await posting(ids.sales, "SalesOrder", "sales_revenue", "1300", "4000", 100);
  await posting(ids.pos, "Order", "customer_payment", "1000", "1300", 100);
  await posting(ids.standalone, "Order", "sales_revenue", "1000", "4000", 100);
  await require("../../models/CustomerInvoice").createIndexes();
  await require("../../models/InvoiceCounter").createIndexes();
  await require("../../services/chartOfAccounts.service").ensureDefaultCOA(
    ids.tenant,
  );
  const { syncSource } = require("../../services/customerInvoice/sync");
  const salesInvoice = await syncSource({
    tenantId: ids.tenant,
    source: "sales",
    sourceId: ids.sales,
  });
  const posInvoice = await syncSource({
    tenantId: ids.tenant,
    source: "pos",
    sourceId: ids.standalone,
  });
  return { db, ids, item, posting, salesInvoice, posInvoice, syncSource };
}
module.exports = { seed };
