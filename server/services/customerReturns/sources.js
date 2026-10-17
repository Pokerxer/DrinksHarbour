// Persisted source lines only: projected Sales return rows are never POS refunds.
const positive = (field) => ({ $max: [0, { $ifNull: [field, 0] }] });
function ambiguous(items, line) {
  return {
    $gt: [
      {
        $size: {
          $filter: {
            input: items,
            as: "candidate",
            cond: {
              $and: [
                { $eq: ["$$candidate.subproduct", `${line}.subproduct`] },
                {
                  $or: [
                    { $eq: [{ $ifNull: [`${line}.size`, null] }, null] },
                    {
                      $eq: [
                        { $ifNull: ["$$candidate.size", null] },
                        { $ifNull: [`${line}.size`, null] },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      1,
    ],
  };
}
function sourcePipelines(tenant) {
  const sales = [
    { $match: { tenant, docType: "order", "items.returnedQty": { $gt: 0 } } },
    { $set: { orderItems: "$items" } },
    { $unwind: "$items" },
    {
      $match: {
        "items.returnedQty": { $gt: 0 },
        "items.lineType": { $nin: ["section", "note"] },
      },
    },
    {
      $project: {
        _id: 0,
        id: {
          $concat: [
            "sales:",
            { $toString: "$_id" },
            ":",
            { $toString: "$items._id" },
          ],
        },
        ambiguous: ambiguous("$orderItems", "$items"),
        source: { $literal: "sales" },
        sourceId: "$_id",
        sourceNumber: "$soNumber",
        reference: "$soNumber",
        subproductId: "$items.subproduct",
        productId: "$items.product",
        sizeId: { $ifNull: ["$items.size", null] },
        product: "$items.name",
        // Read the raw saved Sales-origin counter, not a linked POS projection.
        returned: positive("$items.returnedQty"),
        declaredRestocked: { $literal: null },
        notRestocked: { $literal: null },
        date: { $literal: null },
        reason: { $literal: "Sales stock return" },
        warehouseId: { $literal: null },
      },
    },
  ];
  const pos = [
    { $match: { tenant, source: "pos", "refunds.items.quantity": { $gt: 0 } } },
    { $set: { orderItems: "$items" } },
    { $unwind: { path: "$refunds", includeArrayIndex: "refundIndex" } },
    { $match: { "refunds.source": { $ne: "sales" } } },
    { $set: { refundItems: "$refunds.items" } },
    {
      $unwind: { path: "$refunds.items", includeArrayIndex: "refundLineIndex" },
    },
    {
      $set: {
        soldItem: {
          $arrayElemAt: ["$orderItems", "$refunds.items.orderItemIndex"],
        },
        returned: {
          $max: [
            0,
            {
              $subtract: [
                positive("$refunds.items.quantity"),
                positive("$refunds.items.salesReturnedQuantity"),
              ],
            },
          ],
        },
      },
    },
    {
      $match: {
        returned: { $gt: 0 },
        "soldItem.subproduct": { $exists: true },
      },
    },
    {
      $project: {
        _id: 0,
        id: {
          $concat: [
            "pos:",
            { $toString: "$_id" },
            ":",
            { $toString: "$refundIndex" },
            ":",
            { $toString: "$refundLineIndex" },
          ],
        },
        ambiguous: {
          $or: [
            ambiguous("$orderItems", "$soldItem"),
            {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: "$refundItems",
                      as: "duplicate",
                      cond: {
                        $eq: [
                          "$$duplicate.orderItemIndex",
                          "$refunds.items.orderItemIndex",
                        ],
                      },
                    },
                  },
                },
                1,
              ],
            },
          ],
        },
        source: { $literal: "pos" },
        linkedSalesOrder: "$linkedSalesOrder",
        refundRecorded: { $gt: ["$refunds.totalRefunded", 0] },
        sourceId: "$_id",
        sourceNumber: { $ifNull: ["$receiptNumber", "$orderNumber"] },
        reference: "$refunds.receiptNumber",
        subproductId: "$soldItem.subproduct",
        productId: "$soldItem.product",
        product: "$soldItem.name",
        sizeId: { $ifNull: ["$soldItem.size", null] },
        returned: 1,
        declaredRestocked: {
          $cond: [
            { $eq: ["$refunds.items.restock", false] },
            0,
            {
              $cond: [
                { $isNumber: "$refunds.items.restockedQuantity" },
                {
                  $min: [
                    "$returned",
                    positive("$refunds.items.restockedQuantity"),
                  ],
                },
                null,
              ],
            },
          ],
        },
        notRestocked: {
          $cond: [{ $eq: ["$refunds.items.restock", false] }, "$returned", 0],
        },
        date: { $ifNull: ["$refunds.refundedAt", null] },
        warehouseId: { $ifNull: ["$soldItem.warehouse", null] },
        reason: {
          $ifNull: [
            "$refunds.items.reason",
            { $ifNull: ["$refunds.reason", "Customer return"] },
          ],
        },
      },
    },
  ];
  return { sales, pos };
}
module.exports = { sourcePipelines };
