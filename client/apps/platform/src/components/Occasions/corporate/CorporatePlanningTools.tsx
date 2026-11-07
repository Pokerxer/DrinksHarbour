'use client';

import { useState } from 'react';
import type { BottleChoice } from '@/lib/weddingBottleList';
import type { CalcConfig } from '@/lib/occasions/types';
import GuestDrinkCalculator from '../planning/GuestDrinkCalculator';
import OccasionShelf from '../planning/OccasionShelf';
import { useOptionalOccasionDrinks } from '../planning/OccasionDrinksContext';
import { CATEGORY_TO_ROWS, OCCASION_DRINK_LABELS, rowsForSelection, uncoveredSelection } from '@/lib/occasions/categoryRows';
import SuggestionQuantities, { type Suggestion } from './SuggestionQuantities';

type Props = { calc: CalcConfig };

const MAX_INTERMEDIATE_TOTAL = 30000;

/**
 * Client-side planning tools for the corporate occasion page. Local state only:
 * suggestions are collected here and transcribed by the customer into the staff
 * request form (OccasionChatPlanner) below — nothing is sent automatically and
 * no client-side price math happens here.
 */
export default function CorporatePlanningTools({ calc }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [notice, setNotice] = useState('');
  const drinks = useOptionalOccasionDrinks();
  const selection = (drinks?.selected ?? []) as string[];
  const config = rowsForSelection(calc, selection, CATEGORY_TO_ROWS.corporate);
  const uncovered = uncoveredSelection(selection, CATEGORY_TO_ROWS.corporate);
  const uncoveredNote = uncovered.length > 0
    ? `No draft quantity rows for ${uncovered.map(id => OCCASION_DRINK_LABELS[id]).join(', ').toLowerCase()} yet — mention them in the brief below and our team will plan them.`
    : undefined;

  function add(name: string, quantity: number): boolean {
    const cleanName = name.trim();
    if (!cleanName || !Number.isSafeInteger(quantity) || quantity < 1) return false;
    let addedTotal = 0;
    let limitHit = false;
    setSuggestions(current => {
      const existing = current.find(entry => entry.name.toLowerCase() === cleanName.toLowerCase());
      if (existing && existing.quantity + quantity > 9999) {
        limitHit = true;
        return current;
      }
      const runningTotal = current.reduce((sum, entry) => sum + entry.quantity, 0);
      if (runningTotal + quantity > MAX_INTERMEDIATE_TOTAL) {
        limitHit = true;
        return current;
      }
      addedTotal = quantity;
      return existing
        ? current.map(entry => entry.name.toLowerCase() === cleanName.toLowerCase()
          ? { ...entry, quantity: entry.quantity + quantity }
          : entry)
        : [...current, { name: cleanName, quantity }];
    });
    setNotice(limitHit ? 'That entry would exceed a sensible single-order quantity. Send what you have and ask the team about larger amounts.' : '');
    return addedTotal > 0 || !limitHit;
  }

  function onCalculatorUse(choices: BottleChoice[]) {
    choices.forEach(choice => add(choice.name, choice.suggestedQuantity ?? 1));
  }

  function onShelfAdd(choice: BottleChoice): boolean {
    const added = add(choice.name, 1);
    return added;
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-bold">Size an end-of-year reception</h2>
        <p className="mt-3 leading-7 text-gray-700">Use attendance and planned hours to estimate each drink line. Adjust the default shares to your guest mix — they overlap on purpose, because water and soft drinks serve every guest while wine or spirits serve some.{!selection.length && ' Tip: choose your drink categories in the planner below and this estimate follows them.'}</p>
        <GuestDrinkCalculator config={config} onUse={onCalculatorUse} uncoveredNote={uncoveredNote} />
        <p className="mt-3 text-xs leading-5 text-gray-500">Planning support only — no account, booking or stock reservation is created here.</p>
      </section>
      <SuggestionQuantities suggestions={suggestions} onClear={() => { setSuggestions([]); setNotice(''); }} />
      {notice && <p aria-live="polite" className="text-sm font-semibold text-[#7c1d1d]">{notice}</p>}
      <section>
        <h2 className="text-2xl font-bold">Collect client-gift bottles</h2>
        <p className="mt-3 leading-7 text-gray-700">Gifts are planned bottle by bottle: add the ones that fit your recipients, match each delivery address in the request form, and let the team confirm packaging and current availability.</p>
        <div className="grid gap-6 lg:grid-cols-2">
          <OccasionShelf label="Whisky for client gifts" category="whisky" limit={4}
            emptyHint="Whisky bottles could not load right now. Send your preferences in the request form and the team will suggest available options."
            onAdd={onShelfAdd} />
          <OccasionShelf label="Wine for receptions" category="wine" limit={4}
            emptyHint="Wine bottles could not load right now. Send your preferences in the request form and the team will suggest available options."
            onAdd={onShelfAdd} />
        </div>
        <p className="mt-3 text-xs leading-5 text-gray-500">Bottles are for internal celebrations responsibly served; alcoholic gifts need an adult recipient aged 18 or over.</p>
      </section>
    </div>
  );
}
