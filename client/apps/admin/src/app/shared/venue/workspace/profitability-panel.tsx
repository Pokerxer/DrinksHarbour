'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getMarginReport, type MarginReport } from '@/services/venue/costing';
import CostStatus, { costMoney } from './cost-status';
import { buttonClass, fieldClass, Notice, panelClass } from './controls';
export default function ProfitabilityPanel({
  token,
  locationId,
}: {
  token: string;
  locationId: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [fromDate, setFrom] = useState(today.slice(0, 8) + '01');
  const [toDate, setTo] = useState(today);
  const [basis, setBasis] = useState<'recorded' | 'estimated'>('recorded');
  const [data, setData] = useState<MarginReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const sequence = useRef(0);
  const load = useCallback(
    async (cursor?: string) => {
      const current = ++sequence.current;
      setLoading(true);
      setError('');
      if (!cursor) setData(null);
      try {
        const result = await getMarginReport(token, locationId, {
          fromDate,
          toDate,
          basis,
          ...(cursor ? { cursor } : {}),
        });
        if (current === sequence.current)
          setData((previous) =>
            cursor && previous
              ? { ...result, rows: [...previous.rows, ...result.rows] }
              : result,
          );
      } catch (e) {
        if (current === sequence.current)
          setError(e instanceof Error ? e.message : 'Unable to load report');
      } finally {
        if (current === sequence.current) setLoading(false);
      }
    },
    [token, locationId, fromDate, toDate, basis],
  );
  useEffect(() => {
    void load();
    return () => {
      sequence.current++;
    };
  }, [load]);
  return (
    <section className="space-y-5" aria-label="Venue profitability">
      <div className={panelClass}>
        <h2 className="text-xl font-semibold">Menu margin</h2>
        <p className="mt-2 text-sm leading-6">
          Recorded gross profit uses matched stock costs. Estimates describe
          planned portion margin. Neither figure includes every operating
          expense.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label>
            From business date
            <input
              className={fieldClass}
              type="date"
              value={fromDate}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            To business date
            <input
              className={fieldClass}
              type="date"
              value={toDate}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label>
            Report basis
            <select
              className={fieldClass}
              value={basis}
              onChange={(e) => setBasis(e.target.value as typeof basis)}
            >
              <option value="recorded">Recorded gross profit</option>
              <option value="estimated">Estimated portion margin</option>
            </select>
          </label>
        </div>
      </div>
      {error && (
        <Notice
          tone="error"
          role="alert"
          action={
            <button className={buttonClass} onClick={() => void load()}>
              Retry report
            </button>
          }
        >
          {error}
        </Notice>
      )}
      {loading && <p role="status">Loading report…</p>}
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Net merchandise', data.totals.netMerchandiseMinor],
              ['Gross profit', data.totals.grossProfitMinor],
              [
                'Contribution after channel costs',
                data.totals.contributionMinor,
              ],
            ].map(([label, value]) => (
              <div className={panelClass} key={String(label)}>
                <p className="text-sm">{label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {costMoney(value as number | null)}
                </p>
              </div>
            ))}
          </div>
          <p className="text-sm">
            Cost coverage: {data.coverage.costPct}%. Report captured{' '}
            {new Date(data.asOf).toLocaleString()}. Refunds are already included
            in net merchandise.
          </p>
          {!data.rows.length ? (
            <p>
              No recognised merchandise in this interval. Choose another
              business-date range.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Portion margins and cost evidence
                </caption>
                <thead>
                  <tr>
                    {[
                      'Serving',
                      'Net merchandise',
                      'Cost basis',
                      'Gross profit',
                      'Margin',
                      'Markup',
                    ].map((title) => (
                      <th className="p-3" key={title}>
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.sourceId} className="border-t border-muted">
                      <td className="p-3">
                        {row.servingSnapshot?.displayName ||
                          row.lineId ||
                          'Bill refund'}
                      </td>
                      <td className="p-3 tabular-nums">
                        {costMoney(row.netMerchandiseMinor)}
                      </td>
                      <td className="p-3">
                        <CostStatus status={row.costStatus} />
                        <div className="mt-1">
                          {costMoney(
                            basis === 'recorded'
                              ? row.recordedCogsMinor
                              : row.estimatedCostMinor,
                          )}
                        </div>
                        {row.missingReasons.length > 0 && (
                          <p className="mt-1 text-xs">
                            Incomplete source evidence
                          </p>
                        )}
                      </td>
                      <td className="p-3 tabular-nums">
                        {costMoney(row.grossProfitMinor)}
                      </td>
                      <td className="p-3">
                        {row.grossMarginPct == null
                          ? 'Unknown'
                          : `${row.grossMarginPct}%`}
                      </td>
                      <td className="p-3">
                        {row.markupPct == null
                          ? 'Unknown'
                          : `${row.markupPct}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.nextCursor && (
            <button
              className={buttonClass}
              disabled={loading}
              onClick={() => void load(data.nextCursor!)}
            >
              Load more servings
            </button>
          )}
          <Notice tone="info">
            Use the posted accounting reports for the venue’s operating and net
            result. Deposits, tax and staff tips are separate from merchandise
            profit.
          </Notice>
        </>
      )}
    </section>
  );
}
