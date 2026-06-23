// @ts-nocheck
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import {
  PiGift, PiPercent, PiLightning, PiCalendar, PiCurrencyNgn,
  PiPackage, PiTimer, PiPlus, PiTrash, PiCaretDown, PiCaretUp,
  PiTag, PiInfo, PiEraser, PiCopy,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import { pricelistService } from '@/services/pricelist.service';
import { PiListBullets, PiArrowSquareOut, PiCircleHalf } from 'react-icons/pi';

// ── Shared primitives ─────────────────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-400">
      {children}{required && <span className="ml-0.5 text-red-400">*</span>}
    </label>
  );
}

function TextInput({ icon, suffix, ...props }: {
  icon?: React.ReactNode; suffix?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 bg-white focus-within:border-gray-400 transition-colors">
      {icon && <span className="ml-3 shrink-0 text-gray-400">{icon}</span>}
      <input
        {...props}
        className="flex-1 border-0 bg-transparent px-3 py-2.5 text-sm outline-none placeholder-gray-300"
      />
      {suffix && (
        <span className="mr-3 shrink-0 text-[11px] font-semibold text-gray-400">{suffix}</span>
      )}
    </div>
  );
}

function Section({
  title, desc, children, toggle, open, onToggle, badge,
}: {
  title: string; desc?: string; children: React.ReactNode;
  toggle?: boolean; open?: boolean; onToggle?: () => void;
  badge?: React.ReactNode;
}) {
  const isCollapsible = toggle !== undefined;
  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden">
      <div
        className={`flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3 ${isCollapsible ? 'cursor-pointer select-none' : ''}`}
        onClick={isCollapsible ? onToggle : undefined}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-gray-700">{title}</p>
              {badge}
            </div>
            {desc && <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>}
          </div>
        </div>
        {isCollapsible && (
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {/* Toggle pill */}
            <div className={`relative flex h-5 w-9 items-center rounded-full transition-colors ${
              toggle ? 'bg-gray-900' : 'bg-gray-200'
            }`}>
              <span className={`absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                toggle ? 'translate-x-[18px]' : 'translate-x-[3px]'
              }`} />
            </div>
            {open
              ? <PiCaretUp className="h-3.5 w-3.5 text-gray-400" />
              : <PiCaretDown className="h-3.5 w-3.5 text-gray-400" />
            }
          </div>
        )}
      </div>
      {(!isCollapsible || open) && <div className="p-4">{children}</div>}
    </div>
  );
}

// ── Percentage quick-pick chips ───────────────────────────────────────────────

const PCT_PRESETS = [5, 10, 15, 20, 25, 30, 50];

function PctChips({ value, onSelect }: { value: number; onSelect: (v: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {PCT_PRESETS.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onSelect(Number(value) === v ? 0 : v)}
          className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-colors ${
            Number(value) === v
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {v}%
        </button>
      ))}
    </div>
  );
}

// ── Savings preview strip ─────────────────────────────────────────────────────

function SavingsStrip({
  basePrice, discountedPrice, saving, label, color = 'green',
}: {
  basePrice: number; discountedPrice: number; saving: number;
  label: string; color?: string;
}) {
  const pct = basePrice > 0 ? ((saving / basePrice) * 100).toFixed(1) : '0';
  const colorMap = {
    green:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  sub: 'text-green-500'  },
    amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  sub: 'text-amber-500'  },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', sub: 'text-purple-500' },
  };
  const c = colorMap[color] ?? colorMap.green;
  return (
    <div className={`mt-3 flex items-center justify-between rounded-xl border px-4 py-3 ${c.bg} ${c.border}`}>
      <div>
        <p className={`text-xs font-semibold ${c.text}`}>{label}</p>
        <p className={`text-[10px] ${c.sub}`}>{pct}% off original price</p>
      </div>
      <div className="text-right">
        <p className={`text-xl font-black tabular-nums ${c.text}`}>
          ₦{discountedPrice.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
        </p>
        <p className={`text-[10px] line-through ${c.sub}`}>
          ₦{basePrice.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
}

// ── Bundle row ────────────────────────────────────────────────────────────────

function BundleRow({
  bundle, index, basePrice,
  onChange, onRemove, onDuplicate,
}: {
  bundle: any; index: number; basePrice: number;
  onChange: (idx: number, key: string, val: any) => void;
  onRemove: (idx: number) => void;
  onDuplicate: (idx: number) => void;
}) {
  const discountedTotal = bundle.discount > 0 && basePrice > 0
    ? (basePrice * (bundle.quantity || 1)) * (1 - (bundle.discount || 0) / 100)
    : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      {/* Bundle header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100">
            <PiPackage className="h-3.5 w-3.5 text-purple-600" />
          </div>
          <p className="text-xs font-bold text-gray-700">Bundle #{index + 1}</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onDuplicate(index)}
            className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600" title="Duplicate">
            <PiCopy className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => onRemove(index)}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500" title="Remove">
            <PiTrash className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Label>Bundle Name</Label>
          <TextInput
            placeholder="e.g. Buy 2 Get 1 Free"
            value={bundle.name || ''}
            onChange={(e) => onChange(index, 'name', e.target.value)}
          />
        </div>
        <div>
          <Label>Discount (%)</Label>
          <TextInput
            icon={<PiPercent className="h-4 w-4" />}
            type="number" min="0" max="100" step="0.1"
            placeholder="10"
            value={bundle.discount ?? ''}
            onChange={(e) => onChange(index, 'discount', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div>
          <Label>Valid Until</Label>
          <TextInput
            icon={<PiCalendar className="h-4 w-4" />}
            type="date"
            value={bundle.validUntil ? bundle.validUntil.slice(0, 10) : ''}
            onChange={(e) => onChange(index, 'validUntil', e.target.value || null)}
          />
        </div>
      </div>

      {/* Quantity quick-pick */}
      <div>
        <Label>Min Quantity (buy this many to qualify)</Label>
        <div className="flex flex-wrap gap-1.5">
          {[2, 3, 6, 12, 24].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onChange(index, 'quantity', q)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                bundle.quantity === q
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      {discountedTotal !== null && (
        <div className="flex items-center justify-between rounded-lg bg-purple-50 border border-purple-100 px-3 py-2">
          <p className="text-[10px] font-semibold text-purple-700">
            Buy {bundle.quantity || 1} · {bundle.discount}% off
          </p>
          <div className="text-right">
            <p className="text-sm font-black tabular-nums text-purple-700">
              ₦{discountedTotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[9px] text-purple-400 line-through">
              ₦{(basePrice * (bundle.quantity || 1)).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICELIST PRICING SECTION
// ─────────────────────────────────────────────────────────────────────────────

const RULE_TYPE_META: Record<string, { label: string; color: string; bg: string; hint: string }> = {
  discount:   { label: 'Discount',    color: '#059669', bg: '#ecfdf5', hint: 'Always-on % or ₦ off selling price' },
  flash_sale: { label: 'Flash Sale',  color: '#d97706', bg: '#fffbeb', hint: 'Time-limited urgent discount' },
  fixed:      { label: 'Fixed',       color: '#2563eb', bg: '#eff6ff', hint: 'Override selling price directly' },
  formula:    { label: 'Formula',     color: '#7c3aed', bg: '#f5f3ff', hint: 'Price = cost × (1 + markup%)' },
  bundle:     { label: 'Bundle',      color: '#9333ea', bg: '#faf5ff', hint: 'Volume deal: buy N → get discount' },
};

const RULE_FORM_EMPTY = {
  priceType:        'discount',
  fixedPrice:       '',
  markupPercentage: '',
  discountType:     'percentage',
  discountPercentage: '',
  discountAmount:   '',
  flashSalePercentage: '',
  flashSaleQty:     '',
  bundleName:       '',
  bundleQuantity:   '2',
  bundleDiscount:   '',
  bundleDiscountType: 'percentage',
  minQuantity:      '',
  startDate:        '',
  endDate:          '',
};

function ruleDesc(r: any): string {
  switch (r.priceType) {
    case 'fixed':      return `Sets price → ₦${Number(r.fixedPrice || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    case 'formula':    return `Cost + ${r.markupPercentage || 0}% markup`;
    case 'flash_sale': return `⚡ ${r.flashSalePercentage || 0}% flash${r.flashSaleQty > 0 ? ` (${r.flashSaleQty} units)` : ''}`;
    case 'discount':
      return r.discountType === 'fixed'
        ? `-₦${r.discountAmount || 0} off`
        : `${r.discountPercentage || 0}% off`;
    case 'bundle': {
      const qty = r.bundleQuantity || 2;
      const dt  = r.bundleDiscountType;
      if (dt === 'markup_on_cost') return `Buy ${qty}+ → cost +${r.bundleDiscount}% markup`;
      if (dt === 'no_discount')    return `Buy ${qty}+ → no discount`;
      if (dt === 'fixed')          return `Buy ${qty}+ → -₦${r.bundleDiscount}/unit`;
      return `Buy ${qty}+ → ${r.bundleDiscount || 0}% off`;
    }
    default: return '—';
  }
}

function buildPayload(form: typeof RULE_FORM_EMPTY, subProductId: string, appliedOn: string) {
  const qty  = parseFloat(form.bundleQuantity) || 2;
  return {
    subProduct:          subProductId,
    appliedOn,
    priceType:           form.priceType,
    fixedPrice:          parseFloat(form.fixedPrice) || 0,
    markupPercentage:    parseFloat(form.markupPercentage) || 0,
    discountType:        form.discountType,
    discountPercentage:  parseFloat(form.discountPercentage) || 0,
    discountAmount:      parseFloat(form.discountAmount) || 0,
    flashSalePercentage: parseFloat(form.flashSalePercentage) || 0,
    flashSaleQty:        parseFloat(form.flashSaleQty) || 0,
    bundleName:          form.bundleName || `Buy ${qty}+`,
    bundleQuantity:      qty,
    bundleDiscount:      parseFloat(form.bundleDiscount) || 0,
    bundleDiscountType:  form.bundleDiscountType,
    minQuantity:         parseFloat(form.minQuantity) || 0,
    startDate:           form.startDate || undefined,
    endDate:             form.endDate   || undefined,
  };
}

function formFromRule(r: any): typeof RULE_FORM_EMPTY {
  return {
    priceType:           r.priceType           || 'discount',
    fixedPrice:          r.fixedPrice           ? String(r.fixedPrice) : '',
    markupPercentage:    r.markupPercentage     ? String(r.markupPercentage) : '',
    discountType:        r.discountType         || 'percentage',
    discountPercentage:  r.discountPercentage   ? String(r.discountPercentage) : '',
    discountAmount:      r.discountAmount       ? String(r.discountAmount) : '',
    flashSalePercentage: r.flashSalePercentage  ? String(r.flashSalePercentage) : '',
    flashSaleQty:        r.flashSaleQty         ? String(r.flashSaleQty) : '',
    bundleName:          r.bundleName           || '',
    bundleQuantity:      r.bundleQuantity       ? String(r.bundleQuantity) : '2',
    bundleDiscount:      r.bundleDiscount       ? String(r.bundleDiscount) : '',
    bundleDiscountType:  r.bundleDiscountType   || 'percentage',
    minQuantity:         r.minQuantity          ? String(r.minQuantity) : '',
    startDate:           r.startDate ? new Date(r.startDate).toISOString().slice(0, 10) : '',
    endDate:             r.endDate   ? new Date(r.endDate).toISOString().slice(0, 10) : '',
  };
}

// ── Inline rule form ──────────────────────────────────────────────────────────

function InlineRuleForm({
  value, onChange, onSave, onCancel, saving, basePrice,
}: {
  value: typeof RULE_FORM_EMPTY;
  onChange: (k: string, v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  basePrice: number;
}) {
  const f  = (k: string) => (e: any) => onChange(k, e.target.value);
  const m  = RULE_TYPE_META[value.priceType] || RULE_TYPE_META.discount;
  const today = new Date().toISOString().slice(0, 10);

  // Live price preview
  const preview = useMemo(() => {
    if (!basePrice) return null;
    const p = basePrice;
    switch (value.priceType) {
      case 'fixed': {
        const fp = parseFloat(value.fixedPrice) || 0;
        return fp ? { after: fp, saving: p - fp } : null;
      }
      case 'discount': {
        if (value.discountType === 'fixed') {
          const amt = parseFloat(value.discountAmount) || 0;
          return amt ? { after: Math.max(0, p - amt), saving: amt } : null;
        }
        const pct = parseFloat(value.discountPercentage) || 0;
        return pct ? { after: p * (1 - pct / 100), saving: p * pct / 100 } : null;
      }
      case 'flash_sale': {
        const pct = parseFloat(value.flashSalePercentage) || 0;
        return pct ? { after: p * (1 - pct / 100), saving: p * pct / 100 } : null;
      }
      default: return null;
    }
  }, [value, basePrice]);

  return (
    <div className="rounded-xl border-2 bg-white p-4 space-y-4" style={{ borderColor: m.color }}>

      {/* Type selector */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Rule Type</p>
        <div className="grid grid-cols-5 gap-1.5">
          {Object.entries(RULE_TYPE_META).map(([v, meta]) => {
            const active = value.priceType === v;
            return (
              <button key={v} type="button" onClick={() => onChange('priceType', v)}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 py-2.5 px-1 text-center transition-all ${active ? 'shadow-sm' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}
                style={active ? { borderColor: meta.color, backgroundColor: meta.bg } : {}}>
                <span className="text-[10px] font-bold leading-tight" style={{ color: active ? meta.color : '#374151' }}>
                  {meta.label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[10px]" style={{ color: m.color }}>{m.hint}</p>
      </div>

      {/* ── Type-specific fields ── */}
      <div className="rounded-xl border bg-gray-50 p-3 space-y-3" style={{ borderColor: m.bg }}>

        {value.priceType === 'fixed' && (
          <div>
            <Label>Selling Price (₦)</Label>
            <TextInput icon={<PiCurrencyNgn className="h-4 w-4" />} type="number" min="0" step="0.01"
              placeholder="e.g. 5000" value={value.fixedPrice} onChange={f('fixedPrice')} autoFocus />
          </div>
        )}

        {value.priceType === 'formula' && (
          <div>
            <Label>Markup %</Label>
            <TextInput type="number" min="0" step="0.1" suffix="%"
              placeholder="e.g. 25" value={value.markupPercentage} onChange={f('markupPercentage')} autoFocus />
            <p className="mt-1 text-[10px] text-gray-400">New price = cost price × (1 + markup%)</p>
          </div>
        )}

        {value.priceType === 'discount' && (
          <>
            <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 text-xs font-semibold">
              {[['percentage', '% Off'], ['fixed', '₦ Off']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => onChange('discountType', v)}
                  className={`flex-1 rounded-md px-3 py-1.5 transition-all ${value.discountType === v ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {l}
                </button>
              ))}
            </div>
            {value.discountType === 'percentage' ? (
              <div>
                <Label>Discount %</Label>
                <TextInput type="number" min="0" max="100" step="0.1" suffix="%"
                  placeholder="e.g. 15" value={value.discountPercentage} onChange={f('discountPercentage')} autoFocus />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[5, 10, 15, 20, 25, 30, 50].map(v => (
                    <button key={v} type="button"
                      onClick={() => onChange('discountPercentage', value.discountPercentage === String(v) ? '' : String(v))}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold border transition-all ${value.discountPercentage === String(v) ? 'border-transparent text-white' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                      style={value.discountPercentage === String(v) ? { backgroundColor: m.color } : {}}>
                      {v}%
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <Label>Amount Off (₦)</Label>
                <TextInput icon={<PiCurrencyNgn className="h-4 w-4" />} type="number" min="0" step="0.01"
                  placeholder="e.g. 500" value={value.discountAmount} onChange={f('discountAmount')} autoFocus />
              </div>
            )}
          </>
        )}

        {value.priceType === 'flash_sale' && (
          <>
            <div>
              <Label>Flash Discount %</Label>
              <TextInput type="number" min="0" max="100" step="0.1" suffix="%"
                placeholder="e.g. 30" value={value.flashSalePercentage} onChange={f('flashSalePercentage')} autoFocus />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[5, 10, 15, 20, 25, 30, 50].map(v => (
                  <button key={v} type="button"
                    onClick={() => onChange('flashSalePercentage', value.flashSalePercentage === String(v) ? '' : String(v))}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold border transition-all ${value.flashSalePercentage === String(v) ? 'border-transparent text-white' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                    style={value.flashSalePercentage === String(v) ? { backgroundColor: m.color } : {}}>
                    {v}%
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Limited Qty (optional)</Label>
              <TextInput type="number" min="0" step="1" placeholder="Leave blank for unlimited"
                value={value.flashSaleQty} onChange={f('flashSaleQty')} />
            </div>
          </>
        )}

        {value.priceType === 'bundle' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Bundle Name (optional)</Label>
                <TextInput placeholder={`Buy ${value.bundleQuantity || 2}+`}
                  value={value.bundleName} onChange={f('bundleName')} />
              </div>
              <div>
                <Label>Min Quantity to Qualify</Label>
                <div className="flex flex-wrap gap-1.5">
                  {[2, 3, 4, 6, 12, 24].map(q => (
                    <button key={q} type="button" onClick={() => onChange('bundleQuantity', String(q))}
                      className={`h-8 w-8 rounded-lg border text-xs font-bold transition-all ${value.bundleQuantity === String(q) ? 'border-transparent text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300'}`}
                      style={value.bundleQuantity === String(q) ? { backgroundColor: m.color } : {}}>
                      {q}
                    </button>
                  ))}
                  <input type="number" min="2" step="1" value={value.bundleQuantity}
                    onChange={e => onChange('bundleQuantity', e.target.value)}
                    className="h-8 w-14 rounded-lg border border-gray-200 bg-white px-2 text-center text-sm outline-none focus:border-purple-400" />
                </div>
              </div>
            </div>
            <div>
              <Label>Discount Type</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {[['percentage','% Off selling price'],['fixed','₦ Off per unit'],['markup_on_cost','Cost + markup%'],['no_discount','Remove discount (full price)']].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => onChange('bundleDiscountType', v)}
                    className={`flex items-start gap-1.5 rounded-lg border-2 px-2.5 py-2 text-left text-[10px] font-semibold transition-all ${value.bundleDiscountType === v ? 'shadow-sm' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}
                    style={value.bundleDiscountType === v ? { borderColor: m.color, color: m.color, backgroundColor: m.bg } : { color: '#374151' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {value.bundleDiscountType !== 'no_discount' && (
              <div>
                <Label>{value.bundleDiscountType === 'markup_on_cost' ? 'Markup %' : value.bundleDiscountType === 'fixed' ? 'Amount Off (₦/unit)' : 'Discount %'}</Label>
                <TextInput
                  type="number" min="0" step="0.1"
                  suffix={value.bundleDiscountType === 'fixed' ? '₦' : value.bundleDiscountType === 'markup_on_cost' ? '%' : '%'}
                  placeholder={value.bundleDiscountType === 'fixed' ? '500' : '15'}
                  value={value.bundleDiscount} onChange={f('bundleDiscount')} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Shared: Min Qty + dates */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Min Order Qty</Label>
          <TextInput type="number" min="0" step="1" placeholder="0" value={value.minQuantity} onChange={f('minQuantity')} />
          <p className="mt-1 text-[10px] text-gray-400">0 = any qty</p>
        </div>
        <div>
          <Label>Valid From</Label>
          <input type="date" min={today} value={value.startDate} onChange={f('startDate')}
            className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-gray-400" />
        </div>
        <div>
          <Label>Valid Until</Label>
          <input type="date" min={value.startDate || today} value={value.endDate} onChange={f('endDate')}
            className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-gray-400" />
        </div>
      </div>

      {/* Live preview */}
      {preview && basePrice > 0 && (
        <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: m.bg }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: m.color }}>After this rule</p>
            <p className="text-[10px] text-gray-500 mt-0.5 line-through">
              ₦{basePrice.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <p className="text-xl font-black tabular-nums" style={{ color: m.color }}>
            ₦{preview.after.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button type="button" onClick={onSave} disabled={saving}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white transition-opacity disabled:opacity-50 hover:opacity-90"
          style={{ backgroundColor: m.color }}>
          {saving ? 'Saving…' : 'Save Rule'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}
          className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Pricelist pricing panel ───────────────────────────────────────────────────

function PricelistPricingSection({
  subProductId, productName, basePrice, adminToken,
}: {
  subProductId: string; productName: string; basePrice: number; adminToken: string;
}) {
  const [allLists,  setAllLists]  = useState<any[]>([]);
  const [coverage,  setCoverage]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set());

  // form state: { plId, ruleId (null=new), data }
  const [form, setForm] = useState<{ plId: string; ruleId: string | null; data: typeof RULE_FORM_EMPTY } | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [reordering,setReordering]= useState(false);

  async function load() {
    setLoading(true);
    try {
      const [lists, cov] = await Promise.all([
        pricelistService.list(adminToken, { page: 1, limit: 200 }),
        pricelistService.getCoverage(subProductId, adminToken),
      ]);
      setAllLists(lists?.data?.pricelists || []);
      setCoverage(cov?.pricelists || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [subProductId, adminToken]);

  // Merge: all pricelists with coverage rules injected
  const merged = useMemo(() => {
    return allLists.map(pl => {
      const cov = coverage.find(c => String(c._id) === String(pl._id));
      return {
        ...pl,
        coveredRules: (cov?.rules || []).sort((a: any, b: any) => (a.sequence ?? 999) - (b.sequence ?? 999)),
        hasCoverage: !!cov,
      };
    });
  }, [allLists, coverage]);

  const coveredCount = merged.filter(p => p.hasCoverage).length;

  function toggleExpand(plId: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(plId) ? next.delete(plId) : next.add(plId);
      return next;
    });
  }

  function openAddForm(plId: string) {
    setForm({ plId, ruleId: null, data: { ...RULE_FORM_EMPTY } });
    setExpanded(prev => new Set([...prev, plId]));
  }

  function openEditForm(plId: string, rule: any) {
    setForm({ plId, ruleId: rule._id, data: formFromRule(rule) });
    setExpanded(prev => new Set([...prev, plId]));
  }

  function cancelForm() { setForm(null); }

  function changeFormField(k: string, v: string) {
    setForm(f => f ? { ...f, data: { ...f.data, [k]: v } } : f);
  }

  async function saveRule() {
    if (!form) return;
    setSaving(true);
    try {
      const payload = buildPayload(form.data, subProductId, productName);
      if (form.ruleId) {
        await pricelistService.updateRule(form.plId, form.ruleId, payload, adminToken);
        toast.success('Rule updated');
      } else {
        await pricelistService.addRule(form.plId, payload, adminToken);
        toast.success('Rule added');
      }
      setForm(null);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function deleteRule(plId: string, ruleId: string) {
    setDeleting(ruleId);
    try {
      await pricelistService.deleteRule(plId, ruleId, adminToken);
      toast.success('Rule removed');
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setDeleting(null); }
  }

  async function moveRule(plId: string, rules: any[], ruleId: string, dir: 'up' | 'down') {
    const idx = rules.findIndex(r => r._id === ruleId);
    if (idx < 0) return;
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= rules.length) return;
    const ordered = [...rules];
    [ordered[idx], ordered[swap]] = [ordered[swap], ordered[idx]];
    setReordering(true);
    // Optimistic update
    setCoverage(prev => prev.map(c => String(c._id) === String(plId)
      ? { ...c, rules: ordered }
      : c
    ));
    try {
      await pricelistService.reorderRules(plId, ordered.map(r => r._id), adminToken);
    } catch (e: any) {
      toast.error(e.message);
      await load(); // revert on failure
    }
    finally { setReordering(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-xs text-gray-400">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500" />
        Loading pricelists…
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* ── Summary ── */}
      {coveredCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-[11px] text-blue-700">
          <PiInfo className="h-4 w-4 shrink-0 text-blue-500" />
          <span>
            This product is covered by <strong>{coveredCount} pricelist{coveredCount !== 1 ? 's' : ''}</strong>.
            Rules apply only when that pricelist is selected in a POS session.
          </span>
        </div>
      )}

      {/* ── Per-pricelist cards ── */}
      {merged.map(pl => {
        const isOpen   = expanded.has(pl._id);
        const rules    = pl.coveredRules;
        const isEditing = form?.plId === pl._id;

        return (
          <div key={pl._id} className={`overflow-hidden rounded-xl border transition-all ${pl.hasCoverage ? 'border-blue-200' : 'border-gray-200'}`}>

            {/* Card header */}
            <div
              className={`flex cursor-pointer items-center justify-between gap-2 px-4 py-3 ${pl.hasCoverage ? 'bg-blue-50/60' : 'bg-gray-50'}`}
              onClick={() => toggleExpand(pl._id)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-gray-800 truncate">{pl.name}</p>
                    <span className="text-[9px] text-gray-400 font-medium">{pl.currency || 'NGN'}</span>
                    {pl.isSelectable && (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">POS</span>
                    )}
                  </div>
                  {pl.hasCoverage ? (
                    <p className="text-[10px] text-blue-600 mt-0.5 font-medium">
                      {rules.length} rule{rules.length !== 1 ? 's' : ''} targeting this product
                    </p>
                  ) : (
                    <p className="text-[10px] text-gray-400 mt-0.5">No rules for this product yet</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); openAddForm(pl._id); }}
                  className="flex items-center gap-1 rounded-lg border border-dashed border-gray-300 px-2.5 py-1 text-[10px] font-semibold text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  <PiPlus className="h-3 w-3" />
                  Add rule
                </button>
                {isOpen ? <PiCaretUp className="h-3.5 w-3.5 text-gray-400" /> : <PiCaretDown className="h-3.5 w-3.5 text-gray-400" />}
              </div>
            </div>

            {/* Card body */}
            {isOpen && (
              <div className="border-t border-gray-100 bg-white p-4 space-y-3">

                {/* Existing rules */}
                {rules.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Rules — lower # = higher priority
                    </p>
                    {rules.map((r: any, idx: number) => {
                      const meta = RULE_TYPE_META[r.priceType] || RULE_TYPE_META.discount;
                      const isEditing = form?.ruleId === r._id && form?.plId === pl._id;
                      const isDel = deleting === r._id;

                      if (isEditing) {
                        return (
                          <InlineRuleForm key={r._id}
                            value={form!.data}
                            onChange={changeFormField}
                            onSave={saveRule}
                            onCancel={cancelForm}
                            saving={saving}
                            basePrice={basePrice}
                          />
                        );
                      }

                      return (
                        <div key={r._id}
                          className="group flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">

                          {/* Priority badge */}
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[9px] font-black"
                            style={{ borderColor: meta.color, color: meta.color }}>
                            {(r.sequence ?? idx) + 1}
                          </span>

                          {/* Type badge */}
                          <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold"
                            style={{ backgroundColor: meta.bg, color: meta.color }}>
                            {meta.label}
                          </span>

                          {/* Description */}
                          <span className="flex-1 min-w-0 text-[11px] text-gray-700 truncate">{ruleDesc(r)}</span>

                          {/* Scope + dates */}
                          <div className="hidden sm:flex shrink-0 items-center gap-2">
                            <span className="text-[9px] italic text-gray-400">
                              {r.subProduct ? 'This product' : 'All products'}
                            </span>
                            {r.minQuantity > 0 && (
                              <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[9px] text-gray-500">
                                min {r.minQuantity}
                              </span>
                            )}
                            {r.endDate && (
                              <span className="text-[9px] text-gray-400">
                                until {new Date(r.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <button type="button" disabled={idx === 0 || reordering}
                              onClick={() => moveRule(pl._id, rules, r._id, 'up')}
                              title="Higher priority"
                              className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-20">
                              <PiCaretUp className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" disabled={idx === rules.length - 1 || reordering}
                              onClick={() => moveRule(pl._id, rules, r._id, 'down')}
                              title="Lower priority"
                              className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-20">
                              <PiCaretDown className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => openEditForm(pl._id, r)}
                              className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700">
                              <PiTag className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" disabled={isDel}
                              onClick={() => deleteRule(pl._id, r._id)}
                              className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40">
                              {isDel
                                ? <span className="h-3 w-3 animate-spin rounded-full border border-gray-400 border-t-transparent" />
                                : <PiTrash className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add rule form for this pricelist */}
                {form?.plId === pl._id && form.ruleId === null && (
                  <InlineRuleForm
                    value={form.data}
                    onChange={changeFormField}
                    onSave={saveRule}
                    onCancel={cancelForm}
                    saving={saving}
                    basePrice={basePrice}
                  />
                )}

                {/* Empty + no form */}
                {rules.length === 0 && !(form?.plId === pl._id) && (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <PiListBullets className="h-8 w-8 text-gray-200 mb-2" />
                    <p className="text-xs text-gray-400">No rules for this product yet</p>
                    <button type="button" onClick={() => openAddForm(pl._id)}
                      className="mt-2 text-[10px] font-semibold text-blue-600 hover:text-blue-800">
                      + Add a rule
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {merged.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <PiCircleHalf className="h-10 w-10 text-gray-200 mb-2" />
          <p className="text-xs text-gray-400">No pricelists found</p>
          <p className="text-[10px] text-gray-300 mt-0.5">Create pricelists in the POS Pricelists section first</p>
          <a href="/pos/pricelists" target="_blank" rel="noopener"
            className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800">
            Go to Pricelists <PiArrowSquareOut className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const BUNDLE_PRESETS = [
  { name: 'Buy 2 Get 1 Free', quantity: 3, discount: 33 },
  { name: 'Buy 3 Save 20%',   quantity: 3, discount: 20 },
  { name: '6-Pack Deal',      quantity: 6, discount: 15 },
  { name: 'Case Deal (12)',   quantity: 12, discount: 25 },
];

const PROMO_PRESETS = [
  { label: 'Summer Sale',        discount: 20, days: 30 },
  { label: 'Holiday Special',    discount: 25, days: 14 },
  { label: 'New Year Clearance', discount: 30, days: 7  },
  { label: 'End of Line',        discount: 40, days: 7  },
  { label: 'Overstock Clear',    discount: 35, days: 14 },
];

export default function SubProductPromotions() {
  const { watch, setValue, register, control } = useFormContext();

  const baseSellingPrice  = Number(watch('subProductData.baseSellingPrice'))  || 0;
  // Use the correct backend fields: saleDiscountValue + saleType (not legacy discount/discountType)
  const saleDiscountValue = Number(watch('subProductData.saleDiscountValue')) || 0;
  const saleType          = watch('subProductData.saleType')                  || 'percentage';
  const saleStartDate     = watch('subProductData.saleStartDate')             || '';
  const saleEndDate       = watch('subProductData.saleEndDate')               || '';
  const isOnSale          = watch('subProductData.isOnSale')                  ?? false;
  const flashSale         = watch('subProductData.flashSale')                 || {};
  const bundleDeals       = watch('subProductData.bundleDeals')               || [];

  // aliases for readability
  const discount     = saleDiscountValue;
  const discountType = saleType;
  const discountStart = saleStartDate;
  const discountEnd   = saleEndDate;

  const [showFlash,   setShowFlash]   = useState(!!flashSale?.isActive);
  const [showBundles, setShowBundles] = useState(bundleDeals.length > 0);

  const { data: session } = useSession();
  const adminToken = (session?.user as any)?.token;
  const params = useParams();
  const subProductId = typeof params?.id === 'string' ? params.id : null;

  const [pricelistCoverage, setPricelistCoverage] = useState<any[]>([]);
  const [coverageLoading, setCoverageLoading]     = useState(false);

  useEffect(() => {
    if (!subProductId || !adminToken) return;
    setCoverageLoading(true);
    pricelistService.getCoverage(subProductId, adminToken)
      .then(d => setPricelistCoverage(d.pricelists || []))
      .catch(() => {})
      .finally(() => setCoverageLoading(false));
  }, [subProductId, adminToken]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const discountAmount = useMemo(() => {
    if (!discount || !baseSellingPrice) return 0;
    return discountType === 'percentage'
      ? baseSellingPrice * (discount / 100)
      : Math.min(discount, baseSellingPrice);
  }, [discount, discountType, baseSellingPrice]);

  const discountedPrice = baseSellingPrice - discountAmount;

  const isDiscountActive = useMemo(() => {
    if (!saleDiscountValue) return false;
    const now   = new Date();
    const start = saleStartDate ? new Date(saleStartDate) : null;
    const end   = saleEndDate   ? new Date(saleEndDate)   : null;
    if (start && now < start) return false;
    if (end   && now > end)   return false;
    return true;
  }, [saleDiscountValue, saleStartDate, saleEndDate]);

  const flashPct        = Number(flashSale?.discountPercentage) || 0;
  const flashPrice      = baseSellingPrice * (1 - flashPct / 100);
  const isFlashActive   = !!flashSale?.isActive && flashPct > 0;

  const activeCount = [
    isDiscountActive && discount > 0,
    isFlashActive,
    bundleDeals.length > 0,
  ].filter(Boolean).length;

  // ── Handlers ───────────────────────────────────────────────────────────────

  function toggleFlash() {
    const next = !flashSale?.isActive;
    setValue('subProductData.flashSale', { ...(flashSale || {}), isActive: next });
    // isOnSale must be true while flash sale is active so backend models reflect it
    if (next) setValue('subProductData.isOnSale', true);
    setShowFlash(next);
  }

  function clearDiscount() {
    setValue('subProductData.saleDiscountValue', 0);
    setValue('subProductData.saleStartDate', '');
    setValue('subProductData.saleEndDate', '');
    setValue('subProductData.isOnSale', false);
  }

  function clearAll() {
    clearDiscount();
    setValue('subProductData.flashSale', {});
    setValue('subProductData.bundleDeals', []);
    setShowFlash(false);
    setShowBundles(false);
    toast.success('All promotions cleared');
  }

  function applyPreset(p: typeof PROMO_PRESETS[0]) {
    setValue('subProductData.saleDiscountValue', p.discount);
    setValue('subProductData.saleType', 'percentage');
    setValue('subProductData.isOnSale', true);
    const start = new Date();
    const end   = new Date();
    end.setDate(end.getDate() + p.days);
    setValue('subProductData.saleStartDate', start.toISOString().slice(0, 16));
    setValue('subProductData.saleEndDate',   end.toISOString().slice(0, 16));
    toast.success(`Applied: ${p.label}`);
  }

  function addBundle(preset?: typeof BUNDLE_PRESETS[0]) {
    const next = {
      name:       preset?.name     || '',
      discount:   preset?.discount || 10,
      quantity:   preset?.quantity || 2,
      validUntil: null,
      products:   [],
    };
    setValue('subProductData.bundleDeals', [...bundleDeals, next]);
    setShowBundles(true);
  }

  function updateBundle(idx: number, key: string, val: any) {
    const updated = bundleDeals.map((b: any, i: number) => i === idx ? { ...b, [key]: val } : b);
    setValue('subProductData.bundleDeals', updated);
  }

  function removeBundle(idx: number) {
    setValue('subProductData.bundleDeals', bundleDeals.filter((_: any, i: number) => i !== idx));
  }

  function duplicateBundle(idx: number) {
    const copy = { ...bundleDeals[idx], name: `${bundleDeals[idx].name} (Copy)` };
    setValue('subProductData.bundleDeals', [...bundleDeals, copy]);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600">
            <PiGift className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-gray-900">Promotions & Discounts</p>
              {activeCount > 0 && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  {activeCount} active
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Boost sales with time-bound offers, flash deals and bundles
            </p>
          </div>
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors shrink-0"
          >
            <PiEraser className="h-3.5 w-3.5" />
            Clear all
          </button>
        )}
      </div>

      {/* ── Price preview ── */}
      {baseSellingPrice > 0 && (isDiscountActive || isFlashActive) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {isDiscountActive && (
            <SavingsStrip
              basePrice={baseSellingPrice}
              discountedPrice={discountedPrice}
              saving={discountAmount}
              label="After regular discount"
              color="green"
            />
          )}
          {isFlashActive && (
            <SavingsStrip
              basePrice={baseSellingPrice}
              discountedPrice={flashPrice}
              saving={baseSellingPrice - flashPrice}
              label="After flash sale"
              color="amber"
            />
          )}
        </div>
      )}

      {/* ── Regular Discount ── */}
      <Section
        title="Regular Discount"
        desc="Always-on discount applied to the selling price"
        badge={
          discount > 0 ? (
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
              isDiscountActive ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-600'
            }`}>
              {isDiscountActive ? 'Active' : 'Scheduled'}
            </span>
          ) : null
        }
      >
        {/* Presets */}
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Quick presets</p>
          <div className="flex flex-wrap gap-2">
            {PROMO_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[10px] font-semibold text-gray-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
              >
                <PiTag className="h-3 w-3" />
                {p.label} ({p.discount}% / {p.days}d)
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Type */}
          <div>
            <Label>Discount Type</Label>
            <Controller
              name="subProductData.saleType"
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    // Keep isOnSale in sync
                    if (saleDiscountValue > 0) setValue('subProductData.isOnSale', true);
                  }}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-400"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed amount (₦)</option>
                </select>
              )}
            />
          </div>

          {/* Value */}
          <div>
            <Label>
              {discountType === 'percentage' ? 'Discount (%)' : 'Discount Amount (₦)'}
            </Label>
            <TextInput
              icon={discountType === 'percentage'
                ? <PiPercent className="h-4 w-4" />
                : <PiCurrencyNgn className="h-4 w-4" />
              }
              type="number" step="0.01" min="0"
              max={discountType === 'percentage' ? 100 : undefined}
              placeholder={discountType === 'percentage' ? '10' : '500'}
              {...register('subProductData.saleDiscountValue', {
                valueAsNumber: true,
                onChange: (e) => {
                  const v = parseFloat(e.target.value) || 0;
                  setValue('subProductData.isOnSale', v > 0);
                },
              })}
            />
            {discountType === 'percentage' && (
              <PctChips
                value={discount}
                onSelect={(v) => {
                  setValue('subProductData.saleDiscountValue', v);
                  setValue('subProductData.saleType', 'percentage');
                  setValue('subProductData.isOnSale', v > 0);
                }}
              />
            )}
            {discountAmount > 0 && baseSellingPrice > 0 && (
              <p className="mt-1.5 text-[10px] text-gray-400">
                Customer saves ₦{discountAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>

          {/* Dates */}
          <div>
            <Label>Start Date (optional)</Label>
            <TextInput
              icon={<PiCalendar className="h-4 w-4" />}
              type="datetime-local"
              {...register('subProductData.saleStartDate')}
            />
          </div>
          <div>
            <Label>End Date (optional)</Label>
            <div className="space-y-1">
              <TextInput
                icon={<PiTimer className="h-4 w-4" />}
                type="datetime-local"
                {...register('subProductData.saleEndDate')}
              />
              {discountEnd && (
                <p className="text-[10px] text-gray-400">
                  Expires {new Date(discountEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Clear */}
        {discount > 0 && (
          <button type="button" onClick={clearDiscount}
            className="mt-4 text-xs font-semibold text-red-500 hover:text-red-700">
            × Remove discount
          </button>
        )}
      </Section>

      {/* ── Flash Sale ── */}
      <Section
        title="Flash Sale"
        desc="Time-limited urgent discount — shown with a lightning badge"
        toggle={!!flashSale?.isActive}
        open={showFlash}
        onToggle={() => { toggleFlash(); setShowFlash((v) => !v); }}
        badge={
          isFlashActive ? (
            <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Live
            </span>
          ) : null
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Start</Label>
            <TextInput
              icon={<PiCalendar className="h-4 w-4" />}
              type="datetime-local"
              {...register('subProductData.flashSale.startDate')}
            />
          </div>
          <div>
            <Label>End</Label>
            <TextInput
              icon={<PiTimer className="h-4 w-4" />}
              type="datetime-local"
              {...register('subProductData.flashSale.endDate')}
            />
          </div>
          <div>
            <Label>Flash Discount (%)</Label>
            <TextInput
              icon={<PiLightning className="h-4 w-4" />}
              type="number" min="0" max="100" step="0.1"
              placeholder="20"
              {...register('subProductData.flashSale.discountPercentage', { valueAsNumber: true })}
            />
            {flashPct > 0 && baseSellingPrice > 0 && (
              <p className="mt-1.5 text-[10px] text-gray-400">
                Flash price: ₦{(baseSellingPrice * (1 - flashPct / 100)).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>
          <div>
            <Label>Limited Qty (optional)</Label>
            <TextInput
              icon={<PiPackage className="h-4 w-4" />}
              type="number" min="0"
              placeholder="100"
              {...register('subProductData.flashSale.remainingQuantity', { valueAsNumber: true })}
            />
            <p className="mt-1 text-[10px] text-gray-400">Leave blank for unlimited</p>
          </div>
        </div>
      </Section>

      {/* ── Bundle Deals ── */}
      <div className="rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-gray-700">Bundle Deals</p>
              {bundleDeals.length > 0 && (
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-bold text-purple-700">
                  {bundleDeals.length} deal{bundleDeals.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Volume discounts — buy X items to get a lower price
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowBundles((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
          >
            {showBundles ? <PiCaretUp className="h-3 w-3" /> : <PiCaretDown className="h-3 w-3" />}
            {showBundles ? 'Hide' : 'Show'}
          </button>
        </div>

        {showBundles && (
          <div className="p-4 space-y-4">
            {/* Presets row */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Quick add</p>
              <div className="flex flex-wrap gap-2">
                {BUNDLE_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => addBundle(p)}
                    className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-[10px] font-semibold text-purple-700 hover:bg-purple-100 transition-colors"
                  >
                    <PiPlus className="h-3 w-3" />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Bundle list */}
            {bundleDeals.length > 0 ? (
              <div className="space-y-3">
                {bundleDeals.map((bundle: any, idx: number) => (
                  <BundleRow
                    key={idx}
                    bundle={bundle}
                    index={idx}
                    basePrice={baseSellingPrice}
                    onChange={updateBundle}
                    onRemove={removeBundle}
                    onDuplicate={duplicateBundle}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <PiPackage className="h-10 w-10 text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">No bundle deals yet</p>
                <p className="text-[10px] text-gray-300 mt-0.5">Use the presets above or add a custom one</p>
              </div>
            )}

            {/* Custom add */}
            <button
              type="button"
              onClick={() => addBundle()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-500 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-600 transition-colors"
            >
              <PiPlus className="h-4 w-4" />
              Add custom bundle
            </button>
          </div>
        )}
      </div>

      {/* ── Active summary ── */}
      {activeCount > 0 && baseSellingPrice > 0 && (
        <div className="rounded-2xl border border-gray-900 bg-gray-900 p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Active promotions</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {isDiscountActive && discount > 0 && (
              <div className="rounded-xl bg-white/10 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <PiGift className="h-4 w-4 text-emerald-400" />
                  <p className="text-[10px] font-bold text-white/60 uppercase">Regular</p>
                </div>
                <p className="text-lg font-black text-white tabular-nums">
                  {discount}{discountType === 'percentage' ? '%' : '₦'} off
                </p>
                <p className="text-[10px] text-white/40 mt-0.5">
                  Saves ₦{discountAmount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </p>
              </div>
            )}
            {isFlashActive && (
              <div className="rounded-xl bg-white/10 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <PiLightning className="h-4 w-4 text-amber-400" />
                  <p className="text-[10px] font-bold text-white/60 uppercase">Flash</p>
                </div>
                <p className="text-lg font-black text-white tabular-nums">{flashPct}% off</p>
                <p className="text-[10px] text-white/40 mt-0.5">
                  Price: ₦{flashPrice.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </p>
              </div>
            )}
            {bundleDeals.length > 0 && (
              <div className="rounded-xl bg-white/10 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <PiPackage className="h-4 w-4 text-purple-400" />
                  <p className="text-[10px] font-bold text-white/60 uppercase">Bundles</p>
                </div>
                <p className="text-lg font-black text-white tabular-nums">
                  {bundleDeals.length} deal{bundleDeals.length !== 1 ? 's' : ''}
                </p>
                <p className="text-[10px] text-white/40 mt-0.5">Volume discounts active</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Pricelist Coverage ── */}
      {subProductId && (
        <div className="rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <PiListBullets className="h-4 w-4 text-gray-500" />
                <p className="text-xs font-bold text-gray-700">Pricelist Rules</p>
                {pricelistCoverage.length > 0 && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700">
                    {pricelistCoverage.length} pricelist{pricelistCoverage.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Pricelists that have rules affecting this product when selected in a POS session
              </p>
            </div>
            {coverageLoading && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500" />
            )}
          </div>

          <div className="p-4">
            {coverageLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500" />
              </div>
            ) : pricelistCoverage.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <PiCircleHalf className="h-8 w-8 text-gray-200 mb-2" />
                <p className="text-xs text-gray-400">No pricelist rules target this product</p>
                <p className="text-[10px] text-gray-300 mt-0.5">
                  Add rules in the Pricelists section to override pricing in POS sessions
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pricelistCoverage.map((pl: any) => (
                  <div key={pl._id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-gray-800">{pl.name}</p>
                        <span className="text-[9px] font-semibold text-gray-400">{pl.currency || 'NGN'}</span>
                        {pl.isSelectable && (
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                            POS selectable
                          </span>
                        )}
                      </div>
                      <a
                        href="/pos/pricelists"
                        target="_blank"
                        rel="noopener"
                        className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800"
                      >
                        Manage <PiArrowSquareOut className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="space-y-1">
                      {pl.rules.map((r: any, i: number) => {
                        const typeColors: Record<string, string> = {
                          discount:   'bg-emerald-50 text-emerald-700',
                          flash_sale: 'bg-amber-50 text-amber-700',
                          fixed:      'bg-blue-50 text-blue-700',
                          formula:    'bg-indigo-50 text-indigo-700',
                          bundle:     'bg-purple-50 text-purple-700',
                        };
                        const ruleDesc = (() => {
                          if (r.priceType === 'fixed')      return `Fixed ₦${(r.fixedPrice || 0).toLocaleString()}`;
                          if (r.priceType === 'formula')    return `Cost + ${r.markupPercentage || 0}% markup`;
                          if (r.priceType === 'flash_sale') return `⚡ ${r.flashSalePercentage || 0}% flash sale`;
                          if (r.priceType === 'discount')
                            return r.discountType === 'fixed'
                              ? `-₦${r.discountAmount || 0} off`
                              : `${r.discountPercentage || 0}% off`;
                          if (r.priceType === 'bundle') {
                            const dt = r.bundleDiscountType;
                            if (dt === 'markup_on_cost') return `📦 Buy ${r.bundleQuantity}+ → cost +${r.bundleDiscount}% markup`;
                            if (dt === 'no_discount')    return `📦 Buy ${r.bundleQuantity}+ → no discount`;
                            if (dt === 'fixed')          return `📦 Buy ${r.bundleQuantity}+ → -₦${r.bundleDiscount}/unit`;
                            return `📦 Buy ${r.bundleQuantity}+ → ${r.bundleDiscount || 0}% off`;
                          }
                          return '—';
                        })();
                        const scope = r.subProduct ? 'This product' : 'All products';
                        return (
                          <div key={r._id || i}
                            className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-1.5">
                            <span className="text-[9px] font-bold text-gray-400">#{(r.sequence ?? i) + 1}</span>
                            <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${typeColors[r.priceType] || 'bg-gray-100 text-gray-500'}`}>
                              {r.priceType.replace('_', ' ')}
                            </span>
                            <span className="flex-1 text-[10px] text-gray-700">{ruleDesc}</span>
                            <span className="text-[9px] text-gray-400 italic">{scope}</span>
                            {(r.minQuantity > 0) && (
                              <span className="text-[9px] text-gray-400">min qty {r.minQuantity}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-gray-400 mt-1">
                  Rules apply only when the pricelist is selected in a POS session. Lower # = higher priority.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tips ── */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
        <PiInfo className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-blue-800">Tips</p>
          <ul className="text-[10px] text-blue-700 space-y-0.5 list-disc list-inside">
            <li>Flash sales create urgency — keep them short (24–72 hours)</li>
            <li>Bundle deals increase average order value and move inventory faster</li>
            <li>Set end dates on regular discounts to avoid forgetting to remove them</li>
          </ul>
        </div>
      </div>

    </div>
  );
}
