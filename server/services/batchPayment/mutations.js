const mongoose = require("mongoose");
const { randomUUID } = require("node:crypto");
const Batch = require("../../models/BatchPayment");
const Claim = require("../../models/SourceBatchClaim");
const { allMembers, validate, paymentModel, accounts } = require("./members");
const { bad } = require("../accounting.query");
const { round2 } = require("../accounting.helpers");
const conflict = (message) => Object.assign(bad(message), { status: 409, statusCode: 409 });
async function requireSourceIndex() {
  let indexes;
  try {
    indexes = await Claim.collection.listIndexes().toArray();
  } catch {
    throw Object.assign(bad("Source receipt protection index is not ready"), {
      status: 503,
      statusCode: 503,
    });
  }
  if (
    !indexes.some(
      (i) =>
        i.unique &&
        i.partialFilterExpression?.active === true &&
        Object.keys(i.partialFilterExpression).length === 1 &&
        Object.keys(i.key).join(",") === "tenant,journal,account" &&
        Object.values(i.key).every((v) => v === 1),
    )
  )
    throw Object.assign(bad("Source receipt protection index is not ready"), {
      status: 503,
      statusCode: 503,
    });
}
function normalizeKey(value, account) {
  if (typeof value !== "string") throw bad("Invalid eligible payment selection");
  if (mongoose.isValidObjectId(value)) return `payment:${value.toLowerCase()}`;
  const match = /^(payment|source):([a-f0-9]{24})(?::(1000|1100|2200))?$/i.exec(value);
  if (!match || (match[1].toLowerCase() === "source" ? match[3] !== account : !!match[3]))
    throw bad("Invalid eligible payment selection");
  return `${match[1].toLowerCase()}:${match[2].toLowerCase()}${match[3] ? `:${match[3]}` : ""}`;
}
async function previewSelection({ tenantId, direction, paymentIds, account = "1100" }) {
  validate(direction, account);
  if (!Array.isArray(paymentIds) || !paymentIds.length || paymentIds.length > 500)
    throw bad("Choose between 1 and 500 eligible payments");
  const keys = paymentIds.map((value) => normalizeKey(value, account));
  if (new Set(keys).size !== keys.length) throw bad("Choose each eligible payment portion only once");
  const rows = await allMembers(tenantId, direction, account);
  return keys.map((key) => rows.find((row) => row.key === key)).filter(Boolean);
}
async function createBatch({ tenantId, direction, paymentIds, account = "1100", userId, expectedMembers }) {
  validate(direction, account);
  if (!Array.isArray(paymentIds) || !paymentIds.length || paymentIds.length > 500)
    throw bad("Choose between 1 and 500 eligible payments");
  const keys = paymentIds.map((value) => normalizeKey(value, account));
  if (new Set(keys).size !== keys.length) throw bad("Choose each eligible payment portion only once");
  if (keys.some((k) => k.startsWith("source:"))) await requireSourceIndex();
  try {
    return await mongoose.connection.transaction(async (session) => {
      const eligible = await allMembers(tenantId, direction, account, { session });
      const members = keys.map((key) => eligible.find((row) => row.key === key));
      if (members.some((m) => !m))
        throw conflict("Some selections are no longer eligible; refresh payments and review");
      if (expectedMembers !== undefined) {
        if (
          !Array.isArray(expectedMembers) ||
          expectedMembers.length !== keys.length ||
          new Set(expectedMembers.map((m) => m?.key)).size !== keys.length
        )
          throw bad("Invalid reviewed selection amounts");
        for (const member of members) {
          const expected = expectedMembers.find((m) => m.key === member.key);
          if (
            !expected ||
            ["amount", "capturedAmount", "refundedAmount"].some(
              (field) =>
                typeof expected[field] !== "number" ||
                !Number.isFinite(expected[field]) ||
                Math.abs(expected[field] - member[field]) > 0.001,
            )
          )
            throw conflict("Selection amounts changed; refresh payments and review");
        }
      }
      const total = round2(members.reduce((sum, m) => sum + m.amount, 0));
      if (!Number.isFinite(total) || total <= 0) throw bad("Invalid batch total");
      const [batch] = await Batch.create(
        [
          {
            tenant: tenantId,
            number: `BATCH-${randomUUID()}`,
            direction,
            account,
            total,
            members,
            membershipVersion: 2,
            createdBy: userId,
          },
        ],
        { session },
      );
      const sources = members.filter((m) => m.origin !== "accounting");
      if (sources.length)
        await Claim.create(
          sources.map((m) => ({
            tenant: tenantId,
            journal: m.journalId,
            account,
            batch: batch._id,
            active: true,
          })),
          { session },
        );
      const manual = members.filter((m) => m.origin === "accounting");
      if (manual.length) {
        const result = await paymentModel(direction).updateMany(
          { tenant: tenantId, _id: { $in: manual.map((m) => m.paymentId) }, status: "active", batch: null },
          { $set: { batch: batch._id } },
          { session },
        );
        if (result.modifiedCount !== manual.length)
          throw conflict("Some payments changed; refresh and review");
      }
      return batch;
    });
  } catch (error) {
    if (error.code === 11000)
      throw conflict("Receipt portion already belongs to another batch; refresh and review");
    throw error;
  }
}
async function legacyMembers(batch, session) {
  const groups = [];
  for (const account of accounts)
    groups.push(await allMembers(batch.tenant, batch.direction, account, { session, includeClaimed: true }));
  return groups.flat().filter((m) => m.origin === "accounting" && m.existingBatch === String(batch._id));
}
async function openBatch(tenant, id, session) {
  if (!mongoose.isValidObjectId(id)) throw bad("Invalid batch");
  const batch = await Batch.findOne({ _id: id, tenant, status: "open" }).session(session);
  if (!batch) throw conflict("Only an existing open batch can be changed");
  return batch;
}
async function depositBatch({ tenantId, id }) {
  return mongoose.connection.transaction(async (session) => {
    const batch = await openBatch(tenantId, id, session);
    if (batch.membershipVersion === 2) {
      const current = await allMembers(tenantId, batch.direction, batch.account, {
        session,
        includeClaimed: true,
      });
      for (const original of batch.members) {
        const member = current.find((m) => m.key === original.key);
        if (
          !member ||
          ["amount", "capturedAmount", "refundedAmount"].some(
            (field) => Math.abs(member[field] - original[field]) > 0.001,
          ) ||
          (member.origin === "accounting" && member.existingBatch !== String(batch._id))
        )
          throw conflict("Batch source evidence changed; review and rebuild this batch");
        if (
          member.origin !== "accounting" &&
          !(await Claim.exists({
            tenant: tenantId,
            journal: member.journalId,
            account: batch.account,
            batch: batch._id,
            active: true,
          }).session(session))
        )
          throw conflict("Batch receipt ownership changed; review this batch");
      }
      if (
        !batch.members.length ||
        Math.abs(round2(batch.members.reduce((n, m) => n + m.amount, 0)) - batch.total) > 0.001
      )
        throw conflict("Batch total changed; review this batch");
    } else {
      const members = await legacyMembers(batch, session);
      if (
        !members.length ||
        Math.abs(round2(members.reduce((n, m) => n + m.amount, 0)) - batch.total) > 0.001
      )
        throw conflict("Legacy batch members changed; review this batch");
      batch.members = members;
      batch.membershipVersion = 1;
    }
    batch.status = "deposited";
    batch.depositedAt = new Date();
    await batch.save({ session });
    return batch;
  });
}
async function cancelBatch({ tenantId, id }) {
  return mongoose.connection.transaction(async (session) => {
    const batch = await openBatch(tenantId, id, session);
    if (!batch.members?.length) {
      batch.members = await legacyMembers(batch, session);
      batch.membershipVersion = 1;
    }
    batch.status = "cancelled";
    await batch.save({ session });
    await Claim.updateMany(
      { tenant: tenantId, batch: batch._id, active: true },
      { $set: { active: false } },
      { session },
    );
    await paymentModel(batch.direction).updateMany(
      { tenant: tenantId, batch: batch._id },
      { $set: { batch: null } },
      { session },
    );
    return batch;
  });
}
module.exports = {
  createBatch,
  depositBatch,
  cancelBatch,
  requireSourceIndex,
  normalizeKey,
  previewSelection,
};
