const test = require("node:test");
const assert = require("node:assert/strict");
const Journal = require("../models/JournalEntry");
const query = (value) => ({ session: () => ({ lean: async () => value }) });
test("only balanced, posted, unreversed refund evidence changes invoice balances", async (t) => {
  const {
    refundEvidence,
  } = require("../services/customerInvoice/refundEvidence");
  const receipt = {
    _id: "order",
    refunds: [
      { _id: "r1", totalRefunded: 20 },
      { _id: "r2", totalRefunded: 10 },
      { _id: "r3", totalRefunded: 5 },
    ],
  };
  const entry = (id, refDoc, amount) => ({
    _id: id,
    refDoc,
    refDocType: "OrderRefund",
    status: "posted",
    lines: [
      { account: "4000", debit: amount, credit: 0 },
      { account: "1000", debit: 0, credit: amount },
    ],
  });
  t.mock.method(Journal, "find", (filter) =>
    query(
      filter.entryType === "refund"
        ? [entry("j1", "r1", 20), entry("j2", "r2", 999), entry("j3", "r3", 5)]
        : [{ refDoc: "j3" }],
    ),
  );
  const result = await refundEvidence("tenant", receipt);
  assert.equal(result.amount, 20);
  assert.equal(result.recordedAmount, 35);
  assert.match(result.issue, /match|reversed/);
  assert.deepEqual(result.journalEntries, ["j1"]);
});
test("legacy refund counters without immutable postings stay reviewable", async (t) => {
  const {
    refundEvidence,
  } = require("../services/customerInvoice/refundEvidence");
  t.mock.method(Journal, "find", () => query([]));
  const result = await refundEvidence("tenant", {
    _id: "order",
    refundDetails: { amount: 30 },
    refunds: [],
  });
  assert.equal(result.amount, 0);
  assert.match(result.issue, /legacy|Legacy/);
});
test("reviewed credit allocation uses verified net collection without rewriting gross source payments", async (t) => {
  const {
    effectiveCreditInvoice,
  } = require("../services/customerInvoice/creditBalance");
  t.mock.method(require("../models/Order"), "exists", () => ({
    session: async () => true,
  }));
  t.mock.method(
    require("../services/customerInvoice/reconcile"),
    "reconcile",
    async () => ({ amountPaid: 80, creditedAmount: 0, issue: "" }),
  );
  const source = {
    _id: "sales",
    total: 100,
    amountPaid: 100,
    creditedAmount: 0,
  };
  const effective = await effectiveCreditInvoice("tenant", source);
  assert.equal(
    require("../services/creditNote.alloc").invoiceOutstanding(effective),
    20,
  );
  assert.equal(source.amountPaid, 100);
});
test("numeric legacy refund amounts are summed as money rather than concatenated strings", async (t) => {
  const {
    refundEvidence,
  } = require("../services/customerInvoice/refundEvidence");
  const receipt = {
    _id: "order",
    refunds: [
      { _id: "r1", totalRefunded: "20" },
      { _id: "r2", totalRefunded: "10" },
    ],
  };
  t.mock.method(Journal, "find", (filter) =>
    query(
      filter.entryType === "refund"
        ? receipt.refunds.map((row) => ({
            _id: `j${row._id}`,
            refDoc: row._id,
            lines: [
              { account: "4000", debit: Number(row.totalRefunded), credit: 0 },
              { account: "1000", debit: 0, credit: Number(row.totalRefunded) },
            ],
          }))
        : [],
    ),
  );
  assert.equal((await refundEvidence("tenant", receipt)).amount, 30);
});
