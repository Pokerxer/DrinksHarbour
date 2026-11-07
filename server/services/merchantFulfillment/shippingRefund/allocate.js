"use strict";
// Shipping-refund allocation COMMAND (workstream S2). Fails closed with the
// verbatim refundReadiness wording unless BOTH the default-off execution flag
// is set AND an immutable, versioned shipping-refund policy is recorded (the
// mechanism, not the policy — production databases contain zero policy
// records). The command binds the child's immutable shippingMinor, re-derives
// it from the parent via the merchandise-weighted-v1 policy, reuses the exact
// refundAuthority pattern for the single allocated original receipt identity
// (read-only import), and records the policy's bearer outcome and journal
// treatment as data. It never executes carrier recovery, merchant billing,
// provider transfers, journal postings or MerchantDispatchBudget changes.
// Once-only: the idempotency key IS the allocation _id, so concurrent
// duplicates on a real Promise.all resolve to exactly one allocation, and a
// per-child conditional remainder guard conserves
// shippingRefunded + amount ≤ child.shippingMinor exactly.
const crypto = require("node:crypto"),
  mongoose = require("mongoose");
const { ConflictError, ValidationError, NotFoundError } = require("../../../utils/errors");
const Child = require("../../../models/MerchantOrder");
const Policy = require("../../../models/MerchantShippingRefundPolicy");
const Allocation = require("../../../models/MerchantShippingRefundAllocation");
const Remainder = require("../../../models/MerchantShippingRefundRemainder");
const access = require("../access");
const authority = require("../refundAuthority");
const { allocate, hash, id } = require("../allocation");
const policyAuthority = require("./policy");

const FLAG = "MERCHANT_SHIPPING_REFUND_ALLOCATIONS_ENABLED";
// Verbatim refundReadiness shipping wording — this mechanism reuses it
// verbatim when no recorded policy governs.
const POLICY_REVIEW =
  "Original shipping refund and carrier-charge allocation policy requires review.";

function commandKey(childId, idempotencyKey) {
  return crypto
    .createHash("sha256")
    .update(`merchant-shipping-refund:${id(childId)}:${idempotencyKey}`)
    .digest("hex");
}

// Result projection rebuilt from the allocation record alone (fresh and replay).
function present(record, status) {
  return {
    status,
    allocationId: record._id,
    merchantOrder: record.merchantOrder,
    order: record.order,
    tenant: record.tenant,
    currency: record.currency,
    amountMinor: record.amountMinor,
    shippingMinor: record.shippingMinor,
    remainderMinorAfter: record.remainderMinorAfter,
    receipt: {
      id: record.receipt,
      provider: record.receiptProvider,
      account: record.receiptAccount,
      reference: record.receiptReference,
      ...(record.receiptTransactionId
        ? { transactionId: record.receiptTransactionId }
        : {}),
    },
    customer: record.customer,
    eligibilityCondition: record.eligibilityCondition,
    bearer: {
      outcome: record.bearerOutcome,
      state: "recorded_not_executed",
      reason:
        "The recorded bearer outcome is bound to the allocation as data; carrier recovery and merchant billing are never executed by this mechanism.",
    },
    journal: {
      treatment: record.journalTreatment,
      state:
        record.journalTreatment === "reverse_posted_4100_shipping_income"
          ? "recorded_not_executed"
          : "not_applicable",
      reason:
        record.journalTreatment === "reverse_posted_4100_shipping_income"
          ? "The recorded reversal of the original 4100 shipping-income journal is recorded as data; the mechanism posts no journal. Executing the reversal requires a separately reviewed settlement step."
          : "The recorded treatment posts no shipping-income journal going forward; marketplace orders post none today.",
    },
    policy: { id: record.policyId, version: record.policyVersion },
  };
}

// Exact remainder advance: conditional update (conservation evaluated
// server-side), then insert-when-absent with an E11000 retry. Concurrent
// commands with different idempotency keys can never over-allocate the
// immutable child shippingMinor.
async function advanceRemainder(child, amountMinor, session) {
  const filter = {
    _id: id(child._id),
    allocatedMinor: { $lte: child.shippingMinor - amountMinor },
  };
  const update = { $inc: { allocatedMinor: amountMinor } };
  let row = await Remainder.findOneAndUpdate(filter, update, { new: true, session });
  if (row) return row;
  if (await Remainder.exists({ _id: id(child._id) }).session(session))
    throw new ConflictError(
      "Shipping refund allocation exceeds the remaining refundable shipping charge of the original merchant order.",
    );
  try {
    return await Remainder.create(
      [{ _id: id(child._id), shippingMinor: child.shippingMinor, allocatedMinor: amountMinor }],
      { session },
    ).then((rows) => rows[0]);
  } catch (error) {
    if (error.code !== 11000) throw error;
    row = await Remainder.findOneAndUpdate(filter, update, { new: true, session });
    if (!row)
      throw new ConflictError(
        "Shipping refund allocation exceeds the remaining refundable shipping charge of the original merchant order.",
      );
    return row;
  }
}

async function run(childId, command, actor, session) {
  const child = access.assertOwned(
    await Child.findOne({ _id: childId, ...access.scope(actor, true) })
      .session(session)
      .lean(),
    actor,
    true,
  );
  const { parent, receipt } = await authority.original(child, session);
  // Re-derive the immutable child shippingMinor from the parent through the
  // original merchandise-weighted-v1 allocation (the external-provider
  // authority's parent re-verification, applied to shipping).
  const expected = allocate(parent).find((row) => row._id === childId);
  if (!expected || expected.shippingMinor !== child.shippingMinor)
    throw new ConflictError("Original accepted shipping charge allocation does not reconcile");
  const policy = await policyAuthority.active({ session });
  if (!policy) throw new ConflictError(POLICY_REVIEW);
  if (!policy.eligibilityConditions.includes(command.eligibilityCondition))
    throw new ConflictError(
      "Recorded shipping refund policy does not list the requested eligibility condition; review required.",
    );
  if (policy.journalTreatment === "reverse_posted_4100_shipping_income") {
    const posted = await require("../../../models/JournalEntry").exists({
      tenant: child.tenant,
      refDoc: parent._id,
      status: "posted",
      lines: { $elemMatch: { account: "4100", credit: { $gt: 0 } } },
    }).session(session);
    if (!posted)
      throw new ConflictError(
        "Recorded policy requires reversing the original order's posted 4100 shipping-income journal; no such posted journal exists and a journal is never invented.",
      );
  }
  const key = commandKey(childId, command.idempotencyKey);
  const prior = await Allocation.findById(key).session(session).lean();
  if (prior) return present(prior, "already_allocated");
  const remainder = await Remainder.findById(id(child._id)).session(session).lean();
  if (remainder && remainder.shippingMinor !== child.shippingMinor)
    throw new ConflictError("Original shipping charge remainder requires reconciliation");
  const allocated = remainder?.allocatedMinor ?? 0;
  if (command.amountMinor > child.shippingMinor - allocated)
    throw new ConflictError(
      "Shipping refund allocation exceeds the remaining refundable shipping charge of the original merchant order.",
    );
  const [record] = await Allocation.create(
    [
      {
        _id: key,
        merchantOrder: child._id,
        order: parent._id,
        tenant: child.tenant,
        currency: parent.currency,
        amountMinor: command.amountMinor,
        shippingMinor: child.shippingMinor,
        remainderMinorAfter: child.shippingMinor - allocated - command.amountMinor,
        receipt: receipt._id,
        receiptProvider: receipt.provider,
        receiptAccount: receipt.account,
        receiptReference: receipt.reference,
        ...(receipt.provider === "paystack"
          ? { receiptTransactionId: String(receipt.receipt.transactionId) }
          : {}),
        customer: parent.user,
        eligibilityCondition: command.eligibilityCondition,
        bearerOutcome: policy.bearerOutcome,
        journalTreatment: policy.journalTreatment,
        policyId: policy._id,
        policyVersion: policy.version,
        state: "allocated",
        allocatedBy: actor._id,
      },
    ],
    { session },
  );
  const advanced = await advanceRemainder(child, command.amountMinor, session);
  if (advanced.allocatedMinor !== allocated + command.amountMinor)
    throw new ConflictError(
      "Shipping refund remainder advanced concurrently; allocation requires replay.",
    );
  await require("../../../models/AuditLog").create(
    [
      {
        actorUserId: actor._id,
        actorRole: actor.role,
        action: "MERCHANT_SHIPPING_REFUND_ALLOCATION_RECORD",
        actionCategory: "create",
        targetType: "MerchantOrder",
        targetId: parent._id,
        targetTenantId: child.tenant,
        justification: `Shipping refund allocated under policy version ${policy.version}`,
        changes: {
          after: {
            allocationId: key,
            merchantOrder: String(child._id),
            amountMinor: command.amountMinor,
            eligibilityCondition: command.eligibilityCondition,
            bearerOutcome: policy.bearerOutcome,
            journalTreatment: policy.journalTreatment,
          },
        },
      },
    ],
    { session },
  );
  return present(record, "allocated");
}

async function allocateShippingRefund(childId, command, actor, { session } = {}) {
  authority.platform(actor);
  if (!Number.isSafeInteger(command?.amountMinor) || command.amountMinor < 1)
    throw new ValidationError("Positive shipping refund minor amount required");
  if (
    typeof command.idempotencyKey !== "string" ||
    command.idempotencyKey.length < 1 ||
    command.idempotencyKey.length > 128
  )
    throw new ValidationError("Idempotency key required for shipping refund allocation");
  if (!Policy.CONDITIONS.includes(command.eligibilityCondition))
    throw new ValidationError(
      "Recorded eligibility condition required for shipping refund allocation",
    );
  if (process.env[FLAG] !== "true") throw new ConflictError(POLICY_REVIEW);
  if (session) return run(childId, command, actor, session);
  const own = await mongoose.startSession();
  try {
    let result;
    try {
      await own.withTransaction(async () => {
        result = await run(childId, command, actor, own);
      });
    } catch (error) {
      // A parallel request may have won the unique idempotency anchor.
      if (error.code === 11000) {
        const winner = await Allocation.findById(commandKey(childId, command.idempotencyKey))
          .lean();
        if (winner) return present(winner, "already_allocated");
      }
      throw error;
    }
    return result;
  } finally {
    await own.endSession();
  }
}

async function list(childId, actor) {
  access.scope(actor);
  access.assertOwned(
    await Child.findOne({ _id: childId, ...access.scope(actor) }).lean(),
    actor,
  );
  return (
    await Allocation.find({ merchantOrder: childId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
  ).map((row) => present(row, "allocated"));
}

module.exports = { allocateShippingRefund, list };
