// models/AuditLog.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const auditLogSchema = new Schema(
  {
    // ── Actor (who performed the action) ────────────────────────────────────
    actorUserId: { type: ObjectId, ref: 'User', index: true },
    actorRole: {
      type: String,
      enum: ['super_admin', 'admin', 'tenant_admin', 'tenant_owner', 'tenant_staff', 'customer', 'system'],
      required: true,
    },
    actorEmail: { type: String, trim: true, lowercase: true },

    // ── Action classification ───────────────────────────────────────────────
    action: {
      type: String,
      required: true,
      index: true,
      // e.g. TENANT_CREATE, PRODUCT_APPROVE, SUBPRODUCT_TRANSFER, USER_SUSPEND,
      //      BULK_PROMOTE_ALL_TENANTS, USER_DELETE, IMPERSONATE, CROSS_TENANT_ACCESS
    },
    actionCategory: {
      type: String,
      enum: ['create', 'update', 'delete', 'approve', 'reject', 'suspend', 'activate', 'transfer', 'bulk', 'impersonate', 'export', 'auth'],
      index: true,
    },

    // ── Target (what was acted upon) ────────────────────────────────────────
    targetType: { type: String, trim: true }, // 'Tenant', 'Product', 'SubProduct', 'User', 'Order', 'InventoryMovement'
    targetId: { type: ObjectId, refPath: 'targetType' },
    targetTenantId: { type: ObjectId, ref: 'Tenant', index: true }, // tenant the target belongs to

    // ── Context ──────────────────────────────────────────────────────────────
    ipAddress: { type: String, trim: true },
    userAgent: { type: String, trim: true },
    justification: { type: String, trim: true }, // reason given by the actor (e.g. support ticket ref)

    // ── Changes (before/after for mutations) ────────────────────────────────
    changes: {
      before: { type: Schema.Types.Mixed },
      after: { type: Schema.Types.Mixed },
    },

    // ── Result ────────────────────────────────────────────────────────────────
    result: {
      type: String,
      enum: ['success', 'failure', 'denied'],
      default: 'success',
      index: true,
    },
    errorMessage: { type: String, trim: true },

    // ── Timestamp ─────────────────────────────────────────────────────────────
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { _id: true, timestamps: false, versionKey: false }
);

// Compound indexes for common queries
auditLogSchema.index({ actorUserId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ targetTenantId: 1, timestamp: -1 });
auditLogSchema.index({ actionCategory: 1, timestamp: -1 });

// TTL: hard-delete audit logs after 7 years (2555 days)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2555 * 24 * 60 * 60 });

module.exports = mongoose.model('AuditLog', auditLogSchema);