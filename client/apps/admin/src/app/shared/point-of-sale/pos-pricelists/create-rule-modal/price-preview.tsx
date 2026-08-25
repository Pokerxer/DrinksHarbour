'use client';

import { PiArrowDown, PiArrowUp, PiInfo } from 'react-icons/pi';
import { RULE_TYPE_META } from '@/app/shared/point-of-sale/pricelist-constants';
import { fmt } from '../rule-format';

interface MetaEntry {
  color: string;
  bg: string;
  border: string;
}
const META = RULE_TYPE_META as unknown as Record<string, MetaEntry>;

export interface PreviewInput {
  priceType: string;
  fixedPrice: string;
  markupPercentage: string;
  discountType: string;
  discountPercentage: string;
  discountAmount: string;
  flashSalePercentage: string;
  bundleQuantity: string;
  bundleDiscount: string;
  bundleDiscountType: string;
}

export interface RulePreview {
  label: string;
  value: number;
  delta: number;
  sub: string;
  color: string;
  noValue?: boolean;
}

function metaKeyByColor(color: string): MetaEntry | undefined {
  return Object.values(META).find((m) => m.color === color);
}

/** Pure computation of the live preview box — exported for reuse/testing. */
export function computeRulePreview(
  f: PreviewInput,
  basePrice: number,
  costPrice: number
): RulePreview | null {
  const pt = f.priceType;

  if (pt === 'fixed') {
    const fp = parseFloat(f.fixedPrice) || 0;
    if (!fp) return null;
    return {
      label: 'New selling price',
      value: fp,
      delta: basePrice > 0 ? fp - basePrice : 0,
      sub: basePrice > 0 ? `was ${fmt(basePrice)}` : 'no current price',
      color: META.fixed.color,
    };
  }

  if (pt === 'formula') {
    const mp = parseFloat(f.markupPercentage) || 0;
    if (!mp) return null;
    if (!costPrice)
      return {
        label: 'Formula',
        value: 0,
        delta: 0,
        sub: 'select a product with a cost price to preview',
        color: META.formula.color,
        noValue: true,
      };
    const computed = Math.round(costPrice * (1 + mp / 100) * 100) / 100;
    return {
      label: 'Computed price',
      value: computed,
      delta: basePrice > 0 ? computed - basePrice : 0,
      sub: `${fmt(costPrice)} cost + ${mp}% markup`,
      color: META.formula.color,
    };
  }

  if (pt === 'discount') {
    if (!basePrice)
      return {
        label: 'Discount',
        value: 0,
        delta: 0,
        sub: 'select a product to preview savings',
        color: META.discount.color,
        noValue: true,
      };
    const isFixed = f.discountType === 'fixed';
    const val = isFixed
      ? parseFloat(f.discountAmount) || 0
      : parseFloat(f.discountPercentage) || 0;
    if (!val) return null;
    const sale = isFixed
      ? Math.max(0, basePrice - val)
      : basePrice * (1 - val / 100);
    const saving = basePrice - sale;
    return {
      label: 'After discount',
      value: sale,
      delta: -saving,
      sub: `customer saves ${fmt(saving)} (${((saving / basePrice) * 100).toFixed(1)}%)`,
      color: META.discount.color,
    };
  }

  if (pt === 'flash_sale') {
    if (!basePrice)
      return {
        label: 'Flash price',
        value: 0,
        delta: 0,
        sub: 'select a product to preview',
        color: META.flash_sale.color,
        noValue: true,
      };
    const pct = parseFloat(f.flashSalePercentage) || 0;
    if (!pct) return null;
    const flash = basePrice * (1 - pct / 100);
    const saving = basePrice - flash;
    return {
      label: '⚡ Flash price',
      value: flash,
      delta: -saving,
      sub: `${pct}% off · saves ${fmt(saving)}`,
      color: META.flash_sale.color,
    };
  }

  if (pt === 'bundle') {
    const qty = parseFloat(f.bundleQuantity) || 2;
    const disc = parseFloat(f.bundleDiscount) || 0;
    const dt = f.bundleDiscountType;

    if (dt === 'no_discount') {
      if (!basePrice)
        return {
          label: 'Bundle',
          value: 0,
          delta: 0,
          sub: 'select a product to preview',
          color: META.bundle.color,
          noValue: true,
        };
      return {
        label: `Buy ${qty}+ · No discount`,
        value: basePrice * qty,
        delta: 0,
        sub: `${fmt(basePrice)} each — sale discount removed`,
        color: META.bundle.color,
      };
    }
    if (dt === 'markup_on_cost') {
      if (!disc) return null;
      if (!costPrice)
        return {
          label: 'Bundle',
          value: 0,
          delta: 0,
          sub: 'select a product with a cost price to preview',
          color: META.bundle.color,
          noValue: true,
        };
      const unitPrice = Math.round(costPrice * (1 + disc / 100) * 100) / 100;
      return {
        label: `Buy ${qty}+ · Cost markup`,
        value: unitPrice * qty,
        delta: basePrice > 0 ? (unitPrice - basePrice) * qty : 0,
        sub: `${fmt(unitPrice)} each (cost ${fmt(costPrice)} + ${disc}% markup)`,
        color: META.bundle.color,
      };
    }
    if (!disc) return null;
    if (!basePrice)
      return {
        label: 'Bundle',
        value: 0,
        delta: 0,
        sub: 'select a product to preview bundle total',
        color: META.bundle.color,
        noValue: true,
      };
    const unitSale =
      dt === 'fixed' ? Math.max(0, basePrice - disc) : basePrice * (1 - disc / 100);
    return {
      label: `Buy ${qty} total`,
      value: unitSale * qty,
      delta: -(basePrice - unitSale) * qty,
      sub: `${fmt(unitSale)} each (was ${fmt(basePrice)})`,
      color: META.bundle.color,
    };
  }

  return null;
}

export default function PricePreview({ preview }: { preview: RulePreview | null }) {
  if (!preview) return null;

  if (preview.noValue) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[11px] text-gray-400">
        <PiInfo className="h-4 w-4 shrink-0" />
        {preview.sub}
      </div>
    );
  }

  const meta = metaKeyByColor(preview.color);
  return (
    <div
      className="flex items-center justify-between rounded-xl border-2 px-4 py-3 transition-all"
      style={{
        borderColor: meta?.border || '#e5e7eb',
        backgroundColor: meta?.bg || '#f9fafb',
      }}
    >
      <div>
        <p
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: preview.color }}
        >
          {preview.label}
        </p>
        <p className="mt-0.5 text-[11px] text-gray-500">{preview.sub}</p>
        {preview.delta !== 0 && (
          <p
            className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold"
            style={{ color: preview.delta < 0 ? '#059669' : '#dc2626' }}
          >
            {preview.delta < 0 ? (
              <PiArrowDown className="h-3 w-3" />
            ) : (
              <PiArrowUp className="h-3 w-3" />
            )}
            {preview.delta < 0 ? '-' : '+'}
            {fmt(Math.abs(preview.delta))} vs current
          </p>
        )}
      </div>
      <p className="text-2xl font-black tabular-nums" style={{ color: preview.color }}>
        {fmt(preview.value)}
      </p>
    </div>
  );
}
