'use client';

import { PiInfo } from 'react-icons/pi';
import { RULE_TYPE_META } from '@/app/shared/point-of-sale/pricelist-constants';
import type { RuleFormValues } from '../types';
import { RuleField, RuleInput, PctChips } from './controls';

const META = RULE_TYPE_META as unknown as Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    hint?: string;
    modalHint?: string;
  }
>;

interface Props {
  form: RuleFormValues;
  errors: Record<string, string>;
  f(k: keyof RuleFormValues, v: string): void;
}

const BUNDLE_QTYS = [2, 3, 4, 6, 12, 24];
const BUNDLE_TYPES: [string, string, string][] = [
  ['percentage', '% Off', 'Percentage discount off selling price'],
  ['fixed', '₦ Off', 'Fixed naira amount off selling price'],
  ['markup_on_cost', 'Cost + Markup', 'Price = cost × (1 + markup%)'],
  ['no_discount', 'No Discount', 'Remove sale/flash discount — charge base price'],
];

export default function BundleFields({ form, errors, f }: Props) {
  return (
    <>
      <RuleField label="Bundle Name" hint="Auto-generated if blank">
        <RuleInput
          type="text"
          placeholder={
            form.bundleDiscountType === 'markup_on_cost'
              ? `Buy ${form.bundleQuantity || 2}+ · Cost +${form.bundleDiscount || '?'}% markup`
              : form.bundleDiscountType === 'no_discount'
                ? `Buy ${form.bundleQuantity || 2}+ · No discount`
                : form.bundleDiscountType === 'fixed'
                  ? `Buy ${form.bundleQuantity || 2}+ · ₦${form.bundleDiscount || '?'} off`
                  : `Buy ${form.bundleQuantity || 2}+ · ${form.bundleDiscount || '?'}% off`
          }
          value={form.bundleName}
          onChange={(e) => f('bundleName', e.target.value)}
        />
      </RuleField>

      <RuleField label="Min Quantity to Qualify" error={errors.bundleQuantity}>
        <div className="flex flex-wrap items-center gap-1.5">
          {BUNDLE_QTYS.map((q) => {
            const active = form.bundleQuantity === String(q);
            return (
              <button
                key={q}
                type="button"
                aria-pressed={active}
                onClick={() => f('bundleQuantity', String(q))}
                className={`h-8 w-8 rounded-lg border text-xs font-bold transition-all ${
                  active
                    ? 'border-transparent text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300'
                }`}
                style={active ? { backgroundColor: META.bundle.color } : {}}
              >
                {q}
              </button>
            );
          })}
          <input
            type="number"
            min="2"
            step="1"
            aria-label="Custom bundle quantity"
            value={form.bundleQuantity}
            onChange={(e) => f('bundleQuantity', e.target.value)}
            className="h-8 w-14 rounded-lg border border-gray-200 bg-white px-2 text-center text-sm outline-none focus:border-purple-400"
          />
        </div>
      </RuleField>

      <RuleField label="Pricing Type">
        <div className="grid grid-cols-2 gap-1.5">
          {BUNDLE_TYPES.map(([v, l, hint]) => {
            const active = form.bundleDiscountType === v;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={active}
                onClick={() => f('bundleDiscountType', v)}
                className={`flex flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-2 text-left transition-all ${
                  active
                    ? 'shadow-sm'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
                style={
                  active
                    ? { borderColor: META.bundle.color, backgroundColor: '#faf5ff' }
                    : {}
                }
              >
                <span
                  className="text-xs font-bold"
                  style={{ color: active ? META.bundle.color : '#374151' }}
                >
                  {l}
                </span>
                <span className="text-[10px] leading-tight text-gray-400">{hint}</span>
              </button>
            );
          })}
        </div>
      </RuleField>

      {form.bundleDiscountType !== 'no_discount' && (
        <RuleField
          label={form.bundleDiscountType === 'markup_on_cost' ? 'Markup %' : 'Discount'}
          error={errors.bundleDiscount}
          hint={
            form.bundleDiscountType === 'markup_on_cost'
              ? 'Bundle price = cost price × (1 + markup%)'
              : undefined
          }
        >
          <RuleInput
            hasError={!!errors.bundleDiscount}
            prefix={form.bundleDiscountType === 'fixed' ? '₦' : undefined}
            suffix={form.bundleDiscountType !== 'fixed' ? '%' : undefined}
            type="number"
            min="0"
            step="0.1"
            placeholder={
              form.bundleDiscountType === 'fixed'
                ? '500'
                : form.bundleDiscountType === 'markup_on_cost'
                  ? '15'
                  : '20'
            }
            value={form.bundleDiscount}
            onChange={(e) => f('bundleDiscount', e.target.value)}
          />
          {(form.bundleDiscountType === 'percentage' ||
            form.bundleDiscountType === 'markup_on_cost') && (
            <PctChips
              value={form.bundleDiscount}
              onChange={(v) => f('bundleDiscount', v)}
              activeColor={META.bundle.color}
            />
          )}
        </RuleField>
      )}

      {form.bundleDiscountType === 'no_discount' && (
        <div className="flex items-start gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2.5 text-[11px] text-purple-800">
          <PiInfo className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" />
          Customers buying {form.bundleQuantity || 2}+ units will be charged the base
          selling price — any active sale or flash-sale discount is removed.
        </div>
      )}
    </>
  );
}
