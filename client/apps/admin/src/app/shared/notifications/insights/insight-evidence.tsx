import type { InsightLine } from '@/services/notificationInsights.service';
import { formatCover, methodLabel, units } from './presentation';
export default function InsightEvidence({
  line,
  compactMissing = false,
}: {
  line: InsightLine;
  compactMissing?: boolean;
}) {
  const f = line.forecast;
  return (
    <details className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
      <summary className="cursor-pointer font-semibold text-gray-800">
        Why this recommendation?
      </summary>
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        {f && (
          <>
            <div>
              <dt>Forecast method</dt>
              <dd>
                {methodLabel(f.method)}
                {f.model && ` · ${f.model}`}
              </dd>
            </div>
            <div>
              <dt>Recorded history</dt>
              <dd>{f.historyDays} completed days</dd>
            </div>
            {(!compactMissing || f.method !== 'insufficient_history') && (
              <div>
                <dt>Expected demand · 7 / 14 / 30 days</dt>
                <dd>
                  {units(f.demand7)} / {units(f.demand14)} / {units(f.demand30)}{' '}
                  units
                </dd>
              </div>
            )}
          </>
        )}
        {line.available !== undefined && (
          <>
            <div>
              <dt>Available / alert threshold</dt>
              <dd>
                {units(line.available)} / {units(line.threshold)} units
              </dd>
            </div>
            <div>
              <dt>Expected stock cover</dt>
              <dd>
                {compactMissing &&
                typeof line.available === 'number' &&
                line.available <= 0
                  ? '0 days · stock depleted'
                  : f?.method === 'insufficient_history'
                    ? compactMissing
                      ? 'History needed'
                      : 'Unknown'
                    : formatCover(line.daysOfCover)}
              </dd>
            </div>
          </>
        )}
        {line.buffer !== undefined && (
          <div>
            <dt>Safety buffer</dt>
            <dd>
              {units(line.buffer)} units ·{' '}
              {line.bufferSource === 'automatic_sales_policy'
                ? 'calculated from local demand and its variability'
                : 'configured reorder policy; matching delivery-horizon error is unavailable'}
            </dd>
          </div>
        )}
        {f?.errors && (
          <div>
            <dt>Chronological validation</dt>
            <dd>
              MAE {units(f.errors.mae)} units; bias {units(f.errors.bias)};{' '}
              {f.errors.holdoutDays} holdout days
            </dd>
          </div>
        )}
      </dl>
      {!!line.incoming?.length && (
        <ul className="mt-3 space-y-1">
          {line.incoming.map((s, i) => (
            <li key={`${s.reference}:${i}`}>
              {s.reference}: {units(s.quantity)} units —{' '}
              {s.source === 'received_unposted'
                ? 'received, awaiting stock posting'
                : s.arrival
                  ? `expected ${new Date(s.arrival).toLocaleDateString('en-NG')}`
                  : 'arrival unconfirmed; excluded from timed supply'}
            </li>
          ))}
        </ul>
      )}
      <ul className="mt-3 space-y-1">
        {line.limitations?.map((l) => <li key={l}>{l}</li>)}
      </ul>
    </details>
  );
}
