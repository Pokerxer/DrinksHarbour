'use client';

import { PiArrowDown, PiArrowUp, PiMinus } from 'react-icons/pi';
import type { ProfitLoss } from '@/services/accounting.service';
import { dateWindowLabel, fmtMoney } from './accounting-helpers';
import { periodComparison } from './period-comparison';

/**
 * Prior-period variance for the profit & loss.
 *
 * A P&L read alone is one number with no meaning: "net profit ₦412,000" says
 * nothing without knowing whether the month before was ₦380,000 or ₦2.1m. The
 * comparison period is the equally long window immediately before, supplied by
 * the server, so a 31-day month is never compared with a 28-day one.
 *
 * Colour comes from `row.favourable`, never from the sign of the change — more
 * cost of goods sold is a worse result even though it moved up.
 */
export default function PlComparisonTable({
  data,
  previousWindow,
}: {
  data: ProfitLoss;
  previousWindow?: { from: string; to: string } | null;
}) {
  const { rows } = periodComparison(data, data.previous);
  if (rows.length === 0) return null;

  const windowLabel = previousWindow
    ? dateWindowLabel(previousWindow.from, previousWindow.to)
    : null;

  return (
    <section className="mb-3" aria-label="Comparison with the previous period">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          vs previous period
        </h3>
        {windowLabel && <span className="text-[11px] text-gray-400">{windowLabel}</span>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[460px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Line</th>
              <th className="px-4 py-2 text-right font-medium">This period</th>
              <th className="px-4 py-2 text-right font-medium">Previous</th>
              <th className="px-4 py-2 text-right font-medium">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => {
              const tone =
                r.favourable === null
                  ? 'text-gray-400'
                  : r.favourable
                    ? 'text-emerald-600'
                    : 'text-red-600';
              return (
                <tr key={r.key} className={r.key === 'netProfit' ? 'font-semibold' : ''}>
                  <td className="px-4 py-2 text-gray-700">{r.label}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                    {fmtMoney(r.current)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-gray-500">
                    {fmtMoney(r.previous)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-2 text-right tabular-nums ${tone}`}
                  >
                    <span className="inline-flex items-center justify-end gap-1">
                      {r.delta === 0 ? (
                        <PiMinus size={11} />
                      ) : r.delta > 0 ? (
                        <PiArrowUp size={11} />
                      ) : (
                        <PiArrowDown size={11} />
                      )}
                      {r.pct === null
                        ? fmtMoney(Math.abs(r.delta))
                        : `${r.delta > 0 ? '+' : '−'}${Math.abs(r.pct).toFixed(1)}%`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-[11px] text-gray-400">
        Arrows show direction of movement; the colour shows whether it helped.
        A percentage is omitted where the previous figure cannot be a base.
      </p>
    </section>
  );
}
