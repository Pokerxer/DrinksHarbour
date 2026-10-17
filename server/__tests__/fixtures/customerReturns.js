const mongoose = require("mongoose");
async function seedCustomerReturns(db) {
  const ids = Object.fromEntries(
    [
      "tenant",
      "foreign",
      "so",
      "legacy",
      "pos",
      "product",
      "sub",
      "size",
      "warehouse",
    ].map((k) => [k, new mongoose.Types.ObjectId()]),
  );
  const item = {
    _id: new mongoose.Types.ObjectId(),
    name: "Wine",
    product: ids.product,
    subproduct: ids.sub,
    size: ids.size,
    quantity: 10,
    fulfilledQty: 10,
    returnedQty: 3,
  };
  await db.collection("salesorders").insertMany([
    {
      _id: ids.so,
      tenant: ids.tenant,
      soNumber: "SO-1",
      docType: "order",
      items: [item],
    },
    {
      _id: ids.legacy,
      tenant: ids.tenant,
      soNumber: "SO-OLD",
      docType: "order",
      items: [{ ...item, returnedQty: 2 }],
    },
    {
      tenant: ids.foreign,
      soNumber: "SECRET",
      docType: "order",
      items: [item],
    },
  ]);
  await db.collection("orders").insertMany([
    {
      _id: ids.pos,
      tenant: ids.tenant,
      source: "pos",
      orderNumber: "POS-1",
      receiptNumber: "RCP-1",
      linkedSalesOrder: ids.so,
      items: [{ ...item, warehouse: ids.warehouse }],
      refunds: [
        {
          _id: new mongoose.Types.ObjectId(),
          receiptNumber: "RET-NO",
          refundedAt: new Date("2026-10-10"),
          reason: "Damaged",
          items: [
            {
              orderItemIndex: 0,
              quantity: 2,
              restock: false,
              restockedQuantity: 0,
            },
          ],
        },
        {
          _id: new mongoose.Types.ObjectId(),
          receiptNumber: "RET-YES",
          refundedAt: new Date("2026-10-11"),
          items: [
            {
              orderItemIndex: 0,
              quantity: 2,
              restock: true,
              restockedQuantity: 2,
            },
          ],
        },
        {
          _id: new mongoose.Types.ObjectId(),
          receiptNumber: "RET-OVERLAP",
          refundedAt: new Date("2026-10-12"),
          items: [
            {
              orderItemIndex: 0,
              quantity: 3,
              restock: true,
              salesReturnedQuantity: 3,
              restockedQuantity: 0,
            },
          ],
        },
      ],
    },
    {
      tenant: ids.foreign,
      source: "pos",
      orderNumber: "POS-SECRET",
      receiptNumber: "SECRET",
      items: [item],
      refunds: [{ items: [{ orderItemIndex: 0, quantity: 8 }] }],
    },
  ]);
  await db
    .collection("tenants")
    .insertOne({ _id: ids.tenant, name: "Wyn City" });
  await db.collection("products").insertOne({ _id: ids.product, name: "Wine" });
  await db
    .collection("warehouses")
    .insertOne({ _id: ids.warehouse, tenant: ids.tenant, name: "Shop" });
  const move = {
    tenant: ids.tenant,
    subProduct: ids.sub,
    size: ids.size,
    warehouse: ids.warehouse,
    type: "return",
    category: "in",
    status: "confirmed",
    referenceType: "return",
    source: "return",
    quantity: 3,
    createdAt: new Date("2026-10-09"),
  };
  await db.collection("inventorymovements").insertMany([
    { ...move, reference: "SO-1", relatedSalesOrder: ids.so },
    { ...move, reference: "RET-YES", relatedOrder: ids.pos, quantity: 2 },
    { ...move, tenant: ids.foreign, reference: "SO-OLD", quantity: 99 },
    {
      ...move,
      reference: "SO-OLD",
      referenceType: "transfer",
      quantity: 99,
    },
    {
      ...move,
      reference: "SO-OLD",
      referenceType: "vendor_return",
      quantity: 99,
    },
  ]);
  return { ids, item, move };
}
module.exports = { seedCustomerReturns };
