'use strict';
const mongoose = require('mongoose');

// Immutable, versioned AUTHORITY RECORD for original-source stored-value refund
// credits (workstream W). Mechanism, not policy: this model stores operator
// recorded decisions verbatim and offers no defaults. The destination is bound
// to the ORIGINAL stored-value object only — the mechanism does not offer
// substitution, so no other destination value can be recorded. Gift expiry and
// amount precision are recorded rule fields (enum-restricted to rules the
// mechanism can actually execute); production contains no records, so every
// surface stays fail-closed until a super_admin records a version.
//
// Records are append-only: any update or delete of an existing version is
// rejected. A new commercial decision is a new version.
const schema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['wallet', 'gift_card'], required: true },
    destination: { type: String, enum: ['original_object'], required: true },
    version: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    state: { type: String, enum: ['recorded'], required: true },
    // Recorded rules — the only values the mechanism can execute. Content is
    // operator input; absent fields are absent, never defaulted.
    amountPrecisionRule: { type: String, enum: ['whole_naira_units'], required: true },
    giftExpiryRule: { type: String, enum: ['reactivate_expired_card', 'reject_if_expired'] },
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

// Append-only enforcement: recorded versions are immutable. Mirrors the
// VenueFinancialPolicy approved-snapshot discipline.
function rejectMutation() {
  throw new (require('../utils/errors').ConflictError)(
    'Recorded stored-value refund policies are immutable; record a new version.',
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

module.exports = mongoose.models.StoredValueRefundPolicy
  || mongoose.model('StoredValueRefundPolicy', schema);
