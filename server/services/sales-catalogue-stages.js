// Operational projections used by the sales picker; full detail stays in the edit API.
function operationalStages(scope, warehouseId) {
  const sizeLookup = {
    $lookup: {
      from: 'sizes',
      localField: 'sizes',
      foreignField: '_id',
      as: 'sizes',
      pipeline: [
        { $match: scope },
        {
          $project: {
            size: 1,
            displayName: 1,
            sku: 1,
            barcode: 1,
            sellingPrice: 1,
            costPrice: 1,
            wholesalePrice: 1,
            unitsPerPack: 1,
            availableStock: 1,
            stock: 1,
          },
        },
        { $sort: { _id: 1 } },
      ],
    },
  };
  const stockLookup = warehouseId
    ? [
        {
          $lookup: {
            from: 'warehousestocks',
            localField: '_id',
            foreignField: 'subProduct',
            as: 'warehouseStock',
            pipeline: [
              { $match: { ...scope, warehouse: warehouseId } },
              {
                $project: {
                  size: 1,
                  available: {
                    $max: [
                      0,
                      {
                        $subtract: [
                          { $ifNull: ['$currentQuantity', 0] },
                          { $ifNull: ['$reservedQuantity', 0] },
                        ],
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
        { $set: { availableStock: { $sum: '$warehouseStock.available' } } },
      ]
    : [];
  const stockSizes = warehouseId
    ? [
        {
          $set: {
            sizes: {
              $map: {
                input: '$sizes',
                as: 's',
                in: {
                  $mergeObjects: [
                    '$$s',
                    {
                      availableStock: {
                        $sum: {
                          $map: {
                            input: {
                              $filter: {
                                input: '$warehouseStock',
                                as: 'w',
                                cond: { $eq: ['$$w.size', '$$s._id'] },
                              },
                            },
                            as: 'w',
                            in: '$$w.available',
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        { $unset: 'warehouseStock' },
      ]
    : [];
  const warehouseSizes = warehouseId ? [{
    $set: { sizes: { $filter: {
      input: '$sizes', as: 's',
      cond: { $in: ['$$s._id', '$warehouseStock.size'] },
    } } },
  }] : [];
  return { sizeLookup, stockLookup, stockSizes, warehouseSizes };
}
module.exports = { operationalStages };
