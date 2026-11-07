"use strict";
// Synthetic merchant-order fixtures for shipping-refund allocation tests
// (workstream S2). They create exactly the recorded identities the shipping
// refund mechanism must bind: the immutable child shippingMinor derived by
// merchandise-weighted-v1, the single allocated platform payment claim, the
// posted original sales journal, and the carrier dispatch budget. Production
// databases contain none of the recorded policies these tests create.
const mongoose = require("mongoose");
const oid = () => new mongoose.Types.ObjectId();

async function orderFixture({ shippingNaira = 10, merchandiseNaira = 40 } = {}) {
  const orderId = oid(),
    customerId = oid(),
    tenantId = oid();
  const share = Math.round(merchandiseNaira * 0.8),
    commission = merchandiseNaira - share;
  const raw = {
    _id: orderId,
    user: customerId,
    currency: "NGN",
    subtotal: merchandiseNaira,
    totalAmount: merchandiseNaira + shippingNaira,
    shippingFee: shippingNaira,
    taxAmount: 0,
    discountTotal: 0,
    paymentStatus: "paid",
    status: "confirmed",
    paymentMethod: "card",
    merchantFulfillmentVersion: 1,
    source: "web",
    settlementOwner: "platform",
    items: [
      {
        _id: oid(),
        tenant: tenantId,
        warehouse: oid(),
        product: oid(),
        subproduct: oid(),
        size: oid(),
        quantity: 2,
        itemSubtotal: merchandiseNaira,
        discountAmount: 0,
        tenantRevenueShare: share,
        platformCommission: commission,
      },
    ],
  };
  await require("../../models/Order").collection.insertOne(raw);
  const children = require("../../services/merchantFulfillment/allocation").allocate(raw);
  await require("../../models/MerchantOrder").create(children);
  await require("../../models/MerchantOrderSet").create({
    _id: orderId,
    currency: "NGN",
    totalMinor: (merchandiseNaira + shippingNaira) * 100,
    children: children.map((child) => child._id),
    allocationPolicy: "merchandise-weighted-v1",
  });
  const reference = `pi_shipping_${String(orderId).slice(-10)}`;
  await require("../../models/MarketplacePaymentClaim").create({
    _id: `stripe:platform:${reference}`,
    provider: "stripe",
    account: "platform",
    reference,
    user: customerId,
    amount: merchandiseNaira + shippingNaira,
    currency: "NGN",
    state: "allocated",
    order: orderId,
    receipt: {
      method: "stripe",
      reference,
      amount: merchandiseNaira + shippingNaira,
      currency: "NGN",
    },
  });
  await require("../../services/chartOfAccounts.service").ensureDefaultCOA(tenantId);
  await require("../../services/journalEntry.service").postJournalEntry({
    tenantId,
    refDoc: orderId,
    refDocType: "Order",
    entryType: "sales_revenue",
    source: "marketplace",
    lines: [
      { account: "1300", debit: share, credit: 0 },
      { account: "6500", debit: commission, credit: 0 },
      { account: "4000", debit: 0, credit: merchandiseNaira },
    ],
  });
  const child = children[0];
  await require("../../models/MerchantDispatchBudget").collection.insertOne({
    _id: String(child._id),
    order: orderId,
    tenant: tenantId,
    shippingMinor: child.shippingMinor,
    reservedMinor: 0,
    committedMinor: 0,
  });
  return {
    orderId,
    customerId,
    tenantId,
    childId: child._id,
    child,
    claimReference: reference,
    shippingMinor: child.shippingMinor,
    budget: async () =>
      JSON.stringify(
        await require("../../models/MerchantDispatchBudget").findById(child._id).lean(),
      ),
    counts: async () => ({
      allocations: await require("../../models/MerchantShippingRefundAllocation")
        .countDocuments(),
      remainders: await require("../../models/MerchantShippingRefundRemainder")
        .countDocuments(),
      journals: await require("../../models/JournalEntry").countDocuments(),
    }),
  };
}

// Explicitly synthetic recorded policy (production has none). Super-admin actor.
async function recordPolicy(overrides = {}) {
  return require("../../services/merchantFulfillment/shippingRefund/policy").record(
    {
      eligibilityConditions: ["failed_delivery", "carrier_fault"],
      bearerOutcome: "customer_refund_source",
      journalTreatment: "no_shipping_income_journal",
      decisionReference: "SYNTHETIC-S2-SHIPPING",
      ...overrides,
    },
    { _id: oid(), role: "super_admin" },
  );
}

module.exports = { orderFixture, recordPolicy, oid };
