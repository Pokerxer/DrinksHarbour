'use client';

import { useMemo, useState } from 'react';
import {
  BUDGET_OPTIONS,
  RECIPIENT_OPTIONS,
  findGiftMatch,
  suggestsAlcohol,
  type BudgetTier,
  type RecipientType,
} from './giftFinderTable';

/**
 * Deterministic gift finder: recipient type × budget tier → bottle categories
 * from a fixed local table. No AI, no prices — categories and guidance only.
 */
export default function GiftFinder() {
  const [recipient, setRecipient] = useState<RecipientType>('unknown');
  const [budget, setBudget] = useState<BudgetTier>('classic');
  const match = useMemo(() => findGiftMatch(recipient, budget), [recipient, budget]);
  const recipientLabel = RECIPIENT_OPTIONS.find(option => option.value === recipient)?.label ?? recipient;
  const budgetLabel = BUDGET_OPTIONS.find(option => option.value === budget)?.label ?? budget;

  return <section className="rounded-2xl border border-gray-200 bg-white p-6" aria-label="Gift finder">
    <h3 className="text-xl font-bold text-gray-900">Narrow the bottle list</h3>
    <p className="mt-2 text-sm leading-6 text-gray-600">
      Pick the recipient and a gift level — the suggestions come from a fixed list, not AI. They name bottle categories to browse, never amounts to pay.
    </p>
    <div className="mt-4 flex flex-wrap gap-4">
      <label className="text-sm font-semibold text-gray-700">Recipient
        <select value={recipient} onChange={event => setRecipient(event.target.value as RecipientType)}
          className="mt-1 block min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">
          {RECIPIENT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="text-sm font-semibold text-gray-700">Gift level
        <select value={budget} onChange={event => setBudget(event.target.value as BudgetTier)}
          className="mt-1 block min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">
          {BUDGET_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    </div>
    <div aria-live="polite" className="mt-5">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Suggested bottle categories for {recipientLabel.toLowerCase()} at a {budgetLabel.toLowerCase()} level</caption>
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
            <th scope="col" className="py-2">Category</th>
            <th scope="col" className="py-2">Why it fits</th>
            <th scope="col" className="py-2"><span className="sr-only">Browse</span></th>
          </tr>
        </thead>
        <tbody>
          {match.suggestions.map(suggestion => <tr key={suggestion.category} className="border-b border-gray-100 align-top">
            <td className={`py-3 pr-4 font-semibold text-gray-900 ${suggestsAlcohol(suggestion.category) ? '' : 'text-emerald-800'}`}>
              {suggestion.category}
            </td>
            <td className="py-3 pr-4 text-gray-600">{suggestion.why}</td>
            <td className="py-3 text-right">
              <a href={suggestion.href} className="inline-flex min-h-10 items-center rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-[#7c1d1d] hover:border-[#7c1d1d] hover:bg-[#fff8ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">
                Browse {suggestion.category.toLowerCase().split(' & ')[0]}
              </a>
            </td>
          </tr>)}
        </tbody>
      </table>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-gray-600">
        {match.notes.map(note => <li key={note}>{note}</li>)}
      </ul>
    </div>
  </section>;
}
