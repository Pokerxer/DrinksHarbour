'use strict';

const { Types } = require('mongoose');
const Warehouse = require('../models/Warehouse');
const Stock = require('../models/WarehouseStock');
const { id } = require('./salesReservations/quantities');

function selection(tenant) {
  const settings = tenant?.warehouseSettings;
  return settings?.marketplaceWarehouses ?? (settings?.marketplaceWarehouse ? [settings.marketplaceWarehouse] : []);
}
const selectionFields = 'warehouseSettings.marketplaceWarehouses warehouseSettings.marketplaceWarehouse';
const quantity = field => ({ $ifNull: [field, 0] });
const unexpired = { $or: [{ $eq: [{ $ifNull: ['$expiryDate', null] }, null] }, { $gt: ['$expiryDate', '$$NOW'] }] };

// Shared by catalogue aggregation and populated-offer/cart reads. Batch-tracked
// items can only be sold up to the quantity checkout can allocate from live lots.
function availabilityStages(blockExpired, includeIdentity = false) {
  return [
    { $lookup: {
      from: 'warehouses', localField: 'warehouse', foreignField: '_id', as: '_location',
      let: { owner: '$tenant' },
      pipeline: [{ $match: { isActive: true, $expr: { $eq: ['$tenant', '$$owner'] } } }, { $project: { _id: 1 } }],
    } },
    { $match: { '_location.0': { $exists: true } } },
    { $lookup: {
      from: 'subproducts', localField: 'subProduct', foreignField: '_id', as: '_listing',
      let: { owner: '$tenant' },
      pipeline: [
        { $match: { $expr: { $eq: ['$tenant', '$$owner'] } } },
        { $project: { product: 1 } },
      ],
    } },
    { $lookup: {
      from: 'products', localField: '_listing.product', foreignField: '_id', as: '_product',
      pipeline: [{ $project: { tracksBatch: 1 } }],
    } },
    { $lookup: {
      from: 'warehousebatches', as: '_batches',
      let: { tenant: '$tenant', warehouse: '$warehouse', subProduct: '$subProduct', size: '$size' },
      pipeline: [
        { $match: { quantity: { $gt: 0 }, quarantined: { $ne: true }, $expr: { $and: [
          { $eq: ['$tenant', '$$tenant'] }, { $eq: ['$warehouse', '$$warehouse'] },
          { $eq: ['$subProduct', '$$subProduct'] }, { $eq: ['$size', '$$size'] },
        ] } } },
        { $group: { _id: null, eligible: { $sum: { $cond: [
          unexpired, '$quantity', 0,
        ] } }, expired: { $sum: { $cond: [
          { $not: [unexpired] }, '$quantity', 0,
        ] } } } },
      ],
    } },
    { $project: { _id: 0, ...(includeIdentity ? { tenant: 1, warehouse: 1, subProduct: 1, size: 1 } : {}), stock: {
      $let: { vars: {
        free: { $max: [0, { $subtract: [
          { $subtract: [quantity('$currentQuantity'), quantity('$reservedQuantity')] },
          { $cond: [blockExpired, quantity({ $first: '$_batches.expired' }), 0] },
        ] }] },
      }, in: { $cond: [
        { $eq: [{ $first: '$_product.tracksBatch' }, false] }, '$$free',
        { $min: ['$$free', quantity({ $first: '$_batches.eligible' })] },
      ] } },
    } } },
  ];
}

const tenantProjection = [{ $project: {
  'warehouseSettings.marketplaceWarehouse': 1,
  'warehouseSettings.marketplaceWarehouses': 1,
  'warehouseSettings.blockExpiredStock': 1,
} }];
const legacyWarehouse = { $ifNull: [{ $first: '$_marketOwner.warehouseSettings.marketplaceWarehouse' }, null] };
const selectedWarehouses = { $ifNull: [
  { $first: '$_marketOwner.warehouseSettings.marketplaceWarehouses' },
  { $cond: [{ $ne: [legacyWarehouse, null] }, [legacyWarehouse], []] },
] };
const locationLookup = {
  from: 'warehousestocks', localField: '_id', foreignField: 'size', as: '_marketStock',
  let: { owner: '$tenant', listing: '$subproduct',
    warehouses: selectedWarehouses,
    blockExpired: { $first: '$_marketOwner.warehouseSettings.blockExpiredStock' },
  },
  pipeline: [
    { $match: { $expr: { $and: [
      { $eq: ['$tenant', '$$owner'] }, { $in: ['$warehouse', '$$warehouses'] },
      { $eq: ['$subProduct', '$$listing'] },
    ] } } },
    ...availabilityStages('$$blockExpired'),
  ],
};

function sizeStages() {
  const selected = { $gt: [{ $size: selectedWarehouses }, 0] };
  const stock = { $sum: '$_marketStock.stock' };
  const activeStock = { $cond: [{ $eq: [{ $ifNull: ['$status', 'active'] }, 'active'] }, stock, 0] };
  const take = field => ({ $cond: [selected, activeStock, field] });
  return [
    { $lookup: { from: 'tenants', localField: 'tenant', foreignField: '_id', as: '_marketOwner', pipeline: tenantProjection } },
    { $lookup: locationLookup },
    { $set: {
      stock: take('$stock'),
      availableStock: take('$availableStock'),
      reservedStock: { $cond: [selected, 0, '$reservedStock'] },
      availability: { $cond: [selected, {
        $switch: { branches: [
          { case: { $lte: [activeStock, 0] }, then: 'out_of_stock' },
          { case: { $lte: [stock, { $ifNull: ['$lowStockThreshold', 6] }] }, then: 'low_stock' },
        ], default: 'available' },
      }, '$availability'] },
    } },
    { $unset: ['_marketOwner', '_marketStock'] },
  ];
}

function constrainStockLookups(stages) {
  return stages.map(stage => {
    if (stage.$lookup?.pipeline) {
      const lookup = stage.$lookup;
      const prefix = lookup.from === 'sizes' ? sizeStages() : [];
      return { $lookup: { ...lookup, pipeline: [...prefix, ...constrainStockLookups(lookup.pipeline)] } };
    }
    if (stage.$facet) return { $facet: Object.fromEntries(
      Object.entries(stage.$facet).map(([key, stages]) => [key, constrainStockLookups(stages)])
    ) };
    return stage;
  });
}

const stockKey = (...parts) => parts.map(id).join(':');

async function stockRows(offers) {
  const selected = offers.filter(offer => selection(offer.tenant).length && offer.sizes?.length);
  if (!selected.length) return new Map();

  const objectId = value => value instanceof Types.ObjectId ? value : new Types.ObjectId(value);
  const keys = selected.map(offer => ({
    tenant: objectId(offer.tenant._id), warehouse: { $in: selection(offer.tenant).map(objectId) },
    subProduct: objectId(offer._id), size: { $in: offer.sizes.filter(Boolean).map(size => objectId(size._id)) },
  }));
  const rows = [];
  for (let start = 0; start < keys.length; start += 250) {
    const result = await Stock.aggregate([
      { $match: { $or: keys.slice(start, start + 250) } },
      { $lookup: { from: 'tenants', localField: 'tenant', foreignField: '_id', as: '_marketOwner', pipeline: tenantProjection } },
      ...availabilityStages({ $first: '$_marketOwner.warehouseSettings.blockExpiredStock' }, true),
    ]);
    rows.push(...result);
  }
  return new Map(rows.map(row => [stockKey(row.tenant, row.warehouse, row.subProduct, row.size), row.stock || 0]));
}

async function scopeOffers(offers) {
  const stocks = await stockRows(offers);
  return offers.map(offer => {
    const warehouses = selection(offer.tenant);
    if (!warehouses.length) return offer;
    const sizes = (offer.sizes || []).filter(Boolean).map(size => {
      const stock = size.status && size.status !== 'active' ? 0 : warehouses.reduce((total, warehouse) =>
        total + (stocks.get(stockKey(offer.tenant, warehouse, offer, size)) || 0), 0);
      return { ...size, stock, availableStock: stock, reservedStock: 0,
        availability: stock === 0 ? 'out_of_stock' : stock <= (size.lowStockThreshold ?? 6) ? 'low_stock' : 'available' };
    });
    const totalStock = sizes.reduce((sum, size) => sum + size.stock, 0);
    return { ...offer, sizes, totalStock, availableStock: totalStock, stockQuantity: totalStock, reservedStock: 0 };
  });
}

async function cartSizeStock(tenant, subProduct, size) {
  if (!selection(tenant).length) return undefined;
  const [offer] = await scopeOffers([{ _id: subProduct, tenant,
    sizes: [{ _id: size._id, status: size.status }] }]);
  return offer.sizes[0].stock;
}

async function activeWarehouse(tenant, warehouse, session = null) {
  return Warehouse.exists({ _id: warehouse, tenant, isActive: true }).session(session);
}

module.exports = { selection, selectionFields, constrainStockLookups, scopeOffers, cartSizeStock, activeWarehouse };
