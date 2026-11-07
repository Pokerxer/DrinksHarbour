'use strict';
const crypto = require('node:crypto');
const Portion = require('../../models/VenuePayerPortion'); const Attempt = require('../../models/VenuePaymentAttempt'); const Order = require('../../models/Order');
const { fail, requireId } = require('./errors'); const { id } = require('./eligibility');
const { runVenueOperation } = require('./operations'); const { visitContext } = require('./lines'); const { minor, sum, equalSplit } = require('./money-rules');
const { balanceFor } = require('./payer-balances');
function enabled() { if (process.env.VENUE_MONEY_ENABLED !== 'true') fail('VENUE_MONEY_NOT_ENABLED', 'Shared bill collection is not enabled', 404); }
function payerLinkToken(portionId, version = 0) {
  const secret = process.env.VENUE_PAYER_SECRET;
  if (!secret || secret.length < 32) fail('PAYER_CONFIGURATION_REQUIRED', 'Payer link signing is not configured');
  return crypto.createHmac('sha256', secret).update(`venue-payer:${portionId}:${version}`).digest('hex');
}
async function portionFor(args, mongoSession = null) {
  requireId(args.portionId); requireId(args.customerId);
  const customer = await require('../../models/User').exists({ _id: args.customerId, role: 'customer', status: 'active' }).session(mongoSession);
  const row = customer && await Portion.findOne({ _id: args.portionId }).session(mongoSession);
  if (!row || typeof args.token !== 'string' || !/^[a-f\d]{64}$/.test(args.token) || !crypto.timingSafeEqual(Buffer.from(args.token, 'hex'), Buffer.from(payerLinkToken(id(row), row.grantVersion), 'hex')) || row.payer && id(row.payer) !== args.customerId) fail('NOT_FOUND', 'Payer portion not found', 404);
  return row;
}
async function createPortions(args) {
  enabled(); payerLinkToken('configuration-check');
  const context = await visitContext({ ...args, action: 'collection.write' });
  await require('./financial-policy').moneyIndexesReady();
  const result = await runVenueOperation({ ...args, locationId: id(context.location), actor: context.actor, operation: 'payer.reserve', key: args.idempotencyKey, payload: { sessionId: args.sessionId, expectedVersion: args.expectedVersion, amountsMinor: args.amountsMinor, equalCount: args.equalCount, financialPolicyVersion: args.financialPolicyVersion, itemsByPortion: args.itemsByPortion }, execute: async ({ mongoSession }) => {
    const { visit } = await visitContext({ ...args, action: 'collection.write', mongoSession });
    if(args.locationId&&args.locationId!==id(visit.location))fail('NOT_FOUND','Visit not found',404);
    if (visit.version !== args.expectedVersion || visit.state !== 'closing') fail('STATE_CHANGED', 'Bill changed; refresh');
    const bill = await Order.findOne({ _id: visit.billOrder, tenant: args.tenantId, venueBillForSession: visit._id }).session(mongoSession);
    if (!bill || bill.paymentStatus !== 'pending') fail('STATE_CHANGED');
    if (await Attempt.exists({ tenant: args.tenantId, billOrder: bill._id, collectionVersion: { $ne: 2 } }).session(mongoSession)) fail('PAYMENT_PENDING', 'Existing full-bill collection requires reconciliation');
    await Order.updateOne({ _id: bill._id, tenant: args.tenantId }, { $inc: { venueMoneyLockVersion: 1 } }, { session: mongoSession });
    const policy = bill.venueFinancialPolicy || await require('./financial-policy').approvedSnapshot({ tenantId: args.tenantId, locationId: id(visit.location), version: args.financialPolicyVersion, mongoSession });
    await require('./financial-policy').preflightCollection({tenantId:args.tenantId,policy,mongoSession});
    const balance = await balanceFor(bill, mongoSession);
    const items = args.itemsByPortion ? require('./money-rules').itemPortions(bill.venueBillSnapshot, args.itemsByPortion) : null;
    if (items) {
      const committed = await Portion.find({ tenant: args.tenantId, billOrder: bill._id, $or: [{state: 'applied'}, ...require('./payer-balances').activePortions().$or] }).session(mongoSession).lean();
      if (items.some(p => p.acceptedLines.some(ref => committed.some(c => c.acceptedLines.some(r => r.lineId === ref.lineId && r.revision === ref.revision))))) fail('LINE_ALREADY_RESERVED', 'Accepted line already belongs to a payer');
    }
    const amounts = items ? items.map(p => p.amountMinor) : args.equalCount !== undefined ? equalSplit(balance.availableMinor, args.equalCount) : args.amountsMinor;
    if (!Array.isArray(amounts) || !amounts.length || amounts.length > 100 || amounts.some(a => { minor(a); return a === 0; }) || sum(...amounts) > balance.availableMinor) fail('BALANCE_RESERVED', 'Payer portions exceed the available balance');
    bill.venueMoneyVersion = 2; bill.venueFinancialPolicy = policy; await bill.save({ session: mongoSession });
    const rows = await Portion.create(amounts.map((amountMinor, index) => ({ acceptedLines: items?.[index].acceptedLines || [], tenant: args.tenantId, location: visit.location, session: visit._id, billOrder: bill._id, amountMinor, expiresAt: new Date(Date.now() + 900000) })), { session: mongoSession, ordered:true });
    visit.version++; await visit.save({ session: mongoSession });
    return { sessionId: id(visit), portionIds: rows.map(id), version: visit.version };
  } });
  const rows = await Portion.find({ _id: { $in: result.portionIds }, tenant: args.tenantId }).lean();
  return { version: result.version, portions: result.portionIds.map(pid => { const row = rows.find(r => id(r) === pid); return { id: pid, amountMinor: row.amountMinor, currency: row.currency, state: row.state, expiresAt: row.expiresAt.toISOString(), token: payerLinkToken(pid, row.grantVersion) }; }) };
}
async function collectPortion(args) {
  enabled(); if (typeof args.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email)) fail('INVALID_EMAIL', 'Receipt email required', 400);
  const original = await portionFor(args);
  const result = await runVenueOperation({ tenantId: id(original.tenant), locationId: id(original.location), actor: { userId: args.customerId, role: 'customer' }, operation: 'payer.collect', key: args.idempotencyKey, payload: { portionId: args.portionId, email: args.email }, execute: async ({ mongoSession }) => {
    const portion = await portionFor(args, mongoSession);
    const bill = await Order.findOne({ _id: portion.billOrder, tenant: portion.tenant, venueBillForSession: portion.session, venueMoneyVersion: 2 }).session(mongoSession);
    if (!bill) fail('NOT_FOUND', 'Bill not found', 404);
    const tenant = await require('../../models/Tenant').findOne({ _id: portion.tenant }).session(mongoSession).lean();
    if (!tenant || tenant.status !== 'approved' || tenant.isActive === false) fail('VENUE_DISABLED', 'Collection is not available', 403);
    await Order.updateOne({ _id: bill._id, tenant: portion.tenant }, { $inc: { venueMoneyLockVersion: 1 } }, { session: mongoSession });
    if (portion.attempt) return { sessionId: id(portion.session), attemptId: id(portion.attempt), version: 0 };
    if (portion.state !== 'reserved' || portion.expiresAt <= new Date() || bill.paymentStatus !== 'pending') fail('PAYER_PORTION_EXPIRED', 'Portion expired or bill changed; ask the host for a new link');
    const visit = await require('../../models/VenueServiceSession').findOne({_id:portion.session,tenant:portion.tenant,location:portion.location,billOrder:bill._id}).session(mongoSession).lean();
    const location = await require('../../models/Warehouse').findOne({_id:portion.location,tenant:portion.tenant,isActive:{$ne:false}}).session(mongoSession).lean();
    if(!visit||!location)fail('NOT_FOUND','Payable visit not found',404);
    const entitlement = require('../entitlements.service').resolveEntitlements(tenant);
    const writable = entitlement.writesAllowed && entitlement.capabilities.includes('table_management');
    // The signed portion grants only this existing obligation, never staff authority.
    const recovering = require('./subscription').authorizeVenueRecovery({actor:{tenantId:id(portion.tenant)},tenant,session:visit,command:'collection.write'}).allowed;
    if(!writable&&!recovering)fail('SUBSCRIPTION_READ_ONLY','Only an existing obligation predating subscription lapse may be paid',403);
    await require('./financial-policy').preflightCollection({tenantId:id(portion.tenant),policy:bill.venueFinancialPolicy,mongoSession});
    const [attempt] = await Attempt.create([{ tenant: portion.tenant, location: portion.location, session: portion.session, billOrder: bill._id, payer: args.customerId, payerPortion: portion._id, grantVersion: portion.grantVersion,
      collectionVersion: 2, collectionSlot: `payer:${id(portion)}`, purpose: 'venue_bill', policySnapshot: bill.venueFinancialPolicy,
      method: 'paystack', amountMinor: portion.amountMinor, currency: 'NGN', reference: `dhv-${crypto.randomUUID()}`, state: 'initializing', key: args.idempotencyKey, requestHash: require('./operations').fingerprint({ portionId: args.portionId, email: args.email }), actor: args.customerId }], { session: mongoSession });
    portion.payer = args.customerId; portion.attempt = attempt._id; portion.state = 'pending'; await portion.save({ session: mongoSession });
    await require('./collections').enqueue({ tenant: portion.tenant, location: portion.location, kind: 'verify_payment', targetId: attempt._id, mongoSession });
    return { sessionId: id(portion.session), attemptId: id(attempt), version: 0 };
  } });
  return require('./advances').attemptDTO(await require('./advances').initializeOnce(result.attemptId, args.email));
}
async function status(args) {
  const portion = await portionFor(args);
  const attempt = portion.attempt && await Attempt.findOne({ _id: portion.attempt, tenant: portion.tenant, payer: args.customerId }).select('+authorizationUrl').lean();
  return { collectionEnabled: process.env.VENUE_MONEY_ENABLED === 'true', id: id(portion), amountMinor: portion.amountMinor, currency: portion.currency, state: portion.state, expiresAt: portion.expiresAt.toISOString(), ...(attempt ? { payment: require('./advances').attemptDTO(attempt) } : {}) };
}
async function verifyPortion(args) {
  const portion = await portionFor(args);
  const attempt = portion.attempt && await Attempt.findOne({ _id: portion.attempt, tenant: portion.tenant, payer: args.customerId }).lean();
  if (!attempt) fail('NOT_FOUND', 'Payer attempt not found', 404);
  const receiptId = attempt.receipt || await require('./collections').verifyVenuePayment({ reference: attempt.reference });
  if(receiptId)await require('./settlement').settleVenueBill({ tenantId: id(portion.tenant), receiptId: id(receiptId) });
  return status(args);
}
async function listPortions(args){
  const {visit}=await visitContext({...args,action:'collection.write'});
  if(args.locationId&&args.locationId!==id(visit.location))fail('NOT_FOUND','Visit not found',404);
  const rows=await Portion.find({tenant:args.tenantId,location:visit.location,session:visit._id,billOrder:visit.billOrder}).sort({createdAt:1,_id:1}).lean();
  return {version:visit.version,portions:rows.map(row=>{const state=row.state==='reserved'&&row.expiresAt<=new Date()?'expired':row.state;return {id:id(row),amountMinor:row.amountMinor,currency:row.currency,state,expiresAt:row.expiresAt.toISOString(),...(state==='reserved'&&!row.attempt?{token:payerLinkToken(id(row),row.grantVersion)}:{})};})};
}
async function releasePortion(args) {
  requireId(args.portionId);
  const context=await visitContext({...args,action:'bill.reconcile'});
  return runVenueOperation({...args,locationId:id(context.location),actor:context.actor,operation:'payer.release',key:args.idempotencyKey,targetType:'VenuePayerPortion',payload:{sessionId:args.sessionId,portionId:args.portionId},execute:async({mongoSession})=>{
    const {visit}=await visitContext({...args,action:'bill.reconcile',mongoSession});
    if(args.locationId&&args.locationId!==id(visit.location))fail('NOT_FOUND','Visit not found',404);
    const row=await Portion.findOne({_id:args.portionId,tenant:args.tenantId,session:visit._id,billOrder:visit.billOrder}).session(mongoSession);
    if(!row)fail('NOT_FOUND','Portion not found',404);
    if(row.attempt||row.state!=='reserved')fail('PAYMENT_PENDING','Only unstarted reservations can be released; reconcile any initiated payment');
    await Order.updateOne({_id:visit.billOrder,tenant:args.tenantId},{$inc:{venueMoneyLockVersion:1}},{session:mongoSession});
    row.state='expired';row.grantVersion++;await row.save({session:mongoSession});visit.version++;await visit.save({session:mongoSession});
    return {id:id(row),state:row.state,version:visit.version};
  }});
}
async function ensureIndexes() { await require('./advances').ensureIndexes(); for (const Model of [Portion, require('../../models/VenuePaymentAllocation')]) await Model.createIndexes(); }
module.exports = { enabled, listPortions, releasePortion, payerLinkToken, createPortions, collectPortion, status, verifyPortion, ensureIndexes };
