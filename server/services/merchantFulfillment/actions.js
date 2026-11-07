"use strict";
const mongoose = require("mongoose");
const Child = require("../../models/MerchantOrder"),
  Set = require("../../models/MerchantOrderSet"),
  Operation = require("../../models/MerchantFulfillmentOperation"),
  Order = require("../../models/Order");
const { ConflictError, ValidationError } = require("../../utils/errors");
const { hash, id } = require("./allocation"),
  access = require("./access");
const transitions = {
  accept: ["pending", "accepted"],
  pick: ["accepted", "picking"],
  ship: ["accepted", "shipped"],
  deliver: ["shipped", "delivered"],
  cancel: ["pending", "cancelled"],
};
function aggregate(rows) {
  const active = rows.filter((row) => row.state !== "cancelled");
  if (!active.length) return "cancelled";
  if (active.every((row) => row.state === "delivered")) return "delivered";
  if (active.every((row) => ["shipped", "delivered"].includes(row.state)))
    return "shipped";
  if (active.some((row) => ["shipped", "delivered"].includes(row.state)))
    return "partially_shipped";
  if (active.some((row) => ["accepted", "picking"].includes(row.state)))
    return "processing";
  return "confirmed";
}
async function act(childId, input, actor) {
  access.scope(actor, true);
  if (
    Object.keys(input || {}).some(
      (key) => !["action", "expectedVersion", "idempotencyKey"].includes(key),
    ) ||
    !transitions[input?.action] ||
    !Number.isSafeInteger(input.expectedVersion) ||
    typeof input.idempotencyKey !== "string" ||
    !input.idempotencyKey ||
    input.idempotencyKey.length > 128
  )
    throw new ValidationError(
      "Valid action, expectedVersion and idempotency key required",
    );
  const identity = hash(childId + ":" + input.idempotencyKey),
    fingerprint = hash(
      JSON.stringify({
        action: input.action,
        expectedVersion: input.expectedVersion,
      }),
    );
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const child = access.assertOwned(
        await Child.findOne({
          _id: childId,
          ...access.scope(actor, true),
        }).session(session),
        actor,
        true,
      );
      if (child.fulfillmentVersion === 2 && ['ship', 'deliver', 'cancel'].includes(input.action)) throw new ConflictError('Use version2 exact quantity commands');
      const prior = await Operation.findById(identity).session(session).lean();
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new ConflictError(
            "Merchant operation key already used for another action",
          );
        result = prior.result;
        return;
      }
      if (child.version !== input.expectedVersion)
        throw new ConflictError("Merchant order changed; reload");
      const parent = await Order.findOne({
        _id: child.order,
        merchantFulfillmentVersion: { $in: [1, 2] },
      }).session(session);
      if (!parent)
        throw new ConflictError("Merchant parent authority unavailable");
      const group = await Set.findById(child.order).session(session);
      if (!group || !group.children.includes(childId))
        throw new ConflictError("Merchant allocation ownership unavailable");
      const [from, to] = transitions[input.action];
      const valid =
        input.action === "cancel"
          ? ["pending", "accepted", "picking"].includes(child.state)
          : input.action === "ship"
            ? ["accepted", "picking"].includes(child.state)
            : child.state === from;
      if (!valid) throw new ConflictError("Merchant transition unavailable");
      if (
        input.action === "ship" &&
        (child.refundReservedMinor > 0 || child.refundedMinor > 0)
      )
        throw new ConflictError(
          "Refund allocation requires review before shipping",
        );
      if (
        ["ship", "deliver"].includes(input.action) &&
        !["paid", "partially_refunded"].includes(parent.paymentStatus) &&
        parent.paymentMethod !== "cash_on_delivery"
      )
        throw new ConflictError("Verified payment required before shipment");
      if (
        input.action === "cancel" &&
        parent.paymentStatus !== "pending" &&
        child.refundedMinor < child.totalMinor
      )
        throw new ConflictError(
          "Paid merchant allocation requires full verified refund before cancellation",
        );
      if (["ship", "cancel"].includes(input.action)) {
        const lineIds = new global.Set(
            child.lines.map((line) => id(line.line)),
          ),
          lines = parent.items.filter((line) =>
            lineIds.has(id(line.fulfillmentLineId)),
          );
        if (
          lines.length !== child.lines.length ||
          lines.some(
            (line) =>
              id(line.tenant) !== id(child.tenant) ||
              id(line.warehouse) !== id(child.location),
          )
        )
          throw new ConflictError("Merchant line ownership needs review");
        if (input.action === "cancel")
          await require("./goodsCancellation").cancelGoodsAccounting({ parent, child, actor, session });
        await require("../storefrontLocationStock").transition(
          { _id: parent._id, items: lines },
          input.action === "ship" ? "consume" : "release",
          session,
          actor._id,
          { tenant: child.tenant, warehouse: child.location },
        );
        // Existing stock command annotates the actual parent line documents with batch snapshots.
        parent.$locals.deferAccounting = true;
        await parent.save({ session });
      }
      await access.audit(
        child,
        actor,
        `MERCHANT_ORDER_${input.action.toUpperCase()}`,
        { session },
      );
      child.state = to;
      child.version++;
      const stamp = {
        accept: "acceptedAt",
        ship: "shippedAt",
        deliver: "deliveredAt",
        cancel: "cancelledAt",
      }[input.action];
      if (stamp) child[stamp] = new Date();
      await child.save({ session });
      const rows = await Child.find({ order: parent._id })
        .session(session)
        .lean();
      await Order.updateOne(
        { _id: parent._id, merchantFulfillmentVersion: parent.merchantFulfillmentVersion },
        { $set: { status: parent.merchantFulfillmentVersion === 2 ? require("./quantity/state").parentState(rows) : aggregate(rows) } },
        { session },
      );
      group.version++;
      await group.save({ session });
      result = access.dto(child);
      await Operation.create(
        [
          {
            _id: identity,
            actor: actor._id,
            action: input.action,
            merchantOrder: childId,
            tenant: child.tenant,
            fingerprint,
            result,
          },
        ],
        { session },
      );
    });
    return result;
  } finally {
    await session.endSession();
  }
}
module.exports = { act, aggregate };
