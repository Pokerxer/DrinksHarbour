'use client';

import React from 'react';
import * as Icon from 'react-icons/pi';
import type { FormData } from './ApplyForm';
import { PLAN_TIERS } from '../../data';
import { StepHeader } from './step-ui';

function formatNaira(n: number): string {
  if (n === 0) return 'Free';
  return `₦${n.toLocaleString('en-NG')}`;
}

const ACCENT_STYLES: Record<string, { selected: string; icon: string; pill: string }> = {
  gray: { selected: 'border-gray-300 bg-gray-50 ring-gray-200', icon: 'text-gray-600', pill: 'bg-gray-100 text-gray-600' },
  blue: { selected: 'border-blue-300 bg-blue-50 ring-blue-200', icon: 'text-blue-600', pill: 'bg-blue-50 text-blue-700' },
  emerald: { selected: 'border-emerald-300 bg-emerald-50 ring-emerald-200', icon: 'text-emerald-600', pill: 'bg-emerald-50 text-emerald-700' },
  red: { selected: 'border-red-300 bg-red-50 ring-red-200', icon: 'text-red-600', pill: 'bg-red-50 text-red-700' },
  purple: { selected: 'border-purple-300 bg-purple-50 ring-purple-200', icon: 'text-purple-600', pill: 'bg-purple-50 text-purple-700' },
  amber: { selected: 'border-amber-300 bg-amber-50 ring-amber-200', icon: 'text-amber-600', pill: 'bg-amber-50 text-amber-700' },
};

export function PlanStep({
  form,
  update,
  errors,
}: {
  form: FormData;
  update: <K extends keyof FormData>(key: K, value: FormData[K]) => void;
  errors: Partial<Record<keyof FormData, string>>;
}) {
  return (
    <div className="space-y-5">
      <StepHeader title="Pick your plan" subtitle="Start free and upgrade anytime. You can change this later — no lock-in." />

      <div className="grid sm:grid-cols-2 gap-3">
        {PLAN_TIERS.map((tier) => {
          const selected = form.plan === tier.key;
          const accent = ACCENT_STYLES[tier.accent] || ACCENT_STYLES.gray;

          return (
            <button
              key={tier.key}
              type="button"
              onClick={() => update('plan', tier.key)}
              className={`text-left p-4 rounded-2xl border-2 transition-all duration-300 ${
                selected
                  ? `${accent.selected} ring-2 shadow-md scale-[1.02]`
                  : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className={`font-bold text-sm ${selected ? accent.icon : 'text-gray-900'}`}>{tier.label}</h3>
                    {tier.popular && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-red-600 to-red-800 text-white uppercase tracking-wide">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">{tier.tagline}</p>
                </div>
                {selected && (
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${accent.pill}`}>
                    <Icon.PiCheckBold size={14} />
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-2xl font-black text-gray-900">{formatNaira(tier.priceMonthly)}</span>
                {tier.priceMonthly > 0 && <span className="text-[11px] text-gray-400">/mo</span>}
              </div>

              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${selected ? accent.pill : 'bg-gray-100 text-gray-600'}`}>
                  <Icon.PiPackage size={9} className="inline mr-0.5" />{tier.skuLimit}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${selected ? accent.pill : 'bg-gray-100 text-gray-600'}`}>
                  <Icon.PiUsersBold size={9} className="inline mr-0.5" />{tier.staffLimit}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${selected ? accent.pill : 'bg-red-50 text-red-700'}`}>
                  {tier.commissionRate} commission
                </span>
              </div>

              {selected && (
                <ul className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                  {tier.features.slice(0, 3).map((feat) => (
                    <li key={feat} className="flex items-center gap-1.5 text-[11px] text-gray-600">
                      <Icon.PiCheckBold size={10} className={accent.icon} />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              )}
            </button>
          );
        })}
      </div>

      {errors.plan && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <Icon.PiWarningCircle size={12} /> {errors.plan}
        </p>
      )}
    </div>
  );
}