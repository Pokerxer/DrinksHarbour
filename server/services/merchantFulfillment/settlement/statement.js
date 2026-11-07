"use strict";
// Versioned, READ-ONLY settlement statement projection per merchant child and
// per tenant-scoped order set. Built only from existing immutable records:
// MerchantOrder components + refund counters, MerchantOrderSet,
// MerchantRefundAllocation, JournalEntry (sales_revenue / refund /
// inventory_adjust), MerchantGoodsCancellation (frozen costMinor) and
// MerchantDispatchBudget.committedMinor (recorded carrier cost with no
// journal — shown as journal-exempt). No payout execution, transfers, holds
// release, writes or new models. Reuses the reconciliation identities already
// enforced in refundAuthority.js rather than re-deriving them.
const Child = require("../../../models/MerchantOrder"),
  Group = require("../../../models/MerchantOrderSet"),
  Refund = require("../../../models/MerchantRefundAllocation"),
  Budget = require("../../../models/MerchantDispatchBudget"),
  Basis = require("../../../models/MerchantGoodsCancellation");
const access = require("../access");
const journals = require("./journals");
const agreement = require("../../../utils/revenueAgreement");
const { NotFoundError } = require("../../../utils/errors");
const VERSION = 1;
const PAYOUT_REASON =
  "No payout execution exists; payout policy requires review.";
const safe = (n) => Number.isSafeInteger(n) && n >= 0;
const sum = (rows, key) => rows.reduce((n, row) => n + (row[key] || 0), 0);
function allocationView(row) {
  return {
    id: String(row._id),
    amountMinor: row.amountMinor,
    commissionMinor: row.commissionMinor,
    tenantShareMinor: row.tenantShareMinor,
    state: row.state,
    source: `MerchantRefundAllocation:${row._id}`,
  };
}
// revenueAgreement.refundSettlement is the recorded authority: a partial
// refund settlement is needs_review unless the full order amount is settled.
function settlementReview(settledMinor, merchandiseMinor) {
  if (!settledMinor) return null;
  try {
    const status = agreement.refundSettlement(
      [],
      settledMinor / 100,
      merchandiseMinor / 100,
    ).status;
    return status === "needs_review"
      ? {
          scope: "refundSettlement",
          state: "needs_review",
          reason:
            "Partial refund settlement reverses the original journal without a full-order allocation; revenueAgreement.refundSettlement requires review.",
        }
      : null;
  } catch (error) {
    return {
      scope: "refundSettlement",
      state: "needs_review",
      reason:
        "Recorded refund and merchandise amounts require reconciliation before a settlement status can be derived.",
    };
  }
}
async function project(child) {
  const orderId = child.order,
    tenantId = child.tenant,
    childId = child._id;
  const [group, rows, budget, basis, tenantChildren] = await Promise.all([
    Group.findById(orderId).lean(),
    Refund.find({ merchantOrder: childId, tenant: tenantId })
      .sort({ createdAt: 1, _id: 1 })
      .limit(200)
      .lean(),
    Budget.findOne({ _id: childId, tenant: tenantId }).lean(),
    Basis.findOne({ order: orderId, tenant: tenantId }).lean(),
    Child.find({ order: orderId, tenant: tenantId }).lean(),
  ]);
  const settledRows = rows.filter((row) => row.state === "succeeded");
  const settledMinor = sum(settledRows, "amountMinor");
  const settledCommissionMinor = sum(settledRows, "commissionMinor");
  const settledTenantShareMinor = sum(settledRows, "tenantShareMinor");
  const childComponents = {
    grossMinor: child.grossMinor,
    discountMinor: child.discountMinor,
    merchandiseMinor: child.merchandiseMinor,
    tenantShareMinor: child.tenantShareMinor,
    commissionMinor: child.commissionMinor,
    shippingMinor: child.shippingMinor,
    taxMinor: child.taxMinor,
    totalMinor: child.totalMinor,
  };
  const sales = await journals.originalSales(tenantId, orderId);
  const refundJournalRows = await journals.merchantRefunds(
    tenantId,
    rows.map((row) => row._id),
  );
  const goodsRefs = (basis?.cancellations || [])
    .filter((row) => row.merchantOrder === childId && row.journalRef)
    .map((row) => row.journalRef);
  const goodsJournalRows = await journals.goodsCancellations(tenantId, goodsRefs);
  const cancelledCostMinor = sum(
    (basis?.cancellations || []).filter((row) => row.merchantOrder === childId),
    "costMinor",
  );
  const items = [];
  const identities = [];
  const identity = (name, holds) => {
    identities.push({ name, holds });
    if (!holds)
      items.push({
        scope: "component",
        state: "needs_review",
        reason: `Recorded settlement identity "${name}" does not hold; figures require reconciliation.`,
      });
  };
  const validComponents = Object.values(childComponents).every(safe);
  identity(
    "gross-discount-merchandise",
    validComponents &&
      childComponents.grossMinor - childComponents.discountMinor ===
        childComponents.merchandiseMinor,
  );
  identity(
    "tenant-share-plus-commission",
    validComponents &&
      childComponents.tenantShareMinor + childComponents.commissionMinor ===
        childComponents.merchandiseMinor,
  );
  identity(
    "merchandise-shipping-tax-total",
    validComponents &&
      childComponents.merchandiseMinor +
        childComponents.shippingMinor +
        childComponents.taxMinor ===
        childComponents.totalMinor,
  );
  identity(
    "refund-budget-conservation",
    validComponents &&
      safe(child.refundReservedMinor) &&
      safe(child.refundedMinor) &&
      safe(child.refundedCommissionMinor) &&
      child.refundReservedMinor + child.refundedMinor <=
        childComponents.merchandiseMinor &&
      child.refundedMinor >= child.refundedCommissionMinor,
  );
  identity(
    "settled-allocations-match-counters",
    settledMinor === child.refundedMinor &&
      settledCommissionMinor === child.refundedCommissionMinor &&
      settledTenantShareMinor ===
        child.refundedMinor - child.refundedCommissionMinor,
  );
  if (
    !group ||
    !group.children.includes(childId) ||
    group.refundReservedMinor + group.refundedMinor > group.totalMinor
  )
    items.push({
      scope: "orderSet",
      state: "needs_review",
      reason:
        "Original order-set membership or budgets require reconciliation.",
    });
  const tenantSums = tenantChildren.reduce(
    (acc, row) => ({
      merchandiseMinor: acc.merchandiseMinor + row.merchandiseMinor,
      tenantShareMinor: acc.tenantShareMinor + row.tenantShareMinor,
      commissionMinor: acc.commissionMinor + row.commissionMinor,
    }),
    { merchandiseMinor: 0, tenantShareMinor: 0, commissionMinor: 0 },
  );
  const salesView = journals.salesView(sales);
  if (
    !salesView ||
    salesView.merchandiseMinor !== tenantSums.merchandiseMinor ||
    salesView.tenantShareMinor !== tenantSums.tenantShareMinor ||
    salesView.commissionMinor !== tenantSums.commissionMinor
  )
    items.push({
      scope: "JournalEntry",
      state: "needs_review",
      reason:
        "Original posted marketplace sales journal does not reconcile with the recorded tenant settlement shares.",
    });
  const review = settlementReview(
    settledMinor,
    childComponents.merchandiseMinor,
  );
  if (review) items.push(review);
  const uncertain = rows
    .filter((row) => ["submitting", "uncertain"].includes(row.state))
    .map((row) => ({
      scope: "MerchantRefundAllocation",
      id: String(row._id),
      state: row.state,
      reason:
        "Refund outcome requires reconciliation; do not resubmit. Reserved budget stays held.",
    }));
  const netSettledMinor = validComponents
    ? childComponents.tenantShareMinor - settledTenantShareMinor
    : 0;
  return {
    statementVersion: VERSION,
    readOnly: true,
    currency: child.currency,
    scope: {
      childId: String(childId),
      orderId: String(orderId),
      tenantId: String(tenantId),
      fulfillmentVersion: child.fulfillmentVersion || 1,
    },
    totals: childComponents,
    sources: { totals: `MerchantOrder:${childId}` },
    refunds: {
      reservedMinor: child.refundReservedMinor,
      settledMinor: child.refundedMinor,
      settledCommissionMinor: child.refundedCommissionMinor,
      settledTenantShareMinor,
      allocations: rows.map(allocationView),
    },
    commissionReversal: {
      settledMinor: child.refundedCommissionMinor,
      sourceIds: refundJournalRows.map((row) => `JournalEntry:${row._id}`),
    },
    goodsCost: {
      sourceId: basis ? String(basis._id) : null,
      originalCostMinor: basis ? basis.originalCostMinor : 0,
      cancelledCostMinor,
      netCostMinor: basis ? basis.originalCostMinor - cancelledCostMinor : 0,
      sourceNote:
        "Frozen MerchantGoodsCancellation cost basis; goods cancellation never confirms a refund.",
    },
    carrierCost: {
      sourceId: budget ? String(budget._id) : null,
      committedMinor: budget ? budget.committedMinor : 0,
      reservedMinor: budget ? budget.reservedMinor : 0,
      journalExempt: true,
      sourceNote:
        "Committed carrier spend from MerchantDispatchBudget; no journal exists for this cost and its bearer is an open policy decision.",
    },
    netReceivable: {
      settledMinor: netSettledMinor,
      reservedMinor: child.refundReservedMinor,
      projectedMinor: netSettledMinor - child.refundReservedMinor,
    },
    journals: {
      sales: salesView,
      refunds: refundJournalRows.map(journals.refundView),
      goodsCancellations: goodsJournalRows.map(journals.goodsView),
    },
    reconciliation: {
      state: items.length || uncertain.length ? "needs_review" : "reconciled",
      identities,
      items,
      uncertain,
    },
    payout: { state: "review_required", reason: PAYOUT_REASON },
    set: {
      orderId: String(orderId),
      childIds: tenantChildren.map((row) => String(row._id)),
      totals: {
        merchandiseMinor: tenantSums.merchandiseMinor,
        tenantShareMinor: tenantSums.tenantShareMinor,
        commissionMinor: tenantSums.commissionMinor,
        settledMinor: tenantChildren.reduce(
          (n, row) => n + row.refundedMinor,
          0,
        ),
        reservedMinor: tenantChildren.reduce(
          (n, row) => n + row.refundReservedMinor,
          0,
        ),
        netReceivableMinor: tenantSums.tenantShareMinor -
          tenantChildren.reduce(
            (n, row) => n + row.refundedMinor - row.refundedCommissionMinor,
            0,
          ),
      },
    },
  };
}
async function child(childId, actor) {
  access.scope(actor);
  const key = String(childId || "");
  if (!key) throw new NotFoundError("Merchant order not found");
  const row = await Child.findOne({
    _id: key,
    ...access.scope(actor),
  }).lean();
  if (!row) throw new NotFoundError("Merchant order not found");
  return project(row);
}
module.exports = { child, project, VERSION };
