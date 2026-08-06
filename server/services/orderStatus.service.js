// services/orderStatus.service.js
//
// Single source of truth for "an order changed status".
//
// This used to live inline in orderController.updateOrderStatus, which was fine
// while the admin order page was the only thing that moved an order. The
// logistics dispatch module now also moves orders — dispatching a trip ships
// every order on it, completing a stop delivers one — and a status change is
// NOT a plain field write:
//
//   status → 'shipped'    decrements totalStock AND releases the reservation
//   status → 'cancelled'  either restores physical stock (if already shipped)
//                         or releases the reservation (if not)
//
// A second code path that assigned `order.status` directly would ship goods
// without ever decrementing stock, silently drifting Size.stock away from the
// warehouse ledger. So both callers go through applyOrderStatus instead.

const inventoryService = require('./inventory.service');

// Statuses an actor may move an order to. 'refunded' and 'partially_shipped'
// are reached by other flows (refunds, per-tenant fulfillment), not this one.
const APPLICABLE_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

// Status → the timestamp column it stamps, when not already stamped.
const STATUS_TIMESTAMPS = {
  confirmed: 'confirmedAt',
  processing: 'processingAt',
  shipped: 'shippedAt',
  delivered: 'deliveredAt',
};

/**
 * Move an order to a new status, stamping the lifecycle timestamp and applying
 * the inventory side effects that go with the transition.
 *
 * Saves the order. Inventory calls are fire-and-forget with their own error
 * handling, matching the behaviour this replaced — a warehouse hiccup must not
 * roll back a status the operator already committed to.
 *
 * @param {object} order       a live Order document (not a lean object)
 * @param {string} status      target status, one of APPLICABLE_STATUSES
 * @param {object} [options]
 * @param {string|object} [options.actorId]      user credited with the movement
 * @param {string} [options.cancelReason]        stored when cancelling
 * @param {string} [options.tenantId]            also set this tenant's
 *                                               fulfillmentStatus entry
 * @returns {Promise<{previousStatus: string, changed: boolean}>}
 */
async function applyOrderStatus(order, status, options = {}) {
  const { actorId = null, cancelReason, tenantId = null } = options;

  if (!APPLICABLE_STATUSES.includes(status)) {
    throw new Error(
      `Invalid order status "${status}". Must be one of: ${APPLICABLE_STATUSES.join(', ')}`
    );
  }

  const previousStatus = order.status;
  const changed = previousStatus !== status;

  order.status = status;

  const now = new Date();
  const stampField = STATUS_TIMESTAMPS[status];
  if (stampField && !order[stampField]) order[stampField] = now;

  if (status === 'cancelled') {
    order.cancelledAt = now;
    order.cancelReason = cancelReason || 'Cancelled by admin';
  }

  // Per-tenant fulfillment. Multi-tenant orders track each tenant's slice
  // separately, so a dispatch by one tenant must not claim the whole order.
  if (tenantId && order.fulfillmentStatus) {
    order.fulfillmentStatus.set(String(tenantId), status);
  }

  await order.save();

  applyInventoryEffects(order, status, previousStatus, actorId);

  return { previousStatus, changed };
}

/**
 * The stock movements a transition implies. Split out so the rules are readable
 * and testable on their own.
 */
function applyInventoryEffects(order, status, previousStatus, actorId) {
  const stockItems = order.items.filter((i) => i.subproduct);
  if (!stockItems.length) return;

  if (status === 'shipped' && previousStatus !== 'shipped') {
    // Leaving the warehouse: decrement totalStock + reservedStock.
    inventoryService.commitShipment(stockItems, order._id, actorId).catch(() => {});
    return;
  }

  if (status === 'cancelled' && previousStatus !== 'cancelled') {
    if (inventoryService.isShipped(previousStatus)) {
      // Already shipped, so the goods are coming back.
      inventoryService.restoreStock(stockItems, order._id, actorId).catch(() => {});
    } else {
      // Never left: drop the reservation only.
      inventoryService.releaseReserve(stockItems, order._id, actorId).catch(() => {});
    }
  }
}

module.exports = {
  applyOrderStatus,
  applyInventoryEffects,
  APPLICABLE_STATUSES,
  STATUS_TIMESTAMPS,
};
