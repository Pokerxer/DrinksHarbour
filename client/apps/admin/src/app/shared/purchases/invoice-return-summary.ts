import type { VendorBill } from '@/services/vendorBill.service';
import type { StockTransfer } from '@/services/stockTransfer.service';
import { computeTransferTotals } from './transfer-money';

export function billReturnSummary(bill: VendorBill, returns = bill.returns || []) {
  const ids = new Set(bill.returnAdjustments?.map((entry) => entry.vendorReturn) || []);
  const linked = returns.filter((entry) => {
    const id = typeof entry.vendorBill === 'object' ? entry.vendorBill?._id : entry.vendorBill;
    return id === bill._id || ids.has(entry._id);
  });
  const confirmed = linked.filter(
    (entry) => !['draft', 'cancelled', 'rejected'].includes(entry.status),
  );
  const lines = bill.items.map((item, index) => {
    const original = bill.originalInvoice?.items[index];
    const returned =
      (bill.returnAdjustments?.length
        ? bill.returnAdjustments
            .filter((entry) => entry.active !== false)
            .reduce(
              (sum, entry) =>
                sum + (entry.lines.find((line) => line.itemIndex === index)?.quantity || 0),
              0,
            )
        : undefined) ??
      confirmed.reduce(
        (sum, entry) =>
          sum +
          entry.items
            .filter(
              (line) =>
                line.subProductId === item.subProductId &&
                (line.sizeId || '') === (item.sizeId || ''),
            )
            .reduce((n, line) => n + line.quantity, 0),
        0,
      );
    return { original: original?.quantity, returned, remaining: item.quantity };
  });
  const originalTotal = bill.originalInvoice?.totalAmount;
  const credit = originalTotal == null ? undefined : Math.max(0, originalTotal - bill.totalAmount);
  const refunds = confirmed.reduce((sum, entry) => sum + (entry.refundAmount || 0), 0);
  return {
    linked,
    confirmed,
    lines,
    originalTotal,
    credit,
    refunds,
    refundRemaining: Math.max(0, (bill.paidAmount || 0) - bill.totalAmount - refunds),
    fullyReturned:
      lines.some((line) => line.returned > 0) && bill.items.every((item) => item.quantity === 0),
  };
}

export function transferReturnSummary(transfer: StockTransfer) {
  const original = computeTransferTotals(
    transfer.items.map((item) => ({ ...item, costPrice: item.costPrice || 0 })),
    transfer.deliveryCharge || 0,
  );
  const returned = transfer.items.reduce((sum, item) => sum + (item.returnedQty || 0), 0);
  const remaining = transfer.items.reduce(
    (sum, item) => sum + Math.max(0, item.quantity - (item.returnedQty || 0)),
    0,
  );
  return {
    originalTotal: original.total,
    returned,
    remaining,
    credit: Math.max(0, original.total - (transfer.total ?? transfer.totalValue ?? original.total)),
    fullyReturned: returned > 0 && remaining === 0,
  };
}
