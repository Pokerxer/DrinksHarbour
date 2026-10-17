const Credit = require("../../models/CreditNote");
const Journal = require("../../models/JournalEntry");
const { round2 } = require("../accounting.helpers");
const id = (value) => String(value?._id || value || "");
const sum = (lines, side, account) =>
  round2(
    (lines || []).reduce(
      (n, line) =>
        n +
        (!account || line.account === account ? Number(line[side]) || 0 : 0),
      0,
    ),
  );
async function creditEvidence(tenant, doc, session) {
  const credits = await Credit.find({
    tenant,
    postedAt: { $ne: null },
    status: "applied",
    $or: [{ "allocations.salesOrder": doc._id }, { salesOrder: doc._id }],
  })
    .session(session || null)
    .lean();
  let creditedAmount = 0,
    creditNoteAmount = 0;
  const journalEntries = [],
    issues = [];
  for (const credit of credits) {
    const entry = await Journal.findOne({
      tenant,
      refDoc: credit._id,
      refDocType: "CreditNote",
      entryType: "refund",
      status: "posted",
    })
      .session(session || null)
      .lean();
    if (!entry) {
      issues.push("A credit posting is missing");
      continue;
    }
    if (
      await Journal.exists({
        tenant,
        refDoc: entry._id,
        entryType: "reversal",
        status: "posted",
      }).session(session || null)
    ) {
      issues.push("A credit posting is reversed");
      continue;
    }
    const gross = round2(Number(credit.amount) + Number(credit.taxAmount || 0));
    const allocations = credit.allocations || [];
    if (
      allocations.some(row => !Number.isFinite(Number(row.amount)) || Number(row.amount) < 0) ||
      round2(allocations.reduce((n, row) => n + Number(row.amount), 0)) > gross + 0.01
    ) {
      issues.push("Credit allocations exceed or invalidate the posted credit");
      continue;
    }
    if (
      Math.abs(sum(entry.lines, "credit", "1300") - gross) > 0.01 ||
      Math.abs(sum(entry.lines, "debit") - sum(entry.lines, "credit")) > 0.01
    ) {
      issues.push("A credit posting does not match its amount");
      continue;
    }
    const allocated = (credit.allocations || [])
      .filter((row) => id(row.salesOrder) === id(doc._id))
      .reduce((n, row) => n + Number(row.amount), 0);
    creditedAmount += allocated;
    creditNoteAmount +=
      id(credit.salesOrder) === id(doc._id) ? gross : allocated;
    journalEntries.push(entry._id);
  }
  return {
    creditedAmount: round2(creditedAmount),
    creditNoteAmount: round2(creditNoteAmount),
    journalEntries,
    issue: issues.join("; "),
  };
}
module.exports = { creditEvidence };
