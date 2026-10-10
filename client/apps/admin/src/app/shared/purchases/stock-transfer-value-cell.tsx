import type { StockTransfer } from '@/services/stockTransfer.service';
import { computeTransferTotals } from './transfer-money';

export default function StockTransferValueCell({ transfer }: { transfer: StockTransfer }) {
  const fallback = computeTransferTotals(
    transfer.items.map((item) => ({
      ...item,
      costPrice: item.costPrice ?? 0,
      quantity: Math.max(0, item.quantity - (item.returnedQty || 0)),
    })),
    transfer.deliveryCharge || 0,
  );
  // Saved totals already include tax and reflect returns. Zero is authoritative.
  const total = transfer.total ?? transfer.totalValue ?? fallback.total;
  const tax = transfer.taxAmount ?? fallback.taxAmount;
  const currency = transfer.currency || 'NGN';
  const format = (value: number) =>
    `${currency} ${value.toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="whitespace-nowrap text-right tabular-nums">
      <div className="font-semibold text-gray-900">{format(total)}</div>
      {tax > 0 && (
        <div className="mt-0.5 text-[11px] text-gray-500">Includes {format(tax)} tax</div>
      )}
    </div>
  );
}
