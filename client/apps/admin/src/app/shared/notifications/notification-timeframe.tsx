'use client';
import { useState } from 'react';
export const timeframeToday = (completed = false) =>
  new Date(Date.now() + 3600000 - (completed ? 86400000 : 0))
    .toISOString()
    .slice(0, 10);
export function validTimeframe(start: string, end: string, completed = false) {
  const date = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  return (
    date(start) &&
    date(end) &&
    start <= end &&
    end <= timeframeToday(completed) &&
    (Date.parse(end) - Date.parse(start)) / 86400000 < 366
  );
}
export default function NotificationTimeframe(props: {
  startDate?: string;
  endDate?: string;
  onApply: (start: string, end: string) => void;
  completed?: boolean;
  disabled?: boolean;
}) {
  return (
    <TimeframeFields key={`${props.startDate}:${props.endDate}`} {...props} />
  );
}
function TimeframeFields({
  startDate = '',
  endDate = '',
  onApply,
  completed = false,
  disabled = false,
}: {
  startDate?: string;
  endDate?: string;
  onApply: (start: string, end: string) => void;
  completed?: boolean;
  disabled?: boolean;
}) {
  const [start, setStart] = useState(startDate),
    [end, setEnd] = useState(endDate),
    [error, setError] = useState('');
  const apply = () => {
    if (!validTimeframe(start, end, completed)) {
      setError(
        'Choose valid dates in order, up to 366 days, with no future dates.'
      );
      return;
    }
    setError('');
    onApply(start, end);
  };
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <p className="text-sm font-semibold text-gray-900">Timeframe</p>
          <p className="mt-1 text-xs text-gray-500">
            {startDate
              ? `${startDate} – ${endDate}`
              : completed
                ? 'Default: last 30 completed days'
                : 'All recorded dates'}{' '}
            · Lagos time
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
          From
          <input
            aria-label="From date"
            type="date"
            value={start}
            max={timeframeToday(completed)}
            disabled={disabled}
            onChange={(e) => {
              setStart(e.target.value);
              setError('');
            }}
            className="h-11 rounded-xl border border-gray-200 px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
          To
          <input
            aria-label="To date"
            type="date"
            value={end}
            max={timeframeToday(completed)}
            disabled={disabled}
            onChange={(e) => {
              setEnd(e.target.value);
              setError('');
            }}
            className="h-11 rounded-xl border border-gray-200 px-3 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={disabled}
          onClick={apply}
          className="h-11 rounded-xl bg-[#b20202] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          Apply timeframe
        </button>
        {(startDate || start || end) && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setStart('');
              setEnd('');
              setError('');
              onApply('', '');
            }}
            className="h-11 rounded-xl border border-gray-200 px-4 text-sm font-semibold disabled:opacity-50"
          >
            Reset timeframe
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
