const Journal = require("../../models/JournalEntry");
const { round2 } = require("../accounting.helpers");
const id = (value) => String(value?._id || value || "");
const sum = (lines, side, accounts) =>
  round2(
    (lines || []).reduce(
      (n, line) =>
        n +
        (!accounts || accounts.includes(line.account)
          ? Number(line[side]) || 0
          : 0),
      0,
    ),
  );
async function refundEvidence(tenant, receipt, session) {
  const refunds = (receipt.refunds || []).filter(
    (row) => row.source !== "sales" && row.totalRefunded > 0,
  );
  const recordedAmount = round2(
    Math.max(
      refunds.reduce((n, row) => n + Number(row.totalRefunded), 0),
      receipt.refundDetails?.amount || 0,
    ),
  );
  const entries = refunds.length
    ? await Journal.find({
        tenant,
        refDoc: { $in: refunds.map((row) => row._id).filter(Boolean) },
        refDocType: "OrderRefund",
        entryType: "refund",
        status: "posted",
      })
        .session(session || null)
        .lean()
    : [];
  const reversed = entries.length
    ? await Journal.find({
        tenant,
        refDoc: { $in: entries.map((entry) => entry._id) },
        entryType: "reversal",
        status: "posted",
      })
        .session(session || null)
        .lean()
    : [];
  const reversalIds = new Set(reversed.map((entry) => id(entry.refDoc)));
  const issues = [],
    journalEntries = [];
  let amount = 0;
  for (const refund of refunds) {
    const candidates = entries.filter(
      (entry) => id(entry.refDoc) === id(refund._id),
    );
    const entry = candidates[0];
    if (candidates.length !== 1) {
      issues.push("A refund posting is missing or duplicated");
      continue;
    }
    if (reversalIds.has(id(entry._id))) {
      issues.push("A recorded refund posting is reversed");
      continue;
    }
    const invalid = (entry.lines || []).some(
      (line) =>
        !Number.isFinite(Number(line.debit || 0)) ||
        !Number.isFinite(Number(line.credit || 0)) ||
        line.debit < 0 ||
        line.credit < 0,
    );
    if (
      invalid ||
      Math.abs(sum(entry.lines, "debit") - sum(entry.lines, "credit")) > 0.01 ||
      Math.abs(
        sum(
          entry.lines,
          "debit",
          receipt.linkedSalesOrder ? ["1300"] : ["4000", "2100"],
        ) - refund.totalRefunded,
      ) > 0.01 ||
      Math.abs(
        sum(entry.lines, "credit", ["1000", "1100", "2200", "1300"]) -
          refund.totalRefunded,
      ) > 0.01
    ) {
      issues.push("A refund posting does not match its amount");
      continue;
    }
    amount += Number(refund.totalRefunded);
    journalEntries.push(entry._id);
  }
  if (
    recordedAmount >
    refunds.reduce((n, row) => n + Number(row.totalRefunded), 0) + 0.01
  )
    issues.push("Legacy refund counters need posting review");
  return {
    amount: round2(amount),
    recordedAmount,
    journalEntries,
    issue: [...new Set(issues)].join("; "),
  };
}
module.exports = { refundEvidence };
