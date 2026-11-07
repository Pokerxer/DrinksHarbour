'use strict';
const Child = require('../../models/MerchantOrder'),
  Set = require('../../models/MerchantOrderSet');
const { allocate, minor, hash, id } = require('./allocation');
const { ConflictError } = require('../../utils/errors');
async function prepare(order, { session } = {}) {
  if (process.env.MERCHANT_FULFILLMENT_ENABLED !== 'true') return [];
  if (
    order.paymentStatus !== 'paid' ||
    ['cash', 'cash_on_delivery'].includes(order.paymentMethod)
  )
    return [];
  if (
    !order.isNew ||
    order.onlineStockVersion !== 1 ||
    order.integrationCheckout ||
    order.source === 'pos' ||
    order.venueIdentityVersion === 1 ||
    order.tableServiceBooking ||
    order.settlementOwner !== 'platform'
  )
    return [];
  if (!order.items.length || order.items.some((line) => !line.warehouse))
    return [];
  if (!session?.inTransaction())
    throw new ConflictError(
      'Merchant allocation requires owning order transaction'
    );
  for (const [index, line] of order.items.entries())
    line.fulfillmentLineId = hash(id(order._id) + ':line:' + index).slice(
      0,
      24
    );
  const version = order.merchantFulfillmentVersion === 2 ? 2 : 1;
  const groups = allocate(order).map(group => version === 2 ? { ...group, fulfillmentVersion: 2, quantityProgress: group.lines.map(line => ({ line: String(line.line), shipped: 0, delivered: 0, cancelled: 0, financialBlocks: [] })) } : group);
  await Set.create(
    [
      {
        _id: order._id,
        currency: order.currency,
        totalMinor: minor(order.totalAmount),
        children: groups.map((group) => group._id),
        allocationPolicy: 'merchandise-weighted-v1',
      },
    ],
    { session }
  );
  await Child.create(groups, { session, ordered: true });
  order.merchantFulfillmentVersion = version;
  return groups;
}
async function list(actor) {
  const access = require('./access');
  access.scope(actor);
  await access.audit(null, actor, 'merchant_orders_list');
  return require('./reads').views(
    await Child.find(access.scope(actor))
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
  );
}
async function get(id, actor) {
  const access = require('./access');
  const row = access.assertOwned(
    await Child.findOne({ _id: id, ...access.scope(actor) }).lean(),
    actor
  );
  await access.audit(row, actor, 'merchant_order_read');
  return (await require('./reads').views([row]))[0];
}
module.exports = { prepare, list, get };
