'use strict';
// services/venue/gratuity.js — S5 Task 3 (spec §2.2): receipt-anchored gratuity
// ALLOCATION records. RECORDS ONLY:
// - it never creates charges, refunds, journals or stock effects, and never
//   imports a payment/refund service (no collections/settlement/refunds import);
// - it never mutates Order.tipAmount or the receipt — the existing post-payment
//   tip collection stays the authorised money movement (10 §6 "never mutate a
//   completed Paystack charge"); these rows only record who a tip is FOR;
// - the gratuityAllocation policy subdoc is read for DEFAULTS ONLY (a
//   `defaultStaffIds` hint echoed on the DTO) — allocation rows come from the
//   request and are recorded, not executed.
// Write authorization rides the 'collection.write' action (the Batch-2
// money-command class — payers.createPortions runs under it via
// runVenueOperation, which also carries the staffCommands rate limiter and
// operation idempotency: a replayed key is a stored-result no-op). The read
// surface rides 'bill.read' — the weakest sufficient existing action, since
// gratuity records are bill/receipt-anchored financial records.
const Allocation = require('../../models/VenueGratuityAllocation');
const Session = require('../../models/VenueServiceSession');
const Receipt = require('../../models/VenuePaymentReceipt');
const { runVenueOperation } = require('./operations');
const { loadVenueContext } = require('./context');
const { fail, requireId } = require('./errors');
const { id } = require('./eligibility');
const { minor } = require('./money-rules');

// Same visit resolution discipline as lines.visitContext, kept local so this
// service imports no line/pricing/consumption machinery at all.
async function visitFor({ tenantId, sessionId, actor, action, mongoSession = null }) {
  requireId(sessionId);
  const visit = await Session.findOne({ _id: sessionId, tenant: tenantId }).session(mongoSession);
  if (!visit) fail('NOT_FOUND', 'Visit not found', 404);
  await loadVenueContext({ tenantId, locationId: id(visit.location), actor, action, visit, mongoSession });
  return visit;
}

// Share arithmetic — the cumulative disjoint integer discipline copied EXACTLY
// from services/venue/refund-components.js: partition each cumulative prefix
// (BigInt floor division against the 10000 bps total), then subtract adjacent
// prefixes. Every row is disjoint, and because the final prefix is exactly
// 10000, `at(10000) − at(prev)` telescopes — the LAST row deterministically
// absorbs the integer-division residue and the rows sum to amountMinor EXACTLY
// (two rounding carries can never double-assign one kobo). Row ORDER (and so
// residue placement) is the request order — stable and replay-identical.
function shareRows(amountMinor, shares) {
  if (!Array.isArray(shares) || !shares.length || shares.length > 100) fail('INVALID_GRATUITY_SHARES', 'Choose 1–100 allocation rows', 400);
  const at = bps => Number(BigInt(amountMinor) * BigInt(bps) / BigInt(10000));
  let totalBps = 0;
  const validated = shares.map(share => {
    if (!Number.isSafeInteger(share?.shareBps) || share.shareBps < 1) fail('INVALID_GRATUITY_SHARES', 'Each row needs positive basis points', 400);
    const staffId = share.staffId ? requireId(share.staffId) : null;
    const shiftId = share.shiftId ? requireId(share.shiftId) : null;
    if (!!staffId === !!shiftId) fail('INVALID_GRATUITY_SHARES', 'Exactly one of staffId or shiftId per row', 400);
    totalBps += share.shareBps;
    return { staffId, shiftId, shareBps: share.shareBps };
  });
  if (totalBps !== 10000) fail('INVALID_GRATUITY_SHARES', 'shareBps must total exactly 10000', 400);
  let cumulative = 0;
  return validated.map(share => {
    const next = cumulative + share.shareBps;
    const row = { ...(share.staffId ? { staffId: share.staffId } : { shiftId: share.shiftId }), shareBps: share.shareBps, amountMinor: at(next) - at(cumulative) };
    cumulative = next;
    return row;
  });
}

function allocationDTO(row, policy = null) {
  const defaults = policy && policy.gratuityAllocation ? policy.gratuityAllocation : null;
  return {
    id: id(row), sessionId: id(row.session), receiptId: id(row.receiptId), sourceKind: row.sourceKind,
    amountMinor: row.amountMinor, policyVersion: row.policyVersion,
    allocations: (row.allocations || []).map(item => ({ ...(item.staffId ? { staffId: id(item.staffId) } : { shiftId: id(item.shiftId) }), shareBps: item.shareBps, amountMinor: item.amountMinor })),
    // Recorded hint from the approved policy — never executed here.
    ...(defaults ? { defaults: { mode: defaults.mode || 'none', ...(defaults.defaultStaffIds?.length ? { defaultStaffIds: defaults.defaultStaffIds.map(id) } : {}) } } : {}),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

async function recordAllocation({ tenantId, locationId, sessionId, receiptId, sourceKind, amountMinor, policyVersion, shares, actor, idempotencyKey }) {
  requireId(receiptId);
  if (sourceKind !== 'pos' && sourceKind !== 'payer') fail('INVALID_GRATUITY_SOURCE', 'sourceKind must be pos or payer', 400);
  minor(amountMinor);
  if (!Number.isSafeInteger(policyVersion) || policyVersion < 1) fail('INVALID_GRATUITY_POLICY', 'An approved policy version integer is required', 400);
  const rows = shareRows(amountMinor, shares);
  // Pre-transaction eligibility (fast 404s, matches the payers.js pattern); the
  // transaction re-resolves the visit for the authoritative check.
  const context = await visitFor({ tenantId, sessionId, actor, action: 'collection.write' });
  return runVenueOperation({ tenantId, locationId: id(context.location), actor, operation: 'gratuity.allocate', key: idempotencyKey, targetType: 'VenueGratuityAllocation',
    payload: { sessionId, receiptId, sourceKind, amountMinor, policyVersion, shares },
    execute: async ({ mongoSession }) => {
      const visit = await visitFor({ tenantId, sessionId, actor, action: 'collection.write', mongoSession });
      if (locationId && locationId !== id(visit.location)) fail('NOT_FOUND', 'Visit not found', 404);
      const receipt = await Receipt.findOne({ _id: receiptId, tenant: tenantId }).session(mongoSession);
      // Receipt must exist for THIS tenant and belong to THIS visit — a receipt
      // from another session is not a valid anchor (defense in depth beyond the
      // {_id, tenant} filter).
      if (!receipt || id(receipt.session) !== sessionId) fail('NOT_FOUND', 'Receipt not found', 404);
      const policy = await require('../../models/VenueFinancialPolicy').findOne({ tenant: tenantId, location: id(visit.location), version: policyVersion, state: 'approved' }).session(mongoSession).lean();
      if (!policy) fail('NOT_FOUND', 'Approved financial policy version not found', 404);
      // Domain guard ahead of the unique index {tenant, receiptId, sourceKind},
      // which remains the race backstop.
      if (await Allocation.exists({ tenant: tenantId, receiptId, sourceKind }).session(mongoSession)) fail('GRATUITY_ALREADY_ALLOCATED', 'This receipt already carries a gratuity allocation for this source', 409);
      const [row] = await Allocation.create([{ tenant: tenantId, location: visit.location, session: visit._id, receiptId, sourceKind, amountMinor, policyVersion, allocations: rows, actor: actor.userId }], { session: mongoSession });
      return allocationDTO(row, policy);
    } });
}

async function listAllocations({ tenantId, locationId, sessionId, actor }) {
  const newestFirst = { createdAt: -1, _id: -1 };
  if (sessionId) {
    const visit = await visitFor({ tenantId, sessionId, actor, action: 'bill.read' });
    if (locationId && locationId !== id(visit.location)) fail('NOT_FOUND', 'Visit not found', 404);
    return { allocations: (await Allocation.find({ tenant: tenantId, session: visit._id }).sort(newestFirst).lean()).map(row => allocationDTO(row)) };
  }
  // Session-less listing stays a staff read: the location scope must clear
  // eligibility ('bill.read') before any rows are returned.
  requireId(locationId);
  await loadVenueContext({ tenantId, locationId, actor, action: 'bill.read' });
  return { allocations: (await Allocation.find({ tenant: tenantId, location: locationId }).sort(newestFirst).lean()).map(row => allocationDTO(row)) };
}

async function ensureIndexes() { await Allocation.createIndexes(); }
module.exports = { recordAllocation, listAllocations, ensureIndexes };
