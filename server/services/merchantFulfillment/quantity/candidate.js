"use strict";
const { hash, id } = require("../allocation");
function initialize(order) {
  if (
    process.env.MERCHANT_FULFILLMENT_ENABLED !== "true" ||
    process.env.MERCHANT_QUANTITY_FULFILLMENT_ENABLED !== "true" ||
    !order.isNew ||
    order.paymentStatus !== "paid" ||
    ["cash", "cash_on_delivery"].includes(order.paymentMethod) ||
    order.onlineStockVersion !== 1 ||
    order.integrationCheckout ||
    order.source === "pos" ||
    order.venueIdentityVersion === 1 ||
    order.tableServiceBooking ||
    order.settlementOwner !== "platform" ||
    !order.items.length ||
    order.items.some((line) => !line.warehouse)
  )
    return 1;
  for (const [index, line] of order.items.entries())
    line.fulfillmentLineId = hash(id(order._id) + ":line:" + index).slice(
      0,
      24,
    );
  order.merchantFulfillmentVersion = 2;
  return 2;
}
module.exports = { initialize };
