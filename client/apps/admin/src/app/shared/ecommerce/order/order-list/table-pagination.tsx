'use client';

import { PiCaretLeftBold, PiCaretRightBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';

export default function TablePagination({
  page,
  pages,
  total,
  onPageChange,
  label = 'orders',
}: {
  page: number;
  pages: number;
  total: number;
  onPageChange: (p: number) => void;
  /** Noun for the total count — the carts page reuses this table. */
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-muted px-5 py-4">
      <span className="text-sm text-gray-500">
        Page {page} of {pages} · {total} {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          aria-label="Previous page"
          className="rounded-lg border border-muted p-2 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PiCaretLeftBold className="h-4 w-4" />
        </button>
        {(() => {
          const span = Math.min(5, pages);
          const start = Math.max(1, Math.min(pages - span + 1, page - 2));
          return [...Array(span)].map((_, i) => {
            const pg = start + i;
            return (
              <button
                key={pg}
                type="button"
                onClick={() => onPageChange(pg)}
                aria-label={`Page ${pg}`}
                aria-current={pg === page ? 'page' : undefined}
                className={cn(
                  'h-9 w-9 rounded-lg text-sm font-semibold transition-colors',
                  pg === page
                    ? 'bg-gray-900 text-gray-0'
                    : 'border border-muted text-gray-700 hover:bg-gray-50'
                )}
              >
                {pg}
              </button>
            );
          });
        })()}
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPageChange(Math.min(pages, page + 1))}
          aria-label="Next page"
          className="rounded-lg border border-muted p-2 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PiCaretRightBold className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
