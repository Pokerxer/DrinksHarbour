// services/stockTransferReceive.js
//
// Physical half of transfer-as-purchase: given validated receive lines, move
// the stock and value it. Quantities/bookkeeping on the StockTransfer document
// (receipts[], receivedQty, status) stay in the controller — this module only
// touches inventory, so it can be exercised without MongoDB.
//
// No mongoose transaction: matches the existing document workflow (single-
// writer endpoints, ordered per-line operations). If a line throws midway the
// caller's request fails wholesale; stock ops here are individually atomic.

const { ValidationError } = require('../utils/errors');
const { computeTransferMoney } = require('./stockTransfer.money');

async function receiveStockTransferLines(
  { transfer, tenantId, userId, lines },
  deps = {}
) {
  const {
    batchService = require('./batch.service'),
    WarehouseStock = require('../models/WarehouseStock'),
    WarehouseMovement = require('../models/WarehouseMovement'),
    recalcSubProductStock = require('./warehouseStock.helpers').recalcSubProductStock,
  } = deps;

  const money = computeTransferMoney(transfer.items, transfer.deliveryCharge);
  const touched = new Set();

  for (const line of lines) {
    const i = Number(line.itemIndex);
    const item = transfer.items[i];
    if (!item) throw new ValidationError(`Receive line ${i}: invalid item index`);
    const qty = Number(line.quantity);
    const outstanding = (item.quantity || 0) - (item.receivedQty || 0);
    if (!(qty > 0) || qty > outstanding) {
      throw new ValidationError(
        `"${item.subProductName}"${item.sizeName ? ` (${item.sizeName})` : ''}: ` +
          `cannot receive ${qty}, ${outstanding} outstanding`
      );
    }

    const eff = money.lines[i].effectiveUnitCost;
    await batchService.transferBatchesFefo({
      tenantId,
      subProduct: item.subProductId,
      size: item.sizeId || undefined,
      fromWarehouse: transfer.sourceWarehouse,
      toWarehouse: transfer.destinationWarehouse,
      quantity: qty,
      destUnitCost: eff,
    });

    const srcQ = { tenant: tenantId, warehouse: transfer.sourceWarehouse, subProduct: item.subProductId };
    if (item.sizeId) srcQ.size = item.sizeId;
    const src = await WarehouseStock.findOne(srcQ);
    if (!src || src.currentQuantity < qty) {
      throw new ValidationError(`Insufficient stock for "${item.subProductName}"`);
    }
    src.currentQuantity -= qty;
    await src.save();

    const dstQ = { tenant: tenantId, warehouse: transfer.destinationWarehouse, subProduct: item.subProductId };
    if (item.sizeId) dstQ.size = item.sizeId;
    let dst = await WarehouseStock.findOne(dstQ);
    if (!dst) {
      dst = new WarehouseStock({
        tenant: tenantId, warehouse: transfer.destinationWarehouse,
        subProduct: item.subProductId, size: item.sizeId || src.size,
      });
    }
    dst.currentQuantity += qty;
    await dst.save();

    await WarehouseMovement.create([
      { tenant: tenantId, warehouse: transfer.sourceWarehouse, subProduct: item.subProductId,
        size: src.size, type: 'transfer_out', quantity: qty,
        balanceAfter: src.currentQuantity,
        reference: `Transfer ${transfer.transferNumber}`, performedBy: userId },
      { tenant: tenantId, warehouse: transfer.destinationWarehouse, subProduct: item.subProductId,
        size: dst.size, type: 'transfer_in', quantity: qty,
        balanceAfter: dst.currentQuantity,
        reference: `Transfer ${transfer.transferNumber}`, performedBy: userId },
    ]);

    touched.add(String(item.subProductId));
  }

  for (const subId of touched) await recalcSubProductStock(subId);
}

module.exports = { receiveStockTransferLines };
