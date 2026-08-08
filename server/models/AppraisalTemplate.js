const mongoose = require('mongoose');
const { Schema } = mongoose;

const questionSchema = new Schema({
  type: {
    type: String,
    enum: ['rating', 'text', 'likert', 'choice', 'yes_no', 'scale'],
    required: true,
  },
  label: { type: String, required: true, trim: true, maxlength: 300 },
  helpText: { type: String, trim: true, maxlength: 500 },
  required: { type: Boolean, default: true },
  scaleMax: { type: Number, min: 2, max: 10, default: 5 },
  // For choice / multi-select questions
  options: [{ type: String, trim: true, maxlength: 200 }],
  multiple: { type: Boolean, default: false },
  // For likert / scale questions — custom endpoint labels
  scaleLabels: {
    low: { type: String, trim: true, maxlength: 100 },
    high: { type: String, trim: true, maxlength: 100 },
  },
  // Which reviewer kinds are asked this question. Shared ids across kinds are
  // what make self-vs-manager comparison a direct lookup.
  askOf: {
    type: [String],
    enum: ['self', 'manager', 'peer'],
    default: ['self', 'manager', 'peer'],
  },
});

const sectionSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  // Which departments are asked this section (Phase 5 §9.1). EMPTY MEANS
  // EVERYONE — the common case, and the shape every pre-Phase-5 template
  // already has, so no migration is needed to keep existing forms company-wide.
  // Filtering lives in filterSections (services/appraisal.helpers.js), which
  // every read/write path goes through; nothing here enforces it.
  departments: [{ type: Schema.Types.ObjectId, ref: 'Department' }],
  questions: [questionSchema],
});

const appraisalTemplateSchema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    // Copy-on-write versioning. A template is edited in place until a cycle
    // has launched against it; the first edit after that forks a new version
    // and the launched cycle keeps pointing at the version it launched with.
    // Editing a form must never rewrite an appraisal an employee has already
    // signed off on.
    family: { type: Schema.Types.ObjectId, required: true, index: true },
    version: { type: Number, required: true, default: 1 },
    isLatest: { type: Boolean, default: true },
    // The tenant's seeded family — what ensureDefaultTemplate resolves and
    // what createCycle falls back to when HR names no template.
    isDefault: { type: Boolean, default: false },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    isArchived: { type: Boolean, default: false },
    sections: [sectionSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

appraisalTemplateSchema.index({ tenant: 1, family: 1, version: 1 }, { unique: true });

// At most one latest version per family. Enforced for every family, not just
// the default — a family with two isLatest rows resolves non-deterministically
// at cycle create, and the fork transaction relies on this rejecting a
// half-applied write.
appraisalTemplateSchema.index(
  { tenant: 1, family: 1 },
  { unique: true, partialFilterExpression: { isLatest: true } }
);

// At most one default family per tenant. This is what makes
// ensureDefaultTemplate's upsert safe against two concurrent first-ever
// createCycle calls, which previously raced through findOne-then-create and
// could seed two default templates. Keyed on {tenant, isDefault} rather than
// the bare {tenant} used by the field-level `tenant` index above — Mongoose
// compares index key patterns and ignores options, so a bare {tenant: 1}
// here would collide with that field-level index and print a duplicate-index
// warning even though a partial index can't serve general tenant queries.
appraisalTemplateSchema.index(
  { tenant: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true, isLatest: true } }
);

module.exports = mongoose.model('AppraisalTemplate', appraisalTemplateSchema);
