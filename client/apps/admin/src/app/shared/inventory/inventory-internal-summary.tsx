import type { InventoryMovement } from '@/services/inventory.service';
import { internalStats } from './inventory-internal-view';
import { fmtNgn } from './inventory-receipts-support';
export default function InternalSummary({
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
  const s = internalStats(moves);
  const cards = [
    ['Transferred in', s.transferIn.toLocaleString(), 'Original incoming stock'],
    ['Transferred out', s.transferOut.toLocaleString(), 'Original outgoing stock'],
    [
      'Returned in / out',
      `${s.returnIn.toLocaleString()} / ${s.returnOut.toLocaleString()}`,
      'Return legs shown separately',
    ],
    [
      'Net stock change',
      `${s.net > 0 ? '+' : ''}${s.net.toLocaleString()}`,
      'Includes transfers and returns',
    ],
    ['Awaiting posting', s.pending.toLocaleString(), `${s.pendingLines} pending warehouse legs`],
    [
      'Posted leg cost',
      fmtNgn(s.cost),
      s.unpriced
        ? `${s.unpriced} posted legs missing cost`
        : 'Each recorded warehouse leg · not invoice total',
    ],
  ];
  return (
    <section
      aria-label="Internal transfer totals"
      aria-busy={loading}
      className="grid shrink-0 grid-cols-2 divide-x divide-gray-200 border-b border-gray-200 bg-white sm:grid-cols-3 xl:grid-cols-6"
    >
      {cards.map(([label, value, note]) => (
        <div key={label} className="min-w-0 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            {label}
          </p>
          <p
            className={`mt-1 text-base font-bold tabular-nums ${label === 'Posted leg cost' ? 'text-[#b20202]' : 'text-gray-900'}`}
          >
            {loading || error ? '—' : value}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
            {loading
              ? 'Loading internal history…'
              : error
                ? 'Internal totals unavailable'
                : truncated
                  ? `Loaded entries only · ${note}`
                  : note}
          </p>
        </div>
      ))}
    </section>
  );
}
