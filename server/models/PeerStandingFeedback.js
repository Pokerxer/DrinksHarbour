// models/PeerStandingFeedback.js — "who on my team is doing well, and who
// needs support", written by an employee about their own department.
//
// Phase 5 §9.5. Deliberately NOT an AppraisalFeedback row and deliberately not
// reachable through any appraisal payload:
//
//  - It is ATTRIBUTED, unlike peer feedback. The reader is the tenant owner and
//    nobody else, and an unattributed standing report is a rumour.
//  - It is about OTHER people, so it can never be joined into the subject's own
//    appraisal, a roster, a report or a comparison. The one read path is
//    GET /api/appraisal-feedback/standing, gated to tenant_owner + super_admin
//    at the route AND re-checked in the controller.
//  - It is optional. An employee who fills nothing in has said nothing, which
//    is a legitimate answer and must not block their self-assessment.
const mongoose = require('mongoose');
const { Schema } = mongoose;

const standingEntrySchema = new Schema(
  {
    subject: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Two values, not a scale. A 1–5 rating of a colleague by a colleague is
    // the low-n mean problem the peer form already avoids (see
    // buildDefaultTemplate); "who should I be paying attention to" is the
    // question the owner actually has, and it is a two-way split.
    standing: { type: String, enum: ['doing_well', 'needs_support'], required: true },
    note: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false }
);

const peerStandingFeedbackSchema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    cycle: { type: Schema.Types.ObjectId, ref: 'AppraisalCycle', required: true, index: true },
    // The author's OWN appraisal — this is a step on their self-form, so it is
    // anchored to the record that form belongs to.
    appraisal: { type: Schema.Types.ObjectId, ref: 'Appraisal' },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Snapshot at authoring time, matching Appraisal.department: who the
    // candidate list was drawn from is a fact about when it was written, and a
    // transfer afterwards must not relabel it.
    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    entries: [standingEntrySchema],
    submittedAt: { type: Date },
  },
  { timestamps: true }
);

// One standing report per author per cycle. Compound-only — a field-level
// unique on `author` would enforce one report per person for all time, and
// across every tenant, which is the stale-global-index bug this repo has been
// bitten by before.
peerStandingFeedbackSchema.index({ author: 1, cycle: 1 }, { unique: true });
// The owner's read: everything in one cycle, tenant-scoped.
peerStandingFeedbackSchema.index({ tenant: 1, cycle: 1 });

module.exports =
  mongoose.models.PeerStandingFeedback ||
  mongoose.model('PeerStandingFeedback', peerStandingFeedbackSchema);
