// server/models/AppraisalNudge.js
const mongoose = require('mongoose');
const { NUDGE_REASONS } = require('../services/appraisal.helpers');

const { Schema } = mongoose;

/**
 * A reminder HR sent to someone holding an appraisal up.
 *
 * Its OWN collection, deliberately, not a subdocument array on Appraisal. A
 * nudge aimed at an outstanding peer carries that peer's id in `target`, so as
 * a subdocument it would be an identity-bearing field on the very document
 * projected to the subject of the appraisal — and REVIEWER_IDENTITY_FIELDS in
 * appraisal.controller.js is a DENY-list, so a new identity-bearing field is
 * exposed by default until someone remembers to add it. As a separate
 * collection the subject's payload structurally never carries it: there is
 * nothing to claw back. Same argument that split AppraisalFeedback out of
 * Appraisal in the parent spec.
 *
 * The module's privacy asymmetry is deliberate and load-bearing: the manager
 * and HR see peer reviewer names, only the employee does not (peers are told
 * exactly this by the disclosure banner in reviewer-form.tsx before they
 * write). Nothing here may be used to widen it.
 */
const appraisalNudgeSchema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    appraisal: { type: Schema.Types.ObjectId, ref: 'Appraisal', required: true },
    cycle: { type: Schema.Types.ObjectId, ref: 'AppraisalCycle', required: true },
    // Who is being chased. NOT who the appraisal is about.
    target: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Imported from appraisal.helpers.js rather than retyped, so the planner
    // (outstandingActionsFor) and this enum cannot drift: a reason the planner
    // can emit but the enum rejects would fail at write time, on the one path
    // HR uses when a cycle is already stuck.
    reason: { type: String, enum: NUDGE_REASONS, required: true },
    // 'email' means an email actually went out. A requested email that failed
    // is stored as 'app' with `emailError` set — the in-app reminder did land.
    channel: { type: String, enum: ['app', 'email'], default: 'app' },
    sentBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sentAt: { type: Date, default: Date.now },
    emailError: { type: String },
  },
  { timestamps: true }
);

// Repeat nudges are kept as history — the roster's "nudged 2d ago" reads the
// most recent row — so there is deliberately NO unique index here, and no
// field-level `unique: true` anywhere above (that is what once made a purchase
// document number globally unique across tenants). Every index leads with
// `tenant`, and neither duplicates the other's key pattern, so mongoose prints
// no "Duplicate schema index" warning on boot.
appraisalNudgeSchema.index({ tenant: 1, cycle: 1, target: 1 });
// Serves both the 12-hour throttle lookup (equality on the first four keys,
// newest first) and the roster's latest-nudge-per-appraisal read.
appraisalNudgeSchema.index({ tenant: 1, appraisal: 1, target: 1, reason: 1, sentAt: -1 });

module.exports = mongoose.model('AppraisalNudge', appraisalNudgeSchema);
