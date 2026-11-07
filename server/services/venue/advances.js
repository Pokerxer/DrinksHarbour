'use strict';
const crypto = require('node:crypto');
const Booking = require('../../models/Booking'); const Attempt = require('../../models/VenuePaymentAttempt');
const { requireId, fail } = require('./errors'); const { id } = require('./eligibility');
const { runVenueOperation } = require('./operations'); const { validatePolicy, moneyIndexesReady } = require('./financial-policy');
async function ownedBooking({ customerId, reference }, mongoSession = null) {
  requireId(customerId);
  if (typeof reference !== 'string' || reference.length > 80) fail('NOT_FOUND', 'Booking not found', 404);
  const customer = await require('../../models/User').exists({ _id: customerId, role: 'customer', status: 'active' }).session(mongoSession);
  const booking = customer && await Booking.findOne({ createdBy: customerId, requestReference: reference, requestMode: 'request_only' }).session(mongoSession);
  if (!booking) fail('NOT_FOUND', 'Booking not found', 404); return booking;
}
const attemptDTO = row => ({ attemptId: id(row), state: row.state, currency: row.currency, amountMinor: row.amountMinor, authorizationUrl: row.authorizationUrl, receiptId: id(row.receipt) || null });
async function initializeOnce(attemptId, email, options = {}) {
  const row = await Attempt.findOneAndUpdate({ _id: attemptId, state: 'initializing', initializationStartedAt: null }, { $set: { initializationStartedAt: new Date() } }, { new: true });
  if (row) {
    try {
      const result = await require('./paystack').initialize(row, email, options);
      const url = new URL(result.authorizationUrl);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Unknown provider URL');
      await Attempt.updateOne({ _id: row._id, state: 'initializing' }, { $set: { authorizationUrl: url.href, state: 'pending' } });
    } catch { await Attempt.updateOne({ _id: row._id, state: 'initializing' }, { $set: { state: 'needs_review' } }); }
  }
  return Attempt.findById(attemptId).select('+authorizationUrl').lean();
}
async function startDeposit(args) {
  if (process.env.VENUE_MONEY_ENABLED !== 'true') fail('VENUE_MONEY_NOT_ENABLED', 'Deposits are not enabled', 404);
  if (typeof args.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email)) fail('INVALID_EMAIL', 'Receipt email required', 400);
  const original = await ownedBooking(args);
  if (args.acceptedTerms !== true) fail('TERMS_ACCEPTANCE_REQUIRED', 'Accept the reviewed deposit terms before collection', 400);
  if (args.expectedVersion !== original.requestVersion || args.policyVersion !== original.financialPolicy?.version) fail('STATE_CHANGED', 'Booking or deposit policy changed; review the current quote');
  await moneyIndexesReady();
  const actor = { userId: args.customerId, role: 'customer' };
  const result = await runVenueOperation({ tenantId: id(original.tenant), locationId: id(original.location), actor, operation: 'deposit.start', key: args.idempotencyKey, targetType: 'Booking', payload: { reference: args.reference, email: args.email, acceptedTerms: args.acceptedTerms, expectedVersion: args.expectedVersion, policyVersion: args.policyVersion }, execute: async ({ mongoSession }) => {
    const booking = await ownedBooking(args, mongoSession);
    const slot = `deposit:${id(booking)}`;
    const existing = await Attempt.findOne({ tenant: booking.tenant, collectionSlot: slot }).session(mongoSession);
    if (existing) return { id: id(booking), attemptId: id(existing), version: booking.requestVersion };
    if (booking.status !== 'confirmed' || !booking.capacityClaim || booking.serviceSession || !booking.depositDeadline || booking.depositDeadline <= new Date()) fail('BOOKING_NOT_ACCEPTED', 'An accepted, unexpired booking is required before deposit collection');
    const capacity = await require('../../models/VenueCapacityClaim').exists({ _id: booking.capacityClaim, tenant: booking.tenant, location: booking.location, booking: booking._id, end: { $gt: new Date() }, ...require('./capacity-policy').active() }).session(mongoSession);
    if (!capacity) fail('CAPACITY_UNAVAILABLE', 'Accepted capacity requires review');
    const tenant = await require('../../models/Tenant').findOne({ _id: booking.tenant }).session(mongoSession).lean();
    if (!tenant || tenant.status !== 'approved' || tenant.isActive === false || !require('../entitlements.service').resolveEntitlements(tenant).writesAllowed || !require('../entitlements.service').resolveEntitlements(tenant).capabilities.includes('table_management')) fail('VENUE_DISABLED', 'New collection is not available', 403);
    const policy = validatePolicy(booking.financialPolicy);
    if (String(policy.tenant) !== id(booking.tenant) || String(policy.location) !== id(booking.location) || !policy.depositMinor) fail('FINANCIAL_POLICY_REQUIRED');
    await require('./financial-policy').preflightCollection({tenantId:id(booking.tenant),policy,mongoSession});
    const [attempt] = await Attempt.create([{ tenant: booking.tenant, location: booking.location, booking: booking._id, payer: args.customerId,
      collectionVersion: 2, collectionSlot: slot, purpose: 'venue_deposit', method: 'paystack', amountMinor: policy.depositMinor, currency: policy.currency,
      policySnapshot: policy, bookingReference: booking.requestReference, reference: `dhv-${crypto.randomUUID()}`, state: 'initializing', actor: args.customerId,
      key: args.idempotencyKey, requestHash: require('./operations').fingerprint({ reference: args.reference, email: args.email }) }], { session: mongoSession });
    booking.financialTermsVersion = policy.version; booking.financialTermsAcceptedAt = new Date(); booking.moneyState = 'deposit_pending'; await booking.save({ session: mongoSession });
    await require('./collections').enqueue({ tenant: booking.tenant, location: booking.location, kind: 'verify_payment', targetId: attempt._id, mongoSession });
    return { id: id(booking), attemptId: id(attempt), version: booking.requestVersion };
  } });
  return attemptDTO(await initializeOnce(result.attemptId, args.email));
}
async function recordAdvance({ attempt, data, mongoSession }) {
  const Receipt = require('../../models/VenuePaymentReceipt');
  const booking = await Booking.findOne({ _id: attempt.booking, tenant: attempt.tenant, location: attempt.location }).session(mongoSession);
  let capacity = booking && await require('../../models/VenueCapacityClaim').findOne({ _id: booking.capacityClaim, tenant: attempt.tenant, location: attempt.location, booking: booking._id }).session(mongoSession);
  const tenant=await require('../../models/Tenant').findOne({_id:attempt.tenant}).session(mongoSession).lean();
  const location=await require('../../models/Warehouse').findOne({_id:attempt.location,tenant:attempt.tenant,isActive:{$ne:false}}).session(mongoSession).lean();
  const entitlement=tenant&&require('../entitlements.service').resolveEntitlements(tenant);
  const canCommit=tenant?.status==='approved'&&tenant.isActive!==false&&location&&entitlement.writesAllowed&&entitlement.capabilities.includes('table_management');
  if (canCommit && (booking?.status === 'confirmed' || booking?.requestState === 'expired') && ['held','expired'].includes(capacity?.state)) {
    try {
      capacity = await require('./capacity').acquire({ tenantId: id(attempt.tenant), locationId: id(attempt.location), bookingId: id(booking), resourceIds: capacity.resources.map(String), bookingAt: booking.bookingAt.toISOString(), partySize: booking.partySize, policyVersion: capacity.policyVersion, expectedVersion: capacity.version, state: 'confirmed' }, mongoSession);
      booking.capacitySnapshot = require('./capacity').dto(capacity);
      if (booking.requestState === 'expired') { booking.status = 'confirmed'; booking.requestState = 'reviewed'; booking.requestVersion++; }
    } catch (error) {
      if (!['CAPACITY_UNAVAILABLE', 'STATE_CHANGED', 'CAPACITY_NOT_CONFIGURED', 'INVALID_INPUT'].includes(error.code)) throw error;
      capacity = null;
    }
  }
  if (capacity && (capacity.state !== 'confirmed' || capacity.end <= new Date())) capacity = null;
  const visit = booking?.serviceSession && await require('../../models/VenueServiceSession').findOne({ _id: booking.serviceSession, tenant: attempt.tenant, location: attempt.location }).session(mongoSession);
  const resolution = booking?.status === 'confirmed' && capacity || booking?.status === 'checked_in' && visit && !visit.billOrder ? 'none' : 'paid_needs_resolution';
  const [receipt] = await Receipt.create([{ tenant: attempt.tenant, location: attempt.location, booking: attempt.booking, payer: attempt.payer,
    collectionVersion: 2, purpose: 'venue_deposit', policySnapshot: attempt.policySnapshot, ...(visit ? { session: visit._id, ...(visit.billOrder ? { billOrder: visit.billOrder } : {}) } : {}),
    attempt: attempt._id, provider: 'paystack', reference: attempt.reference, providerTransactionId: String(data.transactionId), amountMinor: data.amountMinor,
    currency: data.currency, unappliedMinor: data.amountMinor, verifiedAt: new Date(), paidAt: new Date(data.paidAt || Date.now()), resolution }], { session: mongoSession });
  if (booking) { booking.moneyState = resolution === 'none' ? 'deposit_received' : 'paid_needs_resolution'; await booking.save({ session: mongoSession }); }
  attempt.state = 'verified'; attempt.receipt = receipt._id; attempt.providerTransactionId = String(data.transactionId); await attempt.save({ session: mongoSession });
  await require('./collections').enqueue({ tenant: attempt.tenant, location: attempt.location, kind: 'post_advance', targetId: receipt._id, mongoSession });
  if (resolution !== 'none') await require('./collections').enqueue({ tenant: attempt.tenant, location: attempt.location, kind: 'money_resolution', targetId: receipt._id, mongoSession });
  return id(receipt);
}
async function ensureIndexes() { for (const Model of [Attempt, require('../../models/VenuePaymentReceipt'), require('../../models/VenueOperation'), require('../../models/VenueWorkItem'), require('../../models/VenueFinancialPolicy'), require('../../models/VenuePaymentAllocation')]) await Model.createIndexes(); await require('../../models/AuditLog').createCollection(); }
module.exports = { ownedBooking, startDeposit, initializeOnce, recordAdvance, ensureIndexes, attemptDTO };
