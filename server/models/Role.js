// server/models/Role.js
//
// Custom access-control roles. A Role REFINES the fixed User.role enum
// additively (permissions are a union with the base role's declarative set) —
// it never replaces the enum and never weakens JWT tenant scoping. See
// server/config/permissions.js for the catalogue these permission keys come
// from, and docs/custom-roles-permissions-continue-prompt.md for the settled
// design.
//
// NOT to be confused with EmployeeRole (HR shift-planning roles) — that model
// is about who can work which shift; this one is about what an account may do.
// There is deliberately NO isSystem flag: system roles ARE the User.role enum
// and never live in this collection.

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

const {
  PERMISSION_CATALOG,
  validatePermissions,
} = require('../config/permissions');

const CATALOG_KEYS = PERMISSION_CATALOG.map((p) => p.key);

const roleSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    // 'platform' → drinksharbour.com staff; 'tenant' → one business's people.
    scope: {
      type: String,
      enum: ['platform', 'tenant'],
      required: true,
    },

    // Required iff scope === 'tenant'; null for platform roles.
    tenant: {
      type: ObjectId,
      ref: 'Tenant',
      default: null,
      validate: {
        validator: function (value) {
          if (this.scope === 'tenant') return value != null;
          return value == null;
        },
        message:
          'A tenant role must name its tenant; a platform role must have none',
      },
    },

    // Subset of the canonical catalog — validated below, re-checked in the
    // service so a tenant scope can never hold PLATFORM_ONLY_PERMISSIONS.
    permissions: {
      type: [String],
      default: [],
      validate: {
        validator: function (keys) {
          const result = validatePermissions(keys, this.scope);
          return result.ok;
        },
        message: function (props) {
          const { unknown = [], platformOnly = [] } =
            validatePermissions(props.value, this.scope);
          if (unknown.length) {
            return `Unknown permissions: ${unknown.join(', ')}. Allowed keys: ${CATALOG_KEYS.join(', ')}`;
          }
          return `Tenant roles cannot hold platform-only permissions: ${platformOnly.join(', ')}`;
        },
      },
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    color: {
      type: String,
      trim: true,
      default: '',
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: false },
    toObject: { virtuals: false },
  }
);

// Uniqueness is PER SCOPE, not global: "Shift Lead" may exist once per tenant
// and once on the platform side.
//
//   - Platform names: partial-unique index where tenant IS null — a plain
//     compound unique would let only ONE tenant role exist across ALL tenants
//     (every non-null tenant collides), which is exactly the mistake the badge
//     number index comment in models/User.js documents.
//   - Tenant names: plain unique { tenant: 1, name: 1 }; every document has a
//     tenant by validation.
roleSchema.index(
  { scope: 1, name: 1 },
  { unique: true, partialFilterExpression: { tenant: null } }
);
roleSchema.index({ tenant: 1, name: 1 }, { unique: true });

module.exports =
  mongoose.models.Role || mongoose.model('Role', roleSchema);
