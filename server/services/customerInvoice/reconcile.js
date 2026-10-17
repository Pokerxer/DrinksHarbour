const mongoose = require("mongoose");
const Journal = require("../../models/JournalEntry");
const Payment = require("../../models/CustomerPayment");
const Order = require("../../models/Order");
const { creditEvidence } = require("./creditEvidence");
const { refundEvidence } = require("./refundEvidence");
const { posInvoiceBalanceStages } = require("../posInvoiceBalance.query");
const { round2 } = require("../accounting.helpers");
const sum = (lines, side, accounts) =>
  round2(
    (lines || []).reduce(
      (n, l) =>
        n +
        (!accounts || accounts.includes(l.account) ? Number(l[side]) || 0 : 0),
      0,
    ),
  );
async function posBalance(tenant, doc, session) {
  const query = Order.aggregate([
    {
      $match: {
        _id: doc._id,
        tenant: new mongoose.Types.ObjectId(String(tenant)),
      },
    },
    ...posInvoiceBalanceStages(new mongoose.Types.ObjectId(String(tenant))),
    { $project: { accountOutstanding: 1 } },
  ]);
  if (session) query.session(session);
  const [balance] = await query;
  return balance?.accountOutstanding ?? doc.paymentDetails?.accountCharge ?? 0;
}
async function reconcile(tenant, source, doc, total, session) {
  const revenue = await Journal.findOne({
    tenant,
    refDoc: doc._id,
    entryType: "sales_revenue",
    status: "posted",
  })
    .session(session || null)
    .lean();
  const journalEntries = revenue ? [revenue._id] : [];
  const issues = [];
  if (!revenue) issues.push("Source revenue posting is missing");
  else if (
    Math.abs(sum(revenue.lines, "debit") - sum(revenue.lines, "credit")) >
      0.01 ||
    Math.abs(
      sum(revenue.lines, "credit") -
        sum(revenue.lines, "debit", ["4100"]) -
        total,
    ) > 0.01
  )
    issues.push("Source posting does not match invoice total");
  const reversed =
    revenue &&
    (await Journal.exists({
      tenant,
      refDoc: revenue._id,
      entryType: "reversal",
      status: "posted",
    }).session(session || null));
  let amountPaid = sum(revenue?.lines, "debit", ["1000", "1100", "2200"]);
  let creditedAmount = 0,
    refundedAmount = 0,
    creditNoteAmount = 0;
  const payments = [],
    receipts = [],
    statements = [];
  if (source === "sales") {
    const allocated = await Payment.find({
      tenant,
      status: "active",
      "allocations.salesOrder": doc._id,
    })
      .session(session || null)
      .lean();
    for (const payment of allocated) {
      const allocations = payment.allocations || [];
      if (
        allocations.some(a => !Number.isFinite(Number(a.amount)) || Number(a.amount) < 0) ||
        round2(allocations.reduce((n, a) => n + Number(a.amount), 0)) > round2(payment.amount) + 0.01
      ) {
        issues.push("Payment allocations exceed or invalidate the recorded payment");
        continue;
      }
      const entry = await Journal.findOne({
        tenant,
        refDoc: payment._id,
        entryType: "customer_payment",
        status: "posted",
      })
        .session(session || null)
        .lean();
      if (!entry) {
        issues.push("A payment posting is missing");
        continue;
      }
      if (
        !Number.isFinite(Number(payment.amount)) ||
        payment.amount < 0 ||
        Math.abs(sum(entry.lines, "credit", ["1300"]) - payment.amount) >
          0.01 ||
        Math.abs(sum(entry.lines, "debit") - sum(entry.lines, "credit")) > 0.01
      ) {
        issues.push("A payment posting does not match its amount");
        continue;
      }
      const reversedPayment = await Journal.exists({
        tenant,
        refDoc: entry._id,
        entryType: "reversal",
        status: "posted",
      }).session(session || null);
      if (reversedPayment) {
        issues.push("An active payment has a reversed posting");
        continue;
      }
      amountPaid += payment.allocations
        .filter((a) => String(a.salesOrder) === String(doc._id))
        .reduce((n, a) => n + Number(a.amount), 0);
      payments.push(payment._id);
      journalEntries.push(entry._id);
    }
    const linked = await Order.find({
      tenant,
      source: "pos",
      linkedSalesOrder: { $in: [doc._id, doc.convertedFrom].filter(Boolean) },
      isVoided: { $ne: true },
      paymentStatus: { $in: ["paid", "partially_refunded", "refunded"] },
    })
      .session(session || null)
      .lean();
    for (const receipt of linked) {
      const entry = await Journal.findOne({
        tenant,
        refDoc: receipt._id,
        entryType: "customer_payment",
        status: "posted",
      })
        .session(session || null)
        .lean();
      if (!entry) {
        issues.push("A linked POS payment posting is missing");
        continue;
      }
      if (await Journal.exists({
        tenant, refDoc: entry._id, entryType: "reversal", status: "posted",
      }).session(session || null)) {
        issues.push("A linked POS payment posting is reversed");
        continue;
      }
      if (
        Math.abs(sum(entry.lines, "debit") - sum(entry.lines, "credit")) >
          0.01 ||
        Math.abs(
          sum(entry.lines, "credit", ["1300"]) -
            (receipt.totalAmount -
              (receipt.tipAmount || 0) -
              (receipt.roundingAmount || 0)),
        ) > 0.01
      ) {
        issues.push("A linked POS payment posting does not match its amount");
        continue;
      }
      const evidence = await require("./accountEvidence").accountEvidence(
        tenant,
        receipt,
        session,
      );
      const outstanding =
        evidence.outstanding ?? (await posBalance(tenant, receipt, session));
      if (evidence.issue) issues.push(evidence.issue);
      payments.push(...evidence.payments);
      statements.push(...evidence.statements);
      journalEntries.push(...evidence.journals);
      const refund = await refundEvidence(tenant, receipt, session);
      if (refund.issue) issues.push(refund.issue);
      const refunded = refund.amount;
      refundedAmount += refunded;
      journalEntries.push(...refund.journalEntries);
      if (refunded > sum(entry.lines, "credit", ["1300"]) + 0.01)
        issues.push(
          "Refund exceeds linked invoice settlement; review the return and tender allocation",
        );
      amountPaid += Math.max(
        0,
        sum(entry.lines, "credit", ["1300"]) - outstanding - refunded,
      );
      receipts.push(receipt._id);
      journalEntries.push(entry._id);
    }
    const credit = await creditEvidence(tenant, doc, session);
    creditedAmount = credit.creditedAmount;
    creditNoteAmount = credit.creditNoteAmount;
    journalEntries.push(...credit.journalEntries);
    if (credit.issue) issues.push(credit.issue);
    if (Math.abs(creditedAmount - (doc.creditedAmount || 0)) > 0.01)
      issues.push("Source credit allocations need reconciliation");
    // Linked receipt journals and customer ledgers are authoritative; Sales'
    // gross payment counter is not updated when a POS payout is refunded.
    if (
      !linked.length &&
      Math.abs(round2(amountPaid) - (doc.amountPaid || 0)) > 0.01
    )
      issues.push("Source payment balance does not match recorded payments");
  } else {
    const refund = await refundEvidence(tenant, doc, session);
    creditedAmount = refund.amount;
    refundedAmount = refund.amount;
    journalEntries.push(...refund.journalEntries);
    if (refund.issue) issues.push(refund.issue);
    // Account repayments are allocated across the complete customer ledger FIFO.
    const evidence = await require("./accountEvidence").accountEvidence(
      tenant,
      doc,
      session,
    );
    const outstanding =
      evidence.outstanding ?? (await posBalance(tenant, doc, session));
    if (evidence.issue) issues.push(evidence.issue);
    payments.push(...evidence.payments);
    statements.push(...evidence.statements);
    journalEntries.push(...evidence.journals);
    amountPaid = ["paid", "partially_refunded", "refunded"].includes(
      doc.paymentStatus,
    )
      ? Math.max(0, total - creditedAmount - outstanding)
      : 0;
    if (doc.accountingStatus === "needs_review")
      issues.push(doc.accountingIssue || "POS accounting needs review");
    if (creditedAmount > 0 && doc.accountingStatus !== "posted")
      issues.push("Refund postings need reconciliation");
    receipts.push(doc._id);
  }
  amountPaid = round2(amountPaid);
  if (amountPaid + creditedAmount > total + 0.01)
    issues.push("Payments and credits exceed the invoice total");
  const outstanding = round2(Math.max(0, total - amountPaid - creditedAmount));
  return {
    amountPaid,
    creditedAmount,
    refundedAmount: round2(refundedAmount),
    creditNoteAmount,
    outstanding,
    paymentStatus:
      outstanding <= 0
        ? "paid"
        : amountPaid + creditedAmount > 0
          ? "partial"
          : "unpaid",
    journalEntries,
    payments,
    receipts,
    statements,
    issue: [...new Set(issues)].join("; "),
    cancelled:
      !!reversed ||
      doc.isVoided === true ||
      doc.orderStatus === "cancelled" ||
      doc.status === "cancelled",
  };
}
module.exports = { reconcile };
