import type { InsightLine } from '@/services/notificationInsights.service';
import { units } from '../insights/presentation';
import ForecastTimeline from './forecast-timeline';
export default function ForecastEvidence({
  line,
  days,
}: {
  line: InsightLine;
  days: number;
}) {
  const f = line.forecast;
  return (
    <details
      open
      className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs text-gray-600"
    >
      <summary className="cursor-pointer font-semibold text-gray-900">
        Forecast evidence
      </summary>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <dt>Completed history</dt>
          <dd className="mt-1 font-semibold">{f?.historyDays || 0} days</dd>
        </div>
        <div>
          <dt>Method / model</dt>
          <dd className="mt-1 font-semibold">
            {f?.method === 'trained_forecast'
              ? f.model
              : f?.method === 'historical_baseline'
                ? f.baseline === 'weekly_seasonal'
                  ? 'Weekly seasonal baseline'
                  : 'Trailing average baseline'
                : 'History needed'}
          </dd>
        </div>
        <div>
          <dt>Demand basis</dt>
          <dd className="mt-1 font-semibold">
            {line.summary
              ? 'Customer sales across the tenant'
              : line.demandBasis === 'sales_and_transfers'
                ? 'Customer sales + net transfers out'
                : line.demandBasis === 'transfers'
                  ? 'Net transfers out'
                  : 'Customer sales at this warehouse'}
          </dd>
        </div>
      </dl>
      {f?.errors ? (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
          <p className="font-semibold text-gray-800">
            Recent chronological validation · {f.errors.holdoutDays} held-out
            days
          </p>
          <p className="mt-1">
            Mean absolute error: {units(f.errors.mae)} units/day · Bias:{' '}
            {units(f.errors.bias)} units/day
            {f.errors.wape !== null &&
              ` · Relative error: ${Math.round(f.errors.wape * 100)}%`}
          </p>
          <p className="mt-1">
            Baseline error: {units(f.errors.baselineMae)} units/day. Fit
            describes recent history, not a guarantee of future sales.
          </p>
        </div>
      ) : (
        <p className="mt-4">
          This estimate has not yet been validated on held-out days.
        </p>
      )}
      {f?.validation?.reason && <p className="mt-3">{f.validation.reason}</p>}
      <ForecastTimeline line={line} days={days} />
      <ul className="mt-4 list-disc space-y-1 pl-4">
        {Array.from(
          new Set([...(f?.limitations || []), ...(line.limitations || [])])
        ).map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      {!line.summary && (
        <p className="mt-3">
          Shortfall is the largest uncovered demand balance within this horizon,
          before safety stock and pack rounding. Overdue and undated arrivals
          are excluded; other dated arrivals are counted on their calendar day.
          Confirm actual delivery times.
        </p>
      )}
      {line.summary && (
        <p className="mt-3 font-medium">
          Internal transfers are excluded from tenant customer sales. Select a
          warehouse to forecast its sales and transfer demand.
        </p>
      )}
    </details>
  );
}
