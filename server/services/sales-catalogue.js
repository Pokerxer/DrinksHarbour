const mongoose = require('mongoose');
const { operationalStages } = require('./sales-catalogue-stages');
const SubProduct = require('../models/SubProduct');
const Warehouse = require('../models/Warehouse');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { escapeRegex } = require('../utils/escapeRegex');

const id = (value) => {
  if (!/^[a-f\d]{24}$/i.test(String(value)))
    throw new ValidationError('Invalid catalogue filter');
  return new mongoose.Types.ObjectId(String(value));
};
const values = (input) =>
  String(input || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
const pageNumber = (value, fallback, max) =>
  Math.min(max, Math.max(1, Number.parseInt(value, 10) || fallback));

function facet(path, collection) {
  return [
    { $group: { _id: path } },
    { $match: { _id: { $ne: null } } },
    {
      $lookup: {
        from: collection,
        localField: '_id',
        foreignField: '_id',
        as: 'label',
      },
    },
    { $unwind: '$label' },
    { $project: { _id: 0, id: '$_id', name: '$label.name' } },
    { $sort: { name: 1, id: 1 } },
  ];
}

function buildCataloguePipeline(tenantId, options = {}) {
  const page = pageNumber(options.page, 1, 100000);
  const limit = pageNumber(options.limit, 24, 48);
  const scope = tenantId ? { tenant: id(tenantId) } : {};
  const match = {};
  const searchTerms = [...new Set(String(options.search || '').split(/[,;\n]/)
    .map(term => term.trim().slice(0, 120)).filter(Boolean))];
  if (searchTerms.length) {
    match.$or = searchTerms.flatMap(term => {
      const regex = new RegExp(escapeRegex(term), 'i');
      return ['sku', 'product.name', 'sizes.sku', 'sizes.barcode'].map(path => ({ [path]: regex }));
    });
  }
  for (const [key, path] of [
    ['categories', 'product.category'],
    ['brands', 'product.brand'],
  ]) {
    const selected = values(options[key]);
    if (selected.length) match[path] = { $in: selected.map(id) };
  }
  const types = values(options.types);
  if (types.length) match['product.type'] = { $in: types };
  if (options.inStock === 'true') match.availableStock = { $gt: 0 };
  const sortKey = ['name', 'priceAsc', 'priceDesc', 'stock'].includes(
    options.catalogueSort,
  )
    ? options.catalogueSort
    : 'name';
  const priceSort = sortKey === 'priceAsc' || sortKey === 'priceDesc';
  const earlySizes = searchTerms.length > 0 || priceSort;
  const earlyStock = !!options.warehouseId;
  const sort = {
    name: { 'product.name': 1, _id: 1 },
    priceAsc: { cataloguePrice: 1, _id: 1 },
    priceDesc: { cataloguePrice: -1, _id: 1 },
    stock: { availableStock: -1, _id: 1 },
  }[sortKey] || { 'product.name': 1, _id: 1 };

  const pipeline = [
    { $match: scope },
    {
      $project: {
        product: 1,
        tenant: 1,
        sku: 1,
        sizes: 1,
        baseSellingPrice: 1,
        costPrice: 1,
        taxRate: 1,
        sellWithoutSizeVariants: 1,
        bundleDeals: 1,
        availableStock: 1,
        totalStock: 1,
        imagesOverride: { $slice: [{ $ifNull: ['$imagesOverride', []] }, 1] },
      },
    },
    {
      $lookup: {
        from: 'products',
        localField: 'product',
        foreignField: '_id',
        as: 'product',
        pipeline: [
          {
            $project: {
              name: 1,
              type: 1,
              brand: 1,
              category: 1,
              isAlcoholic: 1,
              abv: 1,
              images: { $slice: [{ $ifNull: ['$images', []] }, 1] },
            },
          },
        ],
      },
    },
    { $unwind: '$product' },
  ];
  const { sizeLookup, stockLookup, stockSizes, warehouseSizes } = operationalStages(
    scope,
    options.warehouseId ? id(options.warehouseId) : null,
  );
  // Warehouse membership must constrain counts/facets/pages, not only decorate
  // visible products. Keep zero-available rows unless In stock is requested.
  if (earlyStock) pipeline.push(...stockLookup, {
    $match: { 'warehouseStock.0': { $exists: true } },
  });
  if (earlySizes) pipeline.push(sizeLookup, ...warehouseSizes);
  if (!options.warehouseId)
    pipeline.push({
      $set: {
        availableStock: {
          $ifNull: ['$availableStock', { $ifNull: ['$totalStock', 0] }],
        },
      },
    });
  if (priceSort)
    pipeline.push({
      $set: {
        cataloguePrice: {
          $cond: [
            {
              $and: [
                { $ne: ['$sellWithoutSizeVariants', true] },
                { $gt: [{ $size: '$sizes' }, 0] },
              ],
            },
            {
              $min: {
                $map: {
                  input: '$sizes',
                  as: 's',
                  in: {
                    $cond: [
                      { $gt: ['$$s.sellingPrice', 0] },
                      '$$s.sellingPrice',
                      '$baseSellingPrice',
                    ],
                  },
                },
              },
            },
            '$baseSellingPrice',
          ],
        },
      },
    });
  const facets = {
    products: [
      { $match: match },
      { $sort: sort },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      ...(!earlySizes ? [sizeLookup, ...warehouseSizes] : []),
      ...(!earlyStock ? stockLookup : []),
      ...stockSizes,
      {
        $lookup: {
          from: 'brands',
          localField: 'product.brand',
          foreignField: '_id',
          as: 'brand',
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'product.category',
          foreignField: '_id',
          as: 'category',
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      {
        $set: {
          'product.brand': { $arrayElemAt: ['$brand', 0] },
          'product.category': { $arrayElemAt: ['$category', 0] },
        },
      },
      { $unset: ['brand', 'category', 'cataloguePrice', 'tenant'] },
    ],
    count: [{ $match: match }, { $count: 'total' }],
  };
  if (options.facets === 'true') {
    facets.categories = facet('$product.category', 'categories');
    facets.brands = facet('$product.brand', 'brands');
    facets.types = [
      { $group: { _id: '$product.type' } },
      { $match: { _id: { $nin: [null, ''] } } },
      { $project: { _id: 0, id: '$_id', name: '$_id' } },
      { $sort: { name: 1 } },
    ];
  }
  pipeline.push({ $facet: facets });
  return { pipeline, page, limit };
}

async function getSalesCatalogue(tenantId, options) {
  if (options.warehouseId) {
    if (!tenantId)
      throw new ValidationError('Select a tenant before choosing a warehouse');
    const warehouse = await Warehouse.exists({
      _id: id(options.warehouseId),
      tenant: id(tenantId),
    });
    if (!warehouse)
      throw new NotFoundError('Warehouse not found for this tenant');
  }
  const { pipeline, page, limit } = buildCataloguePipeline(tenantId, options);
  const [result = {}] = await SubProduct.aggregate(pipeline).collation({
    locale: 'en',
    strength: 2,
  });
  const total = result.count?.[0]?.total || 0;
  return {
    subProducts: options.pricing === 'true'
      ? await require('./sales-catalogue-pricing').priceCataloguePage(result.products || [], tenantId, options)
      : result.products || [],
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
    ...(options.facets === 'true'
      ? {
          facets: {
            categories: result.categories || [],
            brands: result.brands || [],
            types: result.types || [],
          },
        }
      : {}),
  };
}

module.exports = { buildCataloguePipeline, getSalesCatalogue };
