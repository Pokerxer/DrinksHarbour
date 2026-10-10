const mongoose = require('mongoose');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { historyQuery } = require('./warehouseHistory.service');
async function getWarehouseHistoryProducts(tenant, warehouse, deps = {}) {
  if (!mongoose.isValidObjectId(warehouse)) throw new ValidationError('Invalid warehouse');
  const Warehouse = deps.Warehouse || require('../models/Warehouse');
  const location = await Warehouse.findOne({ _id: warehouse, tenant }).select('_id').lean();
  if (!location) throw new NotFoundError('Warehouse not found');
  const Stock = deps.WarehouseStock || require('../models/WarehouseStock');
  const Movement = deps.WarehouseMovement || require('../models/WarehouseMovement');
  const Transfer = deps.StockTransfer || require('../models/StockTransfer');
  const Purchase = deps.PurchaseOrder || require('../models/PurchaseOrder');
  const SubProduct = deps.SubProduct || require('../models/SubProduct');
  const groups = await Promise.all([
    Stock.distinct('subProduct', { tenant, warehouse }),
    Movement.distinct('subProduct', { tenant, warehouse }),
    Transfer.distinct('items.subProductId', historyQuery(tenant, warehouse, { kind: 'transfers' })),
    Purchase.distinct('items.subProductId', historyQuery(tenant, warehouse, { kind: 'purchases' })),
  ]);
  const ids = [...new Set(groups.flat().filter(Boolean).map(String))];
  if (!ids.length) return [];
  const products = await SubProduct.find({ tenant, _id: { $in: ids } })
    .select('sku product')
    .populate('product', 'name')
    .lean();
  return products
    .map((row) => ({
      id: String(row._id),
      label: `${row.product?.name || 'Product'}${row.sku ? ` · ${row.sku}` : ''}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
module.exports = { getWarehouseHistoryProducts };
