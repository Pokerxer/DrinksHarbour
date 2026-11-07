import { PiCaretDown, PiMagnifyingGlass, PiMapPin, PiX } from 'react-icons/pi';
import type { SortKey } from './directory.types';

interface Props {
  search: string;
  location: string;
  sort: SortKey;
  onSearch: (value: string) => void;
  onLocation: (value: string) => void;
  onSort: (value: SortKey) => void;
  onClear: () => void;
  total?: number;
  loading: boolean;
}
const sorts: { value: SortKey; label: string }[] = [
  { value: 'products', label: 'Most products' },
  { value: 'name_asc', label: 'Name A → Z' },
  { value: 'name_desc', label: 'Name Z → A' },
];
const inputClass = 'w-full rounded-xl border border-gray-300 bg-gray-50 py-3 pl-10 pr-12 text-[16px] outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100';
const clearClass = 'absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700';

export default function DirectoryFilters({ search, location, sort, onSearch, onLocation, onSort, onClear, total, loading }: Props) {
  const active = !!(search.trim() || location.trim() || sort !== 'products');
  return <section aria-label="Vendor filters" className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="min-w-0">
        <label htmlFor="vendor-search" className="mb-1.5 block text-sm font-medium text-gray-700">Search vendors by name</label>
        <div className="relative">
          <PiMagnifyingGlass aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input id="vendor-search" type="search" value={search} onChange={event => onSearch(event.target.value)}
            placeholder="Search vendors by name…" className={`${inputClass} [&::-webkit-search-cancel-button]:hidden`} />
          {search && <button type="button" aria-label="Clear vendor search" className={clearClass} onClick={() => onSearch('')}><PiX aria-hidden="true" size={18} /></button>}
        </div>
      </div>
      <div className="min-w-0">
        <label htmlFor="vendor-location" className="mb-1.5 block text-sm font-medium text-gray-700">State or city</label>
        <div className="relative">
          <PiMapPin aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input id="vendor-location" type="search" value={location} onChange={event => onLocation(event.target.value)}
            placeholder="State / city…" className={`${inputClass} [&::-webkit-search-cancel-button]:hidden`} />
          {location && <button type="button" aria-label="Clear location filter" className={clearClass} onClick={() => onLocation('')}><PiX aria-hidden="true" size={18} /></button>}
        </div>
      </div>
      <div className="min-w-0">
        <label htmlFor="vendor-sort" className="mb-1.5 block text-sm font-medium text-gray-700">Sort vendors</label>
        <div className="relative">
          <select id="vendor-sort" value={sort} onChange={event => onSort(event.target.value as SortKey)}
            className="w-full rounded-xl border border-gray-300 bg-gray-50 py-3 pl-3 pr-10 text-[16px] text-gray-700 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100">
            {sorts.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <PiCaretDown aria-hidden="true" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
        </div>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
      {search.trim() && <button type="button" aria-label={`Remove name filter: ${search.trim()}`} onClick={() => onSearch('')}
        className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-2 text-sm text-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700">Name: {search.trim()}<PiX aria-hidden="true" /></button>}
      {location.trim() && <button type="button" aria-label={`Remove location filter: ${location.trim()}`} onClick={() => onLocation('')}
        className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-2 text-sm text-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700">Location: {location.trim()}<PiX aria-hidden="true" /></button>}
      {active && <button type="button" onClick={onClear} className="rounded-lg px-2 py-2 text-sm font-medium text-red-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700">Clear all</button>}
      <p role="status" className="ml-auto text-sm text-gray-500">
        {loading ? 'Updating vendors…' : total === undefined ? 'Results unavailable' : `${total} vendor${total === 1 ? '' : 's'} found`}
      </p>
    </div>
  </section>;
}
