import { panelClass } from '@/app/shared/venue/workspace/controls';

/**
 * Route-level skeleton for /venue-completion, mirroring the VenueCompletion
 * shape: header row with the reload/back actions, a progress panel, and the
 * list of visit cards. Pulse is motion-safe; `?visit=` deep links are
 * preserved (the page component does not change).
 */
const bar =
  'rounded bg-gray-200 dark:bg-gray-700 motion-safe:animate-pulse';

export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6"
    >
      <p className="sr-only" role="status">
        Loading existing visits…
      </p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className={`${bar} h-8 w-72`} />
          <div className={`${bar} h-4 w-full max-w-lg`} />
        </div>
        <div className="flex items-center gap-2">
          <div className="min-h-11 w-52 rounded-lg border border-muted" />
          <div className="min-h-11 w-52 rounded-lg border border-muted" />
        </div>
      </div>
      <div className={`${panelClass} space-y-3`}>
        <div className={`${bar} h-5 w-48`} />
        <div className={`${bar} h-4 w-64`} />
        <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div className="h-full w-1/3 rounded-full bg-gray-300 dark:bg-gray-600 motion-safe:animate-pulse" />
        </div>
      </div>
      <ul className="space-y-3" aria-hidden="true">
        {[
          'w-2/3',
          'w-1/2',
        ].map((width, i) => (
          <li key={i} className={`${panelClass} flex items-center justify-between gap-3`}>
            <div className="min-w-0 space-y-2">
              <div className={`${bar} h-5 ${width}`} />
              <div className={`${bar} h-4 w-72 max-w-full`} />
            </div>
            <div className="min-h-11 w-48 shrink-0 rounded-lg border border-muted" />
          </li>
        ))}
      </ul>
    </main>
  );
}
