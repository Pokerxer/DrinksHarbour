const Batch = require("../../models/BatchPayment");
const Claim = require("../../models/SourceBatchClaim");
const { bad, dateRange, escapeSearch } = require("../accounting.query");
const { allMembers, paymentModel, accounts } = require("./members");
const { round2 } = require("../accounting.helpers");
function filterFor(tenant, options) {
  const filter = { tenant };
  for (const [key, allowed] of Object.entries({
    direction: ["customer", "vendor"],
    status: ["open", "deposited", "cancelled"],
    account: accounts,
  })) {
    if (options[key]) {
      if (!allowed.includes(options[key])) throw bad(`Invalid batch ${key}`);
      filter[key] = options[key];
    }
  }
  if (["from", "to"].some((key) => options[key] && typeof options[key] !== "string"))
    throw bad("Invalid batch date");
  const dates = dateRange(options);
  if (dates) filter.date = dates;
  if (options.search) {
    if (typeof options.search !== "string") throw bad("Invalid batch search");
    const rx = new RegExp(escapeSearch(options.search.trim()), "i");
    filter.$or = [{ number: rx }, { "members.number": rx }, { "members.name": rx }];
  }
  return filter;
}
function summaryPipeline(filter) {
  const fields = {};
  for (const [status, label] of [
    ["open", "open"],
    ["deposited", "completed"],
    ["cancelled", "cancelled"],
  ]) {
    fields[`${label}Count`] = { $sum: { $cond: [{ $eq: ["$status", status] }, 1, 0] } };
    fields[`${label}Amount`] = { $sum: { $cond: [{ $eq: ["$status", status] }, "$total", 0] } };
  }
  return [{ $match: filter }, { $group: { _id: null, ...fields } }];
}
async function listBatches(tenant, options = {}) {
  const filter = filterFor(tenant, options);
  if ([options.page, options.limit].some((value) => value !== undefined && !Number.isFinite(Number(value))))
    throw bad("Invalid batch pagination");
  const page = Math.max(1, Math.floor(Number(options.page) || 1)),
    limit = Math.min(100, Math.max(1, Math.floor(Number(options.limit) || 25)));
  const [data, total, sums] = await Promise.all([
    Batch.find(filter)
      .sort({ date: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Batch.countDocuments(filter),
    Batch.aggregate(summaryPipeline(filter)),
  ]);
  const cache = new Map();
  const currentFor = (direction, account) => {
    const key = `${direction}:${account}`;
    if (!cache.has(key)) cache.set(key, allMembers(tenant, direction, account, { includeClaimed: true }));
    return cache.get(key);
  };
  const claims = data.length
    ? await Claim.find({ tenant, batch: { $in: data.map((b) => b._id) }, active: true })
        .select("batch journal account")
        .lean()
    : [];
  const rows = [];
  for (const batch of data) {
    let members = batch.members;
    const legacy = batch.membershipVersion !== 2;
    if (!members?.length && batch.status !== "cancelled") {
      const payments = await paymentModel(batch.direction).find({ tenant, batch: batch._id }).lean();
      members = payments.map((p) => ({
        key: `payment:${p._id}`,
        paymentId: String(p._id),
        origin: "accounting",
        account: batch.account,
        number: p.number,
        name: p.customerName || p.vendorName || "Account",
        date: p.date,
        method: p.method,
        capturedAmount: p.amount,
        refundedAmount: 0,
        amount: p.amount,
        allocations: p.allocations || [],
      }));
    }
    members = members || [];
    const current =
      batch.status !== "cancelled" && members.length
        ? legacy
          ? (await Promise.all(accounts.map((a) => currentFor(batch.direction, a)))).flat()
          : await currentFor(batch.direction, batch.account)
        : [];
    const changed =
      batch.status !== "cancelled" &&
      (!members.length ||
        members.some((m) => {
          const now = current.find((r) => r.key === m.key);
          if (
            !now ||
            Math.abs(now.amount - m.amount) > 0.001 ||
            (!legacy &&
              ["capturedAmount", "refundedAmount"].some((field) => Math.abs(now[field] - m[field]) > 0.001))
          )
            return true;
          if (now.origin === "accounting") return now.existingBatch !== String(batch._id);
          return !claims.some(
            (c) =>
              String(c.batch) === String(batch._id) &&
              String(c.journal) === now.journalId &&
              c.account === batch.account,
          );
        }) ||
        Math.abs(round2(members.reduce((n, m) => n + m.amount, 0)) - batch.total) > 0.001);
    rows.push({
      ...batch,
      members,
      historyAvailable: members.length > 0,
      needsReview: changed,
      reviewReason: changed
        ? "Member evidence or amounts changed; review the original records before completion."
        : "",
      payments: members.map((m) => ({
        _id: m.key,
        number: m.number,
        customerName: batch.direction === "customer" ? m.name : undefined,
        vendorName: batch.direction === "vendor" ? m.name : undefined,
        amount: m.amount,
        date: m.date,
        method: m.method,
        status: batch.status === "cancelled" ? "released" : "active",
      })),
    });
  }
  const empty = {
    openCount: 0,
    openAmount: 0,
    completedCount: 0,
    completedAmount: 0,
    cancelledCount: 0,
    cancelledAmount: 0,
  };
  return {
    data: rows,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    batchSummary: { ...empty, ...sums[0], _id: undefined },
  };
}
module.exports = { listBatches, filterFor, summaryPipeline };
