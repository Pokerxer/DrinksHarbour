'use strict';
// Tax component refund COMMAND (workstream T). Allocates once-only tax
// component refunds bound to the immutable child taxMinor (+ parent
// Order.taxAmount reconciliation), executing ONLY against a recorded,
// immutable, versioned MerchantComponentRefundPolicy. Marketplace orders
// never captured output VAT (no 2100 journal exists — discovery Q2): a
// recorded reversal treatment that requires reversing (or retroactively
// capturing) a journal FAILS CLOSED with an explicit reason and zero writes —
// the mechanism never fabricates a journal or a retroactive capture. Net
// merchandise refund semantics are untouched: no refundReservedMinor,
// refundedMinor, group or journal writes, ever. Session-bound: runs inside the
// caller's session when one is passed, otherwise inside its own transaction.
const mongoose = require('mongoose');
const { ConflictError } = require('../../../utils/errors');
const Child = require('../../../models/MerchantOrder');
const Journal = require('../../../models/JournalEntry');
const Allocation = require('../../../models/MerchantComponentRefundAllocation');
const authority = require('../refundAuthority');
const access = require('../access');
const { minor } = require('../allocation');
const policyAuthority = require('./policy');
const { anchorKey, fingerprint, assertCommand, present, advanceRemainder, exceeds } = require('./support');

// Verbatim readiness wording (refundReadiness.js — the tax gate).
const TAX_REVIEW = 'Original tax refund and journal allocation policy requires review.';
const NO_CAPTURE_REASON =
  'Marketplace orders never captured output VAT; no 2100 journal exists to reverse.';
const REVERSE_REVIEW =
  'Recorded tax reversal treatment requires reversing captured output VAT, but marketplace orders never captured output VAT; no 2100 journal exists to reverse.';
const RETRO_REVIEW =
  'Recorded tax reversal treatment requires retroactive output VAT capture; the component refund mechanism never fabricates a journal or a retroactive capture.';

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
  const key = anchorKey('tax', String(child._id), command.idempotencyKey);
  const mark = fingerprint({
    kind: 'tax',
    allocatedMinor: command.allocatedMinor,
    reason: command.reason.trim(),
  });
  // Replay first: the same key against the same child is the same command —
  // rebuild the recorded result, write nothing.
  const prior = await Allocation.findById(key).session(session).lean();
  if (prior) {
    if (prior.fingerprint !== mark)
      throw new ConflictError('Component refund key already used for another allocation');
    return present(prior, 'already_allocated');
  }
  const policy = await policyAuthority.active('tax', { session });
  if (!policy) throw new ConflictError(TAX_REVIEW);
  const { parent } = await authority.original(child, session);
  // Parent Order.taxAmount consistency: child components must reconcile with
  // the parent tax before any allocation is recorded.
  const children = await Child.find({ order: parent._id }).session(session).lean();
  if (children.reduce((n, row) => n + row.taxMinor, 0) !== minor(parent.taxAmount))
    throw new ConflictError('Parent tax component does not reconcile with merchant allocations.');
  const componentMinor = child.taxMinor;
  // Recorded reversal treatment resolution BEFORE any write. Only
  // `no_output_vat_captured` is executable: it asserts the recorded no-capture
  // state of marketplace orders. Journal-reversing treatments fail closed.
  let outcome;
  if (policy.reversalTreatment === 'no_output_vat_captured') {
    if (
      await Journal.exists({
        tenant: child.tenant,
        refDoc: parent._id,
        'lines.account': '2100',
      }).session(session)
    )
      throw new ConflictError(
        'An output VAT journal exists for the original marketplace order; the recorded no-capture treatment requires reconciliation.',
      );
    outcome = { state: 'no_reverse_required', reason: NO_CAPTURE_REASON };
  } else if (policy.reversalTreatment === 'reverse_captured_output_vat') {
    throw new ConflictError(REVERSE_REVIEW);
  } else {
    throw new ConflictError(RETRO_REVIEW);
  }
  const guardId = `${String(child._id)}:tax`;
  // Explicit pre-mutation conservation (first command included).
  if (command.allocatedMinor > componentMinor) throw new ConflictError(exceeds('tax'));
  const existing = await require('../../../models/MerchantComponentRefundRemainder')
    .findById(guardId)
    .session(session);
  if (existing && existing.allocatedMinor + command.allocatedMinor > componentMinor)
    throw new ConflictError(exceeds('tax'));
  // Once-only anchor FIRST (unique _id), remainder guard second.
  const anchor = (
    await Allocation.create(
      [
        {
          _id: key,
          kind: 'tax',
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
          treatment: policy.reversalTreatment,
          journalOutcomeState: outcome.state,
          journalOutcomeReason: outcome.reason,
          state: 'allocated',
          createdBy: actor._id,
        },
      ],
      { session },
    )
  )[0];
  const remainder = await advanceRemainder(guardId, componentMinor, command.allocatedMinor, session, 'tax');
  if (remainder.componentMinor !== componentMinor)
    throw new ConflictError(
      'Recorded tax component changed against the component refund remainder; reconciliation required.',
    );
  anchor.remainderMinorAfter = componentMinor - remainder.allocatedMinor;
  await anchor.save({ session });
  await access.audit(child, actor, 'MERCHANT_TAX_COMPONENT_REFUND', { session });
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
        const key = anchorKey('tax', String(childId), command?.idempotencyKey);
        const winner = await Allocation.findById(key).lean();
        if (winner) return present(winner, 'already_allocated');
      }
      throw error;
    }
    return result;
  } finally {
    await own.endSession();
  }
}

module.exports = { allocate, TAX_REVIEW };
