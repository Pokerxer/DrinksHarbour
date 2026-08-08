// models/EmployeeRole.js — an HR/planning role: what someone is capable of doing
// on a shift (Cashier, Bartender, Driver, Stock Keeper).
//
// This is NOT the access-control role. User.role stays a fixed enum
// (`tenant_owner` / `tenant_admin` / `tenant_staff`) that governs permissions and
// is deliberately not editable through this surface. An EmployeeRole grants
// nothing; it only describes capability, so that a shift can require one and the
// roster can flag an unqualified assignment.
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const employeeRoleSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // Drives the roster colour coding, so an open Bartender shift is visually
    // distinct from an open Driver shift at a glance.
    color: { type: String, trim: true, maxlength: 9 },
    // Labour cost per hour when this role is worked. Zero means "not costed";
    // it is never used as a wage, only for roster cost estimation.
    hourlyCost: { type: Number, min: 0, default: 0 },
    note: { type: String, trim: true, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

employeeRoleSchema.index({ tenant: 1, name: 1 }, { unique: true });
employeeRoleSchema.index({ tenant: 1, isActive: 1 });

module.exports = mongoose.models.EmployeeRole || mongoose.model('EmployeeRole', employeeRoleSchema);
