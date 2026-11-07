"use strict";
// Read-only platform-ops audit history view over the existing AuditLog model.
// Whitelisted projection only — never raw `changes` before/after payloads.
const mongoose = require("mongoose"),
  AuditLog = require("../../models/AuditLog"),
  { NotFoundError, ValidationError } = require("../../utils/errors");
const WHITELIST = [
  "action",
  "actionCategory",
  "actorRole",
  "actorEmail",
  "result",
  "errorMessage",
  "justification",
  "targetType",
  "timestamp",
];
function entry(row) {
  const view = Object.fromEntries(
    WHITELIST.filter((key) => row[key] !== undefined && row[key] !== null).map(
      (key) => [key, row[key]]
    )
  );
  view.targetId = row.targetId ? String(row.targetId) : null;
  return view;
}
// Existing access.audit convention: parent order ObjectId as targetId and the
// child identity in changes.after.merchantOrder. Control audits may also carry
// the entity id itself as targetId.
function entityQuery(kind, row) {
  const or = [];
  if (kind === "refund" && mongoose.isValidObjectId(String(row._id)))
    or.push({ targetId: row._id });
  if (row.order && mongoose.isValidObjectId(String(row.order)))
    or.push({ targetId: row.order });
  if (row.merchantOrder)
    or.push({ "changes.after.merchantOrder": String(row.merchantOrder) });
  return or.length ? { $or: or } : { _id: null };
}
async function forEntity(kind, row, { limit = 50 } = {}) {
  const rows = await AuditLog.find(entityQuery(kind, row))
    .sort({ timestamp: -1, _id: -1 })
    .limit(limit)
    .lean();
  return rows.map(entry);
}
// Audit history must remain readable after an entity leaves the queue (e.g. a
// reconciled booking), so the entity may exist in any state here.
async function byId(actor, kind, id) {
  require("./exceptionsQueue").platformOps(actor);
  if (!["refund", "carrier", "return"].includes(kind))
    throw new ValidationError("Unknown platform-ops audit kind");
  if (!id) throw new ValidationError("Audit target id required");
  const Model = {
    refund: require("../../models/MerchantRefundAllocation"),
    carrier: require("../../models/MerchantCarrierBooking"),
    return: require("../../models/MerchantDeliveryReturn"),
  }[kind];
  const filter =
    kind === "refund"
      ? mongoose.isValidObjectId(String(id))
        ? { _id: id }
        : null
      : { _id: String(id) };
  if (!filter) throw new NotFoundError("Audit target not found");
  const row = await Model.findOne(filter).lean();
  if (!row) throw new NotFoundError("Audit target not found");
  return forEntity(kind, row);
}
module.exports = { forEntity, byId };
