import type { InventoryMovement } from '@/services/inventory.service';
import type { MoveStats } from './inventory-movements-summary';
import { receiptStats } from './inventory-receipt-view';
import { fmtNgn } from './inventory-receipts-support';
export default function ReceiptSummary({
  moves,
  stats,
  loading,
  error,
  truncated,
}: {
  moves: InventoryMovement[];
  stats: MoveStats;
  loading: boolean;
  error: string | null;
  truncated: boolean;
}) {
  const receipt = receiptStats(moves);
  const cards = [
    [
      'Receipt lines',
      stats.count.toLocaleString(),
      `${receipt.confirmedLines} posted · ${receipt.excluded} cancelled/rejected`,
    ],
    ['Units received', receipt.received.toLocaleString(), 'Confirmed incoming stock only'],
    [
      'Awaiting receipt',
      receipt.pending.toLocaleString(),
      `${receipt.pending.toLocaleString()} units · ${receipt.pendingLines} pending ${receipt.pendingLines === 1 ? 'line' : 'lines'}`,
    ],
    [
      'Received value',
      fmtNgn(receipt.cost),
      receipt.unpriced
        ? `${receipt.unpriced} posted lines missing cost`
        : 'Recorded stock cost · excludes invoice tax',
    ],
    [
      'Products / suppliers',
      `${stats.products.toLocaleString()} / ${stats.suppliers.toLocaleString()}`,
      `${stats.warehouses} warehouses · ${stats.pos} linked purchase orders`,
    ],
  ];
  return (
    <section
      aria-label="Receipt totals"
      aria-busy={loading}
      className="grid shrink-0 grid-cols-2 divide-x divide-gray-200 border-b border-gray-200 bg-white sm:grid-cols-3 xl:grid-cols-5"
    >
      {cards.map(([label, value, note]) => (
        <div key={label} className="min-w-0 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            {label}
          </p>
          <p
            className={`mt-1 text-base font-bold tabular-nums ${label === 'Received value' ? 'text-[#b20202]' : 'text-gray-900'}`}
          >
            {loading || error ? '—' : value}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
            {loading
              ? 'Loading receipts…'
              : error
                ? 'Receipt totals unavailable'
                : truncated
                  ? `Loaded entries only · ${note}`
                  : note}
          </p>
        </div>
      ))}
    </section>
  );
}
