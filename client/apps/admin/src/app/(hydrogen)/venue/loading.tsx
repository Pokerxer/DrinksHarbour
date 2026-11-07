import { panelClass } from '@/app/shared/venue/workspace/controls';

/**
 * Route-level skeleton mirroring the VenueWorkspace shape: header row with
 * the location control, sticky tool nav pills, and a content panel. The
 * pulse animation is motion-safe (disabled under prefers-reduced-motion).
 */
const bar =
  'rounded bg-gray-200 dark:bg-gray-700 motion-safe:animate-pulse';
const pill =
  'h-11 w-32 shrink-0 rounded-xl border border-gray-200 dark:border-gray-700 motion-safe:animate-pulse';

export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6"
    >
      <p className="sr-only" role="status">
        Loading venue workspace…
      </p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className={`${bar} h-8 w-64`} />
          <div className={`${bar} h-4 w-80 max-w-full`} />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <div className={`${bar} h-4 w-16`} />
            <div className="min-h-11 w-48 rounded-lg border border-muted" />
          </div>
          <div className="min-h-11 w-44 rounded-lg border border-muted" />
        </div>
      </div>
      <div className="flex items-center gap-2 overflow-hidden border-b border-gray-200 pb-3 dark:border-gray-700">
        {['w-28', 'w-40', 'w-36', 'w-44', 'w-40'].map((width) => (
          <div key={width} className={`${pill} ${width}`} />
        ))}
      </div>
      <div className={`${panelClass} space-y-4`}>
        <div className={`${bar} h-6 w-52`} />
        <div className={`${bar} h-4 w-full max-w-xl`} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            'w-2/3',
            'w-1/2',
            'w-3/4',
            'w-1/2',
            'w-2/3',
            'w-1/2',
          ].map((width, i) => (
            <div
              key={i}
              className="h-14 rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className={`mt-4 ml-3 h-4 ${width} ${bar}`} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
