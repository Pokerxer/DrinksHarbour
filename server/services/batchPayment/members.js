const mongoose = require("mongoose");
const { round2 } = require("../accounting.helpers");
const { bad, escapeSearch } = require("../accounting.query");
const accounts = ["1000", "1100", "2200"];
const paymentModel = (direction) =>
  require(`../../models/${direction === "customer" ? "CustomerPayment" : "VendorPayment"}`);
function validate(direction, account) {
  if (!["customer", "vendor"].includes(direction)) throw bad("Invalid batch direction");
  if (!accounts.includes(account)) throw bad("Invalid reconciliation account");
}
function sourceMember(row, account) {
  if (!accounts.includes(account) || row.status !== "active" || row.refundIssue) return null;
  const tenders = row.tenders || {},
    refunds = row.refundsByAccount || {};
  for (const code of accounts) {
    const gross = Number(tenders[code] || 0),
      refunded = Number(refunds[code] || 0);
    if (
      !Number.isFinite(gross) ||
      !Number.isFinite(refunded) ||
      gross < 0 ||
      refunded < 0 ||
      refunded > gross + 0.01
    )
      return null;
  }
  if (row.refundedAmount > 0 && !Object.keys(refunds).length) return null;
  const capturedAmount = round2(tenders[account] || 0),
    refundedAmount = round2(refunds[account] || 0);
  const amount = round2(capturedAmount - refundedAmount);
  if (!(amount > 0) || ![capturedAmount, refundedAmount, amount].every(Number.isFinite)) return null;
  const journalId = String(row._id).replace(/^source:/, "");
  if (!mongoose.isValidObjectId(journalId)) return null;
  const key = `source:${journalId}:${account}`;
  return {
    key,
    _id: key,
    origin: row.source,
    account,
    journalId,
    sourceId: row.sourceId,
    number: row.number || "Source receipt",
    name: row.customerName || "Customer",
    date: row.date,
    method: row.method,
    capturedAmount,
    refundedAmount,
    amount,
    sourceHref: row.sourceHref,
    invoice: row.invoice,
    allocations: [],
  };
}
async function allMembers(tenant, direction, account, { session, includeClaimed = false } = {}) {
  validate(direction, account);
  const read = (Model, filter, fields) => {
    const query = Model.find(filter);
    if (fields) query.select(fields);
    if (session) query.session(session);
    return query.lean();
  };
  const payments = await read(paymentModel(direction), {
    tenant,
    status: "active",
    ...(!includeClaimed ? { batch: null } : {}),
  });
  const Journal = require("../../models/JournalEntry");
  const journals = payments.length
    ? await read(Journal, {
        tenant,
        status: "posted",
        entryType: `${direction}_payment`,
        refDocType: direction === "customer" ? "CustomerPayment" : "VendorPayment",
        refDoc: { $in: payments.map((p) => p._id) },
      })
    : [];
  const reversals = journals.length
    ? await read(
        Journal,
        { tenant, status: "posted", entryType: "reversal", refDoc: { $in: journals.map((j) => j._id) } },
        "refDoc",
      )
    : [];
  const reversed = new Set(reversals.map((r) => String(r.refDoc)));
  const rows = [];
  for (const payment of payments) {
    const entries = journals.filter((j) => String(j.refDoc) === String(payment._id));
    if (entries.length !== 1 || reversed.has(String(entries[0]._id))) continue;
    const lines = entries[0].lines || [];
    if (
      lines.some(
        (l) =>
          !Number.isFinite(Number(l.debit || 0)) ||
          !Number.isFinite(Number(l.credit || 0)) ||
          l.debit < 0 ||
          l.credit < 0,
      )
    )
      continue;
    const sum = (side, filter) =>
      round2(
        lines.reduce((n, l) => n + (!filter || filter.includes(l.account) ? Number(l[side] || 0) : 0), 0),
      );
    const side = direction === "customer" ? "debit" : "credit";
    const amount = Number(payment.amount);
    if (
      !(amount > 0) ||
      !Number.isFinite(amount) ||
      Math.abs(sum("debit") - amount) > 0.01 ||
      Math.abs(sum("credit") - amount) > 0.01 ||
      Math.abs(
        sum(direction === "customer" ? "credit" : "debit", [direction === "customer" ? "1300" : "2000"]) -
          amount,
      ) > 0.01 ||
      Math.abs(sum(side, [account]) - amount) > 0.01 ||
      Math.abs(sum(side, accounts) - amount) > 0.01
    )
      continue;
    rows.push({
      key: `payment:${payment._id}`,
      _id: `payment:${payment._id}`,
      origin: "accounting",
      paymentId: String(payment._id),
      journalId: String(entries[0]._id),
      account,
      number: payment.number,
      name: payment.customerName || payment.vendorName || "Account",
      date: payment.date,
      method: payment.method,
      capturedAmount: amount,
      refundedAmount: 0,
      amount,
      allocations: payment.allocations || [],
      existingBatch: payment.batch ? String(payment.batch) : null,
    });
  }
  if (direction === "customer") {
    const sources = await require("../accountingPayment/sourceReceipts").readSourceReceipts(tenant, {
      session,
    });
    const claims = !includeClaimed
      ? await read(require("../../models/SourceBatchClaim"), { tenant, account, active: true }, "journal")
      : [];
    const claimed = new Set(claims.map((c) => String(c.journal)));
    for (const row of sources) {
      const member = sourceMember(row, account);
      if (member && !claimed.has(member.journalId)) rows.push(member);
    }
  }
  const linked = await require("../accountingPayment.browse").linksFor(tenant, direction, rows);
  return linked.sort(
    (a, b) =>
      (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0) || b.key.localeCompare(a.key),
  );
}
async function eligibleMembers(
  tenant,
  direction,
  { account = "1100", search, page = 1, limit = 100, session } = {},
) {
  if (search && typeof search !== "string") throw bad("Invalid payment search");
  if (![page, limit].every((value) => Number.isFinite(Number(value))))
    throw bad("Invalid payment pagination");
  let rows = await allMembers(tenant, direction, account, { session });
  if (search) {
    const rx = new RegExp(escapeSearch(search), "i");
    rows = rows.filter((r) => [r.number, r.name, r.invoice?.label].some((v) => rx.test(v || "")));
  }
  page = Math.max(1, Math.floor(Number(page) || 1));
  limit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 100)));
  return {
    data: rows.slice((page - 1) * limit, page * limit),
    total: rows.length,
    page,
    pages: Math.ceil(rows.length / limit) || 1,
  };
}
module.exports = { sourceMember, allMembers, eligibleMembers, validate, paymentModel, accounts };
