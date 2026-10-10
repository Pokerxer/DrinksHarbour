'use client';
import Image from 'next/image';
import { PiArrowsClockwise } from 'react-icons/pi';
export default function NotificationHero({
  unread,
  loading,
  busy,
  refresh,
  markAll,
}: {
  unread: number;
  loading: boolean;
  busy: boolean;
  refresh: () => void;
  markAll: () => void;
}) {
  return (
    <div
      className="relative overflow-hidden px-5 py-7 text-white sm:px-8"
      style={{
        background:
          'linear-gradient(135deg, #b20202 0%, #8f0101 60%, #6e0101 100%)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full bg-white/5"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-60 h-40 w-40 rounded-full bg-white/5"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/20">
            <Image
              src="/logo-short.png"
              alt="DrinksHarbour"
              width={38}
              height={38}
              className="rounded-xl"
            />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.15em] text-red-200">
              DrinksHarbour · Notifications
            </p>
            <h1 className="mt-1 text-2xl font-bold !text-white">
              Notifications
            </h1>
            <p className="mt-2 text-sm text-red-100">
              Stock warnings, product updates and ideas for your next step.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            aria-label="Refresh notifications"
            onClick={refresh}
            disabled={loading || busy}
            className="rounded-xl bg-white/10 p-3 disabled:opacity-50"
          >
            <PiArrowsClockwise
              className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
          <div className="rounded-xl bg-white/10 px-4 py-2 backdrop-blur-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-200">
              Unread
            </p>
            <p className="text-xl font-black tabular-nums">{unread}</p>
          </div>
          <button
            onClick={markAll}
            disabled={busy || unread === 0 || loading}
            className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#b20202] disabled:opacity-50"
          >
            Mark all as read
          </button>
        </div>
      </div>
    </div>
  );
}
