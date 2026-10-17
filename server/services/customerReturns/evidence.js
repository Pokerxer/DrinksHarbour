// Exact product/size evidence only. Never classify supplier/transfer receipts as customer returns.
function evidencePipeline(tenant) {
  return [
    {
      $lookup: {
        from: "inventorymovements",
        let: {
          reference: "$reference",
          sub: "$subproductId",
          size: "$sizeId",
          sourceId: "$sourceId",
          source: "$source",
          ambiguous: "$ambiguous",
        },
        pipeline: [
          {
            $match: {
              tenant,
              type: "return",
              category: "in",
              status: "confirmed",
              referenceType: "return",
              $expr: {
                $and: [
                  { $eq: ["$$ambiguous", false] },
                  { $ne: [{ $ifNull: ["$$reference", ""] }, ""] },
                  { $eq: ["$reference", "$$reference"] },
                  { $eq: ["$subProduct", "$$sub"] },
                  {
                    $or: [
                      { $eq: [{ $ifNull: ["$size", null] }, "$$size"] },
                      { $eq: ["$$size", null] },
                    ],
                  },
                  {
                    $or: [
                      {
                        $and: [
                          { $eq: ["$$source", "sales"] },
                          {
                            $or: [
                              { $eq: ["$relatedSalesOrder", "$$sourceId"] },
                              {
                                $eq: [
                                  { $ifNull: ["$relatedSalesOrder", null] },
                                  null,
                                ],
                              },
                            ],
                          },
                        ],
                      },
                      {
                        $and: [
                          { $eq: ["$$source", "pos"] },
                          { $eq: ["$relatedOrder", "$$sourceId"] },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              quantity: { $sum: "$quantity" },
              date: { $max: "$createdAt" },
              warehouses: { $addToSet: "$warehouse" },
            },
          },
        ],
        as: "evidence",
      },
    },
    { $set: { evidence: { $arrayElemAt: ["$evidence", 0] } } },
    {
      $set: {
        restocked: {
          $cond: [
            { $eq: ["$declaredRestocked", 0] },
            0,
            {
              $cond: [
                { $gt: ["$evidence.quantity", 0] },
                {
                  $min: [
                    "$returned",
                    "$evidence.quantity",
                    { $ifNull: ["$declaredRestocked", "$returned"] },
                  ],
                },
                null,
              ],
            },
          ],
        },
        date: {
          $cond: [
            { $eq: ["$source", "sales"] },
            { $ifNull: ["$evidence.date", null] },
            "$date",
          ],
        },
        locationIds: { $ifNull: ["$evidence.warehouses", []] },
        warehouseId: {
          $cond: [
            { $eq: [{ $size: { $ifNull: ["$evidence.warehouses", []] } }, 1] },
            { $arrayElemAt: ["$evidence.warehouses", 0] },
            null,
          ],
        },
      },
    },
    {
      $set: {
        notRestocked: {
          $cond: [
            {
              $and: [
                { $eq: ["$source", "sales"] },
                { $eq: ["$restocked", "$returned"] },
              ],
            },
            0,
            "$notRestocked",
          ],
        },
        stockEvidence: {
          $cond: [
            {
              $eq: [
                {
                  $add: [
                    { $ifNull: ["$restocked", 0] },
                    { $ifNull: ["$notRestocked", 0] },
                  ],
                },
                "$returned",
              ],
            },
            "verified",
            "unverified",
          ],
        },
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "productId",
        foreignField: "_id",
        pipeline: [{ $project: { name: 1 } }],
        as: "catalog",
      },
    },
    {
      $lookup: {
        from: "sizes",
        localField: "sizeId",
        foreignField: "_id",
        pipeline: [
          { $match: { tenant } },
          { $project: { size: 1, displayName: 1 } },
        ],
        as: "sizes",
      },
    },
    {
      $lookup: {
        from: "warehouses",
        localField: "locationIds",
        foreignField: "_id",
        pipeline: [{ $match: { tenant } }, { $project: { name: 1, code: 1 } }],
        as: "locations",
      },
    },
    {
      $set: {
        product: {
          $ifNull: [
            "$product",
            { $ifNull: [{ $arrayElemAt: ["$catalog.name", 0] }, "Product"] },
          ],
        },
        size: {
          $ifNull: [
            { $arrayElemAt: ["$sizes.displayName", 0] },
            { $ifNull: [{ $arrayElemAt: ["$sizes.size", 0] }, "—"] },
          ],
        },
        destinations: "$locations",
        warehouse: {
          $cond: [
            { $eq: [{ $size: "$locations" }, 1] },
            { $arrayElemAt: ["$locations", 0] },
            null,
          ],
        },
      },
    },
    {
      $unset: [
        "evidence",
        "catalog",
        "sizes",
        "locations",
        "declaredRestocked",
        "productId",
        "subproductId",
        "sizeId",
        "ambiguous",
        "locationIds",
      ],
    },
  ];
}
module.exports = { evidencePipeline };
