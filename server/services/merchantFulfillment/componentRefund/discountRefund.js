'use strict';
// Discount component refund COMMAND (workstream T). Allocates once-only
// discount component refunds bound to the immutable child discountMinor and
// the parent order's recorded discountFunding values, executing ONLY against a
// recorded, immutable, versioned MerchantComponentRefundPolicy. Component
// eligibility is bound per discountFunding value (shared_by_agreement |
// platform); a platform-funded share re-credit follows ONLY the recorded
// platformRecreditPath — and only `component_record_only` is executable, so
// any path requiring money movement FAILS CLOSED before any write. Net
// merchandise refund semantics are untouched: no refundReservedMinor,
// refundedMinor, group or journal writes, ever. No journals are written in
// this package: recorded treatment outcomes only. Session-bound like the tax
// command: caller's session when passed, otherwise its own transaction.
const mongoose = require('mongoose');
const { ConflictError } = require('../../../utils/errors');
const Child = require('../../../models/MerchantOrder');
const Allocation = require('../../../models/MerchantComponentRefundAllocation');
const authority = require('../refundAuthority');
const access = require('../access');
const { id, minor } = require('../allocation');
const policyAuthority = require('./policy');
const {
  anchorKey,
  fingerprint,
  assertCommand,
  present,
  advanceRemainder,
  exceeds,
} = require('./support');

// Verbatim readiness wording (refundReadiness.js — the tender gate): the
// discount component has no dedicated readiness entry, so fail closed on the
// exact recorded tender wording when no policy exists.
const TENDER_REVIEW = 'Original tender refund capability requires review.';
const PLATFORM_RECORDED_REASON =
  'Platform-funded discount share re-credit recorded as a component outcome; no tender or ledger movement occurred.';
const PATH_REVIEW =
  'Recorded platform-funded share re-credit path requires money movement the component refund mechanism does not execute; review required.';

async function run(childId, command, actor, session) {
  assertCommand(command);
  const child = access.assertOwned(
    await Child.findOne({
      _id: String(childId),
      ...access.scope(actor, true),
    }).session(session),
    actor,
    true,
  );
  const key = anchorKey('discount', String(child._id), command.idempotencyKey);
  const mark = fingerprint({
    kind: 'discount',
    allocatedMinor: command.allocatedMinor,
    reason: command.reason.trim(),
  });
  // Replay first: the same key against the same child is the same command.
  const prior = await Allocation.findById(key).session(session).lean();
  if (prior) {
    if (prior.fingerprint !== mark)
      throw new ConflictError('Component refund key already used for another allocation');
    return present(prior, 'already_allocated');
  }
  const policy = await policyAuthority.active('discount', { session });
  if (!policy) throw new ConflictError(TENDER_REVIEW);
  const { parent } = await authority.original(child, session);
  // Parent discount component consistency: the child's immutable
  // discountMinor must reconcile with the parent lines of this tenant.
  const tenantLines = parent.items.filter((line) => id(line.tenant) === id(child.tenant));
  const discounted = tenantLines.filter((line) => minor(line.discountAmount || 0) > 0);
  if (
    discounted.reduce((n, line) => n + minor(line.discountAmount), 0) !== child.discountMinor
  )
    throw new ConflictError('Parent discount component does not reconcile with merchant allocations.');
  // The child component must also reconcile with the child's own immutable
  // line-level components (defense-in-depth binding on discountMinor).
  if (child.lines.reduce((n, line) => n + line.discountMinor, 0) !== child.discountMinor)
    throw new ConflictError('Child discount component does not reconcile with its merchant lines.');
  // Funding-source binding: eligibility per discountFunding is recorded, never
  // inferred. An unrecorded funding source cannot be evaluated — fail closed.
  const fundingValues = [...new Set(discounted.map((line) => line.discountFunding))];
  if (fundingValues.some((value) => typeof value !== 'string' || !value.trim()))
    throw new ConflictError(
      'Parent discount funding source is not recorded; component refund eligibility requires reconciliation.',
    );
  if (fundingValues.some((value) => !policy.eligibleFunding.includes(value)))
    throw new ConflictError(
      `Discount funding ${fundingValues.find((value) => !policy.eligibleFunding.includes(value))} is not eligible under the recorded component refund policy.`,
    );
  const platformFunded = fundingValues.includes('platform');
  // Recorded re-credit path: only the component-record outcome is executable.
  if (platformFunded && policy.platformRecreditPath !== 'component_record_only')
    throw new ConflictError(PATH_REVIEW);
  const componentMinor = child.discountMinor;
  // Explicit pre-mutation conservation (first command included).
  if (command.allocatedMinor > componentMinor) throw new ConflictError(exceeds('discount'));
  const guardId = `${String(child._id)}:discount`;
  const existing = await require('../../../models/MerchantComponentRefundRemainder')
    .findById(guardId)
    .session(session);
  if (existing && existing.allocatedMinor + command.allocatedMinor > componentMinor)
    throw new ConflictError(exceeds('discount'));
  // Once-only anchor FIRST (unique _id), remainder guard second.
  const anchor = (
    await Allocation.create(
      [
        {
          _id: key,
          kind: 'discount',
          merchantOrder: String(child._id),
          order: parent._id,
          tenant: child.tenant,
          currency: 'NGN',
          componentMinor,
          allocatedMinor: command.allocatedMinor,
          remainderMinorAfter: 0,
          fingerprint: mark,
          reason: command.reason.trim(),
          requestedBy: actor._id,
          policyId: policy._id,
          policyVersion: policy.version,
          fundingValues,
          recreditOutcomeState: platformFunded ? 'recorded' : 'not_applicable',
          recreditOutcomeReason: platformFunded ? PLATFORM_RECORDED_REASON : undefined,
          state: 'allocated',
          createdBy: actor._id,
        },
      ],
      { session },
    )
  )[0];
  const remainder = await advanceRemainder(
    guardId,
    componentMinor,
    command.allocatedMinor,
    session,
    'discount',
  );
  if (remainder.componentMinor !== componentMinor)
    throw new ConflictError(
      'Recorded discount component changed against the component refund remainder; reconciliation required.',
    );
  anchor.remainderMinorAfter = componentMinor - remainder.allocatedMinor;
  await anchor.save({ session });
  await access.audit(child, actor, 'MERCHANT_DISCOUNT_COMPONENT_REFUND', { session });
  return present(anchor, 'allocated');
}

async function allocate(childId, command, actor, { session } = {}) {
  access.scope(actor, true);
  if (session) return run(childId, command, actor, session);
  const own = await mongoose.startSession();
  try {
    let result;
    try {
      await own.withTransaction(async () => {
        result = await run(childId, command, actor, own);
      });
    } catch (error) {
      // A parallel command may have won the unique idempotency anchor.
      if (error.code === 11000) {
        const winner = await Allocation.findById(
          anchorKey('discount', String(childId), command?.idempotencyKey),
        ).lean();
        if (winner) return present(winner, 'already_allocated');
      }
      throw error;
    }
    return result;
  } finally {
    await own.endSession();
  }
}

module.exports = { allocate };
