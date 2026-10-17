const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const SalesOrder = require("../models/SalesOrder");
const Order = require("../models/Order");
const arAp = { ...require("../services/arAp.service"), async listInvoices(tenant, options = {}) {
  const page = options.page || 1, limit = options.limit || 25;
  const [result] = await SalesOrder.aggregate(require('../services/invoiceBrowse.query').invoicePipeline(tenant, { ...options, page, limit }, require('../services/posInvoiceBalance.query').posInvoiceBalanceStages(tenant)));
  const total = result?.count?.[0]?.total || 0;
  return { data: result?.data || [], total, page, pages: Math.ceil(total / limit) || 1 };
} };
const Statement = require("../models/CustomerAccountStatement");
const { seedInvoiceRecords } = require('./fixtures/accounting-invoice-records');
const uri = process.env.DRINKSHARBOUR_INVOICES_TEST_MONGO_URI;

test(
  "legacy source projection preserves FIFO and tenant-scoped pagination (saved-document API tested separately)",
  { skip: !uri },
  async (t) => {
    assert.match(
      uri,
      /^mongodb:\/\/127\.0\.0\.1:\d+\/drinks_invoice_test_[\w]+$/,
    );
    await mongoose.connect(uri, { autoIndex: false });
    t.after(async () => {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });
    const tenant = new mongoose.Types.ObjectId(),
      other = new mongoose.Types.ObjectId();
    const linked = new mongoose.Types.ObjectId();
    const date = new Date("2026-10-13T08:00:00Z");
    await seedInvoiceRecords({ tenant, other, linked, date });
    const all = await arAp.listInvoices(tenant, { limit: 100 });
    assert.deepEqual(all.data.map((d) => d.orderNumber).sort(), [
      "POS-PAID",
      "SO-PAID",
      "SO-PARTIAL",
      "SO-UNPAID",
    ]);
    assert.equal(all.total, 4);
    const paid = await arAp.listInvoices(tenant, { status: "paid", limit: 1 });
    assert.equal(paid.total, 2);
    assert.equal(paid.pages, 2);
    assert.equal(paid.data[0].outstanding, 0);
    const unpaid = await arAp.listInvoices(tenant, { status: "unpaid" });
    assert.equal(unpaid.data[0].orderNumber, "SO-UNPAID");
    assert.equal(unpaid.data[0].outstanding, 100);
    const open = await arAp.listOpenDocs(tenant, "ar", { limit: 100 });
    assert.deepEqual(open.data.map((d) => d.orderNumber).sort(), [
      "SO-PARTIAL",
      "SO-UNPAID",
    ]);
    const customer = new mongoose.Types.ObjectId();
    await Order.collection.insertMany([
      {
        tenant,
        source: "pos",
        receiptNumber: "TAB-OLD",
        status: "confirmed",
        paymentStatus: "paid",
        totalAmount: 100,
        paymentDetails: {
          accountCharge: 100,
          customer: { customerId: customer, firstName: "Ada" },
        },
        placedAt: date,
      },
      {
        tenant,
        source: "pos",
        receiptNumber: "TAB-NEW",
        status: "confirmed",
        paymentStatus: "paid",
        totalAmount: 100,
        paymentDetails: {
          accountCharge: 80,
          customer: { customerId: customer, firstName: "Ada" },
        },
        placedAt: date,
      },
    ]);
    await Statement.collection.insertMany([
      {
        tenant,
        customer,
        entryType: "charge",
        receiptNumber: "TAB-OLD",
        amount: 100,
        voided: false,
        occurredAt: new Date("2026-10-10"),
      },
      {
        tenant,
        customer,
        entryType: "charge",
        receiptNumber: "TAB-NEW",
        amount: 80,
        voided: false,
        occurredAt: new Date("2026-10-11"),
      },
      {
        tenant,
        customer,
        entryType: "payment",
        amount: 120,
        voided: false,
        occurredAt: date,
      },
      {
        tenant: other,
        customer,
        entryType: "payment",
        amount: 999,
        voided: false,
        occurredAt: date,
      },
      {
        tenant,
        customer,
        entryType: "payment",
        amount: 999,
        voided: true,
        occurredAt: date,
      },
    ]);
    const tabs = await arAp.listInvoices(tenant, {
      search: "TAB-",
      limit: 100,
    });
    const byNumber = new Map(tabs.data.map((d) => [d.orderNumber, d]));
    assert.equal(byNumber.get("TAB-OLD").paymentStatus, "paid");
    assert.equal(byNumber.get("TAB-OLD").amountPaid, 100);
    assert.equal(byNumber.get("TAB-NEW").paymentStatus, "partial");
    assert.equal(byNumber.get("TAB-NEW").amountPaid, 40);
    assert.equal(byNumber.get("TAB-NEW").outstanding, 60);
    // Restricting the visible range never resets repayment allocation chronology.
    const partial = await arAp.listInvoices(tenant, {
      status: "partial",
      search: "TAB-",
    });
    assert.equal(partial.total, 1);
    const refundCustomer = new mongoose.Types.ObjectId();
    await Order.collection.insertOne({
      tenant,
      source: "pos",
      receiptNumber: "POS-REFUND",
      status: "confirmed",
      paymentStatus: "partially_refunded",
      totalAmount: 100,
      refunds: [{ totalRefunded: 20 }],
      paymentDetails: {
        accountCharge: 80,
        customer: { customerId: refundCustomer },
      },
      placedAt: date,
    });
    await Statement.collection.insertMany([
      {
        tenant,
        customer: refundCustomer,
        entryType: "charge",
        receiptNumber: "POS-REFUND",
        amount: 80,
        voided: false,
        occurredAt: new Date("2026-10-10"),
      },
      {
        tenant,
        customer: refundCustomer,
        entryType: "credit",
        receiptNumber: "POS-REFUND",
        amount: 20,
        voided: false,
        occurredAt: date,
      },
      {
        tenant,
        customer: refundCustomer,
        entryType: "payment",
        amount: 10,
        voided: false,
        occurredAt: date,
      },
    ]);
    const [refunded] = (
      await arAp.listInvoices(tenant, { search: "POS-REFUND" })
    ).data;
    assert.equal(refunded.creditedAmount, 20);
    assert.equal(refunded.amountPaid, 30);
    assert.equal(refunded.outstanding, 50);
    await Order.collection.updateOne({ tenant, receiptNumber: 'TAB-OLD' }, { $set: { placedAt: new Date('2026-10-10') } });
    await Order.collection.updateOne({ tenant, receiptNumber: 'TAB-NEW' }, { $set: { placedAt: new Date('2026-10-11') } });
    const dated = await arAp.listInvoices(tenant, { search: 'TAB-', from: '2026-10-11', to: '2026-10-11' });
    assert.equal(dated.total, 1);
    assert.equal(dated.data[0].outstanding, 60);
    const foreignSource = new mongoose.Types.ObjectId();
    await SalesOrder.collection.insertOne({ _id: foreignSource, tenant: other, soNumber: 'FOREIGN-SOURCE', docType: 'order', orderStatus: 'fulfilled', total: 100, amountPaid: 100 });
    await Order.collection.insertOne({ tenant, source: 'pos', receiptNumber: 'OWN-POS', status: 'confirmed', paymentStatus: 'paid', totalAmount: 25, linkedSalesOrder: foreignSource, placedAt: date });
    assert.equal((await arAp.listInvoices(tenant, { search: 'OWN-POS' })).total, 1);
    await Order.collection.insertOne({ tenant, source: 'pos', receiptNumber: 'DELIVERED-UNPAID', status: 'delivered', paymentStatus: 'pending', totalAmount: 30, placedAt: date });
    const [delivered] = (await arAp.listInvoices(tenant, { search: 'DELIVERED-UNPAID' })).data;
    assert.equal(delivered.paymentStatus, 'unpaid');
    assert.equal(delivered.outstanding, 30);

  },
);
