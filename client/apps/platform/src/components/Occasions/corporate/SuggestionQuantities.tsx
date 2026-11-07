'use client';

export type Suggestion = { name: string; quantity: number };

type Props = { suggestions: Suggestion[]; onClear: () => void };

/**
 * Running quantity summary for the customer to transcribe into the request
 * form below. Quantities only — never prices. aria-live because entries are
 * added from calculator and shelf buttons elsewhere on the page.
 */
export default function SuggestionQuantities({ suggestions, onClear }: Props) {
  return <section className="rounded-2xl border border-[#d5b26b] bg-white p-6" aria-label="Suggested quantities collected on this page">
    <h3 className="text-xl font-bold text-gray-900">Your suggested quantities</h3>
    <p className="mt-2 text-sm leading-6 text-gray-600">Collected from the calculator and bottle links on this page. These suggestions are not added to the request form automatically — enter the same bottle names and quantities in the request list below before sending.</p>
    <div aria-live="polite">
      {suggestions.length ? (
        <>
          <ul className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100">
            {suggestions.map(entry => <li key={entry.name} className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm">
              <span className="font-semibold text-gray-900">{entry.name}</span>
              <span className="shrink-0 tabular-nums text-gray-700">{entry.quantity.toLocaleString('en-NG')} bottle{entry.quantity === 1 ? '' : 's'}</span>
            </li>)}
          </ul>
          <button type="button" onClick={onClear}
            className="mt-4 min-h-10 rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-[#7c1d1d] hover:border-[#7c1d1d] hover:bg-[#fff8ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">Clear suggestions</button>
        </>
      ) : (
        <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">No suggestions collected yet. Use the quantity calculator or bottle links above.</p>
      )}
    </div>
    <p className="mt-3 text-xs text-gray-500">Estimates for planning conversations only. Quantities are confirmed against current stock, and alcohol is sold to adults aged 18 and over.</p>
  </section>;
}
