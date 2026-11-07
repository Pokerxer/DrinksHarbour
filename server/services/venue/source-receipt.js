'use strict';
const { fail } = require('./errors');
async function originalReceipt({ tenantId, locationId, lot, mongoSession }) {
  const value = lot.venueValuation;
  if (
    !value?.receiptId ||
    !value.reason ||
    !Number.isSafeInteger(value.initialCostMinor) ||
    value.initialCostMinor < 0 ||
    !Number.isSafeInteger(value.initialQuantityScaled) ||
    value.initialQuantityScaled < 1
  )
    fail(
      'COST_EVIDENCE_REQUIRED',
      'Reviewed original lot valuation required',
      503,
    );
  const receipt = await require('../../models/InventoryMovement')
    .findOne({
      _id: value.receiptId,
      tenant: tenantId,
      warehouse: locationId,
      subProduct: lot.subProduct,
      size: lot.size,
      status: 'confirmed',
      type: { $in: ['received', 'purchase', 'return', 'transfer_in'] },
    })
    .session(mongoSession)
    .lean();
  if (
    !receipt ||
    typeof receipt.totalCost !== 'number' ||
    !Number.isFinite(receipt.totalCost) ||
    !Number.isSafeInteger(Math.round(receipt.totalCost * 100)) ||
    Math.abs(receipt.totalCost * 100 - Math.round(receipt.totalCost * 100)) > 1e-7 ||
    Math.round(receipt.totalCost * 100) !== value.initialCostMinor ||
    receipt.quantity !== lot.initialQuantity
  )
    fail(
      'COST_EVIDENCE_REQUIRED',
      'Original valued receipt is missing or differs from lot',
      503,
    );
  const tenant = await require('../../models/Tenant')
    .findOne({ _id: tenantId })
    .select('defaultCurrency')
    .session(mongoSession)
    .lean();
  if (tenant?.defaultCurrency && tenant.defaultCurrency !== 'NGN')
    fail(
      'INVALID_CURRENCY',
      'Initial venue cost evidence supports NGN only',
      400,
    );
  if (receipt.relatedPurchaseOrder) {
    const po = await require('../../models/PurchaseOrder')
      .findOne({ _id: receipt.relatedPurchaseOrder, tenant: tenantId })
      .select('currency')
      .session(mongoSession)
      .lean();
    if (!po || po.currency !== 'NGN')
      fail(
        'INVALID_CURRENCY',
        'Original purchase currency requires reviewed conversion',
        400,
      );
  }
  return receipt;
}
module.exports = { originalReceipt };
