// models/ShiftSwapRequest.js — somebody asking to be taken off a shift, and
// who ends up on it.
//
// `targetEmployee` IS NULLABLE and that is the point: null means the shift is
// offered to anyone holding the role, exactly like `Shift.employee`. Accepting
// an open swap is what CLAIMS it — the accepter's id is written into this field
// at that moment, so an approval always has somebody to move the shift to.
//
// TWO GATES, NOT ONE
// ------------------
// `accepted` is the target saying yes. `approved` is a manager saying yes. Only
// the second writes `Shift.employee`, and it goes through the same
// `checkAssignment` as any other assignment — a swap is not a way around the
// overlap rule or approved time off. The transition table in
// services/timeOff.helpers.js has no `pending → approved` edge for exactly this
// reason: until somebody has accepted, approving would approve a hole.
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const { SWAP_STATUSES } = require('../services/timeOff.helpers');

const shiftSwapRequestSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    shift: { type: ObjectId, ref: 'Shift', required: true },
    requestedBy: { type: ObjectId, ref: 'User', required: true },
    // null = open to anyone holding the role. Set when somebody claims it.
    targetEmployee: { type: ObjectId, ref: 'User', default: null },
    status: { type: String, enum: SWAP_STATUSES, default: 'pending', index: true },
    // Routed at creation by timeOff.helpers#resolveApprover — the same
    // definition time off uses, so a person has one queue and not two.
    approver: { type: ObjectId, ref: 'User', default: null },
    note: { type: String, trim: true, maxlength: 1000 },
    // When the target answered, which is a different event from the decision.
    respondedAt: { type: Date, default: null },
    decidedBy: { type: ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// The manager's queue and the swaps board.
shiftSwapRequestSchema.index({ tenant: 1, status: 1, createdAt: -1 });
// "Is this shift already up for swap?" — checked before every new request.
shiftSwapRequestSchema.index({ tenant: 1, shift: 1, status: 1 });
// One person's own swaps: what they asked for, and what was offered to them.
shiftSwapRequestSchema.index({ tenant: 1, requestedBy: 1, status: 1 });
shiftSwapRequestSchema.index({ tenant: 1, targetEmployee: 1, status: 1 });

module.exports =
  mongoose.models.ShiftSwapRequest ||
  mongoose.model('ShiftSwapRequest', shiftSwapRequestSchema);
