'use client';
export default function SearchSuggestions({ suggestions, loading, onSelect }: {
  suggestions: string[]; loading: boolean; onSelect: (query: string) => void;
}) {
  if (!suggestions.length && !loading) return null;
  return <section aria-label="Suggested searches" className="mt-3">
    {loading ? <p role="status" className="text-xs text-zinc-500">Finding suggestions…</p>
      : <div className="flex gap-2 overflow-x-auto pb-1">
        {suggestions.map(query => <button key={query} type="button" onClick={() => onSelect(query)}
          className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:border-[#b20202] hover:text-[#b20202] focus-visible:ring-2 focus-visible:ring-[#b20202]">
          {query}
        </button>)}
      </div>}
  </section>;
}
