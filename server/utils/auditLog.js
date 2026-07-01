// utils/auditLog.js
const AuditLog = require('../models/AuditLog');

/**
 * Write an audit log entry. Fire-and-forget by default (never blocks the request).
 * Returns the created AuditLog document (or null on failure).
 *
 * @param {Object} entry
 * @param {string} entry.action - e.g. 'TENANT_CREATE', 'PRODUCT_APPROVE'
 * @param {string} [entry.actionCategory] - 'create'|'update'|'delete'|'approve'|...
 * @param {Object} [entry.actorUserId] - User ObjectId
 * @param {string} [entry.actorRole] - role of the actor
 * @param {string} [entry.actorEmail] - email of the actor
 * @param {string} [entry.targetType] - 'Tenant'|'Product'|'SubProduct'|'User'|...
 * @param {Object} [entry.targetId] - target document ObjectId
 * @param {Object} [entry.targetTenantId] - tenant the target belongs to
 * @param {Object} [entry.req] - Express request (extracts ip, userAgent, actor)
 * @param {string} [entry.justification] - reason provided by actor
 * @param {Object} [entry.changes] - { before, after }
 * @param {string} [entry.result] - 'success'|'failure'|'denied'
 * @param {string} [entry.errorMessage] - error message if result !== 'success'
 * @param {boolean} [entry.fireAndForget=true] - if true, errors are swallowed
 * @returns {Promise<Object|null>}
 */
const logAudit = async (entry) => {
  const {
    action,
    actionCategory,
    actorUserId,
    actorRole,
    actorEmail,
    targetType,
    targetId,
    targetTenantId,
    req,
    justification,
    changes,
    result = 'success',
    errorMessage,
    fireAndForget = true,
  } = entry;

  // Extract actor info from req if available
  const resolvedActorUserId = actorUserId || req?.user?._id;
  const resolvedActorRole = actorRole || req?.user?.role || 'system';
  const resolvedActorEmail = actorEmail || req?.user?.email;

  const ipAddress = req?.ip || req?.connection?.remoteAddress || null;
  const userAgent = req?.headers?.['user-agent'] || null;

  try {
    const doc = await AuditLog.create({
      action,
      actionCategory,
      actorUserId: resolvedActorUserId,
      actorRole: resolvedActorRole,
      actorEmail: resolvedActorEmail,
      targetType,
      targetId,
      targetTenantId,
      ipAddress,
      userAgent,
      justification,
      changes,
      result,
      errorMessage,
    });
    return doc;
  } catch (err) {
    if (fireAndForget) {
      console.error('[AuditLog] Failed to write audit entry:', err.message);
      return null;
    }
    throw err;
  }
};

/**
 * Convenience: log a super-admin / admin privileged action.
 * Wraps logAudit with the audit-required context.
 */
const logPrivilegedAction = async (req, action, actionCategory, target = {}) => {
  return logAudit({
    req,
    action,
    actionCategory,
    targetType: target.targetType,
    targetId: target.targetId,
    targetTenantId: target.targetTenantId,
    justification: target.justification,
    changes: target.changes,
  });
};

module.exports = { logAudit, logPrivilegedAction };