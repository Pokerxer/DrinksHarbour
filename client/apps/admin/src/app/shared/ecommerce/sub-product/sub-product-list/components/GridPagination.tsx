'use client';

// Grid/compact-view pagination bar. Mirrors TablePagination styling but adds
// the page-size selector the TanStack pagination doesn't cover for grid views.

import { Text, Select } from 'rizzui';

/** Page sizes offered by grid & list selectors (10 = POS entry point). */
export const PAGE_SIZE_OPTIONS = [10, 12, 25, 50, 100];

export default function GridPagination({
  pageIndex,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: {
  pageIndex: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (i: number) => void;
  onPageSizeChange: (ps: number) => void;
}) {
  const start = total === 0 ? 0 : pageIndex * pageSize + 1;
  const end = Math.min((pageIndex + 1) * pageSize, total);
  const canPrev = pageIndex > 0;
  const canNext = pageIndex < totalPages - 1;

  const navButton =
    'flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-900 shadow-sm transition-colors hover:bg-gray-50 disabled:text-gray-400 disabled:opacity-40 disabled:shadow-none';

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 bg-gray-50/50 p-4">
      {/* Page size selector */}
      <div className="flex items-center gap-2">
        <Text className="hidden font-normal text-gray-600 @md:block">
          Rows per page
        </Text>
        <Select
          size="sm"
          variant="flat"
          options={PAGE_SIZE_OPTIONS.map((n) => ({
            value: n,
            label: String(n),
          }))}
          value={pageSize}
          onChange={(v: any) => onPageSizeChange(Number(v.value))}
          aria-label="Rows per page"
          className="w-16"
          suffixClassName="[&>svg]:size-3"
          selectClassName="font-semibold text-xs ring-0 shadow-sm h-7"
          optionClassName="font-medium text-xs px-2 justify-center"
        />
      </div>

      {/* Result count */}
      <Text className="hidden font-normal text-gray-600 @xl:block">
        {total === 0
          ? '0 results'
          : `${start}–${end} of ${total.toLocaleString()}`}
      </Text>
      <Text className="hidden font-normal text-gray-600 @3xl:block">
        Page {pageIndex + 1} of {totalPages.toLocaleString()}
      </Text>

      {/* Page nav */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(0)}
          disabled={!canPrev}
          aria-label="First page"
          className={navButton}
        >
          «
        </button>
        <button
          type="button"
          onClick={() => onPageChange(pageIndex - 1)}
          disabled={!canPrev}
          aria-label="Previous page"
          className={navButton}
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => onPageChange(pageIndex + 1)}
          disabled={!canNext}
          aria-label="Next page"
          className={navButton}
        >
          ›
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages - 1)}
          disabled={!canNext}
          aria-label="Last page"
          className={navButton}
        >
          »
        </button>
      </div>
    </div>
  );
}
