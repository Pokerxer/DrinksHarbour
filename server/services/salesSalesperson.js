const { isValidObjectId } = require('mongoose');

/** Snapshot a readable name while keeping the authenticated user's identity. */
function salespersonIdentity(user) {
  const fullName = [user?.firstName, user?.lastName]
    .filter(value => typeof value === 'string' && value.trim())
    .map(value => value.trim()).join(' ');
  const salesperson = [fullName, user?.displayName, user?.name, user?.email]
    .find(value => typeof value === 'string' && value.trim())?.trim() || '';
  return {
    salesperson,
    salespersonUser: isValidObjectId(user?._id) ? user._id : undefined,
  };
}

/** New documents match identity even after a name change. Legacy names remain
 * searchable, but never override a different user's explicit assignment. */
function mySalespersonQuery(user) {
  const { salesperson, salespersonUser } = salespersonIdentity(user);
  if (!salespersonUser) return { _id: { $in: [] } };
  if (!salesperson) return { salespersonUser };
  return { $or: [
    { salespersonUser },
    { salespersonUser: null, salesperson },
  ] };
}

/** A successful content edit makes the authenticated editor the quotation's
 * salesperson. Keep assignment/history unchanged when persistence fails. */
async function saveSalesEdit(document, user) {
  const before = {
    salesperson: document.salesperson,
    salespersonUser: document.salespersonUser,
  };
  const actor = salespersonIdentity(user);
  const reassign = !document.fulfillmentAttribution?.at && document.docType === 'quotation' &&
    actor.salespersonUser && actor.salesperson;
  if (reassign) {
    Object.assign(document, actor);
    // A different editor may have saved since this document was loaded. Force
    // these fields into this write even when they equal our loaded snapshot.
    document.markModified?.('salesperson');
    document.markModified?.('salespersonUser');
  }
  try {
    await document.save();
  } catch (error) {
    Object.assign(document, before);
    throw error;
  }
  if (reassign && (before.salesperson !== actor.salesperson ||
    String(before.salespersonUser || '') !== String(actor.salespersonUser))) {
    await require('./salesActivity.service').logActivity(document.tenant, document._id, {
      subject: `Salesperson: ${before.salesperson || 'Unassigned'} → ${actor.salesperson}`,
      meta: { field: 'salesperson', from: before.salesperson || '', to: actor.salesperson,
        fromUser: before.salespersonUser, toUser: actor.salespersonUser },
      userId: actor.salespersonUser,
    });
  }
  return document;
}

function completeFulfillment(document, user) {
  if (document.orderStatus !== 'fulfilled' || document.fulfillmentAttribution?.at) return;
  const actor = salespersonIdentity(user);
  if (!actor.salespersonUser || !actor.salesperson) return;
  document.fulfillmentAttribution = {
    user: actor.salespersonUser, name: actor.salesperson, at: new Date(),
  };
  Object.assign(document, actor);
  for (const path of ['fulfillmentAttribution', 'salesperson', 'salespersonUser'])
    document.markModified?.(path);
}

async function fulfillmentActorForReceipt(receipt, actor, tenantId, session) {
  if (!receipt?.posStaff || String(receipt.posStaff?._id || receipt.posStaff) === String(actor?._id || ''))
    return actor;
  let query = require('../models/User').findOne({ _id: receipt.posStaff, tenant: tenantId })
    .select('_id firstName lastName displayName email');
  if (session) query = query.session(session);
  return query.lean();
}

function frozenAttributionState(document) {
  const attribution = document.fulfillmentAttribution;
  if (!attribution?.at) return null;
  const id = value => String(value?._id || value || '');
  return JSON.stringify({ name: attribution.name, user: id(attribution.user), at: attribution.at,
    salesperson: document.salesperson, salespersonUser: id(document.salespersonUser) });
}

function protectFulfillmentAttribution(schema) {
  const restoreWhere = doc => {
    if (!doc?.$locals.attributionWhereGuard) return;
    doc.$where = doc.$locals.attributionPriorWhere;
    delete doc.$locals.attributionWhereGuard;
    delete doc.$locals.attributionPriorWhere;
  };
  const capture = doc => {
    doc.$locals.frozenFulfillmentAttribution = frozenAttributionState(doc);
    restoreWhere(doc);
  };
  schema.post('init', capture);
  schema.post('save', capture);
  function guardLoaded() {
    const original = this.$locals.frozenFulfillmentAttribution;
    if (original && original !== frozenAttributionState(this))
      throw new (require('../utils/errors').ConflictError)('Fulfillment attribution is locked.');
  }
  schema.pre('validate', guardLoaded);
  schema.pre('save', function () {
    guardLoaded.call(this);
    if (!this.isNew && !this.$locals.frozenFulfillmentAttribution &&
      ['salesperson', 'salespersonUser', 'fulfillmentAttribution'].some(path => this.isModified(path))) {
      // Mongoose merges document.$where into the actual update predicate.
      // A stale quote loaded before completion must fail rather than restamp it.
      if (!this.$locals.attributionWhereGuard) this.$locals.attributionPriorWhere = this.$where;
      this.$locals.attributionWhereGuard = true;
      this.$where = { ...(this.$where || {}), fulfillmentAttribution: { $exists: false } };
    }
  });
  schema.post('save', function (error, doc, next) { restoreWhere(doc); next(error); });
  schema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace'], function () {
    const update = this.getUpdate() || {};
    const protectedPath = path => ['salesperson', 'salespersonUser', 'fulfillmentAttribution'].includes(path.split('.')[0]);
    const touches = Array.isArray(update) || ['replaceOne', 'findOneAndReplace'].includes(this.op) ||
      Object.entries(update).some(([key, value]) => key.startsWith('$')
        ? Object.keys(value || {}).some(protectedPath) ||
          (key === '$rename' && Object.values(value || {}).some(protectedPath))
        : protectedPath(key));
    if (touches) this.setQuery({ $and: [this.getFilter(), { fulfillmentAttribution: { $exists: false } }] });
  });
}

module.exports = { salespersonIdentity, mySalespersonQuery, saveSalesEdit,
  completeFulfillment, fulfillmentActorForReceipt, protectFulfillmentAttribution };
