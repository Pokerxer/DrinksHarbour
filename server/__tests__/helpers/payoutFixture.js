"use strict";
// Workstream-P payout fixture helper. Builds REAL platform-marketplace
// children (MerchantOrder/MerchantOrderSet + posted sales journals) exactly
// like the settlement-statement fixture, so the payout statement-link
// mechanism is exercised against the real projection, not a stub.
const mongoose = require("mongoose");
const oid = () => new mongoose.Types.ObjectId();
module.exports.oid = oid;

async function twoChildren() {
  const tenantA = oid(),
    tenantB = oid(),
    rootId = oid();
  const root = { _id: rootId, role: "super_admin" };
  const merchantA = { _id: oid(), role: "tenant_owner", tenant: tenantA };
  const merchantB = { _id: oid(), role: "tenant_owner", tenant: tenantB };
  const build = async (tenant, buyer) => {
    const orderId = oid();
    const items = [
      {
        _id: oid(),
        tenant,
        warehouse: oid(),
        product: oid(),
        subproduct: oid(),
        size: oid(),
        quantity: 2,
        itemSubtotal: 20,
        discountAmount: 0,
        tenantRevenueShare: 16,
        platformCommission: 4,
      },
    ];
    const orderDoc = {
      _id: orderId,
      user: buyer,
      currency: "NGN",
      subtotal: 20,
      totalAmount: 20,
      shippingFee: 0,
      taxAmount: 0,
      discountTotal: 0,
      paymentStatus: "paid",
      status: "confirmed",
      paymentMethod: "card",
      merchantFulfillmentVersion: 1,
      source: "web",
      settlementOwner: "platform",
      items,
    };
    await require("../../models/Order").collection.insertOne(orderDoc);
    const groups =
      require("../../services/merchantFulfillment/allocation").allocate(orderDoc);
    const Child = require("../../models/MerchantOrder");
    await Child.create(groups);
    await require("../../models/MerchantOrderSet").create({
      _id: orderId,
      currency: "NGN",
      totalMinor: 2000,
      children: groups.map((g) => g._id),
      allocationPolicy: "merchandise-weighted-v1",
    });
    await require("../../models/MarketplacePaymentClaim").create({
      _id: `stripe:platform:pi_synthetic_${orderId}`,
      provider: "stripe",
      account: "platform",
      reference: `pi_synthetic_${orderId}`,
      user: buyer,
      amount: 20,
      currency: "NGN",
      state: "allocated",
      order: orderId,
      receipt: {
        method: "stripe",
        reference: `pi_synthetic_${orderId}`,
        amount: 20,
        currency: "NGN",
      },
    });
    await require("../../services/chartOfAccounts.service").ensureDefaultCOA(tenant);
    await require("../../services/journalEntry.service").postJournalEntry({
      tenantId: tenant,
      refDoc: orderId,
      refDocType: "Order",
      entryType: "sales_revenue",
      source: "marketplace",
      lines: [
        { account: "1300", debit: 16, credit: 0 },
        { account: "6500", debit: 4, credit: 0 },
        { account: "4000", debit: 0, credit: 20 },
      ],
    });
    return { orderId, child: groups[0] };
  };
  const a = await build(tenantA, oid());
  const b = await build(tenantB, oid());
  return {
    root,
    tenantA,
    tenantB,
    merchantA,
    merchantB,
    orderA: a.orderId,
    orderB: b.orderId,
    childA: a.child,
    childB: b.child,
  };
}
module.exports.twoChildren = twoChildren;
