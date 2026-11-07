'use strict';
const mongoose = require('mongoose');

// Immutable, versioned AUTHORITY RECORD binding payout transfers to the
// read-only settlement statement projection (workstream P). Mechanism, not
// policy: this model stores operator-recorded contract decisions verbatim and
// offers no defaults. Recorded contract fields — the facts a reviewer would
// approve and the payout command consumes as data:
//   scheduleRule             — recorded settlement timing (verbatim, data-only).
//   currencyMode             — original_transaction_currency (executable) or
//                              recorded_fx_conversion, which requires the
//                              recorded FX source fields below (per the
//                              strategy's FX rules: recorded source name,
//                              timestamp policy, maximum age, rounding — and
//                              every converted amount snapshots the rate).
//   destinationAccountSource — the RECORDED FIELD TYPE that binds a payout
//                              destination (tenant payout account reference
//                              id only; no account numbers or rails invented).
//   holdRegime               — the only hold source the mechanism can
//                              represent: recorded hold documents plus the
//                              recorded standingHoldMinor amount.
//   clawbackRule               — recorded_not_executed: clawback operates only
//                              through subsequently recorded holds, or is
//                              explicitly recorded as none_recorded.
//   nettingRule              — the statement nets nothing beyond its own
//                              netReceivable projection (recorded, data-only).
//   minimumThresholdMinor    — recorded minimum below which no transfer
//                              command is prepared.
// Production contains no records, so every payout surface stays fail-closed
// absent BOTH recorded policy versions AND MERCHANT_PAYOUT_POLICY. Records
// are append-only: any update or delete of an existing version is rejected;
// a new decision is a new version (VenueFinancialPolicy approved-snapshot
// discipline).
const currencyModes = ['original_transaction_currency', 'recorded_fx_conversion'];
const fxTimestampPolicies = ['recorded_effective_date'];
const fxRoundings = ['half_up'];
const destinationAccountSources = ['tenant_payout_account_reference'];
const holdRegimes = ['recorded_holds_and_standing_minor'];
const clawbackRules = ['via_recorded_subsequent_hold', 'none_recorded'];
const nettingRules = ['statement_net_receivable_only'];
const conversionFields = ['destinationCurrency', 'fxSourceName', 'fxRateTimestampPolicy', 'fxMaxAgeMinutes', 'fxRounding'];

const absent = (value) => value === undefined || value === null || value === '';
const conversionOnly = (field, label) => ({
  validator: function () {
    return this.currencyMode !== 'original_transaction_currency' || absent(this[field]);
  },
  message: `${label} rules apply only to recorded_fx_conversion currency policies; an original-transaction-currency policy must not record one`,
});
const requiresConversion = (field, label) => ({
  validator: function () {
    return this.currencyMode !== 'recorded_fx_conversion' || !absent(this[field]);
  },
  message: `Recorded FX conversion policies require a recorded ${label}`,
});

const schema = new mongoose.Schema(
  {
    version: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    state: { type: String, enum: ['recorded'], required: true },
    scheduleRule: {
      type: String, trim: true, maxlength: 280,
      validate: {
        validator: (value) => typeof value === 'string' && value.trim().length > 0,
        message: 'Recorded payout policies require a settlement schedule/timing rule',
      },
    },
    currencyMode: { type: String, enum: currencyModes, required: true },
    destinationCurrency: {
      type: String, uppercase: true, match: /^[A-Z]{3}$/,
      validate: [conversionOnly('destinationCurrency', 'Destination currency'), requiresConversion('destinationCurrency', 'destination currency')],
    },
    fxSourceName: {
      type: String, trim: true, maxlength: 280,
      validate: [conversionOnly('fxSourceName', 'FX source name'), requiresConversion('fxSourceName', 'FX source name')],
    },
    fxRateTimestampPolicy: {
      type: String, enum: fxTimestampPolicies,
      validate: [conversionOnly('fxRateTimestampPolicy', 'FX rate timestamp policy'), requiresConversion('fxRateTimestampPolicy', 'FX rate timestamp policy')],
    },
    fxMaxAgeMinutes: {
      type: Number,
      validate: [
        {
          validator: function (value) {
            return this.currencyMode !== 'recorded_fx_conversion' || (Number.isInteger(value) && value >= 1);
          },
          message: 'Recorded FX conversion policies require a maximum rate age of at least one minute',
        },
        conversionOnly('fxMaxAgeMinutes', 'FX maximum rate age'),
      ],
    },
    fxRounding: {
      type: String, enum: fxRoundings,
      validate: [conversionOnly('fxRounding', 'FX rounding rule'), requiresConversion('fxRounding', 'FX rounding rule')],
    },
    destinationAccountSource: { type: String, enum: destinationAccountSources, required: true },
    holdRegime: { type: String, enum: holdRegimes, required: true },
    standingHoldMinor: { type: Number, validate: [Number.isSafeInteger, { validator: (v) => !absent(v) ? v >= 0 : true, message: 'Recorded standing hold must be a non-negative minor amount' }] },
    clawbackRule: { type: String, enum: clawbackRules, required: true },
    nettingRule: { type: String, enum: nettingRules, required: true },
    minimumThresholdMinor: {
      type: Number, required: true,
      validate: { validator: (v) => Number.isInteger(v) && v >= 1, message: 'Recorded payout minimum threshold must be at least one minor unit' },
    },
    decisionReference: { type: String, trim: true, maxlength: 280 },
    effectiveFrom: { type: Date },
    effectiveUntil: { type: Date },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recordedAt: { type: Date, required: true },
    contentHash: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw', autoIndex: false },
);
schema.index({ version: 1 }, { unique: true });

function rejectMutation() {
  throw new (require('../utils/errors').ConflictError)(
    'Recorded merchant payout policies are immutable; record a new version.',
  );
}
schema.pre('save', function () {
  if (!this.isNew && this.isModified()) rejectMutation();
});
for (const operation of [
  'updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne',
  'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete',
])
  schema.pre(operation, function () {
    rejectMutation();
  });

module.exports =
  mongoose.models.MerchantPayoutPolicy ||
  mongoose.model('MerchantPayoutPolicy', schema);

module.exports.currencyModes = currencyModes;
module.exports.fxTimestampPolicies = fxTimestampPolicies;
module.exports.fxRoundings = fxRoundings;
module.exports.destinationAccountSources = destinationAccountSources;
module.exports.holdRegimes = holdRegimes;
module.exports.clawbackRules = clawbackRules;
module.exports.nettingRules = nettingRules;
module.exports.conversionFields = conversionFields;
