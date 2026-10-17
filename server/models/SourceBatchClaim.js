const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },
    journal: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", required: true },
    account: { type: String, enum: ["1000", "1100", "2200"], required: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "BatchPayment", required: true },
    active: { type: Boolean, default: true, required: true },
  },
  { timestamps: true, autoIndex: false, autoCreate: false },
);
schema.index(
  { tenant: 1, journal: 1, account: 1 },
  { unique: true, partialFilterExpression: { active: true }, name: "source_account_active_unique" },
);
module.exports = mongoose.models.SourceBatchClaim || mongoose.model("SourceBatchClaim", schema);
