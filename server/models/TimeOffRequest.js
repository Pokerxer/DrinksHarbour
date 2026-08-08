// models/TimeOffRequest.js — somebody asking to be away, and the answer.
//
// `startDate` and `endDate` are a HALF-OPEN window `[startDate, endDate)` in
// absolute UTC, not the two calendar days a human typed. That is deliberate and
// load-bearing: services/shift.helpers.js#overlapsTimeOff compares
// `start < tEnd && tStart < end`, so an inclusive end would leave the last
// morning of a holiday rosterable. The conversion both ways lives in
// services/timeOff.helpers.js (`timeOffWindow` / `timeOffDayKeys`) — nothing
// else should be doing date arithmetic on these fields.
//
// `days` is DERIVED, never accepted from a request: timeOffWindow computes it
// from the two instants, so a client cannot file half a day and have it counted
// as one. Same reasoning as Attendance.minutesWorked.
//
// The enums are imported from the helper rather than redeclared, the way
// Attendance.js takes ATTENDANCE_STATUSES and Shift.js takes SHIFT_STATUSES —
// one definition, or the model and the rules drift apart.
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const {
  TIME_OFF_TYPES,
  TIME_OFF_STATUSES,
  HALF_DAY_PARTS,
} = require('../services/timeOff.helpers');

const timeOffRequestSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    employee: { type: ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TIME_OFF_TYPES, required: true },
    // Inclusive start of the window.
    startDate: { type: Date, required: true },
    // EXCLUSIVE end. See the note at the top before comparing anything to it.
    endDate: { type: Date, required: true },
    // 'am' ends at local midday, 'pm' starts there, and only on a single-day
    // request. The other half of that day stays rosterable.
    halfDay: { type: String, enum: HALF_DAY_PARTS, default: 'none' },
    // Derived from the window to the nearest half day. 0.5 for a half day.
    days: { type: Number, min: 0, default: 0 },
    reason: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: TIME_OFF_STATUSES, default: 'pending', index: true },
    // Resolved at creation by timeOff.helpers#resolveApprover, so the request
    // arrives in somebody's queue rather than waiting to be noticed. Nullable:
    // a one-person tenant has nobody above the requester.
    approver: { type: ObjectId, ref: 'User', default: null },
    // Who actually decided, which is not always who it was routed to.
    decidedBy: { type: ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, trim: true, maxlength: 1000 },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// The assignment guard's query: this employee's approved leave near a shift.
// Run on every roster assignment, so it leads with employee rather than status.
timeOffRequestSchema.index({ tenant: 1, employee: 1, startDate: 1 });
// The approval queue, and the "who is off this month" calendar read.
timeOffRequestSchema.index({ tenant: 1, status: 1, startDate: 1 });

module.exports =
  mongoose.models.TimeOffRequest || mongoose.model('TimeOffRequest', timeOffRequestSchema);
