// scripts/lib/order.js
//
// Place a Cash-on-Delivery order and (with an admin JWT) walk it to `delivered`
// so the customer becomes eligible to leave a review.
//
// Server contract (see server/controllers/order.controller.js and
// server/routes/order.routes.js):
//
//   POST /api/orders                        optionalProtect
//     body: {
//       customer: { firstName, lastName, email, phone },
//       shipping: { address, city, state, zipCode, country },
//       paymentMethod: 'cash_on_delivery',       (see utils/paymentMethods.js)
//       items:  [{ productId, subProductId, sizeId, quantity, price }],
//       subtotal, total, shippingFee, shippingInfo: { baseFee },
//     }
//     response: { data: { order: { _id, orderNumber, status, ... } } }
//
//   PUT /api/orders/:id/status              tenantAdminOrSuperAdmin
//     body: { status: 'confirmed' | 'processing' | 'shipped' | 'delivered' | ... }
//
//   PUT /api/orders/:id/payment             tenantAdminOrSuperAdmin
//     body: { action: 'mark_paid' | 'mark_failed' | 'mark_refunded' }
//
// The shipping fee is server-authoritative — sending 0 on a non-free zone will
// 400. quoteShipping() in ./shipping.js computes the same fee the controller's
// floor uses, from the same zone tables.

const { quoteShipping } = require('./shipping');

// Standard fulfilment path for a healthy COD order. Skipping straight from
// pending to delivered works too, but stepping through mirrors what an admin
// would actually click and makes the audit log tell a coherent story.
const DELIVERY_STATUS_CHAIN = ['confirmed', 'processing', 'shipped', 'delivered'];

/**
 * Build the /api/orders body from validated buyable rows.
 *
 * @param {object} opts
 * @param {object} opts.customer     from fake-data.generateCustomer()
 * @param {object} opts.address      from fake-data.generateAddress()
 * @param {Array<object>} opts.lines validated rows (catalog row + quantity + price)
 * @returns {object} body ready for POST /api/orders
 */
function buildOrderBody({ customer, address, lines }) {
  const items = lines.map((l) => ({
    productId: l.productId,
    subProductId: l.subProductId,
    sizeId: l.sizeId,
    quantity: l.quantity,
    // Server recomputes unit price from Size + SubProduct + Tenant; this is a
    // fallback for lines the pricing pipeline cannot price (no Size).
    price: Number(l.price) || 0,
  }));

  const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
  const shipping = quoteShipping(address, subtotal);
  const total = subtotal + shipping.shippingFee;

  return {
    customer: {
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phoneNumber,
    },
    shipping: {
      address: address.address,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      country: address.country,
      // `lga` isn't in the validator but the controller reads it for the zone
      // lookup — the validator ignores unknown fields.
      lga: address.lga,
    },
    paymentMethod: 'cash_on_delivery',
    items,
    subtotal,
    total,
    shippingFee: shipping.shippingFee,
    shippingInfo: shipping.shippingInfo,
  };
}

/**
 * Place the order.
 * @param {ApiClient} customerApi   bound to the customer's JWT (so order.user is set,
 *                                  which the review endpoint requires later)
 * @returns {Promise<{ _id, orderNumber, status, totalAmount, subtotal, shippingFee }>}
 */
async function placeOrder(customerApi, { customer, address, lines }) {
  const body = buildOrderBody({ customer, address, lines });
  const res = await customerApi.post('/api/orders', body);
  const order = res?.data?.order;
  if (!order?._id) {
    throw new Error(`Order response is missing data.order._id — keys: ${Object.keys(res?.data || {}).join(',')}`);
  }
  return order;
}

/**
 * Walk a single order pending → delivered using an admin JWT.
 * Skips steps the order has already passed. Returns the final status.
 *
 * @param {ApiClient} adminApi
 * @param {string} orderId
 * @param {string} [startFrom]   current status if known, to skip earlier steps
 */
async function advanceOrderToDelivered(adminApi, orderId, startFrom = 'pending') {
  const chain = DELIVERY_STATUS_CHAIN.slice(
    // If startFrom is already in the chain, start from the next step.
    DELIVERY_STATUS_CHAIN.indexOf(startFrom) + 1,
  );
  // Handle the pending → confirmed step even when startFrom === 'pending'
  // (which is not in the chain).
  if (startFrom === 'pending' && chain[0] !== 'confirmed') chain.unshift('confirmed');

  let currentStatus = startFrom;
  for (const status of chain) {
    const res = await adminApi.put(`/api/orders/${orderId}/status`, { status });
    currentStatus = res?.data?.order?.status || status;
  }
  return currentStatus;
}

/**
 * Mark a COD order as paid (money collected on delivery).
 * Best-effort — leaving it `pending` doesn't block the review flow.
 */
async function markOrderPaid(adminApi, orderId) {
  try {
    await adminApi.put(`/api/orders/${orderId}/payment`, {
      action: 'mark_paid',
      notes: 'COD collected on delivery (seeded)',
    });
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  DELIVERY_STATUS_CHAIN,
  buildOrderBody,
  placeOrder,
  advanceOrderToDelivered,
  markOrderPaid,
};
