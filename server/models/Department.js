// models/Department.js — a unit of the tenant's org structure.
//
// Employees point at a department by id (employeeProfile.work.department), and
// the department's `manager` is the "selected admin" who reviews the appraisals
// of everyone in it (see resolveAppraisalReviewer). Departments nest via
// `parent`; cycles are rejected by validateParentAssignment in the controller,
// because a self-referential tree cannot be constrained by the schema alone.
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const departmentSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, trim: true, uppercase: true, maxlength: 30 },
    parent: { type: ObjectId, ref: 'Department', default: null },
    // Reviews this department's appraisals and is the default approver for its
    // staff. Nullable: a department may exist before anyone leads it.
    manager: { type: ObjectId, ref: 'User', default: null },
    color: { type: String, trim: true, maxlength: 9 },
    note: { type: String, trim: true, maxlength: 1000 },
    // Soft state. Deleting a referenced department is refused outright
    // (describeDeleteBlockers), so deactivating is the way to retire one.
    isActive: { type: Boolean, default: true },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Compound-only: a field-level unique on `name` would enforce uniqueness across
// every tenant, which is the bug that stale global indexes caused on the
// purchase documents.
departmentSchema.index({ tenant: 1, name: 1 }, { unique: true });
departmentSchema.index({ tenant: 1, isActive: 1 });
// Serves "who manages this department?" during appraisal launch, which walks
// every employee's department in one pass.
departmentSchema.index({ tenant: 1, manager: 1 });

module.exports = mongoose.models.Department || mongoose.model('Department', departmentSchema);
