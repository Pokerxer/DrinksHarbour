'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { PiWarningCircle } from 'react-icons/pi';

const focus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2';

export default function VenueError({
  error,
  reset,
}: {
  error: unknown;
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the failure for error reporting; the screen stays generic.
    console.error(error);
  }, [error]);
  return (
    <main className="bg-stone-50 px-4 pb-16 pt-12 text-stone-900 sm:px-6">
      <div className="mx-auto max-w-xl">
        <div
          role="alert"
          className="space-y-5 rounded-3xl border border-stone-200 bg-stone-950 p-6 text-white shadow-sm sm:p-9"
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200">
            Something went wrong
          </p>
          <PiWarningCircle size={40} className="text-amber-200" aria-hidden="true" />
          <h1 className="font-[var(--font-kavoon)] text-3xl font-normal leading-tight">
            Venue details are unavailable
          </h1>
          <p className="leading-7 text-stone-300">
            We could not load the current venue details. This is usually
            temporary &mdash; retrying will fetch them again. Your venue guide
            stays one step away.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={reset}
              className={`inline-flex min-h-12 items-center justify-center rounded-xl bg-red-800 px-6 py-3 font-semibold text-white transition hover:bg-red-900 ${focus}`}
            >
              Retry venue details
            </button>
            <Link
              href="/venues"
              className={`inline-flex min-h-12 items-center rounded-xl px-4 text-sm font-semibold text-stone-300 underline underline-offset-4 transition hover:text-amber-200 ${focus}`}
            >
              Back to all venues
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
