const SubProduct = require('../models/SubProduct');
const { stockProductImage } = require('./stockProductImage');
const { computeStockFlags } = require('./warehouseStock.helpers');

// Read-only placeholders for catalog lines that have never had warehouse stock.
// An explicit tenant-owned product warehouse can label a zero-unit placeholder;
// a missing ledger alone never authorizes assigning stock to a real location.
async function includeUnstockedRows(rows, tenantId, settings = {}) {
  const products = await SubProduct.find({ tenant: tenantId })
    .select('sku product sizes costPrice baseSellingPrice warehouse imagesOverride')
    .populate({
      path: 'product',
      select: 'name category images',
      populate: { path: 'category', select: 'name' },
    })
    .populate({
      path: 'sizes',
      match: { tenant: tenantId },
      select: 'size costPrice sellingPrice wholesalePrice unitsPerPack',
    })
    .populate({ path: 'warehouse', match: { tenant: tenantId }, select: 'name tenant' })
    .lean();
  const seen = new Set(rows.map((row) => `${row.subProductId}|${row.sizeId}`));
  const stockedProducts = new Set(rows.map((row) => row.subProductId));
  const added = [];
  for (const sp of products) {
    const subProductId = String(sp._id);
    const assignedWarehouse = sp.warehouse?._id && String(sp.warehouse.tenant) === String(tenantId)
      ? sp.warehouse : null;
    const sizes = (sp.sizes || []).filter((size) => size && size._id);
    if (!sizes.length && !stockedProducts.has(subProductId)) sizes.push(null);
    for (const size of sizes) {
      const sizeId = size ? String(size._id) : '';
      const key = `${subProductId}|${sizeId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      added.push({
        _id: `unassigned:${subProductId}:${sizeId}`,
        warehouseId: assignedWarehouse ? String(assignedWarehouse._id) : '',
        warehouseName: assignedWarehouse ? assignedWarehouse.name : 'Unassigned',
        subProductId,
        sizeId,
        productName: sp.product?.name || sp.sku || 'Unknown Product',
        productImage: stockProductImage(sp),
        sku: sp.sku || '',
        sizeName: size?.size || '—',
        categoryId: sp.product?.category?._id ? String(sp.product.category._id) : null,
        categoryName: sp.product?.category?.name || 'Uncategorized',
        currentQuantity: 0,
        reservedQuantity: 0,
        costPrice: (size?.costPrice > 0 ? size.costPrice : null) ?? sp.costPrice ?? 0,
        sellingPrice:
          (size?.sellingPrice > 0 ? size.sellingPrice : null) ?? sp.baseSellingPrice ?? 0,
        wholesalePrice: Number(size?.wholesalePrice) || 0,
        unitsPerPack: Number(size?.unitsPerPack) || 1,
        valuationMethod: settings?.valuationMethod || 'fifo',
        minStockLevel: 0,
        earliestExpiry: null,
        flags: computeStockFlags({ currentQuantity: 0, reservedQuantity: 0 }, settings || {}),
      });
    }
  }
  return [...rows, ...added];
}
module.exports = { includeUnstockedRows };
