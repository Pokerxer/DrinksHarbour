import { PiMagnifyingGlass, PiX } from 'react-icons/pi';
export default function NotificationProductControls({
  query,
  setQuery,
  status,
  setStatus,
  statuses,
  sort,
  setSort,
  sorts,
  count,
  reset,
  children,
  label = 'Search products',
}: {
  query: string;
  setQuery: (query: string) => void;
  status: string;
  setStatus: (status: string) => void;
  statuses: Array<[string, string]>;
  sort: string;
  setSort: (sort: string) => void;
  sorts: Array<[string, string]>;
  count: number;
  reset: () => void;
  children?: React.ReactNode;
  label?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-60 flex-1 text-xs font-semibold text-gray-600">
          {label === 'Search notifications'
            ? 'Find a notification'
            : 'Find a product'}
          <span className="mt-1 flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3">
            <PiMagnifyingGlass
              aria-hidden
              className="h-5 w-5 shrink-0 text-gray-400"
            />
            <input
              aria-label={label}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                label === 'Search notifications'
                  ? 'Search notification titles and messages…'
                  : 'Search name, size, SKU, supplier or location…'
              }
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-normal outline-none"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear product search"
                onClick={() => setQuery('')}
                className="rounded p-1 text-gray-500 hover:bg-gray-200"
              >
                <PiX aria-hidden className="h-4 w-4" />
              </button>
            )}
          </span>
        </label>
        {children}
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
          Show
          <select
            aria-label="Show products"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-11 rounded-xl border border-gray-200 px-3 text-sm font-normal"
          >
            {statuses.map(([value, title]) => (
              <option value={value} key={value}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
          Sort by
          <select
            aria-label="Sort products"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-11 rounded-xl border border-gray-200 px-3 text-sm font-normal"
          >
            {sorts.map(([value, title]) => (
              <option value={value} key={value}>
                {title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs">
        <span aria-live="polite" className="text-gray-500">
          {count.toLocaleString('en-NG')} matching entries
        </span>
        <button
          type="button"
          onClick={reset}
          className="font-semibold text-[#b20202] hover:underline"
        >
          Reset filters
        </button>
      </div>
    </div>
  );
}
