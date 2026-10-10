import Image from 'next/image';
import { PiArrowsClockwise, PiChartLineUp, PiMapPin } from 'react-icons/pi';
export default function NotificationFeatureHeader({
  title,
  description,
  period = 'Stock, demand and replenishment insights',
  warehouse = 'All warehouses',
  refreshLabel = 'Refresh insights',
  updatedAt,
  loading,
  refresh,
}: {
  title: string;
  description: string;
  period?: string;
  warehouse?: string;
  refreshLabel?: string;
  updatedAt?: string;
  loading: boolean;
  refresh: () => void;
}) {
  return (
    <header
      className="relative overflow-hidden px-5 py-7 sm:px-8"
      style={{
        background:
          'linear-gradient(135deg, #b20202 0%, #8f0101 60%, #6e0101 100%)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 right-40 h-48 w-48 rounded-full bg-white/5"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/20">
            <Image
              src="/logo-short.png"
              alt="DrinksHarbour"
              width={38}
              height={38}
              className="rounded-xl"
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-red-200">
              DrinksHarbour · Notifications
            </p>
            <h1 className="mt-1 text-2xl font-bold !text-white">{title}</h1>
            <p className="mt-1 text-sm text-red-100">{description}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white">
            <PiMapPin aria-hidden className="h-4 w-4" />
            {warehouse}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
          >
            <PiArrowsClockwise
              aria-hidden
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
            {loading ? 'Refreshing…' : refreshLabel}
          </button>
        </div>
      </div>
      <div className="relative mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-3 text-xs text-red-100">
        <span className="flex items-center gap-1.5">
          <PiChartLineUp aria-hidden className="h-4 w-4" />
          {period}
        </span>
        {updatedAt && (
          <span>
            Updated{' '}
            {new Date(updatedAt).toLocaleString('en-NG', {
              timeZone: 'Africa/Lagos',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            · Lagos time
          </span>
        )}
      </div>
    </header>
  );
}
