const Order = require("../../models/Order");
const { bad } = require("../accounting.query");
/** Credit planning reads verified net collection; source gross counters stay intact. */
async function effectiveCreditInvoice(tenant, so, session) {
  const returned = await Order.exists({
    tenant,
    source: "pos",
    linkedSalesOrder: { $in: [so._id, so.convertedFrom].filter(Boolean) },
    "refunds.totalRefunded": { $gt: 0 },
    isVoided: { $ne: true },
  }).session(session || null);
  if (!returned) return so;
  const balance = await require("./reconcile").reconcile(
    tenant,
    "sales",
    so,
    so.total,
    session,
  );
  if (balance.issue)
    throw bad(
      `Reconcile refund postings before reviewing credit: ${balance.issue}`,
    );
  return {
    ...(so.toObject ? so.toObject() : so),
    amountPaid: balance.amountPaid,
    creditedAmount: balance.creditedAmount,
  };
}
module.exports = { effectiveCreditInvoice };
