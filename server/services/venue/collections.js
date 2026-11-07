'use strict';
const crypto = require('node:crypto'); const mongoose = require('mongoose');
const Attempt = require('../../models/VenuePaymentAttempt'); const Receipt = require('../../models/VenuePaymentReceipt');
const Work = require('../../models/VenueWorkItem'); const Order = require('../../models/Order');
const { visitContext } = require('./lines'); const { getBill } = require('./billing');
const { runVenueOperation, fingerprint } = require('./operations'); const { fail } = require('./errors'); const { id } = require('./eligibility');
function validateTender(snapshot, input) {
  if (!['cash', 'paystack'].includes(input.method)) fail('VENUE_UNSUPPORTED_TENDER', 'Unsupported venue tender; use full-bill cash or Paystack', 422);
  if (input.method === 'cash') {
    if (snapshot.acquisition.kind !== 'direct' || !snapshot.posSessionId) fail('VENUE_UNSUPPORTED_TENDER', 'Cash requires a direct visit with a bound POS drawer', 422);
    if (!Number.isSafeInteger(input.amountTenderedMinor) || input.amountTenderedMinor < snapshot.totalMinor) fail('INVALID_MONEY', 'Cash received must cover the full bill', 400);
    return { changeMinor: input.amountTenderedMinor - snapshot.totalMinor };
  }
  return { changeMinor: 0 };
}
function validateVerifiedPayment(attempt, result) {
  const data = result?.data;
  if (!result?.success || result.status !== 'paid' || !data) fail('PAYMENT_PENDING', 'Payment has not been verified');
  if (!(attempt.purpose === 'venue_bill' || attempt.collectionVersion === 2 && attempt.purpose === 'venue_deposit') || data.reference !== attempt.reference || data.currency !== attempt.currency || data.currency !== 'NGN'
    || !Number.isSafeInteger(data.amountMinor) || data.amountMinor !== attempt.amountMinor || !/^[\w-]+$/.test(String(data.transactionId || ''))) fail('PAYMENT_REVIEW_REQUIRED', 'Provider payment does not match this bill');
  return data;
}
async function enqueue({ tenant, location, kind, targetId, mongoSession }) {
  await Work.updateOne({ tenant, kind, dedupeKey: id(targetId) }, { $setOnInsert: { tenant, location, kind, targetId, dedupeKey: id(targetId), state: 'pending', nextRunAt: new Date() } }, { upsert: true, session: mongoSession });
}
async function recordVerifiedPayment(reference, result) {
  const mongoSession = await mongoose.startSession();
  try {
    return await mongoSession.withTransaction(async () => {
      const attempt = await Attempt.findOne({ reference }).session(mongoSession);
      if (!attempt) fail('NOT_FOUND', 'Payment attempt not found', 404);
      const data = validateVerifiedPayment(attempt, result);
      const previous = await Receipt.findOne({ attempt: attempt._id, tenant: attempt.tenant }).session(mongoSession);
      if (previous) return id(previous);
      if (attempt.collectionVersion === 2 && attempt.purpose === 'venue_deposit') return require('./advances').recordAdvance({ attempt, data, mongoSession });
      const [receipt] = await Receipt.create([{ tenant: attempt.tenant, location: attempt.location, session: attempt.session, billOrder: attempt.billOrder,
        collectionVersion: attempt.collectionVersion, purpose: attempt.purpose, payer: attempt.payer, policySnapshot: attempt.policySnapshot,
        attempt: attempt._id, provider: 'paystack', reference, providerTransactionId: String(data.transactionId), amountMinor: data.amountMinor, currency: 'NGN', verifiedAt: new Date(), paidAt: new Date(data.paidAt || Date.now()) }], { session: mongoSession });
      attempt.state = 'verified'; attempt.receipt = receipt._id; attempt.providerTransactionId = String(data.transactionId); await attempt.save({ session: mongoSession });
      await Order.updateOne({ _id: attempt.billOrder, tenant: attempt.tenant, venueBillForSession: attempt.session, venueSettlementState:{$ne:'settled'} }, { $set: { venueSettlementState: 'receipt_verified' } }, { session: mongoSession });
      if(attempt.collectionVersion===2)await enqueue({tenant:attempt.tenant,location:attempt.location,kind:'post_advance',targetId:receipt._id,mongoSession});
      await enqueue({ tenant: attempt.tenant, location: attempt.location, kind: 'settle_bill', targetId: receipt._id, mongoSession });
      return id(receipt);
    });
  } finally { await mongoSession.endSession(); }
}
async function collectBill(args) {
  const { tenantId, sessionId, actor, expectedVersion, quoteId, method, amountTenderedMinor, email, idempotencyKey } = args;
  const context = await visitContext({ ...args, action: 'collection.write' });
  if (!context.visit.billOrder) fail('BILL_NOT_FROZEN', 'Freeze the bill before collecting');
  const initialBill = await Order.findOne({ _id: context.visit.billOrder, tenant: tenantId, venueBillForSession: sessionId }).lean();
  if (!initialBill) fail('BILL_LINK_CONFLICT');
  if (initialBill.venueMoneyVersion === 2) fail('PAYER_COLLECTION_REQUIRED', 'Collect against the reserved payer portions');
  const tender = validateTender(initialBill.venueBillSnapshot, { method, amountTenderedMinor });
  if (method === 'paystack' && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) fail('INVALID_EMAIL', 'Customer receipt email required', 400);
  const payload = { sessionId, expectedVersion, quoteId, method, amountTenderedMinor, email };
  const hash = fingerprint(payload);
  await require('./accounting').preflightVenueAccounting({ tenantId, snapshot: initialBill.venueBillSnapshot, method });
  const claim = await runVenueOperation({ tenantId, locationId: id(context.location), actor: context.actor, operation: 'collection.start', key: idempotencyKey, payload,
    execute: async ({ mongoSession }) => {
      const { visit } = await visitContext({ ...args, action: 'collection.write', mongoSession });
      const bill = await Order.findOne({ _id: visit.billOrder, tenant: tenantId, venueBillForSession: visit._id }).session(mongoSession);
      const existing = await Attempt.findOne({ tenant: tenantId, billOrder: bill._id }).session(mongoSession);
      if (existing) {
        if (existing.key === idempotencyKey && existing.requestHash !== hash) fail('IDEMPOTENCY_CONFLICT');
        if (existing.method !== method) fail('PAYMENT_PENDING', 'Another tender already owns this bill');
        return { sessionId, attemptId: id(existing), version: visit.version };
      }
      if (visit.state !== 'closing' || visit.version !== expectedVersion || bill.venueBillSnapshot.quoteId !== quoteId || bill.paymentStatus !== 'pending') fail('STATE_CHANGED', 'Bill changed; refresh');
      if (method === 'cash') {
        const drawer = await require('../../models/POSSession').findOne({ _id: visit.posSessionId, tenant: tenantId, warehouse: visit.location, status: 'open' }).session(mongoSession);
        if (!drawer) fail('DRAWER_NOT_OPEN', 'Bound cash drawer is not open');
      }
      const [attempt] = await Attempt.create([{ tenant: tenantId, location: visit.location, session: visit._id, billOrder: bill._id, actor: actor.userId,
        method, amountMinor: bill.venueBillSnapshot.totalMinor, reference: `dhv-${crypto.randomUUID()}`, state: method === 'cash' ? 'verified' : 'initializing',
        key: idempotencyKey, requestHash: hash, changeMinor: tender.changeMinor }], { session: mongoSession });
      if (method === 'cash') {
        const [receipt] = await Receipt.create([{ tenant: tenantId, location: visit.location, session: visit._id, billOrder: bill._id, attempt: attempt._id,
          provider: 'cash', reference: attempt.reference, amountMinor: attempt.amountMinor, currency: 'NGN', verifiedAt: new Date(), paidAt: new Date() }], { session: mongoSession });
        attempt.receipt = receipt._id; await attempt.save({ session: mongoSession });
        await enqueue({ tenant: tenantId, location: visit.location, kind: 'settle_bill', targetId: receipt._id, mongoSession });
      } else await enqueue({ tenant: tenantId, location: visit.location, kind: 'verify_payment', targetId: attempt._id, mongoSession });
      await Order.updateOne({ _id: bill._id, tenant: tenantId }, { $set: { venueSettlementState: method === 'cash' ? 'receipt_verified' : 'payment_pending' } }, { session: mongoSession });
      visit.version++; await visit.save({ session: mongoSession });
      return { sessionId, attemptId: id(attempt), version: visit.version };
    } });
  if (method === 'paystack') {
    const initializer = await Attempt.findOneAndUpdate({ _id: claim.attemptId, tenant: tenantId, state: 'initializing', initializationStartedAt: null }, { $set: { initializationStartedAt: new Date() } }, { new: true });
    if (initializer) {
      try {
        const result = await require('./paystack').initialize(initializer, email, { pos: !!initialBill.posSessionId });
        if (typeof result.authorizationUrl !== 'string' || !result.authorizationUrl.startsWith('https://')) fail('PROVIDER_INITIALIZATION_UNKNOWN');
        await Attempt.updateOne({ _id: initializer._id, tenant: tenantId, state: 'initializing' }, { $set: { authorizationUrl: result.authorizationUrl, state: 'pending' } });
      } catch { await Attempt.updateOne({ _id: initializer._id, tenant: tenantId, state: 'initializing' }, { $set: { state: 'needs_review' } }); }
    }
  }
  let attempt = await Attempt.findOne({ _id: claim.attemptId, tenant: tenantId }).select('+authorizationUrl').lean();
  if (attempt.receipt) {
    try { await require('./settlement').settleVenueBill({ tenantId, receiptId: id(attempt.receipt), actor }); } catch { /* receipt/work already durable: never charge again */ }
    attempt = await Attempt.findOne({ _id: claim.attemptId, tenant: tenantId }).select('+authorizationUrl').lean();
  }
  return { orderId: id(attempt.billOrder), attemptId: id(attempt), receiptId: id(attempt.receipt) || undefined, state: attempt.state,
    authorizationUrl: attempt.authorizationUrl, changeMinor: attempt.changeMinor || 0, bill: await getBill(args) };
}
async function verifyVenuePayment({ reference }) {
  const attempt = await Attempt.findOne({ reference, method: 'paystack' }).lean();
  if (!attempt) fail('NOT_FOUND', 'Venue payment attempt not found', 404);
  if (attempt.receipt) return id(attempt.receipt);
  const result=await require('./paystack').verify(reference);
  if(attempt.collectionVersion===2&&attempt.payerPortion&&require('./payer-failures').failureMatches(attempt,result)){
    const released=await require('./payer-failures').recordFailure(reference,result);if(released)return null;
    const current=await Attempt.findOne({_id:attempt._id,tenant:attempt.tenant}).lean();if(current?.receipt)return id(current.receipt);
  }
  return recordVerifiedPayment(reference,result);
}
async function ensureIndexes() { for (const Model of [Attempt, Receipt, Work, require('../../models/VenuePaymentAllocation')]) await Model.createIndexes(); }
module.exports = { collectBill, verifyVenuePayment, recordVerifiedPayment, validateTender, validateVerifiedPayment, enqueue, ensureIndexes };
