"use strict";
const mongoose = require("mongoose");

// Immutable, versioned AUTHORITY RECORD for zero-only no-money unit release
// (workstream Z). Mechanism, not policy: this model stores operator recorded
// decisions verbatim and offers no defaults — the recorded shape binds the
// no-money record format (zero_release_v1), the qualifying scope rule and the
// verbatim audit wording. Production databases hold zero records; every
// release surface stays fail-closed until a super_admin records a version.
//
// Records are append-only: any update or delete of an existing version is
// rejected. A new commercial decision is a new immutable version.
const schema = new mongoose.Schema(
  {
    _id: { type: String, immutable: true },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      immutable: true,
    },
    version: { type: Number, required: true, min: 1, immutable: true },
    state: { type: String, enum: ["recorded"], required: true },
    // Recorded rules — the only values the release mechanism can execute.
    // Content is operator input; absent fields are absent, never defaulted.
    recordShape: { type: String, enum: ["zero_release_v1"], required: true },
    scopeRule: {
      type: String,
      enum: ["zero_merchandise_only", "zero_merchandise_any_shipping_tax"],
      required: true,
    },
    auditWording: {
      type: String,
      required: true,
      minlength: 5,
      maxlength: 300,
      immutable: true,
    },
    decisionReference: { type: String, trim: true, maxlength: 280 },
    effectiveFrom: { type: Date },
    effectiveUntil: { type: Date },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    recordedAt: { type: Date, required: true },
    contentHash: { type: String, required: true, immutable: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: "throw", autoIndex: false },
);
schema.index({ tenant: 1, version: 1 }, { unique: true });

// Append-only enforcement: recorded versions are immutable. Mirrors the
// stored-value refund policy and venue financial-policy discipline.
function rejectMutation() {
  throw new (require("../utils/errors").ConflictError)(
    "Recorded no-money release policies are immutable; record a newer version.",
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

module.exports =
  mongoose.models.MerchantNoMoneyReleasePolicy ||
  mongoose.model("MerchantNoMoneyReleasePolicy", schema);
