"use strict";
const mongoose = require("mongoose");
const { Schema } = mongoose;
const {
  normalizeConfiguration,
  READINESS,
} = require("../services/country/validation");
const review = new Schema(
  {
    evidence: { type: String, required: true, maxlength: 1000 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reviewedAt: { type: Date, required: true },
  },
  { _id: false },
);
const countrySchema = new Schema(
  {
    code: { type: String, required: true, immutable: true },
    name: { type: String, required: true },
    currency: { type: String, required: true },
    locale: { type: String, required: true },
    timezones: { type: [String], required: true },
    capabilities: {
      marketplace: { type: Boolean, default: false },
      storefront: { type: Boolean, default: false },
      erm: { type: Boolean, default: false },
    },
    active: { type: Boolean, default: false },
    version: { type: Number, required: true, min: 1 },
    readiness: Object.fromEntries(
      READINESS.map((key) => [key, { type: review }]),
    ),
    // Audit and current state change atomically in one document; never call a best-effort logger.
    revisions: {
      type: [
        new Schema(
          {
            version: { type: Number, required: true },
            action: { type: String, required: true },
            actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
            at: { type: Date, required: true },
            reason: { type: String, required: true, maxlength: 1000 },
            snapshot: { type: Schema.Types.Mixed, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true, autoIndex: false, versionKey: false, strict: "throw" },
);
countrySchema.index({ code: 1 }, { unique: true });
countrySchema.pre("validate", function () {
  normalizeConfiguration(this.toObject());
});
module.exports =
  mongoose.models.CountryConfiguration ||
  mongoose.model("CountryConfiguration", countrySchema);
