'use strict';
const { ForbiddenError, NotFoundError } = require('../../utils/errors');
const { effectivePermissions } = require('../effectivePermissions.service');
const { id } = require('./allocation');
function scope(actor, write = false) {
  const platform = ['super_admin', 'admin'].includes(actor?.role);
  if (
    !platform &&
    !['tenant_owner', 'tenant_admin', 'tenant_staff'].includes(actor?.role)
  )
    throw new ForbiddenError('Merchant fulfillment staff access required');
  if (
    !effectivePermissions(actor || {}).includes(
      write ? 'orders:write' : 'orders:read'
    )
  )
    throw new ForbiddenError('Merchant order permission required');
  if (!platform && !actor.tenant)
    throw new ForbiddenError('Authenticated merchant identity required');
  return platform ? {} : { tenant: actor.tenant };
}
function assertOwned(row, actor, write = false) {
  const filter = scope(actor, write);
  if (!row || (filter.tenant && id(row.tenant) !== id(filter.tenant)))
    throw new NotFoundError('Merchant order not found');
  return row;
}
const pick = (value, keys) =>
  Object.fromEntries(
    keys
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, value[key]])
  );
function dto(row) {
  const raw = row.toObject ? row.toObject() : row;
  const view = pick(raw, [
    '_id',
    'order',
    'tenant',
    'location',
    'currency',
    'allocationPolicy',
    'grossMinor',
    'discountMinor',
    'merchandiseMinor',
    'shippingMinor',
    'taxMinor',
    'totalMinor',
    'state',
    'version',
    'fulfillmentVersion',
    'refundReservedMinor',
    'refundedMinor',
    'createdAt',
    'acceptedAt',
    'shippedAt',
    'deliveredAt',
  ]);
  view.lines = (raw.lines || []).map((line) =>
    pick(line, [
      'line',
      'product',
      'subproduct',
      'size',
      'quantity',
      'grossMinor',
      'discountMinor',
      'merchandiseMinor',
    ])
  );
  if(raw.fulfillmentVersion===2) view.quantityProgress=(raw.quantityProgress||[]).map(progress=>({
    ...pick(progress,['line','shipped','delivered','cancelled']),
    financialBlocks:(progress.financialBlocks||[]).map(block=>pick(block,['start','quantity','kind'])),
  }));
  return view;
}
async function audit(row, actor, action, { session } = {}) {
  if (!['super_admin', 'admin'].includes(actor?.role)) return;
  await require('../../models/AuditLog').create(
    [
      {
        actorUserId: actor._id,
        actorRole: actor.role,
        action,
        actionCategory: 'auth',
        targetType: 'Order',
        ...(row?.order ? { targetId: row.order } : {}),
        ...(row?.tenant ? { targetTenantId: row.tenant } : {}),
        justification: 'Authorized platform merchant operation',
        ...(row
          ? {
              changes: {
                after: { merchantOrder: String(row.merchantOrder || row._id) },
              },
            }
          : {}),
      },
    ],
    session ? { session } : {}
  );
}
module.exports = { scope, assertOwned, dto, audit };
