'use client';

// Grid/compact-view pagination bar. Mirrors TablePagination styling but adds
// the page-size selector the TanStack pagination doesn't cover for grid views.

import { Text, Select } from 'rizzui';
import { SUBPRODUCT_PAGE_SIZE_OPTIONS } from '@/utils/sub-product-pagination';

export const PAGE_SIZE_OPTIONS = SUBPRODUCT_PAGE_SIZE_OPTIONS;

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
    'flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-900 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:text-gray-400 disabled:opacity-40';

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 bg-gray-50/50 p-4">
      {/* Page size selector */}
      <div className="flex items-center gap-2">
        <Text className="text-xs font-normal text-gray-600">Rows per page</Text>
        <Select
          size="sm"
          variant="flat"
          options={PAGE_SIZE_OPTIONS.map((n) => ({
            value: n,
            label: String(n),
          }))}
          value={pageSize}
          onChange={(v: { value: number; label: string }) =>
            onPageSizeChange(Number(v.value))
          }
          aria-label="Rows per page"
          className="w-20"
          suffixClassName="[&>svg]:size-3"
          selectClassName="font-semibold text-sm ring-0 min-h-11"
          optionClassName="font-medium text-xs px-2 justify-center"
        />
      </div>

      {/* Result count */}
      <Text className="text-xs font-normal tabular-nums text-gray-600">
        {total === 0
          ? '0 results'
          : `${start}–${end} of ${total.toLocaleString()}`}
      </Text>
      <Text className="text-xs font-normal tabular-nums text-gray-600">
        Page {total === 0 ? 0 : pageIndex + 1} of {totalPages.toLocaleString()}
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
