"use strict";
const mongoose = require("mongoose");

// Immutable, versioned AUTHORITY RECORD for the Kora (Korapay) refund adapter
// (workstream K). Mechanism, not policy: fields ARE the reviewed protocol
// facts an external reviewer approves — they are recorded verbatim, and the
// sealed transport adapter only asserts their PRESENCE (it never invents or
// fills in protocol content). Production databases contain ZERO records, so
// every surface stays fail-closed until a super_admin records a version.
//
// `acceptFallbackTransactionId` is the recorded identity decision for the
// ambiguous fallback `transactionId` identity (marketplacePaymentTrust.js
// falls back to the merchant reference when Korapay does not return one;
// payment.service.js:358). It must be recorded as an explicit boolean:
// absent or false keeps the ambiguous fallback identity REFUSED. A new
// decision is a new immutable version — records are append-only, any update
// or delete of an existing version is rejected.
//
// `refundFeeBearer`/`feeJournalTreatment` coordinates with the fee-treatment
// authority (feeTreatment/*): the bearer vocabulary is read-imported from
// MerchantFeeTreatmentPolicy.BEARERS and executed by NOTHING here (recorded
// data only).
const schema = new mongoose.Schema(
  {
    version: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    state: { type: String, enum: ["recorded"], required: true },
    // The reviewed protocol facts — each recorded verbatim by the reviewer.
    endpointsShapeReference: { type: String, required: true, trim: true, minlength: 16, maxlength: 2000 },
    authMode: { type: String, required: true, trim: true, minlength: 16, maxlength: 2000 },
    refundRequestContract: { type: String, required: true, trim: true, minlength: 16, maxlength: 2000 },
    refundResponseContract: { type: String, required: true, trim: true, minlength: 16, maxlength: 2000 },
    uncertaintyBehavior: { type: String, required: true, trim: true, minlength: 16, maxlength: 2000 },
    idempotencyConvention: { type: String, required: true, trim: true, minlength: 16, maxlength: 2000 },
    // The identity decision. STRICTLY a boolean at recording time; the
    // mechanism only accepts the fallback identity when this is exactly
    // `true`. (Mongoose Boolean `required` ignores `false`, so presence is
    // enforced by the recording service and this custom validator.)
    acceptFallbackTransactionId: {
      type: Boolean,
      validate: { validator: (value) => typeof value === "boolean", message: "The recorded identity decision must be an explicit boolean" },
    },
    // Optional recorded fee bearer for the kora refund flow. Validated
    // against the shared fee-treatment bearer vocabulary (read-import);
    // the command binds it onto the allocation as recorded_not_executed
    // data and executes no fee movement.
    refundFeeBearer: { type: String, trim: true },
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

// Append-only enforcement: recorded versions are immutable. Mirrors the
// StoredValueRefundPolicy / VenueFinancialPolicy approved-snapshot discipline.
function rejectMutation() {
  throw new (require("../utils/errors").ConflictError)(
    "Recorded Kora refund policies are immutable; record a new version.",
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
  "findOneAndReplace",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
])
  schema.pre(operation, function () {
    // Mutations through the model are only allowed when they cannot match an
    // existing record (i.e. the recording service's insert path).
    rejectMutation();
  });

module.exports = mongoose.models.MerchantKoraRefundPolicy
  || mongoose.model("MerchantKoraRefundPolicy", schema);
