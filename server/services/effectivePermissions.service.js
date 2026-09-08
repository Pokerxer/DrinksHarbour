'use strict';

const Role = require('../models/Role');
const BASE_PERMISSIONS = require('../config/base-permissions');
const { PERMISSION_CATALOG, PLATFORM_ONLY_PERMISSIONS } = require('../config/permissions');

// Explicitly supported tenant action grants. Platform catalog mutations and
// billing remain protected by their existing role-only guards.
const TENANT_ACTION_PERMISSIONS = new Set([
  'inventory:read', 'inventory:write', 'inventory:adjust',
  'settings:read', 'settings:write',
]);

async function loadCustomPermissions(user) {
  if (!user?.customRole || !user.tenant ||
      !['tenant_admin', 'tenant_staff'].includes(user.role)) return [];
  const role = await Role.findOne({
    _id: user.customRole, tenant: user.tenant, scope: 'tenant', isActive: true,
  }).select('permissions').lean();
  const known = new Set(PERMISSION_CATALOG.map(p => p.key));
  const fixedPlatformActions = ['products:write', 'products:delete', 'categories:write', 'categories:delete', 'brands:write', 'brands:delete'];
  return [...new Set((role?.permissions || []).filter(p =>
    known.has(p) && !PLATFORM_ONLY_PERMISSIONS.includes(p) && !fixedPlatformActions.includes(p)))];
}

function effectivePermissions(user) {
  return [...new Set([...(BASE_PERMISSIONS[user.role] || []), ...(user.customPermissions || [])])];
}
module.exports = { loadCustomPermissions, effectivePermissions, TENANT_ACTION_PERMISSIONS };
