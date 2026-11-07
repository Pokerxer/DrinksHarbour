'use client';

import { useState } from 'react';
import { BUDGET_OPTIONS, RECIPIENT_OPTIONS, type BudgetTier, type RecipientType } from './giftFinderTable';
import { recipientLines, recipientTotals, type RecipientEntry } from './recipientPlan';
import styles from './giftAnimations.module.css';

let nextId = 1;
const freshEntry = (): RecipientEntry => ({ id: `recipient-${nextId++}`, name: '', recipient: 'unknown', budgetTier: 'classic', budget: 0 });

/**
 * Multi-recipient organizer: rows accumulate planned gifts; totals are computed
 * by the recipientPlan module. Display-only — nothing is sent anywhere, and
 * alcohol-free coverage is counted from the fixed gift-finder table.
 */
export default function RecipientOrganizer() {
  const [rows, setRows] = useState<RecipientEntry[]>([freshEntry()]);
  const totals = recipientTotals(rows);
  const completed = rows.filter(row => row.name.trim() || row.budget > 0).length;

  function update(id: string, changes: Partial<RecipientEntry>) {
    setRows(current => current.map(row => row.id === id ? { ...row, ...changes } : row));
  }
  function addRow() { setRows(current => [...current, freshEntry()]); }
  function removeRow(id: string) { setRows(current => current.filter(row => row.id !== id)); }

  const rowClass = 'min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]';

  return <section className="rounded-2xl border border-gray-200 bg-white p-6" aria-label="Recipient planner">
    <h3 className="text-xl font-bold text-gray-900">Organise everyone you are gifting</h3>
    <p className="mt-2 text-sm leading-6 text-gray-600">Add each recipient with a short label, their drinking stance and a budget tier. Totals stay on this page — mention them in your brief so the team plans the combined delivery.</p>
    <div aria-live="polite">
      <p className="mt-3 text-sm font-semibold text-[#7c1d1d]">{completed} of {rows.length} {rows.length === 1 ? 'recipient' : 'recipients'} planned.</p>
      <ul className="mt-3 space-y-3">
        {rows.map(row => <li key={row.id} className="dropIn rounded-xl border border-gray-100 p-4">
          <div className="grid gap-3 sm:grid-cols-[1.2fr_1.3fr_1fr_auto]">
            <label className="block text-xs font-semibold text-gray-700">Label
              <input value={row.name} onChange={event => update(row.id, { name: event.target.value })} maxLength={40} placeholder="e.g. Ada" className={`mt-1 ${rowClass}`} />
            </label>
            <label className="block text-xs font-semibold text-gray-700">Drinking stance
              <select value={row.recipient} onChange={event => update(row.id, { recipient: event.target.value as RecipientType })} className={`mt-1 bg-white ${rowClass}`}>
                {RECIPIENT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-gray-700">Budget tier
              <select value={row.budgetTier} onChange={event => update(row.id, { budgetTier: event.target.value as BudgetTier })} className={`mt-1 bg-white ${rowClass}`}>
                {BUDGET_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => removeRow(row.id)} disabled={rows.length === 1}
              className="mt-1 min-h-11 self-end rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-[#7c1d1d] hover:border-[#7c1d1d] disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Remove ${row.name.trim() || 'this recipient'}`}>Remove</button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs leading-5 text-gray-500">
            <label className="font-semibold text-gray-700">Planned budget (₦, optional)
              <input type="number" min={0} max={5000000} inputMode="numeric" value={row.budget === 0 ? '' : row.budget}
                onChange={event => { const value = Number(event.target.value); update(row.id, { budget: Number.isSafeInteger(value) && value >= 0 ? value : 0 }); }}
                className="ml-2 w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]" />
            </label>
            <span>Planned lines: {recipientLines(row).join(' + ')}.</span>
          </div>
        </li>)}
      </ul>
      <button type="button" onClick={addRow} className={`mt-4 inline-flex min-h-10 items-center rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-[#7c1d1d] hover:border-[#7c1d1d] ${styles.rise}`}>Add another recipient</button>
      <div className={`mt-4 rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-700 ${totals.recipients ? styles.rise : ''}`}>
        <h4 className="text-sm font-bold text-gray-900">Plan totals</h4>
        <p>{totals.recipients} recipient{totals.recipients === 1 ? '' : 's'} · {totals.alcoholFreeCount} covered alcohol-free · full list needs a recipient label for {totals.unnamed || 0} entr{totals.unnamed === 1 ? 'y' : 'ies'}.</p>
        <p>{totals.plannedNaira > 0 ? `Planned budget mentioned so far: ₦${totals.plannedNaira.toLocaleString('en-NG')}.` : 'No amounts planned yet — budgets are optional here.'}</p>
        <p className="text-xs leading-5 text-gray-500">These totals are a planning summary, not prices. Paste the count and total into the brief so the team plans deliveries together.</p>
      </div>
    </div>
  </section>;
}
