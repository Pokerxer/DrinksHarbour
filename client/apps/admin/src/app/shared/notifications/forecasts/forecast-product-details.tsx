import Link from 'next/link';
import type { InsightLine } from '@/services/notificationInsights.service';
import { units, methodLabel } from '../insights/presentation';
import { performanceLink } from '../performance/performance-rules';
import { reviewForecast } from './forecast-rules';
import ForecastEvidence from './forecast-evidence';
const fits = {
  good: 'Good recent fit',
  mixed: 'Mixed recent fit',
  weak: 'Weak recent fit',
  unvalidated: 'Not validated yet',
  unavailable: 'History needed',
};
export default function ForecastProductDetails({
  line,
  days,
  stock,
  purchase,
  asOf,
}: {
  line: InsightLine;
  days: number;
  stock: boolean;
  purchase: boolean;
  asOf?: string;
}) {
  const r = reviewForecast(line, days, asOf),
    f = line.forecast;
  const action = !r.supported
    ? 'Review dated demand records and location assignments.'
    : !stock
      ? 'Review demand history and forecast validation before planning replenishment.'
      : line.summary
        ? 'Select a warehouse before planning transfers or purchases.'
        : r.shortfall === null
          ? 'Verify this warehouse’s available balance before ordering.'
          : typeof line.available === 'number' && line.available < 0
            ? 'Verify this negative stock balance before preparing replenishment.'
            : r.shortfall > 0
              ? 'Review incoming transfers and supplier delivery times to cover this shortfall.'
              : r.demand === 0
                ? 'No demand is forecast from recorded history. Review visibility and stock availability before ordering.'
                : 'Recorded supply covers this horizon. Monitor demand and incoming delivery dates.';
  const start = Date.parse(f?.startDate || '');
  const end = Number.isFinite(start)
    ? new Date(start + (days - 1) * 86400000).toLocaleDateString('en-NG', {
        timeZone: 'Africa/Lagos',
        day: 'numeric',
        month: 'short',
      })
    : null;
  return (
    <section aria-label="Forecast projection" className="p-4 sm:p-5">
      <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
        {fits[r.fit]}
      </span>
      <dl className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-gray-500">Expected next {days} days</dt>
          <dd className="mt-1 text-xl font-bold text-gray-900">
            {r.demand === null ? 'History needed' : `${units(r.demand)} units`}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Net sold · last 30 days</dt>
          <dd className="mt-1 font-semibold">{units(line.units30)} units</dd>
        </div>
        {stock && (
          <>
            <div>
              <dt className="text-xs text-gray-500">Available now</dt>
              <dd className="mt-1 font-semibold">
                {units(line.available)} units
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">
                {line.summary ? 'Replenishment planning' : 'Forecast shortfall'}
              </dt>
              <dd
                className={`mt-1 font-semibold ${r.attention ? 'text-amber-800' : ''}`}
              >
                {line.summary
                  ? 'Choose a warehouse'
                  : r.shortfall === null
                    ? 'Verify evidence'
                    : `${units(r.shortfall)} units`}
              </dd>
            </div>
          </>
        )}
      </dl>
      <p className="mt-3 text-xs text-indigo-700">
        {methodLabel(f?.method || 'insufficient_history')}
        {f?.model && ` · ${f.model}`}
        {end && ` · Through ${end}`}
      </p>
      {stock && !line.summary && r.supported && (
        <p className="mt-3 text-xs text-gray-500">
          After commitments: {units(r.effective)} units · Dated incoming within
          horizon: {units(r.incoming)} units · Projected ending balance:{' '}
          {units(r.balance)} units
          {r.stockoutDay !== null &&
            ` · Potential depletion: ${r.stockoutDay === 0 ? 'already depleted' : `day ${r.stockoutDay}`}`}
        </p>
      )}
      {line.periodUnits !== undefined && (
        <p className="mt-3 text-xs text-gray-600">
          Net sold · selected past period: {units(line.periodUnits)} units
        </p>
      )}
      <p className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
        {action}
      </p>
      <ForecastEvidence line={line} days={days} />
      <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-[#b20202]">
        {stock && (
          <Link href={performanceLink('/notifications/warehouses', line)}>
            {line.summary
              ? 'Review warehouse demand →'
              : 'Review warehouse supply →'}
          </Link>
        )}
        {purchase && !line.summary && r.supported && r.shortfall !== null && (
          <Link href={performanceLink('/notifications/restock', line)}>
            Review supplier plan →
          </Link>
        )}
      </div>
    </section>
  );
}
