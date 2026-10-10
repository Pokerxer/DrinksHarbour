const {
  effectivePermissions,
  loadCustomPermissions,
} = require('./effectivePermissions.service');
const CATEGORIES = {
  stock: ['low_stock_alert'],
  performance: ['product_performance'],
  suggestions: ['product_suggestion'],
  products: ['product_approved', 'product_rejected'],
  expiry: ['batch_expiry_alert'],
};
const PLATFORM_TYPES = [
  'new_product_pending',
  'new_review_pending',
  'new_tenant_registration',
  'system_alert',
  'general',
];
function allowedTypes(user) {
  if (['super_admin', 'admin'].includes(user.role) && !user.tenant)
    return PLATFORM_TYPES;
  if (
    !user.tenant &&
    !['tenant_owner', 'tenant_admin', 'tenant_staff'].includes(user.role)
  )
    return [];
  if (['tenant_owner', 'tenant_admin'].includes(user.role))
    return Object.values(CATEGORIES).flat();
  if (user.role !== 'tenant_staff') return [];
  const p = effectivePermissions(user);
  return [
    ...(p.includes('inventory:read')
      ? [...CATEGORIES.stock, ...CATEGORIES.expiry]
      : []),
    ...(p.includes('reports:read')
      ? [...CATEGORIES.performance, ...CATEGORIES.suggestions]
      : []),
    ...(p.includes('subproducts:read') ? CATEGORIES.products : []),
  ];
}
async function getTenantRecipients(tenantId, recipientId) {
  const User = require('../models/User');
  const users = await User.find({
    tenant: tenantId,
    ...(recipientId ? { _id: recipientId } : {}),
    status: 'active',
    role: { $in: ['tenant_owner', 'tenant_admin', 'tenant_staff'] },
  })
    .select('_id role tenant customRole')
    .lean();
  for (const user of users)
    user.customPermissions = await loadCustomPermissions(user);
  return users;
}
module.exports = { CATEGORIES, allowedTypes, getTenantRecipients };
