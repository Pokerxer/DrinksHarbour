import type { InsightLine } from '@/services/notificationInsights.service';
import { units } from '../insights/presentation';
import { reviewForecast } from './forecast-rules';
export default function ForecastTimeline({
  line,
  days,
}: {
  line: InsightLine;
  days: number;
}) {
  if (!reviewForecast(line, days).supported) return null;
  const buckets = Array.from({ length: Math.ceil(days / 7) }, (_, i) => ({
    start: i * 7 + 1,
    end: Math.min(days, (i + 1) * 7),
    units: line
      .forecast!.daily.slice(i * 7, Math.min(days, (i + 1) * 7))
      .reduce((n, v) => n + v, 0),
  }));
  const max = Math.max(1, ...buckets.map((b) => b.units));
  return (
    <div className="mt-4">
      <p className="font-semibold text-gray-800">
        Expected demand by week · next {days} days
      </p>
      <div
        className="mt-3 flex items-end gap-3 overflow-x-auto pb-2"
        aria-label="Weekly forecast totals"
      >
        {buckets.map((b) => (
          <div key={b.start} className="min-w-20 flex-1 text-center">
            <p className="mb-2 text-xs font-semibold text-gray-800">
              {units(b.units)} units
            </p>
            <div className="flex h-20 items-end rounded-lg bg-gray-100">
              <span
                aria-hidden
                className="block w-full rounded-lg bg-[#b20202]/70"
                style={{ height: `${(b.units / max) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-gray-500">
              Days {b.start}–{b.end}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
