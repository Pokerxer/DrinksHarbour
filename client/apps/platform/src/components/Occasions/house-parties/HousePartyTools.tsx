'use client';

import { useState } from 'react';
import type { BottleChoice } from '@/lib/weddingBottleList';
import { addBottle, type BottleListItem } from '@/lib/weddingBottleList';
import GuestDrinkCalculator from '@/components/Occasions/planning/GuestDrinkCalculator';
import OccasionShelf from '@/components/Occasions/planning/OccasionShelf';
import { useOptionalOccasionDrinks } from '@/components/Occasions/planning/OccasionDrinksContext';
import { CATEGORY_TO_ROWS, OCCASION_DRINK_LABELS, rowsForSelection, uncoveredSelection } from '@/lib/occasions/categoryRows';
import { housePartyCalcConfig } from './config';
import CocktailPlanner from './CocktailPlanner';

/**
 * Interactive planning tools for the house-parties body. Keeps a local planning
 * summary (deduplicated through the shared addBottle list helper); the customer
 * copies these items into the request form below. Quantities only — no prices.
 */
export default function HousePartyTools() {
  const [items, setItems] = useState<BottleListItem[]>([]);
  const [notice, setNotice] = useState('');
  const drinks = useOptionalOccasionDrinks();
  const selection = (drinks?.selected ?? []) as string[];
  const config = rowsForSelection(housePartyCalcConfig, selection, CATEGORY_TO_ROWS['house-parties']);
  const uncovered = uncoveredSelection(selection, CATEGORY_TO_ROWS['house-parties']);
  const uncoveredNote = uncovered.length > 0
    ? `No draft quantity rows for ${uncovered.map(id => OCCASION_DRINK_LABELS[id]).join(', ').toLowerCase()} yet — mention them in the brief below and our team will plan them.`
    : undefined;

  function add(choices: BottleChoice[]) {
    let next = items;
    let error: string | undefined;
    for (const choice of choices) {
      const result = addBottle(next, choice);
      if (result.error) error = result.error;
      else next = result.items;
    }
    setItems(next);
    setNotice(error ??
      (choices.length === 1
        ? `${choices[0].name} saved to your planning summary below — add these items and quantities in the request form.`
        : `${choices.length} suggestions saved to your planning summary below — add these items and quantities in the request form.`));
  }

  return <div className="space-y-8">
    <GuestDrinkCalculator config={config} onUse={add} uncoveredNote={uncoveredNote} />
    <CocktailPlanner onUse={add} />
    <div className="grid gap-6 lg:grid-cols-2">
      <OccasionShelf label="Gin for the cocktail table" category="gin" onAdd={choice => add([choice])} />
      <OccasionShelf label="Beer for the cooler" category="beer" onAdd={choice => add([choice])} />
    </div>
    <section className="rounded-2xl border border-[#d5b26b] bg-white p-6" aria-label="Your planning summary">
      <div aria-live="polite">
        {notice && <p role="status" className="text-sm font-semibold text-[#7c1d1d]">{notice}</p>}
        <h3 className="text-xl font-bold text-gray-900">Planning summary</h3>
        {items.length
          ? <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-gray-700">
            {items.map(item => <li key={item.id}>{Number(item.quantity).toLocaleString('en-NG')} {item.unit} — {item.name}{item.size ? ` — ${item.size}` : ''}</li>)}
          </ul>
          : <p className="mt-3 text-sm leading-6 text-gray-600">Nothing added yet. Use the calculator and cocktail picker above, or add bottles from the shelves, and the suggestion totals appear here.</p>}
        <p className="mt-3 text-xs leading-5 text-gray-600">These numbers are suggestions, not an order — they are not sent automatically. Enter the items and quantities in the bottle list of the request form, then send it so the team can confirm stock, quantities and delivery. Quantities only; no totals are shown here.</p>
      </div>
    </section>
  </div>;
}
