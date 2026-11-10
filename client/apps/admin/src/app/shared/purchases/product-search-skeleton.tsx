// app/shared/purchases/product-search-skeleton.tsx
'use client';
import { PiSpinner } from 'react-icons/pi';

/**
 * In-flight state for the product search dropdown. Shown while the debounced
 * server search (or the initial list fetch) is running, in place of the
 * results/empty state — so a slow response never flashes "No products match"
 * before real results arrive.
 *
 * `compact` matches the PO line-picker's tight row rhythm; the default height
 * suits the wider dropdowns (vendor search, catalogue modal headers).
 */
export default function ProductSearchSkeleton({
  rows = 5,
  compact = false,
}: {
  rows?: number;
  compact?: boolean;
}) {
  const bar = 'block rounded bg-gray-100 animate-pulse';
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="overflow-hidden"
    >
      <div className={compact ? 'py-1' : 'py-1.5'}>
        {Array.from({ length: rows }, (_, i) => (
          <span
            key={i}
            data-skeleton-row
            className={`flex items-center gap-2 px-3 ${compact ? 'py-2' : 'py-2.5'}`}
          >
            <span
              className={`shrink-0 rounded-full bg-gray-100 animate-pulse ${
                compact ? 'h-6 w-6' : 'h-7 w-7'
              }`}
            />
            <span className="min-w-0 flex-1 space-y-1.5">
              <span className={`${bar} h-2.5 w-2/3`} />
              <span className={`${bar} h-2 w-1/3 bg-gray-50`} />
            </span>
          </span>
        ))}
      </div>
      <p className="flex items-center gap-1.5 border-t border-gray-100 px-3 py-2 text-[10px] font-medium text-gray-400">
        <PiSpinner className="h-3 w-3 animate-spin" aria-hidden />
        Searching products…
      </p>
    </div>
  );
}
