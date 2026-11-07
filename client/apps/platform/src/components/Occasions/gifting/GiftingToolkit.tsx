'use client';

import { useState } from 'react';
import HamperBuilder from './HamperBuilder';
import GiftBudgetTiers from './GiftBudgetTiers';
import GiftMessageCard from './GiftMessageCard';
import RecipientOrganizer from './RecipientOrganizer';
import SuggestionQuantities, { type Suggestion } from '../corporate/SuggestionQuantities';
import styles from './giftAnimations.module.css';

const TABS = [
  { id: 'hamper', label: 'Build a hamper' },
  { id: 'recipients', label: 'Recipients' },
  { id: 'budget', label: 'Budget guide' },
  { id: 'message', label: 'Message' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * All gifting planning tools behind one set of tabs so the tools band stays
 * compact — only the active panel renders. A single shared suggestion summary
 * persists across tabs. Deterministic logic only; no AI, no client-side price
 * math.
 */
export default function GiftingToolkit() {
  const [tab, setTab] = useState<TabId>('hamper');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  function addSuggestions(entries: Suggestion[]) {
    setSuggestions(current => [...current, ...entries]);
  }

  return <section className="rounded-2xl border border-gray-200 bg-white p-6" aria-label="Gifting toolkit">
    <h3 className="text-xl font-bold text-gray-900">Your gifting toolkit</h3>
    <p className="mt-2 text-sm leading-6 text-gray-600">Everything above is planning help: build a hamper, keep recipients straight, sanity-check the budget and find the wording. One tab at a time — nothing here sends anything automatically.</p>
    <nav role="tablist" aria-label="Gifting tool panels" className="mt-4 flex flex-wrap gap-2">
      {TABS.map(item => {
        const active = item.id === tab;
        return <button key={item.id} type="button" role="tab" aria-selected={active} aria-controls={`gift-panel-${item.id}`} id={`gift-tab-${item.id}`}
          onClick={() => setTab(item.id)}
          className={`inline-flex min-h-11 items-center rounded-full border px-5 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d] ${active ? 'border-[#7c1d1d] bg-[#7c1d1d] text-white' : 'border-gray-200 bg-white text-[#7c1d1d] hover:border-[#7c1d1d]'}`}>
          {item.label}
        </button>;
      })}
    </nav>
    <div key={tab} className="rise mt-6" role="tabpanel" id={`gift-panel-${tab}`} aria-labelledby={`gift-tab-${tab}`}>
      {tab === 'hamper' && <HamperBuilder onUse={addSuggestions} />}
      {tab === 'recipients' && <RecipientOrganizer />}
      {tab === 'budget' && <GiftBudgetTiers />}
      {tab === 'message' && <GiftMessageCard />}
    </div>
    <div className="mt-6 border-t border-gray-100 pt-6">
      <SuggestionQuantities suggestions={suggestions} onClear={() => setSuggestions([])} />
    </div>
  </section>;
}
