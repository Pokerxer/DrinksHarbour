'use strict';
const mongoose = require('mongoose');

// Immutable, versioned AUTHORITY RECORD for merchant order component refunds
// (workstream T: tax + discount). Mechanism, not policy: this model stores
// operator-recorded decisions verbatim and offers no defaults. Per kind:
//   tax      — recorded jurisdiction / rate authority / bearer / reversal
//              treatment (enum-restricted to treatments the mechanism can
//              represent; only `no_output_vat_captured` is executable —
//              marketplace orders never captured output VAT).
//   discount — recorded component eligibility per discountFunding value
//              (shared_by_agreement | platform) and the platform-funded share
//              re-credit path (only `component_record_only` is executable;
//              the mechanism writes no journals and moves no money).
// Production contains no records, so every command surface stays fail-closed
// until a super_admin records a version. Records are append-only: any update
// or delete of an existing version is rejected; a new decision is a new
// version (VenueFinancialPolicy approved-snapshot discipline).
const kinds = ['tax', 'discount'];
const reversalTreatments = [
  'no_output_vat_captured',
  'reverse_captured_output_vat',
  'retroactive_capture_then_reverse',
];
const recreditPaths = [
  'component_record_only',
  'original_tender_recredit',
  'stored_value_recredit',
];
const fundingValues = ['shared_by_agreement', 'platform'];

const absent = (value) =>
  value === undefined || value === null || (Array.isArray(value) && value.length === 0);
const taxOnly = (field, label) => ({
  validator: function () {
    return this.kind !== 'discount' || absent(this[field]);
  },
  message: `${label} rules apply only to tax policies; discount policies must not record one`,
});
const discountOnly = (field, label) => ({
  validator: function () {
    return this.kind !== 'tax' || absent(this[field]);
  },
  message: `${label} rules apply only to discount policies; tax policies must not record one`,
});

const schema = new mongoose.Schema(
  {
    kind: { type: String, enum: kinds, required: true },
    version: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    state: { type: String, enum: ['recorded'], required: true },
    // Recorded tax rules — the only values the mechanism can represent.
    jurisdiction: {
      type: String, trim: true, maxlength: 280,
      validate: {
        validator: function () { return this.kind !== 'tax' || (typeof this.jurisdiction === 'string' && this.jurisdiction.trim().length > 0); },
        message: 'Tax policies require a recorded jurisdiction',
      },
    },
    rateAuthority: {
      type: String, trim: true, maxlength: 280,
      validate: {
        validator: function () { return this.kind !== 'tax' || (typeof this.rateAuthority === 'string' && this.rateAuthority.trim().length > 0); },
        message: 'Tax policies require a recorded rate authority',
      },
    },
    bearer: {
      type: String, trim: true, maxlength: 280,
      validate: {
        validator: function () { return this.kind !== 'tax' || (typeof this.bearer === 'string' && this.bearer.trim().length > 0); },
        message: 'Tax policies require a recorded bearer',
      },
    },
    reversalTreatment: {
      type: String, enum: reversalTreatments,
      required: function () { return this.kind === 'tax'; },
      validate: taxOnly('reversalTreatment', 'Reversal treatment'),
    },
    // Recorded discount rules — eligibility per discountFunding value and the
    // platform-funded share re-credit path.
    eligibleFunding: {
      type: [String], enum: fundingValues, default: undefined,
      required: function () { return this.kind === 'discount'; },
      validate: [
        {
          validator: function (values) {
            return this.kind !== 'discount' || (Array.isArray(values) && values.length > 0 && new Set(values).size === values.length);
          },
          message: 'Discount policies require recorded component eligibility per discount funding value',
        },
        discountOnly('eligibleFunding', 'Discount eligibility'),
      ],
    },
    platformRecreditPath: {
      type: String, enum: recreditPaths,
      required: function () { return this.kind === 'discount'; },
      validate: discountOnly('platformRecreditPath', 'Platform-funded re-credit path'),
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
schema.index({ kind: 1, version: 1 }, { unique: true });

// Append-only enforcement: recorded versions are immutable.
function rejectMutation() {
  throw new (require('../utils/errors').ConflictError)(
    'Recorded merchant component refund policies are immutable; record a new version.',
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
    // Mutations through the model are only allowed when they cannot match an
    // existing record (i.e. the recording service's insert path).
    rejectMutation();
  });

module.exports =
  mongoose.models.MerchantComponentRefundPolicy ||
  mongoose.model('MerchantComponentRefundPolicy', schema);
