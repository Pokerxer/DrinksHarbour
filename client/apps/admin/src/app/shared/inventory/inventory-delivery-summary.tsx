import type { InventoryMovement } from '@/services/inventory.service';
import type { MoveStats } from './inventory-movements-summary';
import { deliveryStats } from './inventory-delivery-view';
import { fmtNgn } from './inventory-receipts-support';
export default function DeliverySummary({
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
  const delivery = deliveryStats(moves);
  const cards = [
    [
      'Delivery lines',
      stats.count.toLocaleString(),
      `${delivery.postedLines} stock issued · ${delivery.excluded} cancelled/rejected`,
    ],
    [
      'Units issued',
      delivery.issued.toLocaleString(),
      `Sales ${delivery.sold.toLocaleString()} · Shipments ${delivery.shipped.toLocaleString()}`,
    ],
    [
      'Awaiting issue',
      delivery.pending.toLocaleString(),
      `${delivery.pending.toLocaleString()} units · ${delivery.pendingLines} pending ${delivery.pendingLines === 1 ? 'line' : 'lines'}`,
    ],
    [
      'Issued cost',
      fmtNgn(delivery.cost),
      delivery.unpriced
        ? `${delivery.unpriced} issued lines missing cost`
        : 'Recorded stock cost · excludes invoice tax',
    ],
    [
      'Products / orders',
      `${stats.products.toLocaleString()} / ${delivery.orders.toLocaleString()}`,
      `${stats.warehouses} warehouses · linked sales orders`,
    ],
  ];
  return (
    <section
      aria-label="Delivery totals"
      aria-busy={loading}
      className="grid shrink-0 grid-cols-2 divide-x divide-gray-200 border-b border-gray-200 bg-white sm:grid-cols-3 xl:grid-cols-5"
    >
      {cards.map(([label, value, note]) => (
        <div key={label} className="min-w-0 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            {label}
          </p>
          <p
            className={`mt-1 text-base font-bold tabular-nums ${label === 'Issued cost' ? 'text-[#b20202]' : 'text-gray-900'}`}
          >
            {loading || error ? '—' : value}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
            {loading
              ? 'Loading deliveries…'
              : error
                ? 'Delivery totals unavailable'
                : truncated
                  ? `Loaded entries only · ${note}`
                  : note}
          </p>
        </div>
      ))}
    </section>
  );
}
