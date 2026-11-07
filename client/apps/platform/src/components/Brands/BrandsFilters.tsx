import { useId } from 'react';
import { PiCaretDown, PiMagnifyingGlass, PiX } from 'react-icons/pi';
import type { BrandSort } from './types';
import styles from './BrandsControls.module.css';

interface BrandsFiltersProps {
  search: string;
  country: string;
  sort: BrandSort;
  countries: string[];
  resultCount: number;
  loading?: boolean;
  error?: boolean;
  onSearchChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  onSortChange: (value: BrandSort) => void;
  onClearAll: () => void;
}

const inputClass = `${styles.control} rounded-xl border border-gray-200 bg-gray-50 px-3 text-gray-700 focus:border-red-300 focus:bg-white focus:outline-red-700`;

export default function BrandsFilters({ search, country, sort, countries, resultCount, loading, error,
  onSearchChange, onCountryChange, onSortChange, onClearAll }: BrandsFiltersProps) {
  const id = useId();
  return (
    <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className={styles.fields}>
        <div>
          <label htmlFor={`${id}-search`} className="mb-1.5 block text-xs font-medium text-gray-600">Search brands by name</label>
          <div className="relative">
            <PiMagnifyingGlass aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input id={`${id}-search`} type="search" value={search} onChange={event => onSearchChange(event.target.value)}
              placeholder="Search brands by name…" className={`${inputClass} pl-9 pr-11 [&::-webkit-search-cancel-button]:appearance-none`} />
            {search && <button type="button" aria-label="Clear brand search" onClick={() => onSearchChange('')}
              className="absolute right-0 top-0 flex h-[44px] w-[44px] items-center justify-center rounded-xl text-gray-500 focus-visible:outline-red-700"><PiX aria-hidden="true" size={16} /></button>}
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-country`} className="mb-1.5 block text-xs font-medium text-gray-600">Country of origin</label>
          <div className="relative">
          <select id={`${id}-country`} value={country} onChange={event => onCountryChange(event.target.value)} className={`${inputClass} pr-9`}>
            <option value="">All countries</option>
            {countries.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <PiCaretDown aria-hidden="true" size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-sort`} className="mb-1.5 block text-xs font-medium text-gray-600">Sort brands</label>
          <div className="relative">
          <select id={`${id}-sort`} value={sort} onChange={event => onSortChange(event.target.value as BrandSort)} className={`${inputClass} pr-9`}>
            <option value="name_asc">Name A → Z</option>
            <option value="name_desc">Name Z → A</option>
            <option value="products">Most Products</option>
            <option value="newest">Newest First</option>
          </select>
          <PiCaretDown aria-hidden="true" size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
        {country && <button type="button" onClick={() => onCountryChange('')} className="min-h-[44px] rounded-full bg-blue-50 px-3 text-xs font-medium text-blue-700">Clear country filter</button>}
        <button type="button" onClick={onClearAll} className="min-h-[44px] px-2 text-xs font-medium text-gray-600 underline">Clear all</button>
        <p role="status" aria-live="polite" aria-atomic="true" className="ml-auto text-xs text-gray-500">
          {loading ? 'Loading brands…' : error ? 'Results unavailable' : `${resultCount.toLocaleString()} brand${resultCount === 1 ? '' : 's'}`}
        </p>
      </div>
    </div>
  );
}
