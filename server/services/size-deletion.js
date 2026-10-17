const { ConflictError } = require('../utils/errors');

// Include draft/cancelled documents: their saved lines are still history.
const REFERENCES = [
  ['InventoryMovement', ['size']],
  ['WarehouseMovement', ['size']],
  ['StockMovement', ['size']],
  ['WarehouseBatch', ['size']],
  ['Order', ['items.size']],
  ['SalesOrder', ['items.size']],
  ['CustomerInvoice', ['items.size']],
  ['Sales', ['size']],
  ['PurchaseOrder', ['items.sizeId', 'partialReceipts.items.sizeId']],
  ['StockTransfer', ['items.sizeId']],
  ['VendorBill', ['items.sizeId']],
  ['VendorReturn', ['items.sizeId']],
  ['PurchaseAgreement', ['items.sizeId']],
  ['Cart', ['items.size']],
  ['ReorderRule', ['size']],
  ['VendorPricelist', ['items.sizeId']],
  ['Review', ['sizeId']],
  ['KioskScan', ['size']],
  ['POSCombo', ['choiceLines.items.allowedSizes']],
  ['Promotion', ['sizes', 'bundleItems.size', 'excludedSizes']],
];

async function sizeDeletionStatus(size, tenantId) {
  if (['stock', 'reservedStock', 'availableStock', 'totalSold', 'totalRevenue']
    .some(field => Number(size[field] || 0) !== 0)) {
    return { allowed: false, reason: 'This size has stock, reservations, or sales history.' };
  }
  const id = size._id;
  const WarehouseStock = require('../models/WarehouseStock');
  if (await WarehouseStock.exists({
    tenant: tenantId, subProduct: size.subproduct, size: id,
    $or: [{ currentQuantity: { $ne: 0 } }, { reservedQuantity: { $gt: 0 } }],
  })) return { allowed: false, reason: 'This size has warehouse stock or reservations.' };

  for (const [name, paths] of REFERENCES) {
    const Model = require(`../models/${name}`);
    // Marketplace orders/carts span tenants. Size identity is already scoped
    // through the authorized parent; do not assume a root tenant on these docs.
    const scope = Model.schema.path('tenant') ? { tenant: tenantId } : {};
    if (await Model.exists({ ...scope, $or: paths.map(path => ({ [path]: id })) })) {
      return { allowed: false, reason: `This size has history or is still used in ${name}.` };
    }
  }
  return { allowed: true, reason: null };
}

async function assertSizesDeletable(sizes, tenantId) {
  for (const size of sizes) {
    const status = await sizeDeletionStatus(size, tenantId);
    if (!status.allowed) throw new ConflictError(`Cannot delete ${size.displayName || size.size}: ${status.reason}`);
  }
}

function removedSizes(existing, incoming, singleItem = false) {
  return existing.filter(size => singleItem
    ? size.size !== 'unit'
    : !incoming.some(row => row._id
      ? String(row._id) === String(size._id)
      : String(row.size).toLowerCase() === String(size.size).toLowerCase()));
}

module.exports = { sizeDeletionStatus, assertSizesDeletable, removedSizes };
