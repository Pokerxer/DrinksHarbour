const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

test("customer returns reject invalid filters before reading the database", async () => {
  const { listCustomerReturns } = require("../services/customerReturns/browse");
  const tenant = new mongoose.Types.ObjectId();
  for (const filters of [
    { source: "vendor" },
    { disposition: "lost" },
    { from: "2026-02-30" },
    { warehouse: "invalid" },
    { page: -1 },
  ]) {
    await assert.rejects(listCustomerReturns(tenant, filters), {
      statusCode: 400,
    });
  }
  await assert.rejects(listCustomerReturns(null, {}), { statusCode: 403 });
});

test(
  "real customer returns isolate tenants, retain non-restocked goods and remove Sales/POS overlap",
  {
    skip: !process.env.CUSTOMER_RETURNS_TEST_URI,
  },
  async () => {
    const uri = process.env.CUSTOMER_RETURNS_TEST_URI;
    assert.match(
      uri,
      /^mongodb:\/\/127\.0\.0\.1:\d+\/drinks_customer_returns_test_[\w]+$/,
    );
    await mongoose.connect(uri, { autoIndex: false });
    const {
      listCustomerReturns,
    } = require("../services/customerReturns/browse");
    const db = mongoose.connection.db;
    try {
      const { ids, item, move } =
        await require("./fixtures/customerReturns").seedCustomerReturns(db);
      const before = await db.collection("inventorymovements").countDocuments();
      const result = await listCustomerReturns(ids.tenant, { limit: 1 });
      assert.equal(result.issuer.name, "Wyn City");
      assert.equal(result.total, 4);
      assert.equal(result.rows.length, 1);
      assert.equal(result.summary.returned, 9);
      assert.equal(result.summary.restocked, 5);
      assert.equal(result.summary.notRestocked, 2);
      assert.equal(result.summary.unverified, 1);
      const sales = await listCustomerReturns(ids.tenant, { search: "SO-1" });
      assert.equal(
        sales.rows[0].notRestocked,
        0,
        "a fully proven restock leaves no non-restocked units",
      );
      const noStock = await listCustomerReturns(ids.tenant, {
        disposition: "not-restocked",
      });
      assert.equal(noStock.rows[0].returned, 2);
      assert.equal(noStock.rows[0].restocked, 0);
      assert.equal(noStock.rows[0].notRestocked, 2);
      assert.equal(
        noStock.rows[0].warehouse,
        null,
        "sale location is not a return destination for non-restocked goods",
      );
      const old = await listCustomerReturns(ids.tenant, { search: "SO-OLD" });
      assert.equal(old.rows[0].restocked, null);
      assert.equal(old.rows[0].date, null);
      assert.equal(old.rows[0].warehouse, null);
      assert.equal(
        (await listCustomerReturns(ids.tenant, { source: "pos" })).total,
        2,
      );
      assert.equal(
        (
          await listCustomerReturns(ids.tenant, {
            from: "2026-10-10",
            to: "2026-10-11",
          })
        ).total,
        2,
      );
      assert.equal(
        (await listCustomerReturns(ids.tenant, { search: "SECRET" })).total,
        0,
      );
      assert.equal(
        (await listCustomerReturns(ids.tenant, { search: "SO-.*" })).total,
        0,
        "search is literal",
      );
      assert.equal(
        (
          await listCustomerReturns(ids.tenant, {
            warehouse: String(ids.warehouse),
          })
        ).total,
        2,
      );
      assert.equal(
        await db.collection("inventorymovements").countDocuments(),
        before,
      );
      assert.equal(await db.collection("orders").countDocuments(), 2);
      await db.collection("salesorders").insertOne({
        tenant: ids.tenant,
        docType: "order",
        soNumber: "SO-DUP",
        items: [
          { ...item, returnedQty: 1 },
          { ...item, _id: new mongoose.Types.ObjectId(), returnedQty: 1 },
        ],
      });
      await db
        .collection("inventorymovements")
        .insertOne({ ...move, reference: "SO-DUP", quantity: 2 });
      const ambiguous = await listCustomerReturns(ids.tenant, {
        search: "SO-DUP",
      });
      assert.equal(ambiguous.summary.returned, 2);
      assert.equal(
        ambiguous.summary.restocked,
        0,
        "ambiguous same-product lines cannot share the same stock evidence",
      );
      assert.equal(ambiguous.summary.unverified, 2);
      const secondWarehouse = new mongoose.Types.ObjectId();
      await db.collection("warehouses").insertOne({
        _id: secondWarehouse,
        tenant: ids.tenant,
        name: "Warehouse",
      });
      await db.collection("salesorders").insertOne({
        tenant: ids.tenant,
        docType: "order",
        soNumber: "SO-MULTI",
        items: [{ ...item, returnedQty: 4 }],
      });
      await db.collection("inventorymovements").insertMany([
        { ...move, reference: "SO-MULTI", quantity: 2 },
        {
          ...move,
          reference: "SO-MULTI",
          quantity: 2,
          warehouse: secondWarehouse,
        },
      ]);
      const multi = await listCustomerReturns(ids.tenant, {
        search: "SO-MULTI",
      });
      assert.equal(multi.rows[0].restocked, 4);
      assert.equal(
        multi.rows[0].destinations?.length,
        2,
        "both proven destinations stay visible",
      );
      assert.equal(
        (
          await listCustomerReturns(ids.tenant, {
            warehouse: String(secondWarehouse),
          })
        ).total,
        1,
      );
      const duplicatePOS = new mongoose.Types.ObjectId();
      await db.collection("orders").insertOne({
        _id: duplicatePOS,
        tenant: ids.tenant,
        source: "pos",
        orderNumber: "POS-DUP",
        receiptNumber: "RCP-DUP",
        items: [item],
        refunds: [
          {
            receiptNumber: "RET-DUP",
            items: [
              { orderItemIndex: 0, quantity: 1, restockedQuantity: 1 },
              { orderItemIndex: 0, quantity: 1, restockedQuantity: 1 },
            ],
          },
        ],
      });
      await db.collection("inventorymovements").insertOne({
        ...move,
        relatedOrder: duplicatePOS,
        reference: "RET-DUP",
        quantity: 1,
      });
      const duplicateRefund = await listCustomerReturns(ids.tenant, {
        search: "RCP-DUP",
      });
      assert.equal(
        duplicateRefund.summary.restocked,
        0,
        "duplicate refund lines cannot share the same evidence",
      );
      assert.equal(duplicateRefund.summary.unverified, 2);
      await db
        .collection("salesorders")
        .insertOne({
          tenant: ids.tenant,
          docType: "order",
          soNumber: "SO-NO-FULFILL",
          items: [{ ...item, fulfilledQty: null, returnedQty: 2 }],
        });
      const missingFulfillment = await listCustomerReturns(ids.tenant, {
        search: "SO-NO-FULFILL",
      });
      assert.equal(
        missingFulfillment.rows[0].returned,
        2,
        "raw saved return evidence is not discarded when older fulfillment metadata is missing",
      );
      assert.equal(missingFulfillment.rows[0].stockEvidence, "unverified");
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
