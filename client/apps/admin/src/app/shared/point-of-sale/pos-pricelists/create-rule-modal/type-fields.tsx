'use client';

import { PiInfo } from 'react-icons/pi';
import { RULE_TYPE_META } from '@/app/shared/point-of-sale/pricelist-constants';
import type { RuleFormValues } from '../types';
import { RuleField, RuleInput, Seg, PctChips } from './controls';

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

export default function TypeFields({ form, errors, f }: Props) {
  switch (form.priceType) {
    case 'fixed':
      return (
        <RuleField
          label="Selling Price"
          error={errors.fixedPrice}
          hint="Current price shows once a product is selected"
        >
          <RuleInput
            hasError={!!errors.fixedPrice}
            prefix="₦"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 5000"
            value={form.fixedPrice}
            onChange={(e) => f('fixedPrice', e.target.value)}
            autoFocus
          />
        </RuleField>
      );

    case 'formula':
      return (
        <>
          <RuleField
            label="Markup %"
            error={errors.markupPercentage}
            hint="New price = cost × (1 + markup%)"
          >
            <RuleInput
              hasError={!!errors.markupPercentage}
              suffix="%"
              type="number"
              min="0"
              step="0.1"
              placeholder="e.g. 25"
              value={form.markupPercentage}
              onChange={(e) => f('markupPercentage', e.target.value)}
              autoFocus
            />
          </RuleField>
          <div className="flex items-center gap-2 text-[11px] text-amber-700">
            <PiInfo className="h-3.5 w-3.5 shrink-0" />
            Products without a cost price will be skipped when applied.
          </div>
        </>
      );

    case 'discount':
      return (
        <>
          <Seg
            options={[
              ['percentage', '% Off'],
              ['fixed', '₦ Off'],
            ]}
            value={form.discountType}
            onChange={(v) => f('discountType', v)}
            activeColor={META.discount.color}
          />
          {form.discountType === 'percentage' ? (
            <RuleField label="Discount %" error={errors.discountPercentage}>
              <RuleInput
                hasError={!!errors.discountPercentage}
                suffix="%"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="e.g. 15"
                value={form.discountPercentage}
                onChange={(e) => f('discountPercentage', e.target.value)}
                autoFocus
              />
              <PctChips
                value={form.discountPercentage}
                onChange={(v) => f('discountPercentage', v)}
                activeColor={META.discount.color}
              />
            </RuleField>
          ) : (
            <RuleField label="Amount Off (₦)" error={errors.discountAmount}>
              <RuleInput
                hasError={!!errors.discountAmount}
                prefix="₦"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 500"
                value={form.discountAmount}
                onChange={(e) => f('discountAmount', e.target.value)}
                autoFocus
              />
            </RuleField>
          )}
        </>
      );

    case 'flash_sale':
      return (
        <>
          <RuleField label="Flash Discount %" error={errors.flashSalePercentage}>
            <RuleInput
              hasError={!!errors.flashSalePercentage}
              suffix="%"
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="e.g. 30"
              value={form.flashSalePercentage}
              onChange={(e) => f('flashSalePercentage', e.target.value)}
              autoFocus
            />
            <PctChips
              value={form.flashSalePercentage}
              onChange={(v) => f('flashSalePercentage', v)}
              activeColor={META.flash_sale.color}
            />
          </RuleField>
          <RuleField label="Limited Qty" hint="Leave blank for unlimited">
            <RuleInput
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 50"
              value={form.flashSaleQty}
              onChange={(e) => f('flashSaleQty', e.target.value)}
            />
          </RuleField>
        </>
      );

    case 'bundle':
      return <BundleFields form={form} errors={errors} f={f} />;

    case 'cart_threshold':
      return (
        <>
          <RuleField
            label="Spend threshold"
            error={errors.thresholdAmount}
            hint="Discount activates when the cart subtotal reaches this amount"
          >
            <RuleInput
              type="number"
              min="0"
              step="any"
              prefix="₦"
              value={form.thresholdAmount}
              hasError={!!errors.thresholdAmount}
              onChange={(e) => f('thresholdAmount', e.target.value)}
            />
          </RuleField>

          <RuleField label="Discount type">
            <Seg
              options={[
                ['percentage', '% Off'],
                ['fixed', '₦ Off'],
              ]}
              value={form.discountType}
              onChange={(v) => f('discountType', v)}
              activeColor={META.cart_threshold.color}
            />
          </RuleField>

          <RuleField
            label={
              form.discountType === 'fixed' ? 'Discount amount' : 'Discount percentage'
            }
            error={
              form.discountType === 'fixed'
                ? errors.discountAmount
                : errors.discountPercentage
            }
          >
            <RuleInput
              type="number"
              min="0"
              step="any"
              prefix={form.discountType === 'fixed' ? '₦' : undefined}
              suffix={form.discountType !== 'fixed' ? '%' : undefined}
              value={
                form.discountType === 'fixed'
                  ? form.discountAmount
                  : form.discountPercentage
              }
              hasError={
                !!(form.discountType === 'fixed'
                  ? errors.discountAmount
                  : errors.discountPercentage)
              }
              onChange={(e) =>
                f(
                  form.discountType === 'fixed'
                    ? 'discountAmount'
                    : 'discountPercentage',
                  e.target.value
                )
              }
            />
            {form.discountType !== 'fixed' && (
              <PctChips
                value={form.discountPercentage}
                onChange={(v) => f('discountPercentage', v)}
                activeColor={META.cart_threshold.color}
              />
            )}
          </RuleField>
        </>
      );

    default:
      return null;
  }
}

const BUNDLE_QTYS = [2, 3, 4, 6, 12, 24];
const BUNDLE_TYPES: [string, string, string][] = [
  ['percentage', '% Off', 'Percentage discount off selling price'],
  ['fixed', '₦ Off', 'Fixed naira amount off selling price'],
  ['markup_on_cost', 'Cost + Markup', 'Price = cost × (1 + markup%)'],
  [
    'no_discount',
    'No Discount',
    'Remove sale/flash discount — charge base price',
  ],
];

function BundleFields({ form, errors, f }: Props) {
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
          label={
            form.bundleDiscountType === 'markup_on_cost' ? 'Markup %' : 'Discount'
          }
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
