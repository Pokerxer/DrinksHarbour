"use strict";
// Recorded payout holds (workstream P) — the only clawback/netting lever the
// mechanism can represent. A recorded hold permanently reduces the child's
// statement-linked transferable receivable via the balance guard's
// conservation predicate. Holds are records, never executed money movement.
// Recording is super_admin-only, audited, once-only per idempotency key and
// requires BOTH the recorded payout policy (hold regime) and a reconciled
// settlement statement — otherwise it refuses with the recorded payout
// posture (zero writes).
const crypto = require("node:crypto"),
  mongoose = require("mongoose");
const { ConflictError, NotFoundError, ValidationError } = require("../../../utils/errors");
const Hold = require("../../../models/MerchantPayoutHold");
const balance = require("./balance");
const statementLink = require("./statementLink");
const policyAuthority = require("./policy");
const Child = require("../../../models/MerchantOrder");

const PAYOUT_REASON = "No payout execution exists; payout policy requires review.";

const holdKey = (childId, idempotencyKey) =>
  crypto
    .createHash("sha256")
    .update(`merchant-payout-hold:${childId}:${idempotencyKey}`)
    .digest("hex");

function present(row, status) {
  return {
    status,
    hold: (({ _id, child, amountMinor, currency, reason, policyVersion, createdAt }) => ({
      _id,
      child,
      amountMinor,
      currency,
      reason,
      policyVersion,
      createdAt,
    }))(row),
  };
}

async function run(command, actor, session) {
  const policy = await policyAuthority.active({ session });
  if (!policy) throw new ConflictError(PAYOUT_REASON);
  const childId = String(command.childId);
  const row = await Child.findOne({ _id: childId }).session(session).lean();
  if (!row) throw new NotFoundError("Merchant order not found");
  const base = await statementLink.transferableBase(childId, actor, policy);
  const key = holdKey(childId, command.idempotencyKey);
  const prior = await Hold.findById(key).session(session).lean();
  if (prior) return present(prior, "already_recorded");

  // One transaction: the once-only hold anchor FIRST (its unique _id is the
  // idempotency claim), then the guard's conditional conservation advance —
  // a refused advance aborts the whole write set (zero writes).
  const created = (
    await Hold.create(
      [
        {
          _id: key,
          child: childId,
          order: row.order,
          tenant: row.tenant,
          currency: base.currency,
          amountMinor: command.amountMinor,
          reason: command.reason,
          policyId: policy._id,
          policyVersion: policy.version,
          recordedBy: actor._id,
        },
      ],
      { session },
    )
  )[0];
  const guard = await balance.advance(
    "hold",
    childId,
    command.amountMinor,
    base.standingNetMinor,
    session,
  );
  await require("../../../models/AuditLog").create(
    [
      {
        actorUserId: actor._id,
        actorRole: actor.role,
        action: "MERCHANT_PAYOUT_HOLD_RECORD",
        actionCategory: "create",
        targetType: "MerchantPayoutHold",
        targetTenantId: row.tenant,
        justification: command.reason,
        changes: {
          after: {
            holdId: created._id,
            child: childId,
            amountMinor: command.amountMinor,
            heldMinorAfter: guard.heldMinor,
          },
        },
      },
    ],
    { session },
  );
  return present(created, "recorded");
}

async function recordHold(command, actor, { session } = {}) {
  require("../refundAuthority").platform(actor);
  if (
    typeof command?.idempotencyKey !== "string" ||
    command.idempotencyKey.length < 1 ||
    command.idempotencyKey.length > 128
  )
    throw new ValidationError("Idempotency-Key is required for a recorded payout hold");
  if (typeof command?.reason !== "string" || command.reason.trim().length === 0)
    throw new ValidationError("A recorded payout hold requires a recorded reason");
  if (typeof command?.childId !== "string" || command.childId.length < 1)
    throw new NotFoundError("Merchant order not found");
  if (
    !Number.isSafeInteger(command?.amountMinor) ||
    command.amountMinor < 1
  )
    throw new ValidationError(
      "Recorded payout hold amount must be a positive integer minor amount",
    );
  if (session) return run(command, actor, session);
  const own = await mongoose.startSession();
  try {
    let result;
    try {
      await own.withTransaction(async () => {
        result = await run(command, actor, own);
      });
    } catch (error) {
      // A parallel request may have won the idempotent hold anchor; replay
      // once so concurrent duplicates both resolve (one recorded, one
      // already_recorded).
      if (error.code === 11000)
        return run({ ...command }, actor, null).then((replay) => replay);
      throw error;
    }
    return result;
  } finally {
    await own.endSession();
  }
}

module.exports = { recordHold };
