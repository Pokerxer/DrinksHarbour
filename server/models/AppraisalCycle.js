const mongoose = require('mongoose');
const { Schema } = mongoose;

const appraisalCycleSchema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    template: { type: Schema.Types.ObjectId, ref: 'AppraisalTemplate', required: true },
    // The template FAMILY HR chose. `template` above is the concrete pinned
    // version, re-resolved from this family exactly once at launch and frozen
    // thereafter — so a form edited mid-cycle cannot rewrite an appraisal in
    // flight, while an edit made while the cycle is still draft is picked up.
    templateFamily: { type: Schema.Types.ObjectId, ref: 'AppraisalTemplate', index: true },
    status: {
      type: String,
      enum: ['draft', 'collecting', 'closed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    nominationDeadline: { type: Date },
    feedbackDeadline: { type: Date },
    peerCountMin: { type: Number, min: 0, default: 3 },
    peerCountMax: { type: Number, min: 0, default: 5 },
    // Off → launch lands appraisals straight in 'collecting', exactly as
    // Phase 1 did, so that verified path stays a live branch rather than
    // becoming dead code.
    peerReviewEnabled: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    launchedAt: { type: Date },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

appraisalCycleSchema.index({ tenant: 1, status: 1 });

module.exports = mongoose.model('AppraisalCycle', appraisalCycleSchema);
