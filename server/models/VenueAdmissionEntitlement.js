'use strict';
// models/VenueAdmissionEntitlement.js — Phase-4 E2 Task 2: an admission allowance
// derived from an APPROVED source (an approved guest list in E2; tickets E5, table
// packages E4). The kind enum is fixed for E4/E5 reuse: 'guestlist' | 'ticket' |
// 'table_inclusion' | 'vip'. tokens[] are the scan credentials — unique per tenant
// (multikey unique index on {tenant, 'tokens.token'}: no two entitlements share a
// token, and no document carries a duplicate token in its array). issuedCount is the
// allocated guest count; usedCount only ever grows inside a redemption transaction
// (<= issuedCount is transaction-guarded). agePolicySnapshot freezes the occurrence's
// published age/admission policy (version = occurrence.version at issuance). expiresAt
// defaults to the occurrence end. label is the door-surface display name (minimum
// info). autoIndex: false; indexes ensured via audit-indexes (ADMISSION_MODEL_INDEXES).
const mongoose = require('mongoose'); const { Schema } = mongoose;
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true },
  location: { type: Schema.Types.ObjectId, required: true },
  occurrence: { type: Schema.Types.ObjectId, ref: 'VenueEventOccurrence', required: true },
  kind: { type: String, enum: { values: ['guestlist', 'ticket', 'table_inclusion', 'vip'], message: 'invalid kind' }, required: true },
  sourceRef: { type: Schema.Types.ObjectId, default: null },
  label: { type: String, maxlength: 120, default: null },
  issuedCount: { type: Number, required: true, min: 1, max: 1000 },
  usedCount: { type: Number, default: 0, min: 0 },
  tokens: {
    type: [{
      _id: false,
      token: { type: String, required: true, minlength: 8, maxlength: 64 },
      partySize: { type: Number, required: true, min: 1, max: 50 },
    }],
    validate: tokens => tokens.length <= 20,
  },
  agePolicySnapshot: new Schema({
    version: { type: Number, required: true, min: 0 },
    minimumAge: { type: Number, enum: { values: [16, 18, 21], message: 'invalid minimumAge' }, default: null },
    admissionTerms: { type: String, required: true, maxlength: 2000 },
  }, { _id: false }),
  expiresAt: { type: Date, default: null },
}, { timestamps: true, autoIndex: false });
schema.index({ tenant: 1, 'tokens.token': 1 }, { unique: true });
schema.index({ tenant: 1, occurrence: 1, sourceRef: 1 });
module.exports = mongoose.models.VenueAdmissionEntitlement || mongoose.model('VenueAdmissionEntitlement', schema);
