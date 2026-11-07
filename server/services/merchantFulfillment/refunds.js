"use strict";
const mongoose = require("mongoose"),
  Refund = require("../../models/MerchantRefundAllocation"),
  Child = require("../../models/MerchantOrder"),
  Group = require("../../models/MerchantOrderSet");
const {
    ConflictError,
    ValidationError,
    NotFoundError,
  } = require("../../utils/errors"),
  { hash } = require("./allocation"),
  access = require("./access"),
  authority = require("./refundAuthority");
const dto = require("./refundView");
const settle = require("./refundSettlement");
const providers = require("./refundProviders");
async function list(childId, actor) {
  access.assertOwned(
    await Child.findOne({ _id: childId, ...access.scope(actor) }).lean(),
    actor,
  );
  return (
    await Refund.find({ merchantOrder: childId, ...access.scope(actor) })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
  ).map(dto);
}
async function get(refundId, actor) {
  access.scope(actor);
  if (!mongoose.isValidObjectId(refundId))
    throw new NotFoundError("Refund allocation not found");
  const row = await Refund.findOne({
    _id: refundId,
    ...access.scope(actor),
  }).lean();
  if (!row) throw new NotFoundError("Refund allocation not found");
  return dto(row);
}
async function request(childId, input, actor) {
  access.scope(actor, true);
  if (
    Object.keys(input || {}).some(
      (key) => !["amountMinor", "idempotencyKey", "reason"].includes(key),
    ) ||
    !Number.isSafeInteger(input.amountMinor) ||
    input.amountMinor < 1 ||
    typeof input.idempotencyKey !== "string" ||
    !input.idempotencyKey ||
    input.idempotencyKey.length > 128 ||
    typeof input.reason !== "string" ||
    input.reason.trim().length < 5 ||
    input.reason.length > 500
  )
    throw new ValidationError(
      "Positive merchandise minor amount, reason and idempotency key required",
    );
  const refundId = new mongoose.Types.ObjectId(
      hash(childId + ":refund:" + input.idempotencyKey).slice(0, 24),
    ),
    fingerprint = hash(
      JSON.stringify({
        amountMinor: input.amountMinor,
        reason: input.reason.trim(),
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
      const prior = await Refund.findById(refundId).session(session);
      if (child.fulfillmentVersion === 2)
        throw new ConflictError(
          "Quantity merchant refunds require exact original unit ranges",
        );
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new ConflictError(
            "Refund key already used for another allocation",
          );
        result = dto(prior);
        return;
      }
      const { parent, receipt } = await authority.original(child, session),
        group = await Group.findById(child.order).session(session);
      if (
        !group ||
        !group.children.includes(childId) ||
        child.refundReservedMinor + child.refundedMinor + input.amountMinor >
          child.merchandiseMinor ||
        group.refundReservedMinor + group.refundedMinor + input.amountMinor >
          group.totalMinor
      )
        throw new ConflictError(
          "Refund exceeds remaining merchant or parent budget",
        );
      const priorMinor = child.refundReservedMinor + child.refundedMinor;
      const proportional = (amount) =>
        Number(
          (BigInt(amount) * BigInt(child.commissionMinor)) /
            BigInt(child.merchandiseMinor),
        );
      const commissionMinor =
        proportional(priorMinor + input.amountMinor) - proportional(priorMinor);
      const [row] = await Refund.create(
        [
          {
            _id: refundId,
            merchantOrder: childId,
            order: child.order,
            tenant: child.tenant,
            amountMinor: input.amountMinor,
            commissionMinor,
            tenantShareMinor: input.amountMinor - commissionMinor,
            currency: parent.currency,
            provider: receipt.provider,
            providerTransactionId:
              receipt.provider === "paystack"
                ? String(receipt.receipt.transactionId)
                : undefined,
            account: "platform",
            providerReference: receipt.reference,
            receipt: receipt._id,
            customer: parent.user,
            fingerprint,
            reason: input.reason.trim(),
            requestedBy: actor._id,
          },
        ],
        { session },
      );
      await access.audit(child, actor, "MERCHANT_REFUND_REQUEST", { session });
      child.refundReservedMinor += input.amountMinor;
      await child.save({ session });
      group.refundReservedMinor += input.amountMinor;
      group.version++;
      await group.save({ session });
      result = dto(row);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
async function execute(refundId, actor) {
  authority.platform(actor);
  if (!mongoose.isValidObjectId(refundId))
    throw new NotFoundError("Refund allocation not found");
  if (process.env.MERCHANT_REFUNDS_ENABLED !== "true")
    throw new ConflictError("Merchant refund execution is disabled");
  const session = await mongoose.startSession();
  let pending;
  try {
    await session.withTransaction(async () => {
      const row = await Refund.findById(refundId).session(session);
      if (!row) throw new NotFoundError("Refund allocation not found");
      if (row.state === "succeeded") {
        pending = row;
        return;
      }
      if (row.state !== "reserved")
        throw new ConflictError(
          "Refund outcome requires reconciliation; do not resubmit",
        );
      if (
        row.provider === "paystack" &&
        process.env.MERCHANT_PAYSTACK_REFUNDS_ENABLED !== "true"
      )
        throw new ConflictError(
          "Original Paystack refund capability requires review; execution disabled",
        );
      const child = await Child.findById(row.merchantOrder).session(session);
      authority.reserved(row, await authority.original(child, session));
      const group = await Group.findById(row.order).session(session);
      if (
        !group ||
        !group.children.includes(row.merchantOrder) ||
        child.refundReservedMinor < row.amountMinor ||
        group.refundReservedMinor < row.amountMinor
      )
        throw new ConflictError("Original reserved refund budget changed");
      await access.audit(row, actor, "MERCHANT_REFUND_SUBMIT", { session });
      row.state = "submitting";
      row.executedBy = actor._id;
      await row.save({ session });
      pending = row;
    });
  } finally {
    await session.endSession();
  }
  if (pending.state === "succeeded") return dto(pending);
  try {
    let result = await require("./refundTransport").submit(pending);
    authority.evidence(pending, result);
    if (pending.provider === "paystack") {
      const providerRefundId = String(result.id);
      const saved = await Refund.updateOne(
        {
          _id: pending._id,
          state: "submitting",
          providerRefundId: { $exists: false },
        },
        { $set: { providerRefundId } },
      );
      if (saved.modifiedCount !== 1)
        throw new ConflictError(
          "Provider refund identity requires reconciliation",
        );
      pending.providerRefundId = providerRefundId;
      result = await require("./refundTransport").fetch(
        providerRefundId,
        pending,
      );
      authority.evidence(pending, result);
    }
    if (!providers.succeeded(pending, result))
      throw new ConflictError("Provider refund requires reconciliation");
    return await settle(refundId, result, actor);
  } catch (error) {
    await Refund.updateOne(
      { _id: refundId, state: { $ne: "succeeded" } },
      {
        $set: {
          state: "uncertain",
          issue:
            "Provider or ledger outcome requires reconciliation; do not resubmit",
        },
      },
    );
    throw error;
  }
}
async function reconcile(refundId, actor, providerRefundId) {
  authority.platform(actor);
  if (!mongoose.isValidObjectId(refundId))
    throw new NotFoundError("Refund allocation not found");
  const row = await Refund.findById(refundId).lean();
  if (!row) throw new NotFoundError("Refund allocation not found");
  if (row.state === "succeeded") return dto(row);
  if (
    !["submitting", "uncertain"].includes(row.state) ||
    !providers.validRefundId(row.provider, providerRefundId)
  )
    throw new ConflictError("Known original provider refund evidence required");
  const result = await require("./refundTransport").fetch(
    providerRefundId,
    row,
  );
  if (String(result.id) !== providerRefundId)
    throw new ConflictError("Provider refund evidence identity differs");
  return settle(refundId, result, actor);
}
module.exports = { request, get, list, execute, reconcile };
