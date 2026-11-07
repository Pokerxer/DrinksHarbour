"use strict";
// Zero-only no-money release executor (workstream Z). A versioned command that
// physically releases ZERO-merchandise unit ranges from the existing V2 hold
// authority — importing, never modifying, the quantity cancellation machinery —
// and writes one explicit no-money record. Money-bearing ranges remain the
// exclusive authority of the existing refunded-block cancellation + refund
// commands; no budget, allocation, journal or refund counter is ever touched.
//
// Execution is gated: a recorded immutable MerchantNoMoneyReleasePolicy version
// (recorded by a current active super_admin, inside its effective window) AND
// the explicit MERCHANT_ZERO_ONLY_RELEASE_ENABLED flag (default off). Without
// either, the command fails closed with the verbatim readiness wording and
// zero writes — no key is consumed, no hold counters change.
const mongoose = require("mongoose"),
  { ConflictError } = require("../../../../utils/errors"),
  { hash } = require("../../allocation"),
  { run } = require("../transaction"),
  ownership = require("../ownership"),
  ranges = require("../ranges"),
  policyAuthority = require("./policy"),
  Release = require("../../../../models/MerchantNoMoneyRelease");
const FLAG = "MERCHANT_ZERO_ONLY_RELEASE_ENABLED";
const VERBATIM =
  "Zero-only cancellation has no approved no-money policy; zero-value units release only within a positive supported refund.";
const ADAPTER =
  "Recorded no-money release policy declares a record shape or scope rule this mechanism does not support";
const SUPPORTED_SHAPE = "zero_release_v1";
const RELEASABLE_STATES = [
  "pending",
  "accepted",
  "picking",
  "partially_shipped",
];
// Units of a line carrying zero merchandise money: perUnit(u) =
// floor(M/Q) + (u < M % Q ? 1 : 0) — the same split the unit-range refund math
// uses. A unit qualifies only when its per-unit amount is exactly 0.
function zeroUnitRanges(total, merchandiseMinor, blocks, used, quantity) {
  const base = Math.floor(merchandiseMinor / total),
    extra = merchandiseMinor % total;
  const runs = [];
  for (let unit = 0; unit < total; unit++) {
    if (!(base === 0 && unit >= extra)) continue;
    const last = runs[runs.length - 1];
    if (last && last.start + last.quantity === unit) last.quantity++;
    else runs.push({ start: unit, quantity: 1 });
  }
  const excluded = [
    ...ranges.checked(total, blocks || []),
    ...ranges.checked(total, used || []),
  ].sort((a, b) => a.start - b.start);
  const free = [];
  for (const row of runs) {
    let cursor = row.start;
    for (const block of excluded) {
      const end = Math.min(block.start + block.quantity, row.start + row.quantity);
      if (block.start > cursor)
        free.push({ start: cursor, quantity: block.start - cursor });
      cursor = Math.max(cursor, end);
      if (cursor >= row.start + row.quantity) break;
    }
    if (cursor < row.start + row.quantity)
      free.push({ start: cursor, quantity: row.start + row.quantity - cursor });
  }
  const selected = [];
  let need = quantity;
  for (const row of free) {
    const take = Math.min(need, row.quantity);
    if (take) selected.push({ start: row.start, quantity: take });
    need -= take;
    if (!need) break;
  }
  if (need)
    throw new ConflictError(
      "Zero-value release requires the requested quantity of unallocated zero-merchandise units",
    );
  return selected;
}
async function releaseZeroUnits(childId, input, actor, options = {}) {
  const selected = ownership.lines(input);
  return run(
    childId,
    { ...input, lines: selected },
    actor,
    "zero_release",
    async ({ child, parent, session }) => {
      // Fail-closed gates FIRST: thrown before any write, so a refused release
      // consumes no operation key and mutates nothing.
      const policy = await policyAuthority.activePolicy(child.tenant, session);
      if (!policy) throw new ConflictError(VERBATIM);
      if (process.env[FLAG] !== "true") throw new ConflictError(VERBATIM);
      if (policy.recordShape !== SUPPORTED_SHAPE) throw new ConflictError(ADAPTER);
      if (!RELEASABLE_STATES.includes(child.state))
        throw new ConflictError("Only remaining unshipped units can be released");
      if (
        policy.scopeRule === "zero_merchandise_only" &&
        (child.shippingMinor || child.taxMinor)
      )
        throw new ConflictError(
          "Recorded scope rule restricts zero-value release to orders without shipping and tax components",
        );
      const releaseId = new mongoose.Types.ObjectId(
          hash(childId + ":zero-release:" + input.idempotencyKey).slice(0, 24),
        ),
        planned = [];
      for (const request of selected) {
        const owned = await ownership.owned(
            child,
            parent,
            request.line,
            session,
          ),
          unitRanges = zeroUnitRanges(
            owned.snapshot.quantity,
            owned.snapshot.merchandiseMinor,
            owned.progress.financialBlocks || [],
            owned.used,
            request.quantity,
          );
        planned.push({
          ...owned,
          line: request.line,
          quantity: request.quantity,
          ranges: unitRanges,
          batches: ranges.batchSlice(
            owned.hold.batchAllocations,
            unitRanges,
            owned.hold.quantity,
          ),
        });
      }
      let releasedQuantity = 0;
      for (const row of planned) {
        await require("../../../storefrontOwnedStock").applyOwnedStock({
          hold: row.hold,
          quantity: row.quantity,
          action: "release",
          batches: row.batches,
          reference: `online-release:${releaseId}`,
          orderId: parent._id,
          actorId: actor._id,
          session,
        });
        for (const unit of row.ranges)
          row.hold.unitDispositions.push({
            ...unit,
            action: "release",
            allocation: String(releaseId),
          });
        row.hold.releasedQuantity += row.quantity;
        if (
          row.hold.consumedQuantity + row.hold.releasedQuantity ===
          row.hold.quantity
        )
          row.hold.state = row.hold.consumedQuantity ? "consumed" : "released";
        await row.hold.save({ session });
        row.progress.cancelled += row.quantity;
        releasedQuantity += row.quantity;
      }
      const [row] = await Release.create(
        [
          {
            _id: releaseId,
            merchantOrder: child._id,
            order: parent._id,
            tenant: child.tenant,
            location: child.location,
            releasedBy: actor._id,
            kind: "no_money",
            policyId: policy._id,
            policyVersion: policy.version,
            auditWording: policy.auditWording,
            financials: {
              merchandiseMinor: 0,
              shippingMinor: 0,
              taxMinor: 0,
              totalMinor: 0,
            },
            providerTransaction: "none",
            lines: planned.map((value) => ({
              line: value.line,
              quantity: value.quantity,
              ranges: value.ranges,
              batchAllocations: value.batches,
            })),
          },
        ],
        { session },
      );
      await require("../../../../models/AuditLog").create(
        [
          {
            actorUserId: actor._id,
            actorRole: actor.role,
            action: "MERCHANT_ZERO_ONLY_RELEASE",
            actionCategory: "update",
            targetType: "Order",
            targetId: parent._id,
            targetTenantId: child.tenant,
            justification: policy.auditWording,
            changes: {
              after: {
                merchantOrder: child._id,
                policyId: policy._id,
                policyVersion: policy.version,
                kind: "no_money",
                releasedQuantity,
              },
            },
          },
        ],
        { session },
      );
      return row.toObject();
    },
    options,
  );
}
module.exports = { releaseZeroUnits, VERBATIM, ADAPTER, FLAG };
