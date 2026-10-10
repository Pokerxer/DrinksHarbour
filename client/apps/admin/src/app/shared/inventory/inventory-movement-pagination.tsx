import { PAGE_SIZE } from './inventory-receipts-support';
import type { MovementBrowserView } from './use-movement-browser';
export default function MovementPagination({ view }: { view: MovementBrowserView }) {
  const { groupBy, totalPages, loading, page, setPage, filtered } = view;
  return (
    <>
      {!groupBy && totalPages > 1 && !loading && (
        <div className="flex shrink-0 items-center justify-between border-t border-gray-100 bg-white px-4 py-2.5">
          <span className="text-[11px] text-gray-400">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of{' '}
            {filtered.length.toLocaleString()}
          </span>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p: number;
              if (totalPages <= 7) p = i + 1;
              else if (page <= 4) p = i + 1;
              else if (page >= totalPages - 3) p = totalPages - 6 + i;
              else p = page - 3 + i;
              return (
                <button
                  key={p}
                  type="button"
                  aria-label={`Go to page ${p}`}
                  aria-current={p === page ? 'page' : undefined}
                  onClick={() => setPage(p)}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] font-semibold transition-colors ${
                    p === page
                      ? 'border-[#b20202] bg-[#b20202] text-white'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
