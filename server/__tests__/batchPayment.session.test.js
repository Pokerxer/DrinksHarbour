const test = require("node:test");
const assert = require("node:assert/strict");

test("source proof reads do not overlap operations on a transaction session", async () => {
  const models = ["JournalEntry", "SalesOrder", "Order", "CustomerInvoice"].map((name) =>
    require(`../models/${name}`),
  );
  const originals = models.map((model) => model.find);
  let active = 0,
    peak = 0;
  for (const model of models) {
    model.find = () => ({
      select() {
        return this;
      },
      session() {
        return this;
      },
      async lean() {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setImmediate(resolve));
        active--;
        return [];
      },
    });
  }
  try {
    await require("../services/accountingPayment/sourceReceipts").readSourceReceipts("tenant", {
      session: {},
    });
    assert.equal(peak, 1, "MongoDB transactions require sequential session operations");
  } finally {
    models.forEach((model, index) => {
      model.find = originals[index];
    });
  }
});
