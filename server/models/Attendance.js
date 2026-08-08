
// models/Attendance.js — one worked stretch: a clock-in, and later a clock-out.
//
// A record is a PAIR, not an event. `clockOut` is nullable and the document is
// `open` until it has one, which is why clocking is a single toggle endpoint —
// the state of the employee's last record is what decides whether the button
// means "in" or "out".
//
// `status` and `minutesWorked` are DERIVED, never accepted from a request:
// services/attendance.helpers.js#resolveAttendanceTimes computes both from the
// two instants, so a client cannot report a closed record with no hours on it.
// The enums are imported from the same helper rather than redeclared, the way
// Shift.js takes SHIFT_STATUSES and JobPosition.js takes EMPLOYMENT_TYPES —
// one definition, or the model and the rules drift apart.
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const {
  ATTENDANCE_STATUSES,
  ATTENDANCE_SOURCES,
} = require('../services/attendance.helpers');

const attendanceSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    employee: { type: ObjectId, ref: 'User', required: true },
    // Nullable: somebody can turn up on a day nothing was rostered for them,
    // and matchShiftForClock deliberately refuses to attach a cancelled shift.
    // Null here means "no shift to be late for", not missing data.
    shift: { type: ObjectId, ref: 'Shift', default: null },
    clockIn: { type: Date, required: true },
    // Null while the record is open. Clearing it re-opens the record, which is
    // how an admin corrects a clock-out that was punched by mistake.
    clockOut: { type: Date, default: null },
    // A kiosk punch is what the employee actually did; an admin row is what
    // somebody says happened. The delete guard reads this field.
    source: { type: String, enum: ATTENDANCE_SOURCES, default: 'kiosk', index: true },
    minutesWorked: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ATTENDANCE_STATUSES, default: 'open' },
    // Set on every correction, never cleared: a corrected punch has to say who
    // changed it, or "the system says I worked four hours" has no author.
    editedBy: { type: ObjectId, ref: 'User', default: null },
    note: { type: String, trim: true, maxlength: 1000 },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// The day/range log: every punch in a tenant between two instants.
attendanceSchema.index({ tenant: 1, clockIn: 1 });
// One person's history, and the range log filtered to them.
attendanceSchema.index({ tenant: 1, employee: 1, clockIn: 1 });
// The toggle's hot path: does this employee have a record still open? Run on
// every single kiosk press, so it gets its own index rather than riding on one
// that leads with clockIn.
attendanceSchema.index({ tenant: 1, employee: 1, status: 1 });

module.exports = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);
