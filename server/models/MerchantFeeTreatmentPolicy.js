"use strict";
// Immutable, versioned AUTHORITY RECORD for provider fee bearer + fee
// accounting treatment (workstream Fb). Mechanism, not policy: this model
// stores operator-recorded decisions verbatim and offers no defaults —
// production databases contain no records, so every surface stays fail-closed
// until a super_admin records a version.
//
// A PURE RECORD AUTHORITY: no provider-fee journal exists in the marketplace
// posting set (accounting.orders.js posts 1300/6500/4000, 2100 pos-only,
// 4100 tenant-direct — there is no fee account at all) and historical fees
// stay unknown forever. The future-journal treatment and historical-fee rule
// are RECORDED DATA consumed only by the projection/readiness readers; this
// package builds no journal writer and measures no fees.
//
// A version binds ONE bearer decision to ONE set of flows
// (merchandise_refund | shipping_refund | carrier_recovery | stored_value_refund
// | kora_refund | payout). A flow needing a different bearer gets its own
// version. Records are append-only: any update or delete of an existing
// version is rejected; a new commercial decision is a new version.
const mongoose = require("mongoose");

const FLOWS = [
  "merchandise_refund",
  "shipping_refund",
  "carrier_recovery",
  "stored_value_refund",
  "kora_refund",
  "payout",
];
// Recorded bearer outcomes — surfaced as data, never executed.
const BEARERS = [
  "customer_refund_share",
  "merchant_bears",
  "platform_bears",
  "carrier_recovery",
];
// Recorded FUTURE-journal accounting treatments. No journal writer exists in
// this package; every value is data a future reviewed accounting adapter
// would have to implement (none is executable here).
const TREATMENTS = [
  "no_provider_fee_journal_until_fee_account_exists",
  "future_provider_fee_expense_journal_required",
  "future_provider_fee_expense_net_against_commission_reversal_required",
];
// Historical-fee rule. `none_recorded_stays_unknown` is the ONLY executable
// value: historical fees stay unknown forever — never backfilled, never
// inferred. Other recordable values describe possible future knowledge; the
// projection flags them as requiring a future measurement mechanism.
const HISTORICAL_RULES = [
  "none_recorded_stays_unknown",
  "historical_fees_unrecorded_requires_measurement",
  "historical_fees_partial_requires_measurement",
];

const schema = new mongoose.Schema(
  {
    version: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    state: { type: String, enum: ["recorded"], required: true },
    // Recorded flows this version governs (non-empty, duplicate-free subset).
    flows: {
      type: [String],
      enum: FLOWS,
      required: true,
      validate: (v) => Array.isArray(v) && v.length >= 1 && new Set(v).size === v.length,
    },
    // Recorded bearer outcome for the bound flows — data only, never executed.
    bearer: { type: String, enum: BEARERS, required: true },
    // Recorded FUTURE-journal treatment; consumed ONLY as data (no journal
    // write exists in this package by design).
    futureJournalTreatment: { type: String, enum: TREATMENTS, required: true },
    // Historical-fee rule. `none_recorded_stays_unknown` is the only value the
    // projection executes; others are recorded decisions the projection flags
    // as requiring a future measurement mechanism.
    historicalFeeRule: { type: String, enum: HISTORICAL_RULES, required: true },
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
    "Recorded fee treatment policies are immutable; record a new version.",
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
  mongoose.models.MerchantFeeTreatmentPolicy ||
  mongoose.model("MerchantFeeTreatmentPolicy", schema);
module.exports.FLOWS = FLOWS;
module.exports.BEARERS = BEARERS;
module.exports.TREATMENTS = TREATMENTS;
module.exports.HISTORICAL_RULES = HISTORICAL_RULES;
