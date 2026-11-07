'use client';

import { useState } from 'react';

const ITEMS: { id: string; label: string }[] = [
  { id: 'taste', label: 'Recipient’s drink preferences and restrictions confirmed (including whether they drink alcohol at all)' },
  { id: 'budget-per-recipient', label: 'Bottle choice decided for each recipient, with a size and quantity' },
  { id: 'packaging', label: 'Gift box, hamper or wrapping confirmed with our team — not assumed from the product image' },
  { id: 'message', label: 'Message card text drafted, if a card is included' },
  { id: 'delivery', label: 'Delivery city, address, phone contact and celebration date shared for a realistic window' },
  { id: 'adult-recipient', label: 'An adult aged 18 or over arranged to receive any alcohol at the address' },
];

/**
 * Interactive pre-order checklist for gift buyers. State stays on this page —
 * nothing is sent to the team until the request form below is submitted.
 */
export default function GiftChecklist() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const total = ITEMS.length;
  const completed = ITEMS.filter(item => done[item.id]).length;
  const allDone = completed === total;

  return <section className="rounded-2xl border border-gray-200 bg-white p-6" aria-label="Gift checklist">
    <h3 className="text-xl font-bold text-gray-900">Your gift checklist</h3>
    <p className="mt-2 text-sm leading-6 text-gray-600">
      Work through these before you make the request. Ticking a line saves nothing to our team — the checklist stays on this page until you send the request form.
    </p>
    <ul className="mt-4 space-y-1">
      {ITEMS.map(item => <li key={item.id} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-gray-50">
        <input
          id={`gift-check-${item.id}`}
          type="checkbox"
          checked={Boolean(done[item.id])}
          onChange={event => setDone(current => ({ ...current, [item.id]: event.target.checked }))}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#7c1d1d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]"
        />
        <label htmlFor={`gift-check-${item.id}`} className={`min-h-10 text-sm leading-6 ${done[item.id] ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
          {item.label}
        </label>
      </li>)}
    </ul>
    <p aria-live="polite" className="mt-4 text-sm font-semibold text-gray-900">
      {completed} of {total} confirmed{allDone ? ' — ready to send your request' : ''}
    </p>
  </section>;
}
