"use strict";
// Read-only journal projection for settlement statements.
// Reuses the exact signed account convention enforced by refundAuthority.js:
// 4000 (revenue) is credit-debit; 1300/6500 (tenant share/commission) and
// 1200 (inventory) are debit-credit; 5000 (COGS) is credit-debit.
const Journal = require("../../../models/JournalEntry");
const minor = (value) => Math.round(Number(value || 0) * 100);
function signed(lines, code) {
  return (lines || [])
    .filter((line) => line.account === code)
    .reduce(
      (n, line) =>
        n +
        (code === "4000" || code === "5000"
          ? minor(line.credit) - minor(line.debit)
          : minor(line.debit) - minor(line.credit)),
      0,
    );
}
async function originalSales(tenantId, orderId) {
  return Journal.findOne({
    tenant: tenantId,
    refDoc: orderId,
    entryType: "sales_revenue",
    source: "marketplace",
    status: "posted",
  })
    .lean();
}
async function merchantRefunds(tenantId, allocationIds) {
  if (!allocationIds.length) return [];
  return Journal.find({
    tenant: tenantId,
    refDoc: { $in: allocationIds },
    entryType: "refund",
    source: "merchant_refund",
    status: "posted",
  })
    .lean();
}
async function goodsCancellations(tenantId, journalRefs) {
  if (!journalRefs.length) return [];
  return Journal.find({
    tenant: tenantId,
    refDoc: { $in: journalRefs },
    entryType: "inventory_adjust",
    source: "merchant_goods_cancel",
    status: "posted",
  })
    .lean();
}
function salesView(row) {
  return row
    ? {
        sourceId: `JournalEntry:${row._id}`,
        merchandiseMinor: signed(row.lines, "4000"),
        tenantShareMinor: signed(row.lines, "1300"),
        commissionMinor: signed(row.lines, "6500"),
      }
    : null;
}
function refundView(row) {
  // Refund journals reverse the original sale: 4000 is debited while
  // 1300/6500 are credited, so the signed convention is mirrored.
  const mirrored = (code) =>
    (row.lines || [])
      .filter((line) => line.account === code)
      .reduce(
        (n, line) =>
          n +
          (code === "4000"
            ? minor(line.debit) - minor(line.credit)
            : minor(line.credit) - minor(line.debit)),
        0,
      );
  return {
    sourceId: `JournalEntry:${row._id}`,
    refDoc: String(row.refDoc),
    amountMinor: mirrored("4000"),
    tenantShareMinor: mirrored("1300"),
    commissionMinor: mirrored("6500"),
  };
}
function goodsView(row) {
  return {
    sourceId: `JournalEntry:${row._id}`,
    refDoc: String(row.refDoc),
    costMinor: signed(row.lines, "1200"),
  };
}
module.exports = {
  signed,
  originalSales,
  merchantRefunds,
  goodsCancellations,
  salesView,
  refundView,
  goodsView,
};
