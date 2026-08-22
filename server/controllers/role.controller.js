// server/controllers/role.controller.js
//
// Custom access-control roles — thin HTTP layer over role.service.
//
// Guard shape (mirrors employee.routes.js for the tenant chain and
// user.routes.js's admin section for the platform chain):
//   protect → attachTenant → per-handler branching on the CALLER.
// The caller's tenant comes from the JWT-resolved req.tenant only — never from
// body/query (Workstream A). Platform admins MAY pivot into a tenant with
// x-tenant-slug/?tenant=, in which case they act as that tenant's operator.

const asyncHandler = require('../utils/asyncHandler');
const { ForbiddenError } = require('../utils/errors');
const { logPrivilegedAction } = require('../utils/auditLog');
const {
  PERMISSION_CATALOG,
  PLATFORM_ONLY_PERMISSIONS,
  groupedCatalog,
} = require('../config/permissions');
const roleService = require('../services/role.service');

// Roles allowed to touch /api/roles at all. Mirrors middleware.ts's audience
// for /roles-permissions: PLATFORM_ROLES + tenant_owner + tenant_admin.
const DASHBOARD_ROLES = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin'];

function requireDashboardAccess(req, _res, next) {
  if (!DASHBOARD_ROLES.includes(req.user?.role)) {
    throw new ForbiddenError('You do not have access to role management');
  }
  next();
}

/**
 * Caller context for the service. `tenantId` is the tenant the caller is
 * ACTING ON: their own for tenant roles, or the pivoted target when a platform
 * admin passes x-tenant-slug/?tenant=. No tenant resolved = platform shelf.
 */
function callerContext(req) {
  return {
    role: req.user.role,
    isPlatformAdmin: ['admin', 'super_admin'].includes(req.user.role),
    tenantId: req.tenant?._id || null,
  };
}

function presentRolePayload(roleDoc) {
  return {
    _id: roleDoc._id,
    name: roleDoc.name,
    scope: roleDoc.scope,
    tenant: roleDoc.tenant || null,
    description: roleDoc.description || '',
    color: roleDoc.color || '',
    isActive: roleDoc.isActive !== false,
    permissions: roleDoc.permissions || [],
    createdAt: roleDoc.createdAt,
    updatedAt: roleDoc.updatedAt,
  };
}

exports.requireDashboardAccess = requireDashboardAccess;

// ─── List ─────────────────────────────────────────────────────────────────────

exports.listRoles = asyncHandler(async (req, res) => {
  const caller = callerContext(req);
  const roles = await roleService.listRolesWithCounts(caller);
  res.json({ success: true, data: { roles } });
});

// ─── Catalog ──────────────────────────────────────────────────────────────────

exports.getCatalog = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: {
      catalog: groupedCatalog(),
      permissions: PERMISSION_CATALOG,
      platformOnly: PLATFORM_ONLY_PERMISSIONS,
    },
  });
});

// ─── Create ───────────────────────────────────────────────────────────────────

exports.createRole = asyncHandler(async (req, res) => {
  const caller = callerContext(req);
  const payload = { ...req.body };

  if (payload.scope === 'platform') {
    // Creating ON THE PLATFORM SHELF is a platform-admin capability. Tenant
    // callers always create inside their own tenant, even if they ask nicely.
    if (!caller.isPlatformAdmin) {
      throw new ForbiddenError('Only platform administrators can create platform-scoped roles');
    }
    payload.tenant = null;
  } else if (payload.scope === 'tenant') {
    // Server-authoritative tenancy: overwrite anything the client sent.
    if (!req.tenant) {
      throw new ForbiddenError('Tenant context required for this operation');
    }
    payload.tenant = req.tenant._id;
    payload.scope = 'tenant';
  }

  const role = await roleService.createRole(payload, { id: req.user._id });

  await logPrivilegedAction(req, 'ROLE_CREATE', 'create', {
    targetType: 'Role',
    targetId: role._id,
    targetTenantId: role.tenant || undefined,
    changes: { after: { name: role.name, scope: role.scope, permissions: role.permissions } },
  });

  res.status(201).json({ success: true, data: { role: presentRolePayload(role) } });
});

// ─── Update ───────────────────────────────────────────────────────────────────

exports.updateRole = asyncHandler(async (req, res) => {
  const caller = callerContext(req);
  // Scope and tenant are immutable; strip them so a client cannot smuggle a move.
  const { scope: _scope, tenant: _tenant, ...payload } = req.body;

  const { before, role } = await roleService.updateRole(req.params.id, payload, caller);

  await logPrivilegedAction(req, 'ROLE_UPDATE', 'update', {
    targetType: 'Role',
    targetId: role._id,
    targetTenantId: role.tenant || undefined,
    changes: {
      before: { name: before.name, permissions: before.permissions },
      after: { name: role.name, permissions: role.permissions },
    },
  });

  res.json({ success: true, data: { role: presentRolePayload(role) } });
});

// ─── Delete ───────────────────────────────────────────────────────────────────

exports.deleteRole = asyncHandler(async (req, res) => {
  const caller = callerContext(req);
  const deleted = await roleService.deleteRole(req.params.id, caller);

  await logPrivilegedAction(req, 'ROLE_DELETE', 'delete', {
    targetType: 'Role',
    targetId: deleted._id,
    targetTenantId: deleted.tenant || undefined,
    changes: { before: { name: deleted.name, scope: deleted.scope } },
  });

  res.json({ success: true, message: 'Role deleted' });
});
