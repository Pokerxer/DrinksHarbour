// models/ShiftTemplate.js — a repeating shift pattern ("Weekday morning bar,
// 09:00–17:00, Mon–Fri"), used to generate a roster rather than to be worked.
//
// Times are stored as LOCAL wall clock strings, not Dates. "The morning shift"
// is a local-time idea that stays 09:00 whatever the date; the absolute instant
// only exists once the template is stamped onto a calendar day, which is what
// Shift records. Converting between the two is shift.helpers.js's job and needs
// the tenant's UTC offset, which the controller passes in explicitly.
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const {
  DAYS_OF_WEEK,
  RECURRENCE_TYPES,
  MAX_CYCLE_LENGTH,
} = require('../services/shift.helpers');

const shiftTemplateSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // What the shift needs someone to be able to do. Required: a shift nobody
    // is qualified for cannot be checked against an employee's capabilities.
    role: { type: ObjectId, ref: 'EmployeeRole', required: true },
    department: { type: ObjectId, ref: 'Department', default: null },
    // 'HH:MM' local. An endTime at or before startTime means the shift runs
    // past midnight — derived by shift.helpers.crossesMidnight when
    // endDayOffset is unset, so the two can never disagree.
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    // How many calendar days after the start date the shift ends.
    // 0 = same day (default). 1 = next day (e.g. 08:40→09:00 = 24h 20m).
    // 2 = two days later, etc. When absent or 0, falls back to the legacy
    // heuristic: endTime ≤ startTime → next day.
    endDayOffset: { type: Number, min: 0, max: 6, default: 0 },
    // Unpaid break, subtracted from the roster's scheduled hours.
    breakMinutes: { type: Number, min: 0, default: 0 },
    // How the pattern repeats. 'weekly' reads daysOfWeek; 'cycle' reads the
    // three fields below and ignores daysOfWeek entirely. Defaulting to weekly
    // is what keeps every template written before cycles existed generating the
    // roster it already generated.
    recurrence: { type: String, enum: RECURRENCE_TYPES, default: 'weekly' },
    // 0 = Sunday .. 6 = Saturday, matching Date#getUTCDay. Used by 'weekly'.
    daysOfWeek: { type: [{ type: Number, enum: DAYS_OF_WEEK }], default: [] },
    // ── 'cycle' only ──
    // Days in one turn of the rotation: 2 = one on, one off; 8 = four on, four
    // off. Null on a weekly template.
    cycleLength: { type: Number, min: 1, max: MAX_CYCLE_LENGTH, default: null },
    // Which offsets within the cycle are worked, 0-based and sorted. Empty
    // generates nothing — it is not "every day".
    cycleDays: { type: [Number], default: [] },
    // 'YYYY-MM-DD' local, the day the cycle's offset 0 falls on. Stored, never
    // derived from the range being generated: the phase has to be a pure
    // function of the calendar date or generating March then April would land
    // on different days and break the generator's top-up guarantee.
    anchorDate: { type: String, trim: true, default: null },
    // Falls back to the role's colour on the roster when unset.
    color: { type: String, trim: true, maxlength: 9 },
    note: { type: String, trim: true, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

shiftTemplateSchema.index({ tenant: 1, name: 1 }, { unique: true });
shiftTemplateSchema.index({ tenant: 1, isActive: 1 });

module.exports =
  mongoose.models.ShiftTemplate || mongoose.model('ShiftTemplate', shiftTemplateSchema);
