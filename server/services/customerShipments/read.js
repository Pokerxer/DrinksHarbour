"use strict";
const mongoose = require("mongoose"),
  { NotFoundError, ValidationError } = require("../../utils/errors");
const deny = () => {
  throw new NotFoundError("Order not found");
};
async function read(orderId, actor, query = {}) {
  if (Object.keys(query).length)
    throw new ValidationError("Shipment read accepts no query parameters");
  if (
    actor?.role !== "customer" ||
    !mongoose.isValidObjectId(orderId) ||
    !actor?._id
  )
    deny();
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(
      () => readSnapshot(orderId, actor, session),
      { readConcern: { level: "snapshot" } },
    );
  } finally {
    await session.endSession();
  }
}
async function readSnapshot(orderId, actor, session) {
  const sequential = async (queries) => {
    const rows = [];
    for (const query of queries) rows.push(await query.session(session));
    return rows;
  };
  const parent = await require("../../models/Order")
    .findOne({ _id: orderId, user: actor._id })
    .select(
      "_id user merchantFulfillmentVersion salesChannel channelSnapshot.kind channelSnapshot.apiKey channelSnapshot.storefrontChannel integrationCheckout items.fulfillmentLineId items.tenant items.warehouse items.product items.subproduct items.size items.quantity items.productName",
    )
    .session(session)
    .lean();
  if (
    !parent ||
    parent.integrationCheckout ||
    (!parent.channelSnapshot &&
      parent.salesChannel &&
      parent.salesChannel !== "DRINKSHARBOUR_NG") ||
    (parent.channelSnapshot && parent.channelSnapshot.kind !== "marketplace") ||
    parent.channelSnapshot?.apiKey ||
    parent.channelSnapshot?.storefrontChannel
  )
    deny();
  if (![1, 2].includes(parent.merchantFulfillmentVersion))
    return { orderId: String(parent._id), managed: false, groups: [] };
  const children = await require("../../models/MerchantOrder")
    .find({ order: parent._id })
    .select(
      "_id order tenant location currency lines.line lines.product lines.subproduct lines.size lines.quantity state fulfillmentVersion quantityProgress.line quantityProgress.shipped quantityProgress.delivered quantityProgress.cancelled",
    )
    .sort({ _id: 1 })
    .session(session)
    .lean();
  const ids = children.map((child) => child._id),
    scope = { order: parent._id, merchantOrder: { $in: ids } };
  const [allocations, bookings, pickups, refunds, tenants, products, carriers] =
    await sequential([
      require("../../models/MerchantShipmentAllocation")
        .find(scope)
        .select(
          "_id merchantOrder order tenant location lines.line lines.quantity state dispatchBooking",
        )
        .sort({ _id: 1 })
        .lean(),
      require("../../models/MerchantDispatchBooking")
        .find(scope)
        .select(
          "_id merchantOrder order tenant location state shipmentAllocation lines.line lines.quantity",
        )
        .sort({ _id: 1 })
        .lean(),
      require("../../models/MerchantShipment")
        .find({ ...scope, customer: parent.user })
        .select("_id merchantOrder order tenant location customer provider")
        .lean(),
      require("../../models/MerchantRefundAllocation")
        .find({ ...scope, customer: parent.user })
        .select(
          "merchantOrder order tenant customer state amountMinor currency",
        )
        .lean(),
      require("../../models/Tenant")
        .find({ _id: { $in: children.map((child) => child.tenant) } })
        .select("name")
        .lean(),
      require("../../models/Product")
        .find({
          _id: {
            $in: children
              .flatMap((child) => child.lines.map((line) => line.product))
              .filter(Boolean),
          },
        })
        .select("name")
        .lean(),
      require("../../models/MerchantCarrierBooking")
        .find(scope)
        .select("_id merchantOrder order tenant location allocationId state providerStatus")
        .lean(),
    ]);
  const indexed = (rows) => new Map(rows.map((row) => [String(row._id), row]));
  return require("./projection").project({
    parent,
    children,
    allocations,
    bookings,
    pickups,
    refunds,
    tenants: indexed(tenants),
    products: indexed(products),
    carriers,
  });
}
module.exports = { read };
