"use strict";
const mongoose = require("mongoose"),
  Child = require("../../../models/MerchantOrder"),
  Group = require("../../../models/MerchantOrderSet"),
  Order = require("../../../models/Order"),
  Operation = require("../../../models/MerchantFulfillmentOperation");
const { ConflictError, ValidationError } = require("../../../utils/errors"),
  { hash } = require("../allocation"),
  access = require("../access");
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
async function run(
  childId,
  input,
  actor,
  operation,
  execute,
  { session: provided } = {},
) {
  access.scope(actor, true);
  if (
    !Number.isSafeInteger(input?.expectedVersion) ||
    typeof input?.idempotencyKey !== "string" ||
    !input.idempotencyKey ||
    input.idempotencyKey.length > 128
  )
    throw new ValidationError(
      "Quantity operation requires expectedVersion and idempotencyKey",
    );
  if (provided && !provided.inTransaction())
    throw new ConflictError("An owning transaction is required");
  const operationId = hash(childId + ":" + input.idempotencyKey),
    fingerprint = hash(JSON.stringify(canonical({ operation, ...input }))),
    session = provided || (await mongoose.startSession());
  let result;
  const work = async () => {
    const child = access.assertOwned(
      await Child.findOne({
        _id: childId,
        ...access.scope(actor, true),
      }).session(session),
      actor,
      true,
    );
    if (child.fulfillmentVersion !== 2)
      throw new ConflictError(
        "Quantity commands require version2 line reservations",
      );
    const prior = await Operation.findById(operationId).session(session).lean();
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        throw new ConflictError(
          "Operation key already used for another quantity action",
        );
      result = prior.result;
      return;
    }
    if (child.version !== input.expectedVersion)
      throw new ConflictError("Merchant quantities changed; reload");
    const parent = await Order.findOne({
        _id: child.order,
        merchantFulfillmentVersion: 2,
      }).session(session),
      group = await Group.findById(child.order).session(session);
    if (!parent || !group || !group.children.includes(childId))
      throw new ConflictError(
        "Quantity parent allocation authority unavailable",
      );
    result = await execute({ child, parent, group, operationId, session });
    child.state = require("./state").derive(child);
    child.version++;
    await child.save({ session });
    group.version++;
    await group.save({ session });
    const rows = await Child.find({ order: parent._id })
      .session(session)
      .lean();
    await Order.updateOne(
      { _id: parent._id, merchantFulfillmentVersion: 2 },
      { $set: { status: require("./state").parentState(rows) } },
      { session },
    );
    await access.audit(
      child,
      actor,
      `MERCHANT_QUANTITY_${operation.toUpperCase()}`,
      { session },
    );
    await Operation.create(
      [
        {
          _id: operationId,
          actor: actor._id,
          action: operation,
          merchantOrder: childId,
          tenant: child.tenant,
          fingerprint,
          result,
        },
      ],
      { session },
    );
  };
  try {
    if (provided) await work();
    else await session.withTransaction(work);
    return result;
  } finally {
    if (!provided) await session.endSession();
  }
}
module.exports = { run };
