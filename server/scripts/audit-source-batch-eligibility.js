// Read-only counts and totals. Never prints customer/vendor details or credentials.
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
mongoose.set("autoIndex", false);
async function main() {
  await require("../config/db").connectDB();
  await require("../services/batchPayment/mutations").requireSourceIndex();
  const tenants = await mongoose.connection.db
    .collection("tenants")
    .find({ name: { $in: ["Wyn City", "CKK Giftery"] } }, { projection: { name: 1 } })
    .toArray();
  const { allMembers, accounts } = require("../services/batchPayment/members");
  const reports = [];
  for (const tenant of tenants) {
    for (const direction of ["customer", "vendor"]) {
      for (const account of accounts) {
        const members = await allMembers(tenant._id, direction, account);
        reports.push({
          business: tenant.name,
          direction,
          account,
          eligibleCount: members.length,
          netAmount: Math.round(members.reduce((n, row) => n + row.amount, 0) * 100) / 100,
        });
      }
    }
  }
  console.log(JSON.stringify({ sourceClaimProtectionReady: true, reports }, null, 2));
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
