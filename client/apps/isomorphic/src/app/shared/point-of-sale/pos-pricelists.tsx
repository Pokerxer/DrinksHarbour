// @ts-nocheck
'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import POSNavHeader from '@/app/shared/point-of-sale/pos-nav-header';
import { pricelistService } from '@/services/pricelist.service';
import { subproductService } from '@/services/subproduct.service';
import { warehouseService } from '@/services/warehouse.service';
import { posApi } from '@/app/shared/point-of-sale/api';
import toast from 'react-hot-toast';
import {
  PiPlus,
  PiX,
  PiGear,
  PiMagnifyingGlass,
  PiCaretLeft,
  PiCaretRight,
  PiCheckSquare,
  PiSquare,
  PiDotsSixVertical,
  PiTrash,
  PiSpinner,
  PiWarningCircle,
  PiFloppyDisk,
  PiArrowLeft,
  PiLightning,
  PiCaretDown,
  PiArrowsClockwise,
  PiTag,
  PiReceipt,
  PiSealPercent,
  PiInfo,
  PiPercent,
  PiCurrencyNgn,
  PiFunction,
  PiPackage,
  PiArrowDown,
  PiArrowUp,
  PiWarning,
  PiPencilSimple,
} from 'react-icons/pi';

const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '';

function priceLabel(rule: any) {
  if (rule.priceType === 'fixed')
    return `${Number(rule.fixedPrice || 0).toFixed(2)} ₦`;
  if (rule.priceType === 'formula')
    return `${rule.markupPercentage || 0}% markup on cost`;
  if (rule.priceType === 'flash_sale')
    return `⚡ ${rule.flashSalePercentage || 0}% flash sale`;
  if (rule.priceType === 'bundle') {
    const qty = rule.bundleQuantity || 2;
    const dt = rule.bundleDiscountType;
    if (dt === 'markup_on_cost')
      return `📦 Buy ${qty}+ · Cost +${rule.bundleDiscount || 0}% markup`;
    if (dt === 'no_discount') return `📦 Buy ${qty}+ · No discount`;
    const d =
      dt === 'fixed'
        ? `₦${Number(rule.bundleDiscount || 0).toFixed(0)} off`
        : `${rule.bundleDiscount || 0}% off`;
    return `📦 Buy ${qty}+ · ${d}`;
  }
  if (rule.priceType === 'discount') {
    if (rule.discountType === 'fixed')
      return `-₦${Number(rule.discountAmount || 0).toFixed(2)}`;
    return `${rule.discountPercentage || 0}% discount`;
  }
  return '—';
}

function priceTypeBadge(priceType: string) {
  const map: Record<string, string> = {
    fixed: 'bg-blue-50 text-blue-700',
    formula: 'bg-indigo-50 text-indigo-700',
    discount: 'bg-emerald-50 text-emerald-700',
    flash_sale: 'bg-amber-50 text-amber-700',
    bundle: 'bg-purple-50 text-purple-700',
  };
  return map[priceType] || 'bg-gray-100 text-gray-500';
}

// ── Help tooltip ──────────────────────────────────────────────────────────────
function Tip({ text }: { text: string }) {
  return (
    <span
      title={text}
      className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full bg-gray-200 text-[9px] font-bold text-gray-500"
    >
      ?
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE RULE MODAL — field components defined OUTSIDE the modal so React
// doesn't destroy and recreate them on every keystroke (causing focus loss).
// ─────────────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}
function RuleField({ label, error, hint, children }: FieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-gray-600">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-[11px] text-gray-400">{hint}</p>
      )}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500">
          <PiWarning className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

interface RuleInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}
function RuleInput({
  hasError,
  prefix,
  suffix,
  className: _cls,
  ...props
}: RuleInputProps) {
  return (
    <div
      className={`flex h-9 items-center overflow-hidden rounded-lg border bg-white transition-colors focus-within:ring-1 ${
        hasError
          ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-200'
          : 'border-gray-200 focus-within:border-[#b20202] focus-within:ring-[#b20202]/10'
      }`}
    >
      {prefix && (
        <span className="shrink-0 pl-3 text-sm text-gray-400">{prefix}</span>
      )}
      <input
        {...props}
        className="h-full flex-1 bg-transparent px-3 text-sm tabular-nums outline-none"
      />
      {suffix && (
        <span className="shrink-0 pr-3 text-sm text-gray-400">{suffix}</span>
      )}
    </div>
  );
}

const RULE_EMPTY = {
  applyTo: 'product',
  subProduct: '',
  appliedOn: '',
  priceType: 'discount',
  fixedPrice: '',
  markupPercentage: '',
  discountType: 'percentage',
  discountPercentage: '',
  discountAmount: '',
  flashSalePercentage: '',
  flashSaleQty: '',
  bundleName: '',
  bundleQuantity: '2',
  bundleDiscount: '',
  bundleDiscountType: 'percentage',
  minQuantity: '',
  startDate: '',
  endDate: '',
};

const RULE_TYPE_META = {
  discount: {
    label: 'Discount',
    Icon: PiPercent,
    color: '#059669',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    hint: 'Applied at runtime — base price stays the same',
  },
  flash_sale: {
    label: 'Flash Sale',
    Icon: PiLightning,
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fcd34d',
    hint: 'Highest priority — overrides regular discount',
  },
  fixed: {
    label: 'Fixed Price',
    Icon: PiCurrencyNgn,
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    hint: 'Sets the base selling price directly',
  },
  formula: {
    label: 'Formula',
    Icon: PiFunction,
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    hint: 'Price = cost × (1 + markup%)',
  },
  bundle: {
    label: 'Bundle',
    Icon: PiPackage,
    color: '#9333ea',
    bg: '#faf5ff',
    border: '#e9d5ff',
    hint: 'Applied at order time when qty threshold is met',
  },
};

const PCT_PRESETS = [5, 10, 15, 20, 25, 30, 50];

function PctChips({
  value,
  onChange,
  activeColor,
}: {
  value: string;
  onChange: (v: string) => void;
  activeColor: string;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {PCT_PRESETS.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(value === String(v) ? '' : String(v))}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all ${value === String(v) ? 'border-transparent text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
          style={value === String(v) ? { backgroundColor: activeColor } : {}}
        >
          {v}%
        </button>
      ))}
    </div>
  );
}

function Seg({
  options,
  value,
  onChange,
  activeColor,
}: {
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
  activeColor: string;
}) {
  return (
    <div className="flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 text-xs font-semibold">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`flex-1 rounded-md px-3 py-1.5 transition-all ${value === v ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          style={value === v ? { backgroundColor: activeColor } : {}}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function ruleToFormValues(rule: any): typeof RULE_EMPTY {
  const subProductId = rule.subProduct?._id
    ? String(rule.subProduct._id)
    : rule.subProduct
      ? String(rule.subProduct)
      : '';
  const toDateStr = (d: any) => {
    if (!d) return '';
    const date = new Date(d);
    return isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  };
  return {
    applyTo: subProductId ? 'product' : 'all',
    subProduct: subProductId,
    appliedOn: rule.appliedOn || '',
    priceType: rule.priceType || 'discount',
    fixedPrice: rule.fixedPrice ? String(rule.fixedPrice) : '',
    markupPercentage: rule.markupPercentage
      ? String(rule.markupPercentage)
      : '',
    discountType: rule.discountType || 'percentage',
    discountPercentage: rule.discountPercentage
      ? String(rule.discountPercentage)
      : '',
    discountAmount: rule.discountAmount ? String(rule.discountAmount) : '',
    flashSalePercentage: rule.flashSalePercentage
      ? String(rule.flashSalePercentage)
      : '',
    flashSaleQty: rule.flashSaleQty ? String(rule.flashSaleQty) : '',
    bundleName: rule.bundleName || '',
    bundleQuantity: rule.bundleQuantity ? String(rule.bundleQuantity) : '2',
    bundleDiscount: rule.bundleDiscount ? String(rule.bundleDiscount) : '',
    bundleDiscountType: rule.bundleDiscountType || 'percentage',
    minQuantity: rule.minQuantity ? String(rule.minQuantity) : '',
    startDate: toDateStr(rule.startDate),
    endDate: toDateStr(rule.endDate),
  };
}

function CreateRuleModal({
  token,
  products,
  onSave,
  onSaveNew,
  onDiscard,
  initialValues = null,
}) {
  const isEdit = !!initialValues;
  const [form, setForm] = useState(
    isEdit ? ruleToFormValues(initialValues) : { ...RULE_EMPTY }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<'close' | 'new' | null>(null);
  const [search, setSearch] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const onOut = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node))
        setShowDrop(false);
    };
    document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, []);

  const f = (k: string, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => {
      const n = { ...p };
      delete n[k];
      return n;
    });
  };

  function switchType(type: string) {
    setForm((p) => ({
      ...p,
      priceType: type,
      fixedPrice: '',
      markupPercentage: '',
      discountPercentage: '',
      discountAmount: '',
      flashSalePercentage: '',
      flashSaleQty: '',
      bundleName: '',
      bundleDiscount: '',
    }));
    setErrors({});
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const selProduct = products.find((p: any) => p._id === form.subProduct);
  const basePrice = Number(selProduct?.baseSellingPrice) || 0;
  const costPrice = Number(selProduct?.costPrice) || 0;
  const dispName = selProduct
    ? selProduct.product?.name || selProduct.sku
    : form.appliedOn && form.appliedOn !== 'All products'
      ? form.appliedOn
      : '';

  // Conflict: selected product already has same promotion type active
  const conflict = (() => {
    if (!selProduct) return null;
    const pt = form.priceType;
    if (pt === 'flash_sale' && selProduct.flashSale?.isActive)
      return `This product already has an active flash sale (${selProduct.flashSale.discountPercentage}% off). Applying will overwrite it.`;
    if (
      pt === 'discount' &&
      selProduct.isOnSale &&
      selProduct.saleDiscountValue > 0
    )
      return `This product already has an active discount (${selProduct.saleType === 'fixed' ? `₦${selProduct.saleDiscountValue}` : `${selProduct.saleDiscountValue}%`} off). Applying will overwrite it.`;
    if (pt === 'bundle' && selProduct.bundleDeals?.length > 0)
      return `This product has ${selProduct.bundleDeals.length} existing bundle deal${selProduct.bundleDeals.length > 1 ? 's' : ''}. A new one will be added.`;
    return null;
  })();

  // Live price preview
  const preview = (() => {
    const pt = form.priceType;
    if (pt === 'fixed') {
      const fp = parseFloat(form.fixedPrice) || 0;
      if (!fp) return null;
      const delta = basePrice > 0 ? fp - basePrice : 0;
      return {
        label: 'New selling price',
        value: fp,
        delta,
        sub: basePrice > 0 ? `was ${fmt(basePrice)}` : 'no current price',
        color: RULE_TYPE_META.fixed.color,
      };
    }
    if (pt === 'formula') {
      const mp = parseFloat(form.markupPercentage) || 0;
      if (!mp) return null;
      if (!costPrice)
        return {
          label: 'Formula',
          value: 0,
          delta: 0,
          sub: 'select a product with a cost price to preview',
          color: RULE_TYPE_META.formula.color,
          noValue: true,
        };
      const computed = Math.round(costPrice * (1 + mp / 100) * 100) / 100;
      const delta = basePrice > 0 ? computed - basePrice : 0;
      return {
        label: 'Computed price',
        value: computed,
        delta,
        sub: `${fmt(costPrice)} cost + ${mp}% markup`,
        color: RULE_TYPE_META.formula.color,
      };
    }
    if (pt === 'discount') {
      if (!basePrice)
        return {
          label: 'Discount',
          value: 0,
          delta: 0,
          sub: 'select a product to preview savings',
          color: RULE_TYPE_META.discount.color,
          noValue: true,
        };
      const isFixed = form.discountType === 'fixed';
      const val = isFixed
        ? parseFloat(form.discountAmount) || 0
        : parseFloat(form.discountPercentage) || 0;
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
        color: RULE_TYPE_META.discount.color,
      };
    }
    if (pt === 'flash_sale') {
      if (!basePrice)
        return {
          label: 'Flash price',
          value: 0,
          delta: 0,
          sub: 'select a product to preview',
          color: RULE_TYPE_META.flash_sale.color,
          noValue: true,
        };
      const pct = parseFloat(form.flashSalePercentage) || 0;
      if (!pct) return null;
      const flash = basePrice * (1 - pct / 100);
      const saving = basePrice - flash;
      return {
        label: '⚡ Flash price',
        value: flash,
        delta: -saving,
        sub: `${pct}% off · saves ${fmt(saving)}`,
        color: RULE_TYPE_META.flash_sale.color,
      };
    }
    if (pt === 'bundle') {
      const qty = parseFloat(form.bundleQuantity) || 2;
      const disc = parseFloat(form.bundleDiscount) || 0;
      const dt = form.bundleDiscountType;

      if (dt === 'no_discount') {
        // Preview: shows the base (undiscounted) price vs the current sale price
        if (!basePrice)
          return {
            label: 'Bundle',
            value: 0,
            delta: 0,
            sub: 'select a product to preview',
            color: RULE_TYPE_META.bundle.color,
            noValue: true,
          };
        return {
          label: `Buy ${qty}+ · No discount`,
          value: basePrice * qty,
          delta: 0,
          sub: `${fmt(basePrice)} each — sale discount removed`,
          color: RULE_TYPE_META.bundle.color,
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
            color: RULE_TYPE_META.bundle.color,
            noValue: true,
          };
        const unitPrice = Math.round(costPrice * (1 + disc / 100) * 100) / 100;
        const delta = basePrice > 0 ? (unitPrice - basePrice) * qty : 0;
        return {
          label: `Buy ${qty}+ · Cost markup`,
          value: unitPrice * qty,
          delta,
          sub: `${fmt(unitPrice)} each (cost ${fmt(costPrice)} + ${disc}% markup)`,
          color: RULE_TYPE_META.bundle.color,
        };
      }
      if (!disc) return null;
      if (!basePrice)
        return {
          label: 'Bundle',
          value: 0,
          delta: 0,
          sub: 'select a product to preview bundle total',
          color: RULE_TYPE_META.bundle.color,
          noValue: true,
        };
      const unitSale =
        dt === 'fixed'
          ? Math.max(0, basePrice - disc)
          : basePrice * (1 - disc / 100);
      return {
        label: `Buy ${qty} total`,
        value: unitSale * qty,
        delta: -(basePrice - unitSale) * qty,
        sub: `${fmt(unitSale)} each (was ${fmt(basePrice)})`,
        color: RULE_TYPE_META.bundle.color,
      };
    }
    return null;
  })();

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    const pt = form.priceType;
    if (pt === 'fixed' && !(parseFloat(form.fixedPrice) || 0))
      e.fixedPrice = 'Enter a price';
    if (pt === 'formula' && !(parseFloat(form.markupPercentage) || 0))
      e.markupPercentage = 'Enter a markup %';
    if (pt === 'discount') {
      if (
        form.discountType === 'percentage' &&
        !(parseFloat(form.discountPercentage) || 0)
      )
        e.discountPercentage = 'Enter a discount %';
      if (
        form.discountType === 'fixed' &&
        !(parseFloat(form.discountAmount) || 0)
      )
        e.discountAmount = 'Enter an amount';
    }
    if (pt === 'flash_sale' && !(parseFloat(form.flashSalePercentage) || 0))
      e.flashSalePercentage = 'Enter a discount %';
    if (pt === 'bundle') {
      if ((parseFloat(form.bundleQuantity) || 0) < 2)
        e.bundleQuantity = 'Min 2 units';
      if (
        form.bundleDiscountType !== 'no_discount' &&
        !(parseFloat(form.bundleDiscount) || 0)
      )
        e.bundleDiscount =
          form.bundleDiscountType === 'markup_on_cost'
            ? 'Enter a markup %'
            : 'Enter a discount';
    }
    if (
      form.startDate &&
      form.endDate &&
      new Date(form.startDate) > new Date(form.endDate)
    )
      e.endDate = 'End must be after start';
    return e;
  }

  // ── Payload ───────────────────────────────────────────────────────────────
  function buildPayload() {
    const qty = parseFloat(form.bundleQuantity) || 2;
    const disc = parseFloat(form.bundleDiscount) || 0;
    const bundleName =
      form.bundleName ||
      `Buy ${qty}+ · ${form.bundleDiscountType === 'fixed' ? `₦${disc}` : `${disc}%`} off`;
    return {
      subProduct: form.subProduct || undefined,
      appliedOn: form.subProduct ? form.appliedOn : 'All products',
      priceType: form.priceType,
      fixedPrice: parseFloat(form.fixedPrice) || 0,
      markupPercentage: parseFloat(form.markupPercentage) || 0,
      discountType: form.discountType,
      discountPercentage: parseFloat(form.discountPercentage) || 0,
      discountAmount: parseFloat(form.discountAmount) || 0,
      flashSalePercentage: parseFloat(form.flashSalePercentage) || 0,
      flashSaleQty: parseFloat(form.flashSaleQty) || 0,
      bundleName,
      bundleQuantity: qty,
      bundleDiscount: form.bundleDiscountType === 'no_discount' ? 0 : disc,
      bundleDiscountType: form.bundleDiscountType,
      minQuantity: parseFloat(form.minQuantity) || 0,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
    };
  }

  async function handle(mode: 'close' | 'new') {
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSaving(mode);
    try {
      if (mode === 'close') {
        await onSave(buildPayload());
      } else {
        await onSaveNew(buildPayload());
        setForm((p) => ({
          ...RULE_EMPTY,
          priceType: p.priceType,
          discountType: p.discountType,
          bundleDiscountType: p.bundleDiscountType,
        }));
        setSearch('');
        setErrors({});
        searchRef.current?.focus();
      }
    } finally {
      setSaving(null);
    }
  }

  const filtered = products.filter((p: any) =>
    `${p.product?.name || ''} ${p.sku || ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const typeMeta = RULE_TYPE_META[form.priceType] || RULE_TYPE_META.discount;
  const TypeIcon = typeMeta.Icon;
  const hasErrors = Object.keys(errors).length > 0;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onDiscard}
      />

      <div
        className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: '92vh' }}
      >
        {/* ── Top accent bar ── */}
        <div
          className="h-1 w-full shrink-0"
          style={{ backgroundColor: typeMeta.color }}
        />

        {/* ── Header ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: typeMeta.bg, color: typeMeta.color }}
            >
              <TypeIcon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">
                {isEdit ? 'Edit Price Rule' : 'Add Price Rule'}
              </p>
              <p className="text-[11px] text-gray-400">{typeMeta.hint}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <PiX className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* ── Price Type selector ── */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Rule Type
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {Object.entries(RULE_TYPE_META).map(([v, m]) => {
                const active = form.priceType === v;
                const Icon = m.Icon;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => switchType(v)}
                    className={`flex flex-col items-center gap-1 rounded-xl border-2 px-1 py-2.5 text-center transition-all ${active ? 'shadow-sm' : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white'}`}
                    style={
                      active
                        ? { borderColor: m.color, backgroundColor: m.bg }
                        : {}
                    }
                  >
                    <Icon
                      className="h-4 w-4"
                      style={{ color: active ? m.color : '#6b7280' }}
                    />
                    <span
                      className="text-[10px] font-semibold leading-tight"
                      style={{ color: active ? m.color : '#374151' }}
                    >
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Product picker ── */}
          <RuleField
            label="Product"
            hint="Leave blank to apply to all products"
          >
            <div className="relative" ref={dropRef}>
              <div
                className={`flex h-9 items-center overflow-hidden rounded-lg border transition-colors ${showDrop ? 'border-[#b20202] ring-1 ring-[#b20202]/10' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <PiMagnifyingGlass className="ml-3 h-4 w-4 shrink-0 text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={showDrop ? search : dispName}
                  onFocus={() => {
                    setSearch(dispName);
                    setShowDrop(true);
                  }}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowDrop(true);
                  }}
                  placeholder="Search or leave blank for all products…"
                  className="h-full flex-1 border-0 bg-transparent px-2 text-sm text-gray-800 outline-none placeholder:text-gray-400"
                />
                {form.subProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      f('subProduct', '');
                      f('appliedOn', '');
                    }}
                    className="mr-2 shrink-0 text-gray-400 hover:text-gray-600"
                  >
                    <PiX className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {showDrop && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      f('subProduct', '');
                      f('appliedOn', '');
                      setShowDrop(false);
                      setSearch('');
                    }}
                    className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-2.5 text-sm italic text-gray-400 hover:bg-gray-50"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs text-gray-400">
                      ★
                    </span>
                    All products
                  </button>
                  {filtered.slice(0, 50).map((p: any) => {
                    const name = p.product?.name || p.sku;
                    const isSel = form.subProduct === p._id;
                    return (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => {
                          f('subProduct', p._id);
                          f('appliedOn', name);
                          setShowDrop(false);
                          setSearch('');
                        }}
                        className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 ${isSel ? 'bg-[#b20202]/5 font-semibold' : 'text-gray-700'}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div
                            className={`truncate ${isSel ? 'text-[#b20202]' : ''}`}
                          >
                            {name}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-gray-400">
                              {p.sku}
                            </span>
                            {p.costPrice > 0 && (
                              <span className="text-[10px] text-gray-400">
                                cost {fmt(p.costPrice)}
                              </span>
                            )}
                            {p.isOnSale && (
                              <span className="rounded-full bg-emerald-100 px-1.5 py-px text-[9px] font-bold text-emerald-700">
                                On Sale
                              </span>
                            )}
                            {p.flashSale?.isActive && (
                              <span className="rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-bold text-amber-700">
                                ⚡ Flash
                              </span>
                            )}
                            {p.bundleDeals?.length > 0 && (
                              <span className="rounded-full bg-purple-100 px-1.5 py-px text-[9px] font-bold text-purple-700">
                                📦 Bundle
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-600">
                          {fmt(p.baseSellingPrice || 0)}
                        </span>
                      </button>
                    );
                  })}
                  {filtered.length === 0 && (
                    <p className="px-4 py-5 text-center text-xs text-gray-400">
                      No products found
                    </p>
                  )}
                </div>
              )}
            </div>
          </RuleField>

          {/* Conflict warning */}
          {conflict && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800">
              <PiWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              {conflict}
            </div>
          )}

          {/* ── Type-specific value fields ── */}
          <div
            className="space-y-3 rounded-xl border bg-gray-50 p-4"
            style={{ borderColor: typeMeta.border }}
          >
            {/* Fixed Price */}
            {form.priceType === 'fixed' && (
              <RuleField
                label="Selling Price"
                error={errors.fixedPrice}
                hint={basePrice > 0 ? `Current: ${fmt(basePrice)}` : undefined}
              >
                <RuleInput
                  hasError={!!errors.fixedPrice}
                  prefix="₦"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 5000"
                  value={form.fixedPrice}
                  onChange={(e: any) => f('fixedPrice', e.target.value)}
                  autoFocus
                />
              </RuleField>
            )}

            {/* Formula */}
            {form.priceType === 'formula' && (
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
                    onChange={(e: any) => f('markupPercentage', e.target.value)}
                    autoFocus
                  />
                </RuleField>
                {!costPrice && (
                  <div className="flex items-center gap-2 text-[11px] text-amber-700">
                    <PiInfo className="h-3.5 w-3.5 shrink-0" />
                    {form.subProduct
                      ? 'No cost price on this product — rule will be skipped.'
                      : 'Products without a cost price will be skipped when applied.'}
                  </div>
                )}
              </>
            )}

            {/* Discount */}
            {form.priceType === 'discount' && (
              <>
                <Seg
                  options={[
                    ['percentage', '% Off'],
                    ['fixed', '₦ Off'],
                  ]}
                  value={form.discountType}
                  onChange={(v) => f('discountType', v)}
                  activeColor={RULE_TYPE_META.discount.color}
                />
                {form.discountType === 'percentage' ? (
                  <RuleField
                    label="Discount %"
                    error={errors.discountPercentage}
                  >
                    <RuleInput
                      hasError={!!errors.discountPercentage}
                      suffix="%"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="e.g. 15"
                      value={form.discountPercentage}
                      onChange={(e: any) =>
                        f('discountPercentage', e.target.value)
                      }
                      autoFocus
                    />
                    <PctChips
                      value={form.discountPercentage}
                      onChange={(v) => f('discountPercentage', v)}
                      activeColor={RULE_TYPE_META.discount.color}
                    />
                  </RuleField>
                ) : (
                  <RuleField
                    label="Amount Off (₦)"
                    error={errors.discountAmount}
                  >
                    <RuleInput
                      hasError={!!errors.discountAmount}
                      prefix="₦"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 500"
                      value={form.discountAmount}
                      onChange={(e: any) => f('discountAmount', e.target.value)}
                      autoFocus
                    />
                  </RuleField>
                )}
              </>
            )}

            {/* Flash Sale */}
            {form.priceType === 'flash_sale' && (
              <>
                <RuleField
                  label="Flash Discount %"
                  error={errors.flashSalePercentage}
                >
                  <RuleInput
                    hasError={!!errors.flashSalePercentage}
                    suffix="%"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="e.g. 30"
                    value={form.flashSalePercentage}
                    onChange={(e: any) =>
                      f('flashSalePercentage', e.target.value)
                    }
                    autoFocus
                  />
                  <PctChips
                    value={form.flashSalePercentage}
                    onChange={(v) => f('flashSalePercentage', v)}
                    activeColor={RULE_TYPE_META.flash_sale.color}
                  />
                </RuleField>
                <RuleField label="Limited Qty" hint="Leave blank for unlimited">
                  <RuleInput
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 50"
                    value={form.flashSaleQty}
                    onChange={(e: any) => f('flashSaleQty', e.target.value)}
                  />
                </RuleField>
              </>
            )}

            {/* Bundle */}
            {form.priceType === 'bundle' && (
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
                    onChange={(e: any) => f('bundleName', e.target.value)}
                  />
                </RuleField>

                <RuleField
                  label="Min Quantity to Qualify"
                  error={errors.bundleQuantity}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[2, 3, 4, 6, 12, 24].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => f('bundleQuantity', String(q))}
                        className={`h-8 w-8 rounded-lg border text-xs font-bold transition-all ${form.bundleQuantity === String(q) ? 'border-transparent text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300'}`}
                        style={
                          form.bundleQuantity === String(q)
                            ? { backgroundColor: RULE_TYPE_META.bundle.color }
                            : {}
                        }
                      >
                        {q}
                      </button>
                    ))}
                    <input
                      type="number"
                      min="2"
                      step="1"
                      value={form.bundleQuantity}
                      onChange={(e) => f('bundleQuantity', e.target.value)}
                      className="h-8 w-14 rounded-lg border border-gray-200 bg-white px-2 text-center text-sm outline-none focus:border-purple-400"
                    />
                  </div>
                </RuleField>

                {/* Bundle pricing type — 4 options in a 2×2 grid */}
                <RuleField label="Pricing Type">
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        [
                          'percentage',
                          '% Off',
                          'Percentage discount off selling price',
                        ],
                        [
                          'fixed',
                          '₦ Off',
                          'Fixed naira amount off selling price',
                        ],
                        [
                          'markup_on_cost',
                          'Cost + Markup',
                          'Price = cost × (1 + markup%)',
                        ],
                        [
                          'no_discount',
                          'No Discount',
                          'Remove sale/flash discount — charge base price',
                        ],
                      ] as [string, string, string][]
                    ).map(([v, l, hint]) => {
                      const active = form.bundleDiscountType === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => f('bundleDiscountType', v)}
                          className={`flex flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-2 text-left transition-all ${active ? 'shadow-sm' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}
                          style={
                            active
                              ? {
                                  borderColor: RULE_TYPE_META.bundle.color,
                                  backgroundColor: '#faf5ff',
                                }
                              : {}
                          }
                        >
                          <span
                            className="text-xs font-bold"
                            style={{
                              color: active
                                ? RULE_TYPE_META.bundle.color
                                : '#374151',
                            }}
                          >
                            {l}
                          </span>
                          <span className="text-[10px] leading-tight text-gray-400">
                            {hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </RuleField>

                {/* Value field — hidden for no_discount */}
                {form.bundleDiscountType !== 'no_discount' && (
                  <RuleField
                    label={
                      form.bundleDiscountType === 'markup_on_cost'
                        ? 'Markup %'
                        : 'Discount'
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
                      prefix={
                        form.bundleDiscountType === 'fixed' ? '₦' : undefined
                      }
                      suffix={
                        form.bundleDiscountType !== 'fixed' ? '%' : undefined
                      }
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
                      onChange={(e: any) => f('bundleDiscount', e.target.value)}
                    />
                    {(form.bundleDiscountType === 'percentage' ||
                      form.bundleDiscountType === 'markup_on_cost') && (
                      <PctChips
                        value={form.bundleDiscount}
                        onChange={(v) => f('bundleDiscount', v)}
                        activeColor={RULE_TYPE_META.bundle.color}
                      />
                    )}
                  </RuleField>
                )}

                {form.bundleDiscountType === 'no_discount' && (
                  <div className="flex items-start gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2.5 text-[11px] text-purple-800">
                    <PiInfo className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" />
                    Customers buying {form.bundleQuantity || 2}+ units will be
                    charged the base selling price — any active sale or
                    flash-sale discount is removed.
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Shared: Min Qty + Validity ── */}
          <div className="grid grid-cols-3 gap-3">
            <RuleField label="Min Order Qty" hint="0 = any quantity">
              <RuleInput
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={form.minQuantity}
                onChange={(e: any) => f('minQuantity', e.target.value)}
              />
            </RuleField>
            <RuleField label="Valid From">
              <input
                type="date"
                min={today}
                value={form.startDate}
                onChange={(e) => f('startDate', e.target.value)}
                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#b20202]"
              />
            </RuleField>
            <RuleField label="Valid Until" error={errors.endDate}>
              <input
                type="date"
                min={form.startDate || today}
                value={form.endDate}
                onChange={(e) => f('endDate', e.target.value)}
                className={`h-9 w-full rounded-lg border bg-white px-3 text-sm outline-none ${errors.endDate ? 'border-red-400' : 'border-gray-200 focus:border-[#b20202]'}`}
              />
            </RuleField>
          </div>

          {/* ── Live preview (always last in scroll) ── */}
          {preview && !preview.noValue ? (
            <div
              className="flex items-center justify-between rounded-xl border-2 px-4 py-3 transition-all"
              style={{
                borderColor: typeMeta.border,
                backgroundColor: typeMeta.bg,
              }}
            >
              <div>
                <p
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: typeMeta.color }}
                >
                  {preview.label}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  {preview.sub}
                </p>
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
              <p
                className="text-2xl font-black tabular-nums"
                style={{ color: typeMeta.color }}
              >
                {fmt(preview.value)}
              </p>
            </div>
          ) : preview?.noValue ? (
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[11px] text-gray-400">
              <PiInfo className="h-4 w-4 shrink-0" />
              {preview.sub}
            </div>
          ) : null}

          {/* All-products notice */}
          {!form.subProduct && (
            <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[11px] text-blue-700">
              <PiInfo className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
              <span>
                No product selected — this rule will apply to{' '}
                <strong>all products</strong> when the pricelist is applied.
              </span>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex shrink-0 items-center gap-2 border-t border-gray-100 bg-white px-5 py-3">
          {/* Primary: Save */}
          <button
            type="button"
            onClick={() => handle('close')}
            disabled={!!saving}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#b20202' }}
          >
            {saving === 'close' && (
              <PiSpinner className="h-3.5 w-3.5 animate-spin" />
            )}
            {isEdit ? 'Save Changes' : 'Save & Close'}
          </button>
          {/* Save & New — only in create mode */}
          {!isEdit && (
            <button
              type="button"
              onClick={() => handle('new')}
              disabled={!!saving}
              className="flex items-center gap-1.5 rounded-lg border-2 px-4 py-2 text-sm font-bold transition-colors hover:bg-opacity-10 disabled:opacity-50"
              style={{ borderColor: '#b20202', color: '#b20202' }}
            >
              {saving === 'new' && (
                <PiSpinner className="h-3.5 w-3.5 animate-spin" />
              )}
              Save &amp; New
            </button>
          )}
          {/* Discard */}
          <button
            type="button"
            onClick={onDiscard}
            disabled={!!saving}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
          >
            {isEdit ? 'Cancel' : 'Discard'}
          </button>
          {hasErrors && (
            <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-red-500">
              <PiWarning className="h-3.5 w-3.5" />
              {Object.keys(errors).length} error
              {Object.keys(errors).length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL PANEL  — right-side detail matching POS orders OrderDetail style
// ─────────────────────────────────────────────────────────────────────────────
// ── Rule status helper ────────────────────────────────────────────────────────
function ruleStatus(r: any): { label: string; cls: string } {
  const now = new Date();
  if (r.endDate && new Date(r.endDate) < now)
    return { label: 'Expired', cls: 'bg-red-50 text-red-500' };
  if (r.startDate && new Date(r.startDate) > now)
    return { label: 'Pending', cls: 'bg-blue-50 text-blue-600' };
  if (r.startDate || r.endDate)
    return { label: 'Active', cls: 'bg-emerald-50 text-emerald-700' };
  return { label: 'Always', cls: 'bg-gray-100 text-gray-500' };
}

// ── Rule card ─────────────────────────────────────────────────────────────────
function ruleDescription(rule: any): string {
  switch (rule.priceType) {
    case 'fixed':
      return `Sets selling price → ${fmt(rule.fixedPrice || 0)}`;
    case 'formula':
      return `Price = cost × (1 + ${rule.markupPercentage || 0}% markup)`;
    case 'discount':
      if (rule.discountType === 'fixed')
        return `-₦${Number(rule.discountAmount || 0).toFixed(2)} off selling price`;
      return `${rule.discountPercentage || 0}% off selling price`;
    case 'flash_sale': {
      const qty = rule.flashSaleQty > 0 ? ` · ${rule.flashSaleQty} units` : '';
      return `⚡ ${rule.flashSalePercentage || 0}% flash sale${qty}`;
    }
    case 'bundle': {
      const qty = rule.bundleQuantity || 2;
      const dt = rule.bundleDiscountType;
      if (dt === 'markup_on_cost')
        return `Buy ${qty}+ → Cost +${rule.bundleDiscount || 0}% markup`;
      if (dt === 'no_discount') return `Buy ${qty}+ → No discount (base price)`;
      if (dt === 'fixed')
        return `Buy ${qty}+ → -₦${Number(rule.bundleDiscount || 0).toFixed(0)} per unit`;
      return `Buy ${qty}+ → ${rule.bundleDiscount || 0}% off`;
    }
    default:
      return '—';
  }
}

function RuleCard({
  rule,
  onDelete,
  onEdit,
  deleting,
  sequenceIndex,
  totalRules,
  onMoveUp,
  onMoveDown,
}: {
  rule: any;
  deleting: boolean;
  sequenceIndex: number;
  totalRules: number;
  onDelete: () => void;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const meta = RULE_TYPE_META[rule.priceType] || RULE_TYPE_META.discount;
  const Icon = meta.Icon;
  const sp = rule.subProduct;
  const status = ruleStatus(rule);
  const isExpired = status.label === 'Expired';

  // "All products" when subProduct is absent AND appliedOn is blank or literally 'All products'
  const isAllProducts =
    !sp && (!rule.appliedOn || rule.appliedOn === 'All products');
  const productName = isAllProducts
    ? null
    : rule.appliedOn || sp?.product?.name || sp?.sku;

  const desc = ruleDescription(rule);

  // Constraints line
  const constraints: string[] = [];
  if (rule.minQuantity > 0) constraints.push(`min qty ${rule.minQuantity}`);
  if (rule.startDate || rule.endDate) {
    constraints.push(
      `${rule.startDate ? fmtDate(rule.startDate) : '∞'} → ${rule.endDate ? fmtDate(rule.endDate) : '∞'}`
    );
  }

  // Current product promotion state (only for specific-product rules)
  const hasProductState =
    sp &&
    (sp.flashSale?.isActive ||
      (sp.isOnSale && sp.saleDiscountValue > 0) ||
      sp.bundleDeals?.length > 0 ||
      sp.baseSellingPrice > 0);

  return (
    <div
      className={`group relative flex gap-3 border-b border-gray-100 px-4 py-3.5 transition-colors hover:bg-gray-50/60 ${isExpired ? 'opacity-40' : ''}`}
    >
      {/* Coloured left bar */}
      <div
        className="absolute inset-y-0 left-0 w-1 rounded-r"
        style={{ backgroundColor: meta.color }}
      />

      {/* Type icon */}
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: meta.bg }}
      >
        <Icon className="h-4 w-4" style={{ color: meta.color }} />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        {/* Row 1: type badge + product + status */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-500">
            #{sequenceIndex + 1}
          </span>
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: meta.bg, color: meta.color }}
          >
            {meta.label}
          </span>
          {isAllProducts ? (
            <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
              All products
            </span>
          ) : productName ? (
            <span className="truncate text-xs font-semibold text-gray-800">
              {productName}
            </span>
          ) : null}
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${status.cls}`}
          >
            {status.label}
          </span>
        </div>

        {/* Row 2: full rule description */}
        <p className="text-[11px] font-medium text-gray-700">{desc}</p>

        {/* Row 3: constraints (dates + min qty) */}
        {constraints.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {constraints.map((c, i) => (
              <span
                key={i}
                className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500"
              >
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Row 4: current product promotion state */}
        {hasProductState && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-300">
              Now:
            </span>
            <span className="rounded bg-gray-50 px-1.5 py-0.5 text-[10px] tabular-nums text-gray-500">
              Base {fmt(sp.baseSellingPrice || 0)}
            </span>
            {sp.flashSale?.isActive && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                ⚡ {sp.flashSale.discountPercentage}% flash active
              </span>
            )}
            {!sp.flashSale?.isActive &&
              sp.isOnSale &&
              sp.saleDiscountValue > 0 && (
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  {sp.saleType === 'fixed'
                    ? `-₦${sp.saleDiscountValue}`
                    : `${sp.saleDiscountValue}% off`}{' '}
                  active
                </span>
              )}
            {sp.bundleDeals?.length > 0 && (
              <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
                📦 {sp.bundleDeals.length} bundle deal
                {sp.bundleDeals.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* fixed/formula revert note */}
        {(rule.priceType === 'fixed' || rule.priceType === 'formula') && (
          <p className="text-[10px] italic text-gray-400">
            Deleting this rule won't revert the base price — apply a new rule or
            update manually.
          </p>
        )}
      </div>

      {/* Hover actions */}
      <div className="flex shrink-0 items-start gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={sequenceIndex === 0}
          title="Move up (higher priority)"
          className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-20"
        >
          <PiArrowUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={sequenceIndex === totalRules - 1}
          title="Move down (lower priority)"
          className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-20"
        >
          <PiArrowDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700"
        >
          <PiPencilSimple className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
        >
          {deleting ? (
            <PiSpinner className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PiTrash className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICELIST PANEL
// ─────────────────────────────────────────────────────────────────────────────
function PricelistPanel({ pl, token, onClose, onRefresh }) {
  const [tab, setTab] = useState<'rules' | 'ecommerce'>('rules');
  const [name, setName] = useState(pl?.name || '');
  const [currency, setCurrency] = useState(pl?.currency || 'NGN');
  const [website, setWebsite] = useState(pl?.website || '');
  const [selectable, setSelectable] = useState(!!pl?.isSelectable);
  // ── Resolution bindings ──
  const [boundShops, setBoundShops] = useState<string[]>(pl?.shops || []);
  const [boundWarehouses, setBoundWarehouses] = useState<string[]>(
    (pl?.warehouses || []).map(String)
  );
  const [isDefault, setIsDefault] = useState(!!pl?.isDefault);
  const [shopOptions, setShopOptions] = useState<
    { _id: string; name: string }[]
  >([]);
  const [whOptions, setWhOptions] = useState<{ _id: string; name: string }[]>(
    []
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editRule, setEditRule] = useState<any>(null);
  const [reordering, setReordering] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE = 40;

  // Sync local meta fields when pl changes, but ONLY if the user isn't mid-edit
  // Use a ref to track if meta is currently dirty so we don't wipe unsaved edits
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    // Don't overwrite if user is editing — only sync on initial load or pricelist switch
    if (!dirtyRef.current) {
      setName(pl?.name || '');
      setCurrency(pl?.currency || 'NGN');
      setWebsite(pl?.website || '');
      setSelectable(!!pl?.isSelectable);
      setBoundShops(pl?.shops || []);
      setBoundWarehouses((pl?.warehouses || []).map(String));
      setIsDefault(!!pl?.isDefault);
    }
  }, [pl?._id]); // only re-sync when the pricelist ID changes, not on every rule update

  // Load shop + warehouse options for the binding selectors (once per panel).
  useEffect(() => {
    if (!token) return;
    const builtins = [
      { _id: 'retail', name: 'Retail (built-in)' },
      { _id: 'wholesale', name: 'Wholesale (built-in)' },
    ];
    posApi
      .listShops(token)
      .then((r: any) => {
        const custom = (r?.shops || []).map((s: any) => ({
          _id: String(s._id),
          name: s.name,
        }));
        setShopOptions([...builtins, ...custom]);
      })
      .catch(() => setShopOptions(builtins));
    warehouseService
      .getWarehouses(token, { isActive: true })
      .then((r: any) => {
        const list = r?.warehouses ?? r?.data?.warehouses ?? r ?? [];
        setWhOptions(
          list.map((w: any) => ({ _id: String(w._id), name: w.name }))
        );
      })
      .catch(() => setWhOptions([]));
  }, [token]);

  // Eagerly load products when panel mounts (not waiting for modal open)
  useEffect(() => {
    if (!token || products.length > 0) return;
    setProductsLoading(true);
    subproductService
      .getSubProducts(token, { limit: 500 })
      .then((r) => setProducts(r?.data?.subProducts || r?.subProducts || []))
      .catch(() => {})
      .finally(() => setProductsLoading(false));
  }, [token]);

  async function saveMeta() {
    setSaving(true);
    try {
      await pricelistService.update(
        pl._id,
        {
          name,
          currency,
          website,
          isSelectable: selectable,
          shops: boundShops,
          warehouses: boundWarehouses,
          isDefault,
        },
        token
      );
      toast.success('Pricelist saved');
      setDirty(false);
      dirtyRef.current = false;
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleApply() {
    const rules = pl?.rules || [];
    const activeRules = rules.filter((r: any) => {
      if (r.endDate && new Date(r.endDate) < new Date()) return false;
      return true;
    });
    if (activeRules.length === 0) {
      toast.error('No active rules to apply');
      return;
    }
    setApplying(true);
    try {
      const res = await pricelistService.apply(pl._id, token);
      const d = res.data;
      toast.success(
        d.message ||
          `${d.modified} product${d.modified === 1 ? '' : 's'} updated`
      );
      if (d.skipped > 0)
        toast(`${d.skipped} rule${d.skipped === 1 ? '' : 's'} skipped`, {
          icon: '⚠️',
        });
      if (d.errors?.length > 0)
        toast.error(
          `${d.errors.length} rule${d.errors.length === 1 ? '' : 's'} failed`
        );
      onRefresh(); // refresh to show updated product state in rule cards
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setApplying(false);
    }
  }

  async function saveRule(rule: any, keepOpen: boolean) {
    try {
      await pricelistService.addRule(pl._id, rule, token);
      toast.success('Rule added');
      if (!keepOpen) setShowModal(false);
      // Refresh rules without wiping meta edit state
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
      throw e;
    }
  }

  async function saveEditedRule(ruleId: string, rule: any) {
    try {
      await pricelistService.updateRule(pl._id, ruleId, rule, token);
      toast.success('Rule updated');
      setEditRule(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
      throw e;
    }
  }

  async function deleteRule(ruleId: string) {
    setDeleting(ruleId);
    try {
      await pricelistService.deleteRule(pl._id, ruleId, token);
      toast.success('Rule removed');
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(null);
    }
  }

  async function moveRule(ruleId: string, direction: 'up' | 'down') {
    const currentRules = [...(pl?.rules || [])];
    const idx = currentRules.findIndex((r: any) => r._id === ruleId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= currentRules.length) return;

    // Swap
    [currentRules[idx], currentRules[swapIdx]] = [
      currentRules[swapIdx],
      currentRules[idx],
    ];
    const orderedIds = currentRules.map((r: any) => r._id);

    setReordering(true);
    try {
      await pricelistService.reorderRules(pl._id, orderedIds, token);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setReordering(false);
    }
  }

  const rules = pl?.rules || [];
  const pageRules = rules.slice((page - 1) * PAGE, page * PAGE);
  const totalPages = Math.max(1, Math.ceil(rules.length / PAGE));

  // Rule counts by status
  const now = new Date();
  const expiredCount = rules.filter(
    (r: any) => r.endDate && new Date(r.endDate) < now
  ).length;
  const activeCount = rules.length - expiredCount;

  return (
    <div className="flex h-full flex-col bg-white">
      {/* ── Panel header ── */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
              className="min-w-0 flex-1 truncate bg-transparent text-sm font-bold text-gray-900 outline-none focus:text-gray-700"
              placeholder="Pricelist name"
            />
            {pl?.isSelectable && !dirty && (
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                Selectable
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[10px] text-gray-400">
            {pl?.currency || 'NGN'} · {activeCount} rule
            {activeCount !== 1 ? 's' : ''}
            {expiredCount > 0 ? ` · ${expiredCount} expired` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {dirty && (
            <button
              type="button"
              onClick={saveMeta}
              disabled={saving}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#b20202' }}
            >
              {saving ? (
                <PiSpinner className="h-3 w-3 animate-spin" />
              ) : (
                <PiFloppyDisk className="h-3 w-3" />
              )}
              Save
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Pricelist meta (collapsed row) ── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 bg-gray-50/50 px-4 py-2 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">Currency</span>
          <select
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value);
              setDirty(true);
            }}
            className="border-0 bg-transparent text-xs font-semibold text-gray-700 outline-none"
          >
            <option>NGN</option>
            <option>USD</option>
            <option>EUR</option>
            <option>GBP</option>
          </select>
        </div>
        <div className="h-3 w-px bg-gray-200" />
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="shrink-0 text-gray-400">Website</span>
          <input
            value={website}
            onChange={(e) => {
              setWebsite(e.target.value);
              setDirty(true);
            }}
            className="min-w-0 flex-1 border-0 bg-transparent text-xs font-semibold text-gray-700 outline-none placeholder:font-normal placeholder:text-gray-300"
            placeholder="None"
          />
        </div>
        <div className="h-3 w-px bg-gray-200" />
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={selectable}
            onChange={(e) => {
              setSelectable(e.target.checked);
              setDirty(true);
            }}
            className="h-3.5 w-3.5 rounded accent-[#b20202]"
          />
          <span className="text-gray-500">Selectable</span>
        </label>
        <div className="h-3 w-px bg-gray-200" />
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => {
              setIsDefault(e.target.checked);
              setDirty(true);
            }}
            className="h-3.5 w-3.5 rounded accent-[#b20202]"
          />
          <span className="text-gray-500">Default</span>
        </label>
      </div>

      {/* ── Resolution bindings: shops + warehouses ── */}
      <div className="flex shrink-0 flex-wrap items-start gap-x-6 gap-y-2 border-b border-gray-100 px-4 py-2.5 text-[11px]">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Applies to shops
          </span>
          <div className="flex flex-wrap gap-1.5">
            {shopOptions.length === 0 && (
              <span className="text-gray-300">No shops</span>
            )}
            {shopOptions.map((s) => {
              const on = boundShops.includes(s._id);
              return (
                <button
                  key={s._id}
                  type="button"
                  onClick={() => {
                    setBoundShops((prev) =>
                      on ? prev.filter((x) => x !== s._id) : [...prev, s._id]
                    );
                    setDirty(true);
                  }}
                  className={`rounded-full border px-2 py-0.5 font-semibold transition-colors ${on ? 'border-[#b20202] bg-[#b20202]/5 text-[#b20202]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Applies to warehouses
          </span>
          <div className="flex flex-wrap gap-1.5">
            {whOptions.length === 0 && (
              <span className="text-gray-300">No warehouses</span>
            )}
            {whOptions.map((w) => {
              const on = boundWarehouses.includes(w._id);
              return (
                <button
                  key={w._id}
                  type="button"
                  onClick={() => {
                    setBoundWarehouses((prev) =>
                      on ? prev.filter((x) => x !== w._id) : [...prev, w._id]
                    );
                    setDirty(true);
                  }}
                  className={`rounded-full border px-2 py-0.5 font-semibold transition-colors ${on ? 'border-[#b20202] bg-[#b20202]/5 text-[#b20202]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                >
                  {w.name}
                </button>
              );
            })}
          </div>
        </div>
        {boundShops.length === 0 &&
          boundWarehouses.length === 0 &&
          selectable && (
            <span className="self-center text-[10px] italic text-gray-400">
              Unscoped — offered everywhere as a manual option.
            </span>
          )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex shrink-0 border-b border-gray-100 text-xs font-semibold">
        {(['rules', 'ecommerce'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex flex-1 items-center justify-center py-2.5 capitalize transition-colors ${
              tab === t
                ? 'border-b-2 border-[#b20202] text-[#b20202]'
                : 'border-b-2 border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t === 'rules'
              ? `Price Rules${rules.length > 0 ? ` (${rules.length})` : ''}`
              : 'Ecommerce'}
          </button>
        ))}
      </div>

      {/* ── Price Rules tab ── */}
      {tab === 'rules' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-4 py-2">
            {/* Apply button — only fixed/formula rules update base prices */}
            <button
              type="button"
              onClick={handleApply}
              disabled={applying || rules.length === 0}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: '#b20202' }}
            >
              {applying ? (
                <PiSpinner className="h-3 w-3 animate-spin" />
              ) : (
                <PiLightning className="h-3 w-3" />
              )}
              Apply prices
            </button>
            <span
              className="text-[10px] text-gray-400"
              title="Fixed & formula rules update the product base price permanently. Discount, flash sale, and bundle rules are dynamic — they activate when this pricelist is selected in a POS session."
            >
              fixed & formula only · discount/bundle rules are session-dynamic
            </span>
            <div className="ml-auto flex items-center gap-1 text-[10px] text-gray-400">
              <PiArrowUp className="h-3 w-3" />
              <PiArrowDown className="h-3 w-3" />
              <span>drag priority</span>
            </div>

            {/* Add rule */}
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1 rounded-lg border border-dashed px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-[#b20202] hover:text-[#b20202]"
              style={{ borderColor: '#e5e7eb' }}
            >
              <PiPlus className="h-3.5 w-3.5" />
              Add rule
            </button>
          </div>

          {/* Rules list */}
          <div className="flex-1 overflow-y-auto">
            {productsLoading && rules.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-gray-400">
                <PiSpinner className="h-4 w-4 animate-spin" /> Loading products…
              </div>
            ) : rules.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                  <PiTag className="h-6 w-6 text-gray-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-500">
                    No price rules yet
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    Click "Add rule" to create your first rule
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white"
                  style={{ backgroundColor: '#b20202' }}
                >
                  <PiPlus className="h-3.5 w-3.5" /> Add first rule
                </button>
              </div>
            ) : (
              <>
                {rules.length > PAGE && (
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-1.5 text-[10px] text-gray-400">
                    <span>
                      {(page - 1) * PAGE + 1}–
                      {Math.min(page * PAGE, rules.length)} of {rules.length}
                    </span>
                    <div className="flex gap-0.5">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30"
                      >
                        <PiCaretLeft className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={page >= totalPages}
                        className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30"
                      >
                        <PiCaretRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  {pageRules.map((r: any, idx: number) => (
                    <RuleCard
                      key={r._id}
                      rule={r}
                      deleting={deleting === r._id}
                      sequenceIndex={(page - 1) * PAGE + idx}
                      totalRules={rules.length}
                      onDelete={() => deleteRule(r._id)}
                      onEdit={() => setEditRule(r)}
                      onMoveUp={() => moveRule(r._id, 'up')}
                      onMoveDown={() => moveRule(r._id, 'down')}
                    />
                  ))}
                </div>
                {expiredCount > 0 && (
                  <p className="px-4 py-2 text-center text-[10px] text-gray-400">
                    {expiredCount} expired rule{expiredCount !== 1 ? 's' : ''}{' '}
                    above — they are skipped when applying
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'ecommerce' && (
        <div className="flex flex-1 items-center justify-center text-xs text-gray-400">
          Ecommerce settings coming soon
        </div>
      )}

      {/* Add rule modal */}
      {showModal && (
        <CreateRuleModal
          token={token}
          products={products}
          onSave={async (r) => {
            await saveRule(r, false);
          }}
          onSaveNew={async (r) => {
            await saveRule(r, true);
          }}
          onDiscard={() => setShowModal(false)}
        />
      )}

      {/* Edit rule modal — same modal, pre-filled with rule data */}
      {editRule && (
        <CreateRuleModal
          token={token}
          products={products}
          initialValues={editRule}
          onSave={async (r) => {
            await saveEditedRule(editRule._id, r);
          }}
          onSaveNew={async (r) => {
            await saveEditedRule(editRule._id, r);
          }}
          onDiscard={() => setEditRule(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE — full-screen, exact POS orders layout
// ─────────────────────────────────────────────────────────────────────────────
export default function POSPricelists() {
  const { data: session } = useSession();
  const token = session?.user?.token;

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'selectable' | 'website'>('all');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const PAGE = 50;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await pricelistService.list(token, {
        search,
        page,
        limit: PAGE,
      });
      setRows(res.data.pricelists);
      setTotal(res.data.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  // filter client-side for status pill
  const filtered = rows.filter((pl) => {
    if (status === 'selectable') return !!pl.isSelectable;
    if (status === 'website') return !!pl.website;
    return true;
  });

  const displayList = filtered;
  const allChecked =
    displayList.length > 0 && displayList.every((p) => checked.has(p._id));
  const someChecked = checked.size > 0 && !allChecked;
  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(displayList.map((p) => p._id)));
  }
  function toggleOne(id: string) {
    setChecked((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE));

  async function handleCreate() {
    if (!newName.trim()) {
      toast.error('Enter a name');
      return;
    }
    try {
      const res = await pricelistService.create(
        { name: newName.trim() },
        token
      );
      toast.success('Pricelist created');
      setNewName('');
      setCreating(false);
      setSelected(res.data);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(id: string) {
    try {
      await pricelistService.delete(id, token);
      toast.success('Deleted');
      if (selected?._id === id) setSelected(null);
      setChecked((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDeleteSelected() {
    for (const id of checked) await handleDelete(id);
    setChecked(new Set());
  }

  // re-fetch + update selected when rules change
  async function refreshSelected() {
    load();
    if (selected) {
      try {
        const res = await pricelistService.get(selected._id, token);
        setSelected(res.data);
      } catch {}
    }
  }

  const totalSelectable = rows.filter((p) => p.isSelectable).length;
  const totalWebsite = rows.filter((p) => p.website).length;

  return (
    <div className="flex h-dvh flex-col bg-gray-50">
      <POSNavHeader />

      {/* ── Top bar ── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
        {/* New button */}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
          style={{ backgroundColor: '#b20202' }}
        >
          <PiPlus className="h-3.5 w-3.5" /> New
        </button>

        <div>
          <h1 className="text-base font-bold text-gray-900">Pricelists</h1>
          <p className="text-[11px] text-gray-400">
            {total} total · {filtered.length} shown
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md flex-1">
          <div
            className={`flex overflow-hidden rounded-xl border bg-white transition-all ${search ? 'border-[#b20202] ring-1 ring-[#b20202]/10' : 'border-gray-200'}`}
          >
            <div className="relative flex-1">
              <PiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search pricelists…"
                className="h-9 w-full bg-transparent pl-9 pr-2 text-sm outline-none"
              />
            </div>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="flex items-center px-2 text-gray-400 hover:text-gray-600"
              >
                <PiX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Status pills */}
        <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-0.5 text-xs font-semibold">
          {(
            [
              ['all', 'All'],
              ['selectable', 'Selectable'],
              ['website', 'Has Website'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setStatus(k)}
              className={`rounded-lg px-3 py-1.5 capitalize transition-all ${status === k ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              style={status === k ? { backgroundColor: '#b20202' } : {}}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex shrink-0 items-center gap-1 text-xs text-gray-500">
          <span className="px-1">
            {page}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
          >
            <PiCaretLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
          >
            <PiCaretRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:bg-gray-50 disabled:opacity-40"
        >
          <PiArrowsClockwise
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {/* ── Stats strip ── */}
      <div className="flex shrink-0 divide-x divide-gray-100 border-b border-gray-200 bg-white">
        {[
          {
            label: 'Total',
            value: String(rows.length),
            icon: <PiTag className="h-4 w-4" />,
          },
          {
            label: 'Selectable',
            value: String(totalSelectable),
            icon: <PiReceipt className="h-4 w-4" />,
            red: true,
          },
          {
            label: 'With Website',
            value: String(totalWebsite),
            icon: <PiSealPercent className="h-4 w-4" />,
          },
          {
            label: 'Currencies',
            value: String(new Set(rows.map((r) => r.currency || 'NGN')).size),
            icon: <PiInfo className="h-4 w-4" />,
          },
        ].map(({ label, value, icon, red }) => (
          <div key={label} className="flex flex-1 items-center gap-3 px-5 py-3">
            <span style={red ? { color: '#b20202' } : { color: '#9ca3af' }}>
              {icon}
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {label}
              </p>
              <p
                className="text-sm font-bold tabular-nums"
                style={red ? { color: '#b20202' } : { color: '#111827' }}
              >
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Table */}
        <div
          className={`flex flex-col overflow-hidden border-r border-gray-200 transition-all duration-200 ${selected ? 'w-[55%]' : 'flex-1'}`}
        >
          {/* Selection bar */}
          {checked.size > 0 && (
            <div
              className="flex shrink-0 items-center gap-3 bg-white px-4 py-2.5"
              style={{ borderBottom: '2px solid #b20202' }}
            >
              <div className="flex-1 text-xs font-semibold text-gray-700">
                <span className="font-bold" style={{ color: '#b20202' }}>
                  {checked.size}
                </span>{' '}
                selected
              </div>
              <button
                type="button"
                onClick={() => setChecked(new Set())}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                style={{ backgroundColor: '#b20202' }}
              >
                <PiTrash className="h-3.5 w-3.5" /> Delete{' '}
                {checked.size > 1 ? `${checked.size} items` : 'item'}
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#b20202]" />
            </div>
          ) : error ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-red-500">
              <PiWarningCircle className="h-5 w-5 shrink-0" /> {error}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_#e5e7eb]">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="w-8 px-2 py-3 text-center">
                      <button
                        type="button"
                        onClick={toggleAll}
                        className="text-gray-400 hover:text-[#b20202]"
                      >
                        {allChecked ? (
                          <PiCheckSquare className="h-4 w-4 text-[#b20202]" />
                        ) : someChecked ? (
                          <PiCheckSquare className="h-4 w-4 text-gray-400" />
                        ) : (
                          <PiSquare className="h-4 w-4" />
                        )}
                      </button>
                    </th>
                    <th className="w-6 px-1 py-3" />
                    <th className="px-3 py-3 text-left">Pricelist Name</th>
                    <th className="px-3 py-3 text-left">Country Groups</th>
                    <th className="px-3 py-3 text-left">Currency</th>
                    <th className="px-3 py-3 text-center">Selectable</th>
                    <th className="px-3 py-3 text-left">Website</th>
                    <th className="w-8 px-2 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {/* Inline create row */}
                  {creating && (
                    <tr className="border-b border-gray-100 bg-[#b20202]/5">
                      <td className="px-2 py-2.5" />
                      <td className="px-1 py-2.5" />
                      <td className="px-3 py-2.5" colSpan={5}>
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCreate();
                              if (e.key === 'Escape') {
                                setCreating(false);
                                setNewName('');
                              }
                            }}
                            placeholder="New pricelist name…"
                            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#b20202]"
                          />
                          <button
                            type="button"
                            onClick={handleCreate}
                            className="rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                            style={{ backgroundColor: '#b20202' }}
                          >
                            Create
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCreating(false);
                              setNewName('');
                            }}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-2.5" />
                    </tr>
                  )}

                  {displayList.length === 0 && !creating ? (
                    <tr>
                      <td colSpan={8} className="py-20 text-center">
                        <PiTag className="mx-auto mb-3 h-10 w-10 text-gray-200" />
                        <p className="text-sm text-gray-400">
                          No pricelists — click New to create one
                        </p>
                      </td>
                    </tr>
                  ) : (
                    displayList.map((pl) => {
                      const isChk = checked.has(pl._id);
                      const isSel = selected?._id === pl._id;
                      return (
                        <tr
                          key={pl._id}
                          className={`cursor-pointer border-b border-gray-100 transition-colors ${isSel ? 'text-white' : '' + isChk ? 'bg-[#b20202]/5' : 'bg-white hover:bg-gray-50'}`}
                          style={
                            isSel
                              ? { backgroundColor: '#b20202' }
                              : isChk
                                ? { borderLeft: '2px solid #b20202' }
                                : { borderLeft: '2px solid transparent' }
                          }
                          onClick={() => setSelected(isSel ? null : pl)}
                        >
                          <td
                            className="w-8 px-2 py-2.5 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => toggleOne(pl._id)}
                              className="text-gray-400 hover:text-[#b20202]"
                            >
                              {isChk ? (
                                <PiCheckSquare className="h-4 w-4 text-[#b20202]" />
                              ) : (
                                <PiSquare className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                          <td
                            className={`px-1 py-2.5 ${isSel ? 'text-red-200' : 'text-gray-200'}`}
                          >
                            <PiDotsSixVertical className="h-3.5 w-3.5" />
                          </td>
                          <td
                            className={`px-3 py-2.5 font-semibold ${isSel ? 'text-white' : 'text-gray-900'}`}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              {pl.name}
                              {pl.isDefault && (
                                <span
                                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${isSel ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}
                                >
                                  Default
                                </span>
                              )}
                              {((pl.shops || []).length > 0 ||
                                (pl.warehouses || []).length > 0) && (
                                <span
                                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${isSel ? 'bg-white/15 text-red-100' : 'bg-gray-100 text-gray-500'}`}
                                >
                                  {(pl.shops || []).length}s ·{' '}
                                  {(pl.warehouses || []).length}w
                                </span>
                              )}
                            </span>
                          </td>
                          <td
                            className={`px-3 py-2.5 ${isSel ? 'text-red-100' : 'text-gray-500'}`}
                          >
                            {(pl.countryGroups || []).join(', ') || (
                              <span
                                className={
                                  isSel ? 'text-red-200' : 'text-gray-300'
                                }
                              >
                                —
                              </span>
                            )}
                          </td>
                          <td
                            className={`px-3 py-2.5 ${isSel ? 'text-red-100' : 'text-gray-600'}`}
                          >
                            {pl.currency || 'NGN'}
                          </td>
                          <td
                            className="px-3 py-2.5 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {pl.isSelectable ? (
                              <PiCheckSquare
                                className="mx-auto h-4 w-4"
                                style={
                                  isSel
                                    ? { color: '#fff' }
                                    : { color: '#b20202' }
                                }
                              />
                            ) : (
                              <PiSquare
                                className={`mx-auto h-4 w-4 ${isSel ? 'text-red-200' : 'text-gray-300'}`}
                              />
                            )}
                          </td>
                          <td
                            className={`px-3 py-2.5 ${isSel ? 'text-red-100' : 'text-gray-600'}`}
                          >
                            {pl.website || (
                              <span
                                className={
                                  isSel ? 'text-red-200' : 'text-gray-300'
                                }
                              >
                                —
                              </span>
                            )}
                          </td>
                          <td
                            className="w-8 px-2 py-2.5 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleDelete(pl._id)}
                              className={`transition-colors ${isSel ? 'text-white/60 hover:text-white' : 'text-gray-300 hover:text-red-500'}`}
                            >
                              <PiTrash className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination footer */}
          {totalPages > 1 && (
            <div className="flex shrink-0 items-center justify-between border-t border-gray-100 bg-white px-4 py-2.5 text-xs text-gray-500">
              <span>
                Showing {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, total)}{' '}
                of {total}
              </span>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p =
                    totalPages <= 7
                      ? i + 1
                      : i === 0
                        ? 1
                        : i === 6
                          ? totalPages
                          : page - 2 + i;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] font-semibold ${p === page ? 'text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      style={
                        p === page
                          ? {
                              backgroundColor: '#b20202',
                              borderColor: '#b20202',
                            }
                          : {}
                      }
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div
          className={`flex flex-col bg-white transition-all duration-200 ${selected ? 'flex-1 overflow-hidden' : 'w-72 shrink-0'}`}
        >
          {selected ? (
            <PricelistPanel
              pl={selected}
              token={token}
              onClose={() => setSelected(null)}
              onRefresh={refreshSelected}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
                <PiTag className="h-7 w-7 text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-500">
                Select a pricelist
              </p>
              <p className="text-xs text-gray-400">
                Click a row to view and edit rules
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
