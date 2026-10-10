import type { InventoryMovement } from '@/services/inventory.service';
import { adjustmentStats } from './inventory-adjustment-view';
import { fmtNgn } from './inventory-receipts-support';
export default function AdjustmentSummary({
  moves,
  loading,
  error,
  truncated,
}: {
  moves: InventoryMovement[];
  loading: boolean;
  error: string | null;
  truncated: boolean;
}) {
  const s = adjustmentStats(moves);
  const cards = [
    ['Stock increases', s.increase.toLocaleString(), 'Confirmed units added'],
    ['Stock decreases', s.decrease.toLocaleString(), 'Confirmed units removed'],
    [
      'Net stock change',
      `${s.net > 0 ? '+' : ''}${s.net.toLocaleString()}`,
      s.unknown
        ? `${s.unknown} corrections missing stock change`
        : `${s.unchanged} unchanged · ${s.excluded} cancelled / rejected`,
    ],
    [
      'Awaiting posting',
      s.pending.toLocaleString(),
      `${s.pending.toLocaleString()} units · ${s.pendingLines} pending correction${s.pendingLines === 1 ? '' : 's'}`,
    ],
    [
      'Recorded correction cost',
      fmtNgn(s.cost),
      s.unpriced
        ? `${s.unpriced} posted corrections missing cost`
        : 'Recorded value · not net valuation',
    ],
  ];
  return (
    <section
      aria-label="Adjustment totals"
      aria-busy={loading}
      className="grid shrink-0 grid-cols-2 divide-x divide-gray-200 border-b border-gray-200 bg-white sm:grid-cols-3 xl:grid-cols-5"
    >
      {cards.map(([label, value, note]) => (
        <div key={label} className="min-w-0 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            {label}
          </p>
          <p
            className={`mt-1 text-base font-bold tabular-nums ${label === 'Recorded correction cost' ? 'text-[#b20202]' : 'text-gray-900'}`}
          >
            {loading || error ? '—' : value}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
            {loading
              ? 'Loading adjustments…'
              : error
                ? 'Adjustment totals unavailable'
                : truncated
                  ? `Loaded entries only · ${note}`
                  : note}
          </p>
        </div>
      ))}
    </section>
  );
}
