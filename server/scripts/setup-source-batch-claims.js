// Metadata-only setup authorized by the approved source-batch implementation plan.
// Creates duplicate-protection index; never creates a batch/payment/journal or moves money.
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
mongoose.set("autoIndex", false);
async function main() {
  await require("../config/db").connectDB();
  const Claim = require("../models/SourceBatchClaim");
  await Claim.collection.createIndex(
    { tenant: 1, journal: 1, account: 1 },
    { unique: true, partialFilterExpression: { active: true }, name: "source_account_active_unique" },
  );
  await require("../services/batchPayment/mutations").requireSourceIndex();
  console.log(JSON.stringify({ sourceClaimProtectionReady: true, index: "source_account_active_unique" }));
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
