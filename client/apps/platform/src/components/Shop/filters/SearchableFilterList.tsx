import { useId, useState } from 'react';
import { PiMagnifyingGlass, PiX } from 'react-icons/pi';

type Selection = string | string[] | null;
interface Props {
  title: string;
  options: string[];
  selected: Selection;
  applied: Selection;
  onToggle: (value: string) => void;
  getCount: (value: string) => number;
  formatLabel?: (value: string) => string;
}
const contains = (selection: Selection, value: string) =>
  Array.isArray(selection) ? selection.includes(value) : selection === value;
const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');

export default function SearchableFilterList({
  title, options, selected, applied, onToggle, getCount, formatLabel = value => value,
}: Props) {
  const [query, setQuery] = useState('');
  const searchId = useId();
  const label = title.toLowerCase();
  const search = normalize(query);
  const matches = options.filter(value => normalize(formatLabel(value)).includes(search));

  return (
    <div className="min-w-0">
      <label htmlFor={searchId} className="sr-only">Search {label}</label>
      <div className="relative">
        <PiMagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)}
          placeholder={`Search ${label}…`}
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-10 text-sm outline-none focus:border-[#b20202] focus:ring-2 focus:ring-[#b20202]/20 [&::-webkit-search-cancel-button]:hidden" />
        {query && <button type="button" aria-label={`Clear ${label} search`} onClick={() => setQuery('')}
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b20202]">
          <PiX aria-hidden="true" size={17} />
        </button>}
      </div>
      <div className="flex items-center justify-between gap-2 py-2 text-xs text-gray-500">
        <span role="status">{matches.length} of {options.length} {label}</span>
        {matches.length > 5 && <span>Scroll to see more</span>}
      </div>
      <div role="region" aria-label={`${title} options`} tabIndex={0}
        className="space-y-1 rounded-lg pr-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b20202]"
        // Keep containment with the component: missing generated overflow CSS
        // must never let hundreds of options paint over adjacent sections.
        style={{ maxHeight: '16rem', overflowY: 'auto', overscrollBehavior: 'contain', scrollbarGutter: 'stable', scrollbarWidth: 'auto', scrollbarColor: '#9ca3af #f3f4f6', touchAction: 'pan-y' }}>
        {matches.map(value => {
          const checked = contains(selected, value);
          const changed = checked !== contains(applied, value);
          return <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${checked ? 'bg-[#fdf3f3] text-[#b20202]' : 'text-gray-700 hover:bg-gray-50'}`}>
            <input type="checkbox" checked={checked} onChange={() => onToggle(value)}
              className="h-4 w-4 shrink-0 accent-[#b20202] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b20202]" />
            <span className="min-w-0 flex-1 break-words capitalize">{formatLabel(value)}</span>
            {changed && <span aria-hidden="true" title="Not applied yet" className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />}
            <span aria-hidden="true" className="shrink-0 text-xs tabular-nums text-gray-500">{getCount(value)}</span>
          </label>;
        })}
        {!matches.length && <p className="px-2 py-6 text-center text-sm text-gray-500">No {label} found</p>}
      </div>
    </div>
  );
}
