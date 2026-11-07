"use strict";
const Order = require("../../models/Order"),
  Claim = require("../../models/MarketplacePaymentClaim"),
  Journal = require("../../models/JournalEntry"),
  Account = require("../../models/Account");
const { ConflictError, ForbiddenError } = require("../../utils/errors");
const { id, minor } = require("./allocation");
function platform(actor) {
  if (!["super_admin", "admin"].includes(actor?.role))
    throw new ForbiddenError("Platform admin required for refund execution");
  require("./access").scope(actor, true);
}
async function original(child, session) {
  if (!child)
    throw new ConflictError("Original merchant allocation unavailable");
  const parent = await Order.findOne({
    _id: child.order,
    merchantFulfillmentVersion: child.fulfillmentVersion === 2 ? 2 : 1,
    settlementOwner: "platform",
    paymentStatus: { $in: ["paid", "partially_refunded"] },
  })
    .session(session)
    .lean();
  if (
    !parent ||
    parent.currency !== "NGN" ||
    parent.integrationCheckout ||
    parent.source === "pos" ||
    parent.tableServiceBooking ||
    parent.venueIdentityVersion === 1
  )
    throw new ConflictError(
      "Supported original marketplace payment authority required",
    );
  const receipts = await Claim.find({
    order: parent._id,
    state: "allocated",
  })
    .session(session)
    .lean();
  const receipt = receipts.length === 1 ? receipts[0] : null;
  if (
    !receipt ||
    !["stripe", "paystack"].includes(receipt.provider) ||
    receipt.account !== "platform" ||
    receipt._id !== `${receipt.provider}:platform:${receipt.reference}` ||
    receipt.receipt?.currency !== parent.currency ||
    id(receipt.user) !== id(parent.user) ||
    minor(receipt.amount) !== minor(parent.totalAmount) ||
    receipt.currency !== parent.currency ||
    receipt.receipt?.method !== receipt.provider ||
    receipt.receipt?.reference !== receipt.reference ||
    minor(receipt.receipt?.amount) !== minor(parent.totalAmount)
  )
    throw new ConflictError(
      "Exact allocated original supported receipt required for merchant refund",
    );
  if (
    receipt.provider === "paystack" &&
    (!["string", "number"].includes(typeof receipt.receipt?.transactionId) ||
      !require("./refundProviders").validRefundId(
        "paystack",
        String(receipt.receipt.transactionId),
      ))
  )
    throw new ConflictError(
      "Original verified Paystack transaction identity requires review",
    );
  if (parent.channelSnapshot || receipt.channelSnapshot)
    require("../marketCommitment").assertBinding(
      parent.channelSnapshot,
      receipt.channelSnapshot,
    );
  const posted = await Journal.findOne({
    tenant: child.tenant,
    refDoc: parent._id,
    entryType: "sales_revenue",
    source: "marketplace",
    status: "posted",
  })
    .session(session)
    .lean();
  const children = await require("../../models/MerchantOrder")
    .find({ order: parent._id, tenant: child.tenant })
    .session(session)
    .lean();
  const parentLines = parent.items.filter(
    (line) => id(line.tenant) === id(child.tenant),
  );
  const expected = {
    merchandiseMinor: parentLines.reduce(
      (n, line) =>
        n + minor(line.itemSubtotal) - minor(line.discountAmount || 0),
      0,
    ),
    tenantShareMinor: parentLines.reduce(
      (n, line) => n + minor(line.tenantRevenueShare),
      0,
    ),
    commissionMinor: parentLines.reduce(
      (n, line) => n + minor(line.platformCommission),
      0,
    ),
  };
  if (
    expected.tenantShareMinor + expected.commissionMinor !==
      expected.merchandiseMinor ||
    Object.keys(expected).some(
      (key) => children.reduce((n, row) => n + row[key], 0) !== expected[key],
    )
  )
    throw new ConflictError(
      "Original merchant settlement shares do not reconcile",
    );
  const signed = (code) =>
    posted?.lines
      .filter((line) => line.account === code)
      .reduce(
        (n, line) =>
          n +
          minor(code === "4000" ? line.credit : line.debit) -
          minor(code === "4000" ? line.debit : line.credit),
        0,
      );
  if (
    !posted ||
    signed("4000") !== expected.merchandiseMinor ||
    signed("1300") !== expected.tenantShareMinor ||
    signed("6500") !== expected.commissionMinor ||
    posted.lines.some(
      (line) =>
        !["4000", "1300", "6500"].includes(line.account) &&
        (minor(line.debit) > 0 || minor(line.credit) > 0),
    )
  )
    throw new ConflictError(
      "Original posted journal settlement shares require reconciliation before refund",
    );
  if (
    await Journal.exists({
      tenant: child.tenant,
      refDoc: posted._id,
      entryType: "reversal",
    }).session(session)
  )
    throw new ConflictError(
      "Original settlement journal was reversed; refund requires reconciliation",
    );
  const accounts = await Account.find({
    tenant: child.tenant,
    code: { $in: ["1300", "6500", "4000"] },
    isActive: true,
  })
    .session(session)
    .lean();
  if (new Set(accounts.map((row) => row.code)).size !== 3)
    throw new ConflictError("Original refund journal accounts require review");
  return { parent, receipt, child };
}
function reserved(row, { parent, receipt, child }) {
  if (
    row.receipt !== receipt._id ||
    row.providerReference !== receipt.reference ||
    row.provider !== receipt.provider ||
    row.account !== receipt.account ||
    id(row.customer) !== id(parent.user) ||
    row.currency !== parent.currency ||
    (row.provider === "paystack" &&
      row.providerTransactionId !== String(receipt.receipt.transactionId))
  )
    throw new ConflictError(
      "Original reserved refund receipt or owner changed",
    );
  if (
    (row.fulfillmentVersion === 2 ? 2 : 1) !== parent.merchantFulfillmentVersion
  )
    throw new ConflictError("Original refund fulfillment version changed");
  if (row.fulfillmentVersion === 2)
    require("./quantity/refunds").assertReserved(row, child);
}
function evidence(row, result) {
  if (row.provider === "paystack")
    return require("./refundProviders").paystackEvidence(row, result);
  if (
    !result ||
    result.metadata?.merchant_refund_allocation !== String(row._id) ||
    result.metadata?.merchant_order !== row.merchantOrder ||
    result.metadata?.parent_order !== String(row.order) ||
    typeof result.id !== "string" ||
    !/^re_[A-Za-z0-9_]{1,150}$/.test(result.id) ||
    result.amount !== row.amountMinor ||
    String(result.currency).toUpperCase() !== row.currency ||
    String(result.payment_intent) !== row.providerReference ||
    (row.providerRefundId && result.id !== row.providerRefundId)
  )
    throw new ConflictError(
      "Provider refund evidence does not match saved allocation",
    );
}
module.exports = { platform, original, evidence, reserved };
