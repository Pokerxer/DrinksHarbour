'use client';

import { useTransition, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { PiArrowClockwiseBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { useDashboardMeta, useDashboardRefreshControl } from './use-dashboard';

/** Only the presets get a button; `custom` is driven by the URL, not this control. */
const PRESETS: { key: string; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
];

export default function PeriodSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const meta = useDashboardMeta();
  const { setRefreshing } = useDashboardRefreshControl();

  // Mirror the transition state into context so widgets can dim themselves.
  useEffect(() => {
    setRefreshing(isPending);
  }, [isPending, setRefreshing]);

  const active = meta?.period ?? 'month';

  function select(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === 'month') {
      // 'month' is the server default — keep the URL clean.
      params.delete('period');
    } else {
      params.set('period', key);
    }
    // from/to only ever apply to the custom period.
    params.delete('from');
    params.delete('to');

    const qs = params.toString();
    // Shallow-URL semantics on purpose: push inside a transition so React
    // keeps the current dashboard (keep-cached-while-refreshing) until the
    // new period's server render is ready — the previous data never blanks.
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="group"
        aria-label="Reporting period"
        className="inline-flex flex-wrap items-center rounded-lg border border-muted bg-gray-0 p-0.5"
      >
        {PRESETS.map(({ key, label }) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              type="button"
              onClick={() => select(key)}
              aria-pressed={isActive}
              className={cn(
                // 44px minimum target + visible focus ring, matching the
                // codebase convention (focus-visible:ring-primary, min-h-11).
                'min-h-11 rounded-md px-3.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isActive
                  ? 'bg-[#b20202] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {meta?.period === 'custom' && (
        <span className="inline-flex min-h-11 items-center rounded-lg border border-muted bg-gray-0 px-2.5 text-xs font-medium text-gray-700">
          {meta.label}
        </span>
      )}

      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        aria-label="Refresh dashboard data"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-muted bg-gray-0 px-2.5 text-xs font-medium text-gray-600 transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <PiArrowClockwiseBold
          className={cn(
            'h-3.5 w-3.5',
            isPending && 'animate-spin motion-reduce:animate-none'
          )}
        />
        Refresh
      </button>

      {/* Announces the in-flight load and the period now displayed. */}
      <span aria-live="polite" className="sr-only">
        {isPending
          ? 'Loading dashboard data'
          : `Showing ${meta?.label ?? 'this month'}`}
      </span>
    </div>
  );
}

export function DashboardBody({ children }: { children: React.ReactNode }) {
  const { isRefreshing } = useDashboardRefreshControl();
  return (
    <div
      className={cn(
        'transition-opacity duration-200 motion-reduce:transition-none',
        isRefreshing && 'pointer-events-none opacity-60'
      )}
      aria-busy={isRefreshing}
    >
      {children}
    </div>
  );
}
