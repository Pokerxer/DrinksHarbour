// Read-only comparison. Prints aggregate financial totals and issue counts only.
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
mongoose.set("autoIndex", false);
async function main() {
  await require("../config/db").connectDB();
  const db = mongoose.connection.db;
  const tenants = await db
    .collection("tenants")
    .find({ name: { $in: ["Wyn City", "CKK Giftery"] } }, { projection: { name: 1 } })
    .toArray();
  for (const tenant of tenants) {
    const saved = await db
      .collection("customerinvoices")
      .aggregate([
        { $match: { tenant: tenant._id } },
        {
          $group: {
            _id: { state: "$state", paymentStatus: "$paymentStatus", issue: "$reconciliationIssue" },
            count: { $sum: 1 },
            total: { $sum: "$total" },
            paid: { $sum: "$amountPaid" },
            credited: { $sum: "$creditedAmount" },
            outstanding: { $sum: "$outstanding" },
          },
        },
      ])
      .toArray();
    const drafts = await db
      .collection("customerinvoices")
      .find(
        { tenant: tenant._id, state: "draft", outstanding: { $gt: 0 } },
        { projection: { number: 1, source: 1, sourceId: 1, total: 1, amountPaid: 1, outstanding: 1 } },
      )
      .toArray();
    const sourceChecks = [];
    for (const draft of drafts) {
      const source = await db
        .collection(draft.source === "sales" ? "salesorders" : "orders")
        .findOne(
          { tenant: tenant._id, _id: draft.sourceId },
          {
            projection: {
              soNumber: 1,
              docType: 1,
              quoteStatus: 1,
              orderStatus: 1,
              status: 1,
              total: 1,
              totalAmount: 1,
              amountPaid: 1,
              creditedAmount: 1,
              paymentStatus: 1,
              convertedTo: 1,
              convertedFrom: 1,
              invoiceIssuedAt: 1,
              invoiceDraft: 1,
              paymentMethod: 1,
            },
          },
        );
      sourceChecks.push({ invoice: draft.number, invoiceOutstanding: draft.outstanding, source });
    }
    console.log(
      JSON.stringify(
        {
          sourceChecks,
          business: tenant.name,
          saved,
          invoiceSummary: await require("../services/customerInvoice/summary").invoiceSummary(tenant._id),
          sourceSummary: await require("../services/arAp.service").summary(tenant._id, "ar"),
        },
        null,
        2,
      ),
    );
  }
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
