import type {
  CustomerReturnPage,
  ReturnFilters,
} from '@/services/customerReturns.service';
const field =
  'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand';
export default function CustomerReturnFilters({
  filters,
  search,
  onSearch,
  locations,
  onChange,
}: {
  filters: ReturnFilters;
  search: string;
  onSearch: (value: string) => void;
  locations: CustomerReturnPage['locations'];
  onChange: (value: Partial<ReturnFilters>) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-y border-gray-200 bg-white p-4">
      <input
        aria-label="Search returns"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder="Search order, product or return…"
        className={`${field} min-w-48 flex-1`}
      />
      <select
        aria-label="Return source"
        value={filters.source || ''}
        onChange={(event) => onChange({ source: event.target.value })}
        className={field}
      >
        <option value="">Sales &amp; POS</option>
        <option value="sales">Sales</option>
        <option value="pos">POS</option>
      </select>
      <select
        aria-label="Stock disposition"
        value={filters.disposition || ''}
        onChange={(event) => onChange({ disposition: event.target.value })}
        className={field}
      >
        <option value="">All dispositions</option>
        <option value="restocked">Restocked</option>
        <option value="not-restocked">Not restocked</option>
        <option value="unverified">Stock evidence missing</option>
      </select>
      <select
        aria-label="Return location"
        value={filters.warehouse || ''}
        onChange={(event) => onChange({ warehouse: event.target.value })}
        className={field}
      >
        <option value="">All locations</option>
        {locations.map((location) => (
          <option key={location._id} value={location._id}>
            {location.name}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-xs text-gray-500">
        From
        <input
          aria-label="From date"
          type="date"
          value={filters.from || ''}
          onChange={(event) => onChange({ from: event.target.value })}
          className={field}
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-gray-500">
        To
        <input
          aria-label="To date"
          type="date"
          value={filters.to || ''}
          onChange={(event) => onChange({ to: event.target.value })}
          className={field}
        />
      </label>
      <button
        type="button"
        onClick={() => {
          onSearch('');
          onChange({
            source: '',
            disposition: '',
            warehouse: '',
            from: '',
            to: '',
            search: '',
          });
        }}
        className="rounded-lg px-3 py-2 text-sm font-medium text-brand hover:bg-red-50"
      >
        Clear filters
      </button>
    </div>
  );
}
