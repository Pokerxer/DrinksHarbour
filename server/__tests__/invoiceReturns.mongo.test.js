const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const uri = process.env.INVOICE_RETURNS_TEST_URI;
test(
  "returned invoices preserve snapshots, require posted credits and reconcile actual refunds once",
  { skip: !uri },
  async (t) => {
    assert.match(
      uri,
      /^mongodb:\/\/127\.0\.0\.1:\d+\/drinks_saved_invoice_test_[\w]+$/,
    );
    await mongoose.connect(uri, {
      autoIndex: false,
      serverSelectionTimeoutMS: 5000,
    });
    t.after(async () => {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });
    const fixture = await require("./fixtures/invoice-return-records").seed(
      mongoose.connection.db,
    );
    await require("./fixtures/invoice-return-checks").verify(fixture);
    await require("./fixtures/invoice-return-checks").verifyStockCredits(
      fixture,
    );
  },
);
