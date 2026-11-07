'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BUDGET_OPTIONS, RECIPIENT_OPTIONS, findGiftMatch, type BudgetTier, type RecipientType } from './giftFinderTable';
import { budgetToGiftTier, tierForBudget, MAX_PLANNED_BUDGET } from './giftBudgetLadder';
import type { Suggestion } from '../corporate/SuggestionQuantities';
import styles from './giftAnimations.module.css';

type Packaging = 'bottles-only' | 'gift-box';

const PACKAGING_OPTIONS: { value: Packaging; label: string; note: string }[] = [
  { value: 'bottles-only', label: 'Bottles only', note: 'Bottles delivered as ordered — no box implied.' },
  { value: 'gift-box', label: 'Gift box or hamper', note: 'Packaging, wrapping and message cards are all confirmed in writing with our team before you pay — none are included by default.' },
];

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const dot = (index: number) => <span key={index} className={styles.dot} style={{ animationDelay: `${index * 0.16}s` }}>.</span>;

/**
 * Animated hamper assembly per recipient: deterministic mapping (recipient ×
 * budget) from the gift-finder table, revealed one line at a time with a fake
 * "planning" beat for the AI-feel. No model calls, no prices; quantities and
 * categories only.
 */
export default function HamperBuilder({ onUse }: { onUse?: (choices: Suggestion[]) => void }) {
  const [step, setStep] = useState(0);
  const [recipient, setRecipient] = useState<RecipientType | ''>('');
  const [packaging, setPackaging] = useState<Packaging>('bottles-only');
  const [label, setLabel] = useState('');
  const [budgetRaw, setBudgetRaw] = useState('');
  const [assembling, setAssembling] = useState(false);
  const [assembled, setAssembled] = useState<string[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const budget = useMemo(() => {
    const value = Number(budgetRaw);
    return Number.isSafeInteger(value) && value >= 1 && value <= MAX_PLANNED_BUDGET ? value : null;
  }, [budgetRaw]);
  const plan = budget ? tierForBudget(budget) : null;
  const giftTier: BudgetTier | null = budget ? budgetToGiftTier(budget) : null;
  const match = recipient && giftTier ? findGiftMatch(recipient, giftTier) : null;
  const ready = Boolean(match && plan);

  function assemble() {
    if (!ready || !match || !plan) return;
    setAssembled(null);
    setAssembling(true);
    const lines: string[] = [];
    const categories = match.suggestions;
    const repeats = new Map<string, number>();
    for (let index = 0; index < plan.bottles; index++) {
      const category = categories[index % categories.length].category;
      const seen = repeats.get(category) ?? 0;
      repeats.set(category, seen + 1);
      lines.push(seen === 0 ? category : `${category} — second bottle of the same line`);
    }
    if (packaging === 'gift-box') lines.push('Gift box / hamper packaging — to be confirmed in writing');
    const delay = prefersReducedMotion() ? 0 : 700;
    timer.current = setTimeout(() => { setAssembled(lines); setAssembling(false); }, delay);
  }

  function addAll() {
    if (!assembled) return;
    const ordinal = label.trim() || 'Gift';
    const lines = assembled.map(category => ({ name: `${ordinal} — ${category}`, quantity: 1 }));
    onUse?.(lines);
  }

  return <section className="rounded-2xl border border-gray-200 bg-white p-6" aria-label="Hamper builder">
    <h3 className="text-xl font-bold text-gray-900">Build one hamper at a time</h3>
    <p className="mt-2 text-sm leading-6 text-gray-600">Pick a recipient, the packaging and a planned budget. The bottle-category plan assembles one line at a time — add it to your suggestions, then build the next hamper.</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-semibold text-gray-700">Recipient
        <select value={recipient} onChange={event => { setRecipient(event.target.value as RecipientType | ''); setAssembled(null); }}
          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">
          <option value="">Choose the recipient type</option>
          {RECIPIENT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="block text-sm font-semibold text-gray-700">Packaging
        <select value={packaging} onChange={event => { setPackaging(event.target.value as Packaging); setAssembled(null); }}
          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">
          {PACKAGING_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="block text-sm font-semibold text-gray-700">Hamper label (optional)
        <input value={label} onChange={event => setLabel(event.target.value)} maxLength={40} placeholder="e.g. Ada"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]" />
      </label>
      <label className="block text-sm font-semibold text-gray-700">Planned budget (₦)
        <input type="number" min={1} max={MAX_PLANNED_BUDGET} inputMode="numeric" value={budgetRaw} onChange={event => { setBudgetRaw(event.target.value); setAssembled(null); }}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]" />
      </label>
    </div>
    {match && plan && <p className="mt-3 text-xs leading-5 text-gray-500">{match.notes.join(' ')}</p>}
    <button type="button" disabled={!ready || assembling} onClick={assemble}
      className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#7c1d1d] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Assemble the hamper plan</button>
    <div aria-live="polite" className="mt-4">
      {assembling && <p className="text-sm font-semibold text-[#7c1d1d]">Planning the bottle lines{dot(0)}{dot(1)}{dot(2)}</p>}
      {assembled && <ol className="rise mt-2 space-y-2 rounded-xl border border-[#d5b26b] bg-[#fff8ec] p-4">
        <li className="text-xs font-bold uppercase tracking-wider text-[#7c1d1d]">{(label.trim() || 'Your hamper')} · {plan?.title}</li>
        {assembled.map((line, index) => <li key={`${line}-${index}`} className="dropIn text-sm leading-6 text-gray-700" style={{ animationDelay: `${index * 90}ms` }}>• {line}</li>)}
        <li className="dropIn text-xs leading-5 text-gray-500" style={{ animationDelay: `${assembled.length * 90}ms` }}>Budget plan: ₦{budget?.toLocaleString('en-NG')} planned · no charge happens here; the team confirms bottles and totals.</li>
      </ol>}
      {assembled && <button type="button" onClick={addAll}
        className="mt-3 inline-flex min-h-10 items-center rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-[#7c1d1d] hover:border-[#7c1d1d] hover:bg-[#fff8ec]">Add these to your suggestions</button>}
    </div>
  </section>;
}
