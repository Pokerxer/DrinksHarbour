"use strict";
// Return disposition commands: explicit inspection and eligible restock /
// quarantine-retain / write-off decisions on a quarantined MerchantDeliveryReturn.
// Once-only by stable key; stock/COGS/money effects stay fail-closed unsupported.
const mongoose = require("mongoose"),
  access = require("../../merchantFulfillment/access"),
  { ConflictError, NotFoundError } = require("../../../utils/errors"),
  { hash } = require("../../deliveryProviders/localDispatch/quote"),
  { dispositionDTO, effectsState } = require("./projection"),
  gates = require("./validate");
const Booking = require("../../../models/MerchantDispatchBooking"),
  Return = require("../../../models/MerchantDeliveryReturn");
const unit = (key) => {
  const [start, quantity] = key.split(":");
  return { start: Number(start), quantity: Number(quantity) };
};
function assertRecorded(recorded, ranges, message) {
  const known = new Set(recorded.map(gates.rangeKey));
  if (ranges.some((range) => !known.has(gates.rangeKey(range))))
    throw new ConflictError(message);
}
function assertUntaken(taken, ranges, message) {
  if (ranges.some((range) => taken.has(gates.rangeKey(range))))
    throw new ConflictError(message);
}
function lineOf(record, lineId) {
  const original = record.lines.find((saved) => String(saved.line) === lineId);
  if (!original)
    throw new ConflictError(
      "Disposition ranges must match original recorded units",
    );
  return original;
}
function eligible(record, lineId, treatment, ranges) {
  const inspected = new Map(
    (record.inspections || [])
      .filter((item) => String(item.line) === lineId)
      .flatMap((item) =>
        (item.ranges || []).map((range) => [
          gates.rangeKey(range),
          item.condition,
        ]),
      ),
  );
  const allowed = gates.ELIGIBLE[treatment];
  for (const range of ranges) {
    const condition = inspected.get(gates.rangeKey(range));
    if (!condition)
      throw new ConflictError(
        "Treatment requires a prior exact-unit inspection of these recorded units",
      );
    if (!allowed.includes(condition))
      throw new ConflictError(
        `Inspected condition ${condition} is not eligible for ${treatment}`,
      );
  }
}
async function withReturn(bookingId, actor, write, work) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const row = write
        ? await require("../managedTrips").ownBooking(bookingId, actor, session)
        : access.assertOwned(
            await Booking.findOne({
              _id: bookingId,
              ...access.scope(actor, false),
            }).session(session),
            actor,
            false,
          );
      if (write && row.state !== "returned")
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
        throw new NotFoundError(
          "Quarantined return not found for this booking",
        );
      result = await work(record, row, session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
async function apply(record, row, session, actor, kind, input, build) {
  const fingerprint = hash(input),
    prior = (record.operations || []).find(
      (operation) => operation.key === input.idempotencyKey,
    );
  if (prior) {
    if (prior.fingerprint !== fingerprint)
      throw new ConflictError("Disposition key or payload differs");
    return dispositionDTO(record);
  }
  if (record.version !== input.expectedVersion)
    throw new ConflictError("Current quarantined return version required");
  if ((record.operations || []).length >= gates.OPERATION_LIMIT)
    throw new ConflictError("Disposition operation limit reached");
  await build(record);
  record.operations.push({
    key: input.idempotencyKey,
    fingerprint,
    kind,
    at: new Date(),
  });
  record.version++;
  await record.save({ session });
  await access.audit(row, actor, `RETURN_DISPOSITION_${kind.toUpperCase()}`, {
    session,
  });
  return dispositionDTO(record);
}
async function readDisposition(bookingId, actor) {
  access.scope(actor, false);
  return withReturn(bookingId, actor, false, async (record) =>
    dispositionDTO(record),
  );
}
async function recordInspection(bookingId, input, actor) {
  access.scope(actor, true);
  gates.validateInspection(input);
  return withReturn(bookingId, actor, true, (record, row, session) =>
    apply(record, row, session, actor, "inspect", input, async (record) => {
      for (const line of input.lines) {
        const original = lineOf(record, line.line);
        assertRecorded(
          original.ranges,
          line.ranges,
          "Inspection ranges must match original recorded units",
        );
        assertUntaken(
          new Set(
            (record.inspections || [])
              .filter((item) => String(item.line) === line.line)
              .flatMap((item) => (item.ranges || []).map(gates.rangeKey)),
          ),
          line.ranges,
          "Recorded units cannot be inspected twice",
        );
        record.inspections.push({
          line: line.line,
          condition: line.condition,
          ranges: line.ranges,
          ...(line.evidence?.length ? { evidence: line.evidence } : {}),
          ...(line.note || input.note
            ? { note: line.note || input.note }
            : {}),
          inspectedBy: actor._id,
          inspectedAt: new Date(),
        });
      }
    }),
  );
}
async function recordDecision(bookingId, input, actor) {
  access.scope(actor, true);
  gates.validateDecision(input);
  return withReturn(bookingId, actor, true, (record, row, session) =>
    apply(record, row, session, actor, "decision", input, async (record) => {
      for (const line of input.lines) {
        lineOf(record, line.line);
        eligible(record, line.line, line.treatment, line.ranges);
        assertUntaken(
          new Set(
            (record.decisions || [])
              .filter((item) => String(item.line) === line.line)
              .flatMap((item) => (item.ranges || []).map(gates.rangeKey)),
          ),
          line.ranges,
          "Recorded units cannot be decided twice",
        );
        record.decisions.push({
          line: line.line,
          treatment: line.treatment,
          ranges: line.ranges,
          ...(line.note || input.note
            ? { note: line.note || input.note }
            : {}),
          decidedBy: actor._id,
          decidedAt: new Date(),
        });
      }
    }),
  );
}
async function requestEffects(bookingId, input, actor) {
  access.scope(actor, true);
  const command =
    input &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    Object.keys(input).length > 0;
  // Versioned command payload → the policy-gated once-only executor. Without
  // one this stays a pure scoped read of policy/effect state (no mutation).
  if (command)
    return require("./effects").executeEffects(bookingId, input, actor);
  return withReturn(bookingId, actor, true, async (record) => {
    const state = effectsState(record);
    return {
      effects: {
        ...state,
        ...(state.supported ? {} : { returnVersion: record.version }),
      },
    };
  });
}
module.exports = {
  readDisposition,
  recordInspection,
  recordDecision,
  requestEffects,
};
