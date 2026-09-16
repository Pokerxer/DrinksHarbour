export function PageBar({
  page, totalPages, totalItems, pageSize, onPrev, onNext, onPage,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const start = Math.min((page - 1) * pageSize + 1, totalItems);
  const end = Math.min(page * pageSize, totalItems);
  const pages = Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
    if (totalPages <= 7) return i + 1;
    if (page <= 4) return i + 1;
    if (page >= totalPages - 3) return totalPages - 6 + i;
    return page - 3 + i;
  });
  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
      <p className="text-xs text-gray-500">
        {start.toLocaleString()}–{end.toLocaleString()} of {totalItems.toLocaleString()}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          disabled={page === 1}
          className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M10.354 3.354a.5.5 0 00-.708-.708l-5 5a.5.5 0 000 .708l5 5a.5.5 0 00.708-.708L5.707 8l4.647-4.646z" /></svg>
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPage(p)}
            className={`min-w-[30px] rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${
              page === p
                ? 'border-[#b20202] bg-[#b20202] text-white'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={onNext}
          disabled={page === totalPages}
          className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M5.646 3.354a.5.5 0 01.708-.708l5 5a.5.5 0 010 .708l-5 5a.5.5 0 01-.708-.708L10.293 8 5.646 3.354z" /></svg>
        </button>
      </div>
    </div>
  );
}