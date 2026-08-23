import cn from '@core/utils/class-names';

function Block({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-2xl bg-gray-200/70', className)}
      aria-hidden="true"
    />
  );
}

/**
 * Full-page placeholder shown while the dashboard's auth + data fetch streams
 * in. Mirrors the real layout (hero strip → period bar → stat grid → panels)
 * so the page doesn't jump when content resolves.
 */
export default function DashboardSkeleton() {
  return (
    <div className="@container" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading dashboard…</span>

      {/* Hero strip */}
      <div className="-mx-4 md:-mx-5 lg:-mx-6 3xl:-mx-8 4xl:-mx-10">
        <Block className="h-28 rounded-none md:h-32" />
      </div>

      {/* Period bar */}
      <div className="-mx-4 mb-6 border-b border-muted px-4 py-3 md:-mx-5 md:px-5 lg:-mx-6 lg:px-6 3xl:-mx-8 3xl:px-8 4xl:-mx-10 4xl:px-10">
        <div className="flex items-center justify-between gap-3">
          <Block className="h-4 w-40 rounded-md" />
          <Block className="h-8 w-64 rounded-lg" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-6 @7xl:grid-cols-12 3xl:gap-8">
        <div className="grid grid-cols-1 gap-5 @2xl:grid-cols-2 @3xl:grid-cols-4 @3xl:gap-6 @7xl:col-span-8">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-muted bg-gray-0 p-5 dark:bg-gray-100/30"
            >
              <div className="mb-4 flex items-start justify-between">
                <Block className="h-8 w-8 rounded-lg" />
                <Block className="h-4 w-16 rounded" />
              </div>
              <Block className="mb-2 h-7 w-24 rounded" />
              <div className="mt-5 border-t border-dashed border-muted pt-4">
                <Block className="h-4 w-32 rounded" />
              </div>
            </div>
          ))}
        </div>
        <Block className="h-[464px] rounded-xl @sm:h-[520px] @7xl:col-span-4 @7xl:h-full" />
      </div>

      {/* Chart panel + table panel */}
      <Block className="mt-6 h-80 rounded-xl 3xl:mt-8" />
      <Block className="mt-6 h-64 rounded-xl 3xl:mt-8" />
    </div>
  );
}
