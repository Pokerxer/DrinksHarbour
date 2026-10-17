'use client';
import { PiMagnifyingGlass, PiX } from 'react-icons/pi';

export default function CatalogueSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const parts = value.split(/[,;\n]/);
  const draft = (parts.pop() || '').trimStart();
  const terms = parts.map((term) => term.trim()).filter(Boolean);
  const update = (next: string[], text = draft) =>
    onChange(next.length ? `${next.join(', ')}, ${text}` : text);
  return (
    <div>
      <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2 focus-within:border-brand focus-within:bg-white focus-within:ring-1 focus-within:ring-brand">
        <PiMagnifyingGlass
          aria-hidden="true"
          className="ml-1 h-5 w-5 shrink-0 text-gray-400"
        />
        {terms.map((term, index) => (
          <span
            key={`${index}-${term}`}
            className="inline-flex max-w-full items-center gap-1 rounded-lg border border-red-100 bg-red-50 py-1 pl-2.5 pr-1 text-xs font-medium text-brand"
          >
            <span className="max-w-48 truncate">{term}</span>
            <button
              type="button"
              aria-label={`Remove search ${term}`}
              onClick={() => update(terms.filter((_, i) => i !== index))}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-red-100"
            >
              <PiX />
            </button>
          </span>
        ))}
        <input
          data-autofocus
          aria-label="Search catalogue"
          aria-describedby="catalogue-search-help"
          maxLength={120}
          value={draft}
          onChange={(event) => update(terms, event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Enter') {
              event.preventDefault();
              if (draft.trim()) update([...terms, draft.trim()], '');
            } else if (event.key === 'Backspace' && !draft && terms.length) {
              update(terms.slice(0, -1), '');
            }
          }}
          placeholder={
            terms.length
              ? 'Add another product…'
              : 'Search products, SKU or barcode…'
          }
          className="min-h-9 min-w-40 flex-1 border-0 bg-transparent p-0 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-0"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onChange('')}
            className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
          >
            <PiX />
          </button>
        )}
      </div>
      <p id="catalogue-search-help" className="mt-2 text-xs text-gray-500">
        Press Enter or use commas to add more products. Results match any search
        term.
      </p>
    </div>
  );
}
