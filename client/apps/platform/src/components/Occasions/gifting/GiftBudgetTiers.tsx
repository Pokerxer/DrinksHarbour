'use client';

import { useMemo, useState } from 'react';
import { MAX_PLANNED_BUDGET, GIFT_BUDGET_TIERS, tierForBudget } from './giftBudgetLadder';
import styles from './giftAnimations.module.css';

/**
 * Budget quality ladder. The customer types a planned budget (not a bottle
 * price) and the matching tier reveals with a staggered animation; every other
 * rung stays put. Motion is disabled under prefers-reduced-motion by the
 * shared animation module.
 */
export default function GiftBudgetTiers() {
  const [raw, setRaw] = useState('');
  const parsed = useMemo(() => {
    const value = Number(raw);
    return Number.isSafeInteger(value) && value > 0 && value <= MAX_PLANNED_BUDGET ? value : null;
  }, [raw]);
  const plan = parsed ? tierForBudget(parsed) : null;

  return <section className="rounded-2xl border border-gray-200 bg-white p-6" aria-label="Budget quality tiers">
    <h3 className="text-xl font-bold text-gray-900">What your budget usually buys</h3>
    <p className="mt-2 text-sm leading-6 text-gray-600">Type a planned budget per gift and the matching rung lights up. This is planning guidance — exact bottle prices live on each bottle page and are confirmed with our team.</p>
    <label htmlFor="gift-budget-input" className="mt-4 block text-sm font-semibold text-gray-700">Planned budget per gift (₦)
      <input id="gift-budget-input" type="number" min={1} max={MAX_PLANNED_BUDGET} inputMode="numeric" value={raw} onChange={event => setRaw(event.target.value)}
        placeholder="e.g. 25000"
        className="mt-1 block w-44 rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]" />
    </label>
    <div aria-live="polite">
      <ol className="mt-4 space-y-2">
        {plan && <li key={plan.id} className="rise rounded-xl border border-[#d5b26b] bg-[#fff8ec] p-4" data-tier="match">
          <p className="text-xs font-bold uppercase tracking-wider text-[#7c1d1d]">For your budget</p>
          <p className="text-base font-bold text-gray-900">{plan.title}</p>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-gray-700">
            {plan.lines.map(line => <li key={line} className="dropIn" style={{ animationDelay: '140ms' }}>{line}</li>)}
          </ul>
          <p className="mt-2 text-xs leading-5 text-gray-500">{plan.note} ({parsed?.toLocaleString('en-NG')} planned.)</p>
        </li>}
      </ol>
      <ul className="mt-4 space-y-2">
        {GIFT_BUDGET_TIERS.map((tier, index) => {
          const matched = plan?.id === tier.id;
          return <li key={tier.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${matched ? 'border-[#d5b26b] bg-[#fff8ec]' : 'border-gray-100'}`}>
            <span className="mt-0.5 font-bold tabular-nums text-[#7c1d1d]">{index + 1}</span>
            <div className="min-w-0">
              <p className={`font-semibold ${matched ? 'text-gray-900' : 'text-gray-700'}`}>{tier.title}</p>
              <p className="text-xs leading-5 text-gray-500">{tier.lines.join(' · ')}</p>
            </div>
          </li>;
        })}
      </ul>
    </div>
    {raw && !plan && <p role="status" className="mt-3 text-sm text-gray-600">Enter a whole naira amount up to {MAX_PLANNED_BUDGET.toLocaleString('en-NG')}.</p>}
  </section>;
}
