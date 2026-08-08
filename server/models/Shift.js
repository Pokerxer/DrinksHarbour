// models/Shift.js — one slot on the roster: a role that needs covering between
// two absolute instants, optionally filled by a person.
//
// `employee` IS NULLABLE and that is the point. A roster is built first (from
// templates, as open shifts) and filled afterwards, so "nobody yet" is a normal
// state rather than invalid data. Every read path has to expect null — the same
// id | doc | null ref shape that blanked the warehouse pages when it was assumed
// away.
//
// Start and end are stored as UTC Dates because that is the only form that can
// be compared, sorted and indexed. The tenant's local wall clock lives on
// ShiftTemplate.
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const { SHIFT_STATUSES } = require('../services/shift.helpers');

const shiftSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    // The template this was generated from, if any. Kept so re-generating a
    // range can recognise slots it already created instead of duplicating them.
    // Null for a shift an admin added by hand.
    template: { type: ObjectId, ref: 'ShiftTemplate', default: null },
    // null = an open shift, waiting to be filled.
    employee: { type: ObjectId, ref: 'User', default: null },
    role: { type: ObjectId, ref: 'EmployeeRole', required: true },
    department: { type: ObjectId, ref: 'Department', default: null },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    breakMinutes: { type: Number, min: 0, default: 0 },
    // draft → published → cancelled. A draft roster is deliberately invisible
    // to staff; publishing is an explicit act, never a side effect of editing.
    status: { type: String, enum: SHIFT_STATUSES, default: 'draft', index: true },
    publishedAt: { type: Date, default: null },
    note: { type: String, trim: true, maxlength: 1000 },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// The roster window query: every shift in a tenant between two dates.
shiftSchema.index({ tenant: 1, start: 1 });
// The overlap check: one employee's shifts around a candidate's time.
shiftSchema.index({ tenant: 1, employee: 1, start: 1 });

module.exports = mongoose.models.Shift || mongoose.model('Shift', shiftSchema);
