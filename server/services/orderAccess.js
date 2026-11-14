'use strict';
const { normalizeTenantId: id } = require('../utils/tenantContext');
const { effectivePermissions } = require('./effectivePermissions.service');
const { NotFoundError, ForbiddenError, ConflictError } = require('../utils/errors');
const platform = actor => ['admin', 'super_admin'].includes(actor?.role);
const staff = actor => ['tenant_owner', 'tenant_admin', 'tenant_staff'].includes(actor?.role);
function permit(actor, action) {
  if (!effectivePermissions(actor || {}).includes(action)) throw new ForbiddenError('Order operation not permitted');
}
function access(order, actor) {
  if (!order || !actor) throw new NotFoundError('Order not found');
  if (actor.guestOrder === id(order._id) && !order.user) return 'guest';
  if (platform(actor)) { permit(actor, 'orders:read'); return 'platform'; }
  if (staff(actor) && id(actor.tenant) && (order.items || []).some(i => id(i.tenant) === id(actor.tenant))) {
    permit(actor, 'orders:read'); return 'tenant';
  }
  if (id(order.user) && id(order.user) === id(actor._id)) return 'customer';
  throw new NotFoundError('Order not found');
}
function assertMutation(order, actor, { customer = false } = {}) {
  const scope = access(order, actor);
  if (scope === 'guest') throw new ForbiddenError('Sign in or contact support for order changes');
  if (scope === 'customer' && !customer) throw new ForbiddenError('Order operation not permitted');
  if (scope !== 'customer') permit(actor, 'orders:write');
  if (scope === 'tenant') assertSingleTenant(order, actor.tenant);
  return scope;
}
function assertSingleTenant(order, tenant) {
  if (!(order.items || []).length || order.items.some(i => id(i.tenant) !== id(tenant))) {
    throw new ConflictError('Mixed-tenant order requires platform review and merchant allocation');
  }
}
const pick = (value, keys) => Object.fromEntries(keys.filter(k => value?.[k] !== undefined).map(k => [k, value[k]]));
function identity(value, fields) {
  return value && typeof value === 'object' && value._id ? pick(value, ['_id', ...fields]) : value;
}
function project(order, actor) {
  const scope = access(order, actor);
  const raw = order.toObject ? order.toObject() : order;
  if (scope === 'platform') return raw;
  const view = pick(raw, ['_id', 'orderNumber', 'receiptNumber', 'status', 'paymentStatus', 'paymentMethod', 'currency',
    'placedAt', 'createdAt', 'paidAt', 'confirmedAt', 'shippedAt', 'deliveredAt', 'cancelledAt', 'shippingMethod',
    'subtotal', 'discountTotal', 'taxAmount', 'shippingFee', 'totalAmount', 'source', 'salesChannel']);
  view.items = (raw.items || []).filter(i => scope !== 'tenant' || id(i.tenant) === id(actor.tenant)).map(i => ({
    ...pick(i, ['_id', 'quantity', 'priceAtPurchase', 'itemSubtotal', 'discountAmount', 'productName', 'name', 'sku', 'sizeName']),
    product: identity(i.product, ['name', 'slug', 'images', 'type']),
    subproduct: identity(i.subproduct, ['name', 'sku', 'imagesOverride']),
    size: identity(i.size, ['displayName', 'size']), tenant: identity(i.tenant, ['name']),
  }));
  if (raw.source === 'pos') {
    view.posStaff = identity(raw.posStaff, ['firstName', 'lastName', 'posName']);
    view.customer = pick(raw.paymentDetails?.customer, ['firstName', 'lastName', 'phone']);
    if (scope !== 'tenant' || (raw.items || []).every(i => id(i.tenant) === id(actor.tenant))) {
      view.paymentDetails = { ...pick(raw.paymentDetails, ['method', 'change']), customer: view.customer,
        splitPayments: (raw.paymentDetails?.splitPayments || []).map(t => pick(t, ['method', 'amount'])) };
    }
  }
  view.shippingAddress = pick(raw.shippingAddress, ['fullName', 'email', 'phone', 'addressLine1', 'addressLine2', 'city', 'state', 'country', 'postalCode', 'landmark', 'additionalInstructions']);
  if (scope === 'customer' && raw.gift?.isGift) view.gift = { isGift: true };
  if (['customer', 'guest'].includes(scope)) view.shippingInfo = pick(raw.shippingInfo, ['zone', 'zoneLabel', 'estimatedDelivery']);
  if (scope === 'tenant') {
    // Marketplace customers belong to the PLATFORM. A tenant fulfilling
    // their slice needs the delivery address, not the customer's identity —
    // mask name/phone/email on every non-POS order (web = platform customer).
    // Their own POS walk-in data (source 'pos') stays visible: they typed it.
    if (raw.source !== 'pos') {
      view.shippingAddress = {
        ...pick(view.shippingAddress, ['addressLine1', 'addressLine2', 'city', 'state', 'country', 'postalCode', 'landmark', 'additionalInstructions']),
        fullName: 'Online customer',
      };
    }
    const mixed = (raw.items || []).some(i => id(i.tenant) !== id(actor.tenant));
    view.subtotal = Math.round(view.items.reduce((sum, i) => sum + Number(i.itemSubtotal || 0), 0) * 100) / 100;
    view.discountTotal = Math.round(view.items.reduce((sum, i) => sum + Number(i.discountAmount || 0), 0) * 100) / 100;
    view.shippingFee = mixed ? 0 : Number(raw.shippingFee || 0);
    view.taxAmount = mixed ? 0 : Number(raw.taxAmount || 0);
    // Public subtotal is gross merchandise; deduct this merchant's allocated discount.
    view.totalAmount = Math.round((view.subtotal - view.discountTotal + view.shippingFee + view.taxAmount) * 100) / 100;
    view.totalsScope = mixed ? 'merchant_merchandise_only' : 'merchant_order';
    const fulfillment = raw.fulfillmentStatus instanceof Map ? raw.fulfillmentStatus.get(id(actor.tenant)) : raw.fulfillmentStatus?.[id(actor.tenant)];
    if (fulfillment) view.fulfillmentStatus = { [id(actor.tenant)]: fulfillment };
  }
  return view;
}
// Internal reporting shape: keep lookup identity, replace whole-parent values before aggregation.
function merchantSummary(order, tenant) {
  const raw = order.toObject ? order.toObject() : order;
  const items = (raw.items || []).filter(i => id(i.tenant) === id(tenant));
  const totalAmount = Math.round(items.reduce((sum, i) => sum + Number(i.itemSubtotal || 0) - Number(i.discountAmount || 0), 0) * 100) / 100;
  const mixed = (raw.items || []).some(i => id(i.tenant) !== id(tenant));
  return { ...raw, items, totalAmount: totalAmount + (mixed ? 0 : Number(raw.shippingFee || 0) + Number(raw.taxAmount || 0)) };
}
async function audit(order, actor, action) {
  if (!platform(actor)) return;
  await require('../models/AuditLog').create({ actorUserId: actor._id, actorRole: actor.role, action, actionCategory: 'auth', targetType: 'Order', targetId: order?._id,
    justification: 'Authorized platform order operation' });
}
module.exports = { access, project, assertMutation, assertSingleTenant, platform, permit, audit, merchantSummary };
