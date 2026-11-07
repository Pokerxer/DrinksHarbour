"use strict";
const mongoose = require("mongoose"),
  { Schema } = mongoose;
// Immutable, versioned authority record for post-quarantine stock/COGS effects.
// Content is recorded operator input (mechanism, not policy): no defaults are
// invented here, production holds no rows, and every recorded field is frozen.
// Revocation is exact-ID only; a changed treatment requires a new version.
const conditionTreatment = new Schema(
  {
    sealed: { type: String, required: true, immutable: true },
    damaged: { type: String, required: true, immutable: true },
    expired: { type: String, required: true, immutable: true },
    unverifiable: { type: String, required: true, immutable: true },
  },
  { _id: false },
);
const schema = new Schema(
  {
    _id: { type: String, required: true },
    tenant: { type: Schema.Types.ObjectId, required: true, immutable: true },
    version: { type: Number, required: true, immutable: true, min: 1 },
    status: { type: String, enum: ["recorded", "revoked"], default: "recorded" },
    treatmentByCondition: { type: conditionTreatment, required: true, immutable: true },
    restockLocationRule: { type: String, required: true, immutable: true },
    cogsTreatment: { type: String, required: true, immutable: true },
    reviewReference: { type: String, required: true, immutable: true },
    effectiveFrom: { type: Date, immutable: true },
    effectiveUntil: { type: Date, immutable: true },
    recordedBy: { type: Schema.Types.ObjectId, required: true, immutable: true },
    recordedAt: { type: Date, required: true, immutable: true },
    revokedBy: Schema.Types.ObjectId,
    revokedAt: Date,
  },
  { timestamps: true, autoIndex: false },
);
module.exports =
  mongoose.models.MerchantDispositionPolicy ||
  mongoose.model("MerchantDispositionPolicy", schema);
