"use strict";
// Immutable, versioned AUTHORITY RECORD for shipping-refund allocations
// (workstream S2). Mechanism, not policy: this model stores operator-recorded
// decisions verbatim and offers no defaults — production databases contain no
// records, so every surface stays fail-closed until a super_admin records a
// version. The bearer outcome (customer_refund_source | carrier_recovery |
// merchant_bears) and the journal treatment (whether a 4100 shipping-income
// posting reversal is demanded going forward) are RECORDED data: the shipping
// refund mechanism only binds them onto allocations and never executes carrier
// recovery, merchant billing or journal postings.
//
// Records are append-only: any update or delete of an existing version is
// rejected; a new commercial decision is a new version.
const mongoose = require("mongoose");

const CONDITIONS = ["failed_delivery", "cancelled", "carrier_fault"];
const BEARERS = ["customer_refund_source", "carrier_recovery", "merchant_bears"];
const TREATMENTS = [
  "no_shipping_income_journal",
  "reverse_posted_4100_shipping_income",
];

const schema = new mongoose.Schema(
  {
    version: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    state: { type: String, enum: ["recorded"], required: true },
    // Recorded eligibility conditions, at least one. An allocation command must
    // present one of these recorded conditions to bind an allocation.
    eligibilityConditions: {
      type: [String],
      enum: CONDITIONS,
      required: true,
      validate: (v) => Array.isArray(v) && v.length >= 1,
    },
    // Recorded bearer outcome — recorded on allocations, never executed.
    bearerOutcome: { type: String, enum: BEARERS, required: true },
    // Recorded journal treatment going forward. Marketplace orders never post
    // a 4100 shipping-income journal today; a version demanding reversal of
    // one makes the allocation command fail closed when no such posted journal
    // exists (a journal is never invented).
    journalTreatment: { type: String, enum: TREATMENTS, required: true },
    decisionReference: { type: String, trim: true, maxlength: 280 },
    effectiveFrom: { type: Date },
    effectiveUntil: { type: Date },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recordedAt: { type: Date, required: true },
    contentHash: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: "throw", autoIndex: false },
);
schema.index({ version: 1 }, { unique: true });

function rejectMutation() {
  throw new (require("../utils/errors").ConflictError)(
    "Recorded shipping refund policies are immutable; record a new version.",
  );
}
schema.pre("save", function () {
  if (!this.isNew && this.isModified()) rejectMutation();
});
for (const operation of [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
])
  schema.pre(operation, rejectMutation);

module.exports =
  mongoose.models.MerchantShippingRefundPolicy ||
  mongoose.model("MerchantShippingRefundPolicy", schema);
module.exports.CONDITIONS = CONDITIONS;
module.exports.BEARERS = BEARERS;
module.exports.TREATMENTS = TREATMENTS;
