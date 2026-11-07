'use client';

import { useMemo, useState } from 'react';
import type { BottleChoice } from '@/lib/weddingBottleList';
import type { CalcConfig } from '@/lib/occasions/types';

type Props = { config: CalcConfig; onUse: (choices: BottleChoice[]) => void; uncoveredNote?: string };

const guestsValue = (raw: string) => {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 && value <= 999 ? value : 0;
};
const hoursValue = (raw: string) => {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 && value <= 12 ? value : 0;
};

/** Deterministic serving math: guests × share × drinks ÷ servings per bottle. */
export default function GuestDrinkCalculator({ config, onUse, uncoveredNote }: Props) {
  const [guests, setGuests] = useState('60');
  const [hours, setHours] = useState('4');
  const parsedGuests = guestsValue(guests), parsedHours = hoursValue(hours);
  const ready = parsedGuests > 0 && parsedHours > 0;

  const rows = useMemo(() => config.rows.map(row => {
    const share = Math.min(100, Math.max(0, Number.isFinite(row.sharePercent) ? row.sharePercent : 0));
    return { row, share };
  }), [config]);

  const computed = useMemo(() => rows.map(({ row, share }) => {
    const served = ready ? Math.round((parsedGuests * share) / 100) : 0;
    const drinks = ready ? served * (row.drinksPerGuest + Math.max(0, parsedHours - 1) * (row.drinksPerExtraHour ?? 1)) : 0;
    let bottles = drinks > 0 ? Math.ceil(drinks / row.servingsPerBottle) : 0;
    if (row.roundTo && row.roundTo > 1 && bottles > 0) bottles = Math.ceil(bottles / row.roundTo) * row.roundTo;
    const math = ready ? `${parsedGuests.toLocaleString('en-NG')} guests · ${Math.round(share)}% with ${row.category.toLowerCase()} · ${drinks.toLocaleString('en-NG')} servings ÷ ${row.servingsPerBottle} per bottle` : '';
    return { row, bottles, math };
  }), [parsedGuests, parsedHours, ready, rows]);

  function add(choices: BottleChoice[]) {
    if (!choices.length) return;
    onUse(choices);
  }

  return <section className="rounded-2xl border border-gray-200 bg-white p-6" aria-label={config.heading}>
    <h3 className="text-xl font-bold text-gray-900">{config.heading}</h3>
    <p className="mt-2 text-sm leading-6 text-gray-600">{config.intro}</p>
    {!config.rows.length && <p className="mt-3 rounded-xl border border-rose-100 bg-[#fff8ec] p-4 text-sm leading-7 text-gray-700">Choose drink categories for this occasion and the corresponding quantities appear here.</p>}
    {uncoveredNote && <p className="mt-3 rounded-xl border border-rose-100 bg-[#fff8ec] p-4 text-sm leading-7 text-gray-700">{uncoveredNote}</p>}
    <div className="mt-4 flex flex-wrap gap-4">
      <label className="text-sm font-semibold text-gray-700">Guests
        <input type="number" min={1} max={999} inputMode="numeric" value={guests} onChange={event => setGuests(event.target.value)}
          className="mt-1 block w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]" />
      </label>
      <label className="text-sm font-semibold text-gray-700">Hours
        <input type="number" min={1} max={12} inputMode="numeric" value={hours} onChange={event => setHours(event.target.value)}
          className="mt-1 block w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]" />
      </label>
    </div>
    <div aria-live="polite">
      <table className="mt-5 w-full text-left text-sm">
        <caption className="sr-only">{config.heading} suggested quantities</caption>
        <thead><tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500"><th scope="col" className="py-2">Category</th><th scope="col" className="py-2">How the number is built</th><th scope="col" className="py-2 text-right">Suggested</th><th scope="col" className="py-2"><span className="sr-only">Add</span></th></tr></thead>
        <tbody>
          {computed.map(({ row, bottles, math }) => <tr key={row.id} className="border-b border-gray-100 align-top">
            <td scope="col" className="py-3 pr-4 font-semibold text-gray-900">{row.category}</td>
            <td className="py-3 pr-4 text-gray-600">{math || 'Enter guest and hour numbers above.'}</td>
            <td className="py-3 pr-4 text-right font-bold text-gray-900">{bottles ? `${bottles.toLocaleString('en-NG')} ${bottles === 1 ? 'bottle' : 'bottles'}` : '—'}</td>
            <td className="py-3 text-right">
              <button type="button" disabled={!bottles} onClick={() => add([{ name: row.listName, suggestedQuantity: bottles }])}
                className="min-h-10 rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-[#7c1d1d] hover:border-[#7c1d1d] hover:bg-[#fff8ec] disabled:cursor-not-allowed disabled:opacity-40">Add to list</button>
            </td>
          </tr>)}
        </tbody>
      </table>
      {computed.some(entry => entry.bottles > 0) && <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => add(computed.filter(entry => entry.bottles > 0).map(entry => ({ name: entry.row.listName, suggestedQuantity: entry.bottles })))}
          className="min-h-11 rounded-full bg-[#7c1d1d] px-5 py-3 text-sm font-bold text-white">Add all suggestions to your list</button>
        <p className="text-xs text-gray-600">Suggestions are planning estimates only. Confirm availability and any substitutions with our team before ordering.</p>
      </div>}
    </div>
  </section>;
}
