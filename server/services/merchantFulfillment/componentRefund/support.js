'use strict';
// Shared primitives for the merchant component refund commands (workstream T):
// idempotency anchor derivation, command validation, result projection and the
// per-child remainder guard. Not a ledger — see MerchantComponentRefundAllocation.
const crypto = require('node:crypto');
const { ConflictError, ValidationError } = require('../../../utils/errors');
const Remainder = require('../../../models/MerchantComponentRefundRemainder');

const anchorKey = (kind, childId, idempotencyKey) =>
  crypto
    .createHash('sha256')
    .update(`merchant-component-refund:${kind}:${childId}:${idempotencyKey}`)
    .digest('hex');
const guardKey = (kind, childId) => `${childId}:${kind}`;
const fingerprint = (payload) =>
  crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

function assertCommand(command) {
  if (
    !Number.isSafeInteger(command?.allocatedMinor) ||
    command.allocatedMinor < 1
  )
    throw new ValidationError('Positive component minor amount required');
  if (
    typeof command?.idempotencyKey !== 'string' ||
    command.idempotencyKey.length < 1 ||
    command.idempotencyKey.length > 128
  )
    throw new ValidationError('Idempotency key is required for component refund allocation');
  if (
    typeof command?.reason !== 'string' ||
    command.reason.trim().length < 5 ||
    command.reason.length > 500
  )
    throw new ValidationError('Component refund reason required');
}

// Rebuild the command result from the MerchantComponentRefundAllocation record
// alone — identical shape for fresh allocations and idempotent replays.
function present(record, status) {
  return {
    status,
    kind: record.kind,
    merchantOrder: record.merchantOrder,
    order: record.order,
    tenant: record.tenant,
    currency: record.currency,
    componentMinor: record.componentMinor,
    allocatedMinor: record.allocatedMinor,
    remainderMinor: record.remainderMinorAfter,
    reason: record.reason,
    treatment: record.treatment ?? null,
    journalOutcome: {
      state: record.journalOutcomeState ?? 'not_applicable',
      reason: record.journalOutcomeReason ?? null,
    },
    fundingValues: record.fundingValues ?? null,
    recreditOutcome: {
      state: record.recreditOutcomeState ?? 'not_applicable',
      reason: record.recreditOutcomeReason ?? null,
    },
    policy: { id: record.policyId, version: record.policyVersion },
    state: record.state,
    createdAt: record.createdAt,
  };
}

const exceeds = (kind) =>
  `Component refund allocation exceeds the remaining refundable ${kind} component.`;

// Exact remainder advance: conditional update (conservation evaluated
// server-side), then insert when absent, then a conditional retry if a
// concurrent creator won the insert. Concurrent commands with different
// idempotency keys can never over-allocate the immutable child component.
async function advanceRemainder(guardId, componentMinor, allocatedMinor, session, kind) {
  const filter = {
    _id: guardId,
    allocatedMinor: { $lte: componentMinor - allocatedMinor },
  };
  const update = { $inc: { allocatedMinor } };
  let row = await Remainder.findOneAndUpdate(filter, update, { new: true, session });
  if (row) return row;
  if (await Remainder.exists({ _id: guardId }).session(session))
    throw new ConflictError(exceeds(kind));
  try {
    return await Remainder.create(
      [{ _id: guardId, componentMinor, allocatedMinor }],
      { session },
    ).then((rows) => rows[0]);
  } catch (error) {
    if (error.code !== 11000) throw error;
    row = await Remainder.findOneAndUpdate(filter, update, { new: true, session });
    if (!row) throw new ConflictError(exceeds(kind));
    return row;
  }
}

module.exports = {
  anchorKey,
  guardKey,
  fingerprint,
  assertCommand,
  present,
  advanceRemainder,
  exceeds,
};
