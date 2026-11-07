"use strict";
// Versioned post-quarantine stock/COGS effects executor. A versioned command
// executes once-only against a recorded, immutable MerchantDispositionPolicy
// version AND an explicitly enabled execution flag (default off, test-only).
// Restock restores the exact original consumed unit/batch evidence (restock.js);
// write-off reverses the frozen goods cost basis through the once-only postCost
// journal precedent (writeOff.js). Without a recorded policy the endpoint stays
// byte-identically fail-closed: zero writes, verbatim unsupported reason.
const mongoose = require("mongoose"),
  access = require("../../merchantFulfillment/access"),
  { ConflictError, NotFoundError, ValidationError } = require("../../../utils/errors"),
  { hash } = require("../../deliveryProviders/localDispatch/quote"),
  { id } = require("../../merchantFulfillment/allocation"),
  { dispositionDTO, UNSUPPORTED_EFFECTS, effectsState } = require("./projection"),
  policyAuthority = require("./policy"),
  gates = require("./validate");
const Return = require("../../../models/MerchantDeliveryReturn");
const FLAG = "MERCHANT_RETURN_EFFECTS_ENABLED";
const VERBATIM = UNSUPPORTED_EFFECTS.reasons[0];
const ADAPTER =
  "Recorded return disposition policy declares a treatment adapter this mechanism does not support";
const SUPPORTED_RULES = {
  restockLocationRule: "original_location",
  cogsTreatment: "reverse_original_goods_cost",
};
function unsupported(version, extra = []) {
  return {
    effects: { supported: false, reasons: [VERBATIM, ...extra], returnVersion: version },
  };
}
function validateCommand(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !["expectedVersion", "idempotencyKey"].includes(key)) ||
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    typeof input.idempotencyKey !== "string" ||
    !input.idempotencyKey.trim() ||
    input.idempotencyKey.length > 128
  )
    throw new ValidationError("Current version and stable key required for return effects");
}
function assertUnconsumed(record, lineId, ranges) {
  const taken = new Set(
    (record.consumptions || [])
      .filter((row) => String(row.line) === lineId)
      .flatMap((row) => (row.ranges || []).map(gates.rangeKey)),
  );
  if (ranges.some((range) => taken.has(gates.rangeKey(range))))
    throw new ConflictError("Recorded units already carry a stock or COGS effect");
}
// Bind every decided range to its inspected condition through the recorded
// policy: the decision treatment must equal the recorded policy treatment for
// that condition. Retain-quarantine units carry no stock or COGS effect.
function buildPlan(record, policy) {
  const plan = { restock: [], write_off: [] };
  for (const decision of record.decisions || []) {
    const lineId = String(decision.line);
    const inspected = new Map(
      (record.inspections || [])
        .filter((item) => String(item.line) === lineId)
        .flatMap((item) =>
          (item.ranges || []).map((range) => [gates.rangeKey(range), item.condition]),
        ),
    );
    for (const range of decision.ranges) {
      const condition = inspected.get(gates.rangeKey(range));
      if (!condition)
        throw new ConflictError(
          "Treatment requires a prior exact-unit inspection of these recorded units",
        );
      if (policy.treatmentByCondition[condition] !== decision.treatment)
        throw new ConflictError(
          "Decision treatment differs from the recorded disposition policy for the inspected condition",
        );
      if (decision.treatment === "retain_quarantine") continue;
      assertUnconsumed(record, lineId, [range]);
      plan[decision.treatment].push({
        line: lineId,
        ranges: [{ start: range.start, quantity: range.quantity }],
      });
    }
  }
  return plan;
}
async function executeEffects(bookingId, input, actor) {
  access.scope(actor, true);
  validateCommand(input);
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const row = await require("../managedTrips").ownBooking(bookingId, actor, session);
      if (row.state !== "returned")
        throw new ConflictError(
          "Disposition requires the confirmed returned responsibility",
        );
      const record = await Return.findOne({
        _id: row.shipmentAllocation,
        tenant: row.tenant,
        booking: row._id,
        disposition: "quarantined",
      }).session(session);
      if (!record)
        throw new NotFoundError("Quarantined return not found for this booking");
      const fingerprint = hash(input),
        prior = (record.operations || []).find(
          (operation) => operation.key === input.idempotencyKey,
        );
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new ConflictError("Disposition key or payload differs");
        result = { effects: effectsState(record), return: dispositionDTO(record) };
        return;
      }
      // Prior-key ordering before the version check, same as every command.
      if (record.version !== input.expectedVersion)
        throw new ConflictError("Current quarantined return version required");
      if ((record.operations || []).length >= gates.OPERATION_LIMIT)
        throw new ConflictError("Disposition operation limit reached");
      const policy = await policyAuthority.activePolicy(record.tenant, session);
      if (!policy) {
        result = unsupported(record.version);
        return;
      }
      if (process.env[FLAG] !== "true") {
        result = unsupported(record.version);
        return;
      }
      if (
        Object.entries(SUPPORTED_RULES).some(([field, value]) => policy[field] !== value)
      ) {
        result = unsupported(record.version, [ADAPTER]);
        return;
      }
      const child = await require("../../../models/MerchantOrder").findOne({
        _id: record.merchantOrder,
        order: record.order,
        tenant: record.tenant,
        location: record.location,
        fulfillmentVersion: 2,
      }).session(session);
      const parent =
        child &&
        (await require("../../../models/Order").findById(record.order).session(session));
      if (!child || !parent)
        throw new ConflictError("Original merchant order requires reconciliation");
      const plan = buildPlan(record, policy);
      if (!plan.restock.length && !plan.write_off.length)
        throw new ConflictError(
          "Recorded disposition decisions required for effects execution",
        );
      const effectsRef = hash(`${id(record)}:effects:${input.idempotencyKey}`);
      const restocked = plan.restock.length
        ? await require("./restock").restock(
            record,
            child,
            parent,
            plan.restock,
            effectsRef,
            actor,
            session,
          )
        : [];
      const writtenOff = plan.write_off.length
        ? await require("./writeOff").writeOff(
            record,
            child,
            parent,
            plan.write_off,
            effectsRef,
            actor,
            session,
          )
        : [];
      for (const entry of [
        ...restocked.map((row) => ({ ...row, action: "restock" })),
        ...writtenOff.map((row) => ({ ...row, action: "write_off" })),
      ])
        record.consumptions.push({
          line: entry.line,
          ranges: entry.ranges,
          action: entry.action,
          effectsRef,
          policyVersion: policy.version,
          actor: actor._id,
          at: new Date(),
        });
      record.operations.push({
        key: input.idempotencyKey,
        fingerprint,
        kind: "effects",
        at: new Date(),
      });
      record.version++;
      await record.save({ session });
      await access.audit(row, actor, "RETURN_DISPOSITION_EFFECTS", { session });
      result = {
        effects: { supported: true, effectsRef, policyVersion: policy.version },
        return: dispositionDTO(record),
      };
    });
    return result;
  } finally {
    await session.endSession();
  }
}
module.exports = { executeEffects, unsupported };
