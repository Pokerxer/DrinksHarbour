'use client';

import { useState } from 'react';
import Link from 'next/link';
import GuestDrinkCalculator from '@/components/Occasions/planning/GuestDrinkCalculator';
import OccasionShelf from '@/components/Occasions/planning/OccasionShelf';
import type { BottleChoice } from '@/lib/weddingBottleList';
import type { WeddingDrinkId } from './data';
import { weddingToastCalc } from './planning';
import { CATEGORY_TO_ROWS, OCCASION_DRINK_LABELS, rowsForSelection, uncoveredSelection } from '@/lib/occasions/categoryRows';

type Props = { applyChoices: (choices: BottleChoice[]) => string | undefined; selected?: WeddingDrinkId[] };

/**
 * Quantities and shelf planning for the wedding page. Outputs suggestions and
 * catalogue links only — the numbers join the bottle list below; nothing here
 * reserves stock or shows pricing.
 */
export default function WeddingQuantities({ applyChoices, selected = [] }: Props) {
  const selection = selected as string[];
  const config = rowsForSelection(weddingToastCalc, selection, CATEGORY_TO_ROWS.weddings);
  const uncovered = uncoveredSelection(selection, CATEGORY_TO_ROWS.weddings);
  const uncoveredNote = uncovered.length > 0
    ? `No draft quantity rows for ${uncovered.map(id => OCCASION_DRINK_LABELS[id]).join(', ').toLowerCase()} yet — mention them in the brief below and our team will plan them.`
    : undefined;
  const [notice, setNotice] = useState('');
  const use = (choices: BottleChoice[]) => {
    setNotice('');
    const error = applyChoices(choices);
    setNotice(error || 'Suggestions added to your bottle list below. Adjust quantities there.');
  };
  const addShelfBottle = (bottle: BottleChoice) => {
    setNotice('');
    const error = applyChoices([bottle]);
    if (error) { setNotice(error); return false; }
    setNotice(`${bottle.name.trim()} added to your bottle list below.`);
    return true;
  };
  return <section id="wedding-quantities" aria-labelledby="wedding-quantities-heading" className="scroll-mt-28">
    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7c1d1d]">Rough numbers first</p>
    <h2 id="wedding-quantities-heading" className="mt-3 text-2xl font-bold tracking-tight">Estimate how much to plan for.</h2>
    <p className="mt-3 max-w-2xl leading-7 text-gray-600">Start with the toast, the meal and the table drinks everyone shares. The estimate below is a starting point — reception length, your menu and how your guests drink matter more than any formula.{!selection.length && ' Tip: choose your drink categories in the planner below and this estimate follows them.'}</p>
    <p role="status" aria-live="polite" className="mt-3 text-sm text-[#7c1d1d]">{notice}</p>
    <div className="mt-6"><GuestDrinkCalculator config={config} onUse={use} uncoveredNote={uncoveredNote} /></div>
    <div className="mt-8"><OccasionShelf label="Champagne for the toast" category="champagne" limit={6}
      emptyHint="Champagne did not load just now. Browse champagne in the shop or ask support what is available for your date."
      onAdd={addShelfBottle} /></div>
    <p className="mt-4 text-xs leading-6 text-gray-500">Calculations are planning estimates, not stock guarantees. Availability and prices are confirmed on each bottle page or by our team; sending an enquiry does not reserve bottles. Alcoholic bottles are for adults 18+.</p>
    <p className="mt-4 rounded-xl border border-rose-100 bg-[#fff8ec] p-4 text-sm leading-7 text-gray-600">Planning a traditional engagement? Share the family’s listed items exactly as given alongside your guest drinks. <Link href="/occasions/weddings/traditional-engagement" className="min-h-10 inline-flex items-center font-semibold text-[#7c1d1d] underline underline-offset-4">Open the traditional engagement guide</Link></p>
  </section>;
}
