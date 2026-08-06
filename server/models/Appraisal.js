const mongoose = require('mongoose');
const { Schema } = mongoose;
const { APPRAISAL_STATES } = require('../services/appraisal.helpers');

// A nomination, not a reviewer. `user` only becomes a reviewer — and only then
// joins reviewerIds — once status flips to 'approved'. proposedBy/decidedBy are
// recorded because HR may nominate or approve on someone else's behalf, and a
// record the employee signs off on must be able to show whose choice it was.
const peerNominationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    proposedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['proposed', 'approved', 'rejected'],
      default: 'proposed',
    },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
  },
  { _id: false }
);

const appraisalSchema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    cycle: { type: Schema.Types.ObjectId, ref: 'AppraisalCycle', required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Snapshot taken at launch. Never re-read from employeeProfile.work.manager:
    // a reorg mid-cycle must not rewrite who was responsible for this appraisal.
    manager: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    state: { type: String, enum: APPRAISAL_STATES, default: 'draft', index: true },
    // Denormalised list of everyone with a feedback row, so the access resolver
    // can identify a reviewer without a second query.
    reviewerIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    // Uniqueness of `user` within this array is enforced by validateNominations
    // — Mongoose cannot express uniqueness inside a subdocument array.
    peerNominations: [peerNominationSchema],
    summary: { type: String, trim: true, maxlength: 10000 },
    finalRating: { type: Number, min: 0, max: 10 },
    releasedAt: { type: Date },
    releasedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    acknowledgedAt: { type: Date },
    employeeResponse: { type: String, trim: true, maxlength: 10000 },
    cancelledAt: { type: Date },
    cancelReason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

// Compound-only. A field-level unique here would collide across tenants.
appraisalSchema.index({ tenant: 1, cycle: 1, employee: 1 }, { unique: true });
appraisalSchema.index({ tenant: 1, manager: 1, state: 1 });
// GET /appraisals/my — an employee's own appraisals across every cycle, newest
// first. The unique index above cannot serve this: its prefixes are `tenant`
// and `tenant+cycle`, so a query keyed on (tenant, employee) with no cycle
// skips straight past `employee` and scans the tenant. `createdAt: -1` is
// carried so the sort is served by the index rather than done in memory.
appraisalSchema.index({ tenant: 1, employee: 1, createdAt: -1 });

module.exports = mongoose.model('Appraisal', appraisalSchema);
