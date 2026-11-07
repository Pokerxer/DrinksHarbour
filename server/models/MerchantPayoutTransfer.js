"use strict";
const mongoose = require("mongoose"),
  { Schema } = mongoose;

// Once-only STATEMENT-LINKED payout transfer record (workstream P). The _id
// IS the idempotency anchor: sha256("merchant-payout-transfer:" + childId +
// ":" + idempotencyKey), so concurrent duplicate commands resolve to exactly
// one row on a real Promise.all (unique-index insert race). Every money
// figure is a pinned, immutable read of the settlement statement version the
// command was prepared against — a future payout statement reconciles
// without a second ledger. Lifecycle:
//   prepared → reviewed → executing → settled | uncertain
// executing/uncertain reserve transfer responsibility exactly like refund
// allocations; only once-only provider evidence (MerchantPayoutEvidence,
// _id = provider:account:transferId) settles a transfer. A provider REPORT
// never becomes a financial fact: submit results only stamp the submitted
// identity.
const policySnapshot = new Schema(
  {
    scheduleRule: String,
    currencyMode: String,
    destinationAccountSource: String,
    destinationAccountSourceRule: String,
    holdRegime: String,
    standingHoldMinor: Number,
    clawbackRule: String,
    nettingRule: String,
    minimumThresholdMinor: Number,
    destinationCurrency: String,
  },
  { _id: false, strict: false },
);
const conversionSnapshot = new Schema(
  {
    destinationCurrency: String,
    fxSourceName: String,
    rateId: String,
    rate: Number,
    effectiveDate: Date,
    rateSource: String,
    timestampPolicy: String,
    rounding: String,
    convertedMinor: Number,
  },
  { _id: false, strict: false },
);
const sourceFigures = new Schema(
  {
    netSettledMinor: Number,
    netReservedMinor: Number,
    netProjectedMinor: Number,
    tenantShareMinor: Number,
    settledRefundMinor: Number,
    settledCommissionMinor: Number,
    goodsOriginalCostMinor: Number,
    goodsCancelledCostMinor: Number,
    carrierCommittedMinor: Number,
  },
  { _id: false },
);

const schema = new Schema(
  {
    _id: { type: String, required: true },
    child: { type: String, required: true, immutable: true },
    order: { type: Schema.Types.ObjectId, required: true, immutable: true },
    tenant: { type: Schema.Types.ObjectId, required: true, immutable: true },
    currency: {
      type: String,
      enum: ["NGN"],
      required: true,
      immutable: true,
    },
    amountMinor: {
      type: Number,
      required: true,
      min: 1,
      immutable: true,
      validate: Number.isSafeInteger,
    },
    destinationAccountReference: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      immutable: true,
    },
    statementVersion: { type: Number, required: true, immutable: true },
    netReceivableMinor: {
      type: Number,
      required: true,
      immutable: true,
      validate: Number.isSafeInteger,
    },
    heldTotalMinor: {
      type: Number,
      required: true,
      immutable: true,
      validate: Number.isSafeInteger,
    },
    transferableBaseMinor: {
      type: Number,
      required: true,
      immutable: true,
      validate: Number.isSafeInteger,
    },
    sourceFigures: { type: sourceFigures, immutable: true },
    policyId: { type: Schema.Types.ObjectId, immutable: true },
    policyVersion: { type: Number, required: true, immutable: true },
    policySnapshot: { type: policySnapshot, immutable: true },
    destinationAccountSource: { type: String, immutable: true },
    conversion: { type: conversionSnapshot, immutable: true },
    state: {
      type: String,
      enum: ["prepared", "reviewed", "executing", "settled", "uncertain"],
      default: "prepared",
    },
    balanceClaimedMinor: { type: Number, default: 0 },
    submittedTransferId: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    settledEvidence: { type: String },
    lastError: { type: String },
    lastErrorAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, autoIndex: false },
);

module.exports =
  mongoose.models.MerchantPayoutTransfer ||
  mongoose.model("MerchantPayoutTransfer", schema);
