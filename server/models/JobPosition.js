// models/JobPosition.js — a post within a department that employees are hired into.
//
// Odoo's split is deliberately preserved: the POSITION is the shared, countable
// thing ("Cashier" in Sales, with an expected headcount), while an employee's
// JOB TITLE stays free text on employeeProfile.work.jobTitle, defaulted from the
// position name but overridable. Three people can hold one position under three
// different titles.
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const { EMPLOYMENT_TYPES } = require('../services/orgStructure.helpers');

const jobPositionSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    department: { type: ObjectId, ref: 'Department', default: null },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES, default: 'full_time' },
    // Target headcount, used to show under/over-staffing against the actual
    // employee count on the positions list.
    expectedHeadcount: { type: Number, min: 0, default: 0 },
    description: { type: String, trim: true, maxlength: 5000 },
    requirements: { type: String, trim: true, maxlength: 5000 },
    color: { type: String, trim: true, maxlength: 9 },
    note: { type: String, trim: true, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Scoped to the department, so "Manager" can exist in both Sales and Logistics
// without collision. Two department-less positions still cannot share a name,
// because Mongo treats null as a single distinct key value.
jobPositionSchema.index({ tenant: 1, department: 1, name: 1 }, { unique: true });
jobPositionSchema.index({ tenant: 1, isActive: 1 });

module.exports = mongoose.models.JobPosition || mongoose.model('JobPosition', jobPositionSchema);
