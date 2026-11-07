'use strict';
const mongoose = require('mongoose');
const Enrollment = require('../../models/MarketEnrollment');
const Policy = require('../../models/MarketCategoryPolicy');
const Tenant = require('../../models/Tenant');
const Audit = require('../../models/AuditLog');
const country = require('../country');
const v = require('./validation');
const keys = ['market', 'category', 'channel'];
const conflict = () => v.error('Market revision changed; reload before saving', 409, 'MARKET_CONFLICT');
async function ensureIndexes() {
  await Promise.all([Enrollment.createIndexes(), Policy.createIndexes(), Audit.createCollection()]);
}
async function append(Model, scope, expectedVersion, state, actor, action, expectedId) {
  let indexes;
  try { indexes = await Model.collection.indexes(); }
  catch (e) { if (e.code !== 26) throw e; indexes = []; }
  const required = { ...Object.fromEntries(Object.keys(scope).map(key => [key, 1])), version: 1 };
  const ready = indexes.some(index => index.unique === true && !index.sparse && !index.partialFilterExpression &&
    Object.keys(index.key).length === Object.keys(required).length && Object.entries(required).every(([key, value]) => index.key[key] === value));
  if (!ready) throw v.error('Market revision indexes require reviewed preparation', 503, 'MARKET_INDEXES_REQUIRED');
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const current = await Model.findOne(scope).sort({ version: -1 }).session(session).lean();
      if ((current?.version || 0) !== expectedVersion || (expectedId && String(current?._id) !== expectedId)) throw conflict();
      if (action === 'MARKET_ENROLLMENT_APPLY' && current?.status === 'approved' && +new Date(current.effectiveUntil) > Date.now()) {
        throw v.error('Renewals or changes to this approval require platform review', 409, 'MARKET_APPROVAL_REVIEW_REQUIRED');
      }
      const [row] = await Model.create([{ ...scope, ...state, version: expectedVersion + 1, actor: actor._id }], { session });
      await Audit.create([{
        actorUserId: actor._id, actorRole: actor.role, action, actionCategory: 'update',
        targetType: Model.modelName, targetId: row._id, targetTenantId: scope.tenant,
        justification: state.reason, changes: { before: current, after: row.toObject() },
      }], { session });
      return row.toObject();
    });
  } catch (error) {
    if (error.code === 11000) throw conflict();
    throw error;
  } finally { await session.endSession(); }
}
async function existingTenants(ids) {
  if (await Tenant.countDocuments({ _id: { $in: ids } }) !== ids.length) throw v.error('A referenced tenant does not exist');
}
async function apply({ actor, input }) {
  const tenant = v.owner(actor);
  v.fields(input, [...keys, 'statement', 'expectedVersion']);
  const scope = v.scope(input), expectedVersion = v.version(input.expectedVersion);
  const statement = v.text(input.statement, 'Application statement');
  await country.resolveCountry(scope.market, { requireActive: false });
  await existingTenants([tenant]);
  return append(Enrollment, { ...scope, tenant }, expectedVersion, { status: 'pending', statement, reason: statement }, actor, 'MARKET_ENROLLMENT_APPLY');
}
async function review({ actor, enrollmentId, input }) {
  v.admin(actor); enrollmentId = v.id(enrollmentId, 'enrollment');
  v.fields(input, ['expectedVersion', 'status', 'reason', 'effectiveFrom', 'effectiveUntil']);
  const expectedVersion = v.version(input.expectedVersion), reason = v.text(input.reason, 'Review reason');
  if (!['approved', 'rejected', 'suspended'].includes(input.status)) throw v.error('Invalid review status');
  const dates = input.status === 'approved' ? v.term(input) : {};
  if (input.status !== 'approved' && (input.effectiveFrom !== undefined || input.effectiveUntil !== undefined)) throw v.error('Only approvals accept effective dates');
  const current = await Enrollment.findOne({ _id: enrollmentId }).lean();
  if (!current) throw v.error('Enrollment not found', 404, 'MARKET_NOT_FOUND');
  const scope = { tenant: current.tenant, market: current.market, category: current.category, channel: current.channel };
  return append(Enrollment, scope, expectedVersion, { statement: current.statement, status: input.status, reason, ...dates }, actor, 'MARKET_ENROLLMENT_REVIEW', enrollmentId);
}
async function createPolicy({ actor, input }) {
  v.admin(actor);
  v.fields(input, [...keys, 'expectedVersion', 'mode', 'exclusiveTenant', 'exceptions', 'effectiveFrom', 'effectiveUntil', 'contractReference', 'reason']);
  const scope = v.scope(input), expectedVersion = v.version(input.expectedVersion);
  if (!['open', 'closed', 'exclusive'].includes(input.mode)) throw v.error('Invalid policy mode');
  const dates = v.term(input), reason = v.text(input.reason, 'Review reason');
  const contractReference = v.text(input.contractReference, 'Contract reference');
  const exceptions = input.exceptions ?? [];
  if (!Array.isArray(exceptions) || exceptions.length > 100) throw v.error('At most 100 explicit tenant exceptions are supported');
  const ids = exceptions.map(value => v.id(value));
  if (new Set(ids).size !== ids.length) throw v.error('Duplicate tenant exception');
  let exclusiveTenant;
  if (input.mode === 'exclusive') exclusiveTenant = v.id(input.exclusiveTenant);
  else if (input.exclusiveTenant != null || ids.length) throw v.error('Only exclusive policies accept tenant restrictions');
  if (ids.includes(exclusiveTenant)) throw v.error('Exclusive tenant cannot also be an exception');
  await country.resolveCountry(scope.market, { requireActive: false });
  await existingTenants([...ids, ...(exclusiveTenant ? [exclusiveTenant] : [])]);
  return append(Policy, scope, expectedVersion, { mode: input.mode, exclusiveTenant, exceptions: ids, ...dates, reason, contractReference }, actor, 'MARKET_POLICY_REVISE');
}
async function latest(Model, match, group) {
  return Model.aggregate([{ $match: match }, { $sort: { version: -1 } }, { $group: { _id: group, row: { $first: '$$ROOT' } } }, { $replaceRoot: { newRoot: '$row' } }, { $sort: { market: 1, category: 1, channel: 1, _id: 1 } }]);
}
function listEnrollments({ actor, mine = false }) {
  const match = mine ? { tenant: new mongoose.Types.ObjectId(v.owner(actor)) } : (v.admin(actor), {});
  return latest(Enrollment, match, { tenant: '$tenant', market: '$market', category: '$category', channel: '$channel' });
}
function listPolicies({ actor }) {
  v.admin(actor);
  return latest(Policy, {}, { market: '$market', category: '$category', channel: '$channel' });
}
module.exports = { ensureIndexes, apply, review, createPolicy, listEnrollments, listPolicies };
