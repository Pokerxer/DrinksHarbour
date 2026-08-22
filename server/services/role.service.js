// server/services/role.service.js
//
// Custom access-control roles — CRUD behind /api/roles.
//
// Scoping rules (pinned by __tests__/roleRoutes.test.js):
//   - Platform callers (admin/super_admin, no req.tenant) see and manage
//     scope:'platform' roles.
//   - Tenant callers see and manage ONLY scope:'tenant' roles of their own
//     tenant; the tenant always comes from the server-resolved caller context,
//     never from client input.
//   - A cross-tenant miss is reported as NOT FOUND, never 403 — a 403 would
//     confirm the id exists (see middleware/tenant.middleware.js).
//
// Model calls here are deliberately single-await statics so route tests can
// mock them without chaining.

const mongoose = require('mongoose');
const Role = require('../models/Role');
const User = require('../models/User');
const {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} = require('../utils/errors');
const { validatePermissions } = require('../config/permissions');

function assertValidId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError('Invalid role id');
  }
}

/**
 * Who may act on this role document?
 *   - platform role → platform admins only
 *   - tenant role   → callers whose resolved tenant owns it
 * Anything else throws NotFoundError so existence is not confirmed to
 * unauthorised callers.
 */
function assertCanManage(roleDoc, caller) {
  if (roleDoc.scope === 'platform') {
    if (!caller.isPlatformAdmin) {
      throw new NotFoundError('Role not found');
    }
    return;
  }
  const owned =
    caller.tenantId &&
    String(roleDoc.tenant) === String(caller.tenantId);
  if (!owned) {
    throw new NotFoundError('Role not found');
  }
}

/** Shape a Role doc for the client, with its live assignment count. */
async function presentRole(roleDoc, tenantScopeFilter) {
  const assignedCount = await User.countDocuments({
    customRole: roleDoc._id,
    ...tenantScopeFilter,
  });
  return {
    _id: roleDoc._id,
    name: roleDoc.name,
    scope: roleDoc.scope,
    tenant: roleDoc.tenant || null,
    description: roleDoc.description || '',
    color: roleDoc.color || '',
    isActive: roleDoc.isActive !== false,
    permissions: roleDoc.permissions || [],
    assignedCount,
    createdAt: roleDoc.createdAt,
    updatedAt: roleDoc.updatedAt,
  };
}

/**
 * Caller context derived once in the controller from the authenticated
 * request: `{ role, tenantId, isPlatformAdmin }`.
 */
function listRoles(caller) {
  // Tenant callers are scoped by their resolved tenant id. Platform admins
  // have no tenant and get the platform shelf.
  const filter = caller.tenantId
    ? { scope: 'tenant', tenant: caller.tenantId }
    : { scope: 'platform' };
  return Role.find(filter, null, { sort: { name: 1 } });
}

async function listRolesWithCounts(caller) {
  const docs = await listRoles(caller);
  return Promise.all(
    docs.map((doc) =>
      presentRole(doc, caller.tenantId ? { tenant: caller.tenantId } : {})
    )
  );
}

async function createRole(payload = {}, actor = {}) {
  const name = String(payload.name ?? '').trim();
  if (!name) throw new ValidationError('Role name is required');

  const scope = payload.scope;
  if (!['platform', 'tenant'].includes(scope)) {
    throw new ValidationError('scope must be "platform" or "tenant"');
  }

  const check = validatePermissions(payload.permissions ?? [], scope);
  if (!check.ok) {
    if (check.unknown.length) {
      throw new ValidationError(`Unknown permissions: ${check.unknown.join(', ')}`);
    }
    throw new ValidationError(
      `Tenant roles cannot hold platform-only permissions: ${check.platformOnly.join(', ')}`
    );
  }

  // Server-authoritative tenancy: the controller has already forced
  // scope/tenant for tenant callers; this re-checks the pairing.
  const tenant =
    scope === 'tenant'
      ? payload.tenant || undefined
      : null;
  if (scope === 'tenant' && !tenant) {
    throw new ForbiddenError('Tenant context required for this operation');
  }

  const conflict = await Role.findOne({ scope, tenant, name });
  if (conflict) {
    throw new ConflictError(`A role named "${name}" already exists`);
  }

  return Role.create({
    name,
    scope,
    tenant,
    description: String(payload.description ?? '').slice(0, 500),
    color: String(payload.color ?? ''),
    isActive: payload.isActive === undefined ? true : Boolean(payload.isActive),
    permissions: payload.permissions ?? [],
    createdBy: actor.id || null,
  });
}

async function updateRole(id, payload = {}, caller = {}) {
  assertValidId(id);
  const existing = await Role.findById(id);
  if (!existing) throw new NotFoundError('Role not found');
  assertCanManage(existing, caller);

  const before = { name: existing.name, permissions: [...(existing.permissions || [])] };

  const update = {};

  if (payload.name !== undefined) {
    const name = String(payload.name).trim();
    if (!name) throw new ValidationError('Role name is required');
    if (name !== existing.name) {
      const conflict = await Role.findOne({
        _id: { $ne: existing._id },
        scope: existing.scope,
        tenant: existing.tenant,
        name,
      });
      if (conflict) {
        throw new ConflictError(`A role named "${name}" already exists`);
      }
    }
    update.name = name;
  }

  if (payload.permissions !== undefined) {
    const check = validatePermissions(payload.permissions, existing.scope);
    if (!check.ok) {
      if (check.unknown.length) {
        throw new ValidationError(`Unknown permissions: ${check.unknown.join(', ')}`);
      }
      throw new ValidationError(
        `Tenant roles cannot hold platform-only permissions: ${check.platformOnly.join(', ')}`
      );
    }
    update.permissions = payload.permissions;
  }

  // Scope and tenant are IMMUTABLE — moving a role between shelves or tenants
  // would silently change who can manage it.
  for (const field of ['description', 'color', 'isActive']) {
    if (payload[field] !== undefined) update[field] = payload[field];
  }

  const role = await Role.findByIdAndUpdate(existing._id, { $set: update }, { new: true });
  return { before, role };
}

async function deleteRole(id, caller = {}) {
  assertValidId(id);
  const existing = await Role.findById(id);
  if (!existing) throw new NotFoundError('Role not found');
  assertCanManage(existing, caller);

  const assigned = await User.countDocuments({ customRole: existing._id });
  if (assigned > 0) {
    throw new ConflictError(
      `${assigned} user${assigned === 1 ? '' : 's'} still hold${assigned === 1 ? 's' : ''} this role. Unassign them first.`
    );
  }

  await Role.findByIdAndDelete(existing._id);
  return existing;
}

module.exports = {
  listRoles,
  listRolesWithCounts,
  presentRole,
  createRole,
  updateRole,
  deleteRole,
};
