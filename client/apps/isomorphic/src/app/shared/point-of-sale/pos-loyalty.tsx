// @ts-nocheck
'use client';

import { useState, useEffect, useId } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  PiArrowLeft, PiPlus, PiTrash, PiFloppyDisk,
  PiStar, PiPercent, PiToggleLeft, PiToggleRight,
  PiWarning, PiPencilSimple, PiX, PiGift,
  PiInfo, PiCaretDown, PiCaretUp, PiCheckCircle,
  PiTag, PiTicket, PiCreditCard, PiLightning,
  PiShoppingCart, PiArrowRight, PiCopy,
  PiCalendar, PiCurrencyNgn, PiMagnifyingGlass, PiPackage,
  PiTrophy, PiCrown, PiClock, PiCoins,
} from 'react-icons/pi';
import { useSession } from 'next-auth/react';
import { routes } from '@/config/routes';
import POSNavHeader from '@/app/shared/point-of-sale/pos-nav-header';
import { posApi } from '@/app/shared/point-of-sale/api';
import { pricelistService } from '@/services/pricelist.service';
import { subproductService } from '@/services/subproduct.service';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import type {
  POSDiscountProgram, POSCoupon, POSDiscountCode, POSPromotion,
  POSBuyXGetY, POSLoyaltyCardConfig, POSLoyaltyTier, POSNextOrderCouponConfig,
  POSDiscountAvailability, POSDiscountRules, POSDiscountReward, POSRewardApplyOn,
  POSApplicableItems,
} from '@/app/shared/point-of-sale/types';

// ── Constants ──────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#b20202','#1d4ed8','#059669','#d97706','#7c3aed','#be185d','#0891b2','#374151',
];

const EXAMPLE_PRICES = [1000, 3000, 5000, 10000];

function calcSaving(type: 'pct'|'fixed', value: number, price: number) {
  if (type === 'pct') return Math.round(price * value / 100);
  return Math.min(value, price);
}

function uid() { return `local-${Date.now()}-${Math.random().toString(36).slice(2,6)}`; }

// ── Shared UI ──────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors
        ${checked ? 'bg-[#b20202]' : 'bg-gray-200'} ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function Field({ label, hint, children, required }: {
  label: string; hint?: string; children: React.ReactNode; required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-400">
        {label}{required && <span className="ml-0.5 text-red-400">*</span>}
        {hint && <span className="ml-1.5 font-normal normal-case text-gray-300">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }) {
  const { hasError, ...rest } = props;
  return (
    <input {...rest}
      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors
        ${hasError ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-[#b20202]'}
        ${rest.className || ''}`}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} rows={props.rows || 2}
      className="w-full resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#b20202]"
    />
  );
}

function TypeToggle({ value, onChange, color }: { value: 'pct'|'fixed'; onChange: (v: 'pct'|'fixed') => void; color?: string }) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-gray-200">
      {([['pct','%'],['fixed','₦']] as const).map(([t, lbl]) => (
        <button key={t} type="button" onClick={() => onChange(t)}
          className={`px-4 py-2.5 text-sm font-bold transition-colors ${value === t ? 'text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          style={value === t ? { backgroundColor: color || '#b20202' } : undefined}
        >{lbl}</button>
      ))}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide
      ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
      {active ? <PiCheckCircle className="h-3 w-3" /> : null}
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function SavingsBadge({ type, value, price, color }: { type: 'pct'|'fixed'; value: number; price: number; color?: string }) {
  const saving = calcSaving(type, value, price);
  return (
    <span className="rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ backgroundColor: color || '#b20202' }}>
      -{formatCurrency(saving)}
    </span>
  );
}

function DateInput({ value, onChange, label, min }: { value?: string; onChange: (v: string) => void; label: string; min?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold text-gray-400">{label}</label>
      <input type="datetime-local" value={value || ''} min={min}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#b20202]"
      />
    </div>
  );
}

// ── Generic modal shell ────────────────────────────────────────────────────────

function ModalShell({ title, headerBg, onClose, onSave, saveLabel, children }: {
  title: string; headerBg?: string; onClose: () => void;
  onSave: () => void; saveLabel?: string; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm p-0 sm:items-center sm:p-4">
      <div className="flex w-full sm:w-[80vw] sm:max-w-[80vw] flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl max-h-[90vh]">
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-4"
          style={{ backgroundColor: headerBg || '#b20202' }}>
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30">
            <PiX className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 px-5 py-5">{children}</div>
        </div>
        <div className="flex shrink-0 gap-2 border-t border-gray-100 px-5 py-4">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={onSave}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white hover:opacity-90"
            style={{ backgroundColor: headerBg || '#b20202' }}>
            {saveLabel || 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ icon, title, body, action }: {
  icon: React.ReactNode; title: string; body: string; action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-gray-200 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-gray-600">{title}</p>
        <p className="mt-1 max-w-xs text-xs text-gray-400">{body}</p>
      </div>
      {action}
    </div>
  );
}

// ── List row ───────────────────────────────────────────────────────────────────

function ListRow({ children, faded, onToggle, active, onEdit, onDelete }: {
  children: React.ReactNode; faded?: boolean; active?: boolean;
  onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className={`flex items-center gap-3 border-b border-gray-50 px-5 py-3.5 last:border-0 ${faded ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">{children}</div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={onToggle}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'}`}>
          {active ? <PiToggleRight className="h-5 w-5" /> : <PiToggleLeft className="h-5 w-5" />}
        </button>
        <button type="button" onClick={onEdit}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
          <PiPencilSimple className="h-4 w-4" />
        </button>
        <button type="button" onClick={onDelete}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500">
          <PiTrash className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SectionCard({ icon, color, title, description, count, onAdd, addLabel, children }: {
  icon: React.ReactNode; color: string; title: string; description: string;
  count?: number; onAdd: () => void; addLabel: string; children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: `${color}18` }}>
            <span style={{ color }}>{icon}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">{title}</p>
              {count !== undefined && count > 0 && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: color }}>
                  {count}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">{description}</p>
          </div>
        </div>
        <button type="button" onClick={onAdd}
          className="flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors hover:opacity-90"
          style={{ borderColor: `${color}50`, backgroundColor: `${color}0d`, color }}>
          <PiPlus className="h-3.5 w-3.5" /> {addLabel}
        </button>
      </div>
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARED FORM SECTIONS — used by all four discount modals
// ══════════════════════════════════════════════════════════════════════════════

// Accordion section wrapper
function AccordionSection({ title, icon, open, onToggle, children }: {
  title: string; icon: React.ReactNode; open: boolean;
  onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <button type="button" onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-gray-50">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
          <span className="text-[#b20202]">{icon}</span>
          {title}
        </div>
        {open ? <PiCaretUp className="h-4 w-4 text-gray-400" /> : <PiCaretDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="border-t border-gray-100 px-4 py-4 space-y-4">{children}</div>}
    </div>
  );
}

// ── Pricelist picker (multi-select) ──────────────────────────────────────────
function PricelistPicker({ value, onChange, adminToken }: {
  value: string[]; onChange: (ids: string[]) => void; adminToken?: string;
}) {
  const [pricelists, setPricelists] = useState<{ _id: string; name: string }[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  useEffect(() => {
    if (!adminToken) return;
    setLoading(true);
    pricelistService.list(adminToken)
      .then((d: any) => { setPricelists(d.data?.pricelists || d.pricelists || []); setError(''); })
      .catch(() => setError('Could not load pricelists'))
      .finally(() => setLoading(false));
  }, [adminToken]);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);
  }

  const selectedNames = pricelists.filter(pl => value.includes(pl._id)).map(pl => pl.name);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
          Pricelists
          <span className="ml-1.5 font-normal normal-case text-gray-300">— restrict to these customer groups</span>
        </label>
        {value.length > 0 && (
          <button type="button" onClick={() => onChange([])}
            className="text-[10px] text-gray-400 hover:text-red-500 underline">
            Clear all
          </button>
        )}
      </div>

      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedNames.map(n => (
            <span key={n} className="inline-flex items-center gap-1 rounded-full bg-[#b20202]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#b20202]">
              {n}
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-xs text-gray-400">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-[#b20202]" />
          Loading pricelists…
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-500">
          <PiWarning className="h-4 w-4 shrink-0" /> {error}
        </div>
      ) : pricelists.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-xs text-gray-400">
          No pricelists found — leave empty to apply to all customers
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {pricelists.map(pl => {
            const checked = value.includes(pl._id);
            return (
              <button key={pl._id} type="button" onClick={() => toggle(pl._id)}
                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-colors
                  ${checked
                    ? 'border-[#b20202]/40 bg-red-50/60 ring-1 ring-[#b20202]/30'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}
              >
                <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors
                  ${checked ? 'border-[#b20202] bg-[#b20202]' : 'border-gray-300 bg-white'}`}>
                  {checked && (
                    <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 10">
                      <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className={`text-sm font-semibold leading-tight ${checked ? 'text-[#b20202]' : 'text-gray-800'}`}>
                  {pl.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {value.length === 0 && pricelists.length > 0 && (
        <p className="mt-1.5 text-[10px] text-gray-400">None selected — discount applies to all customers regardless of pricelist</p>
      )}
    </div>
  );
}

// ── Validity & Usage section ──────────────────────────────────────────────────
function ValiditySection({ validFrom, validTo, maxUsage, usageCount, onValidFrom, onValidTo, onMaxUsage, color }: {
  validFrom?: string; validTo?: string; maxUsage?: number; usageCount?: number;
  onValidFrom: (v: string) => void; onValidTo: (v: string) => void;
  onMaxUsage: (v: number) => void; color?: string;
}) {
  const limitEnabled = (maxUsage ?? 0) > 0;
  const accentColor  = color || '#b20202';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <DateInput label="Start date" value={validFrom} onChange={onValidFrom} />
        <DateInput label="End date" value={validTo} onChange={onValidTo} min={validFrom} />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Limit usage</span>
          <Toggle
            checked={limitEnabled}
            onChange={v => onMaxUsage(v ? 1 : 0)}
          />
        </div>
        {limitEnabled && (
          <div className="flex items-center gap-2">
            <input type="number" min={1} value={maxUsage || 1} onChange={e => onMaxUsage(parseInt(e.target.value)||1)}
              className="w-28 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-center outline-none"
              style={{ borderColor: limitEnabled ? accentColor : undefined }}
            />
            <span className="text-sm text-gray-500">total uses allowed</span>
            {(usageCount ?? 0) > 0 && (
              <span className="ml-auto text-xs text-gray-400">{usageCount} used so far</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Item picker (products / categories / brands) ─────────────────────────────
type PickItem = { id: string; name: string; image?: string; indent?: number };
type ItemTab  = 'products' | 'categories' | 'brands';

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors
      ${checked ? 'border-[#b20202] bg-[#b20202]' : 'border-gray-300 bg-white'}`}>
      {checked && (
        <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 10">
          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );
}

function ItemPicker({ value, onChange, adminToken }: {
  value: POSApplicableItems; onChange: (v: POSApplicableItems) => void; adminToken?: string;
}) {
  const [tab,          setTab]          = useState<ItemTab>('products');
  const [productQuery, setProductQuery] = useState('');
  const [brandQuery,   setBrandQuery]   = useState('');
  const [productResults, setProductResults] = useState<PickItem[]>([]);
  const [categories,     setCategories]     = useState<(PickItem & { parent?: string })[]>([]);
  const [brands,         setBrands]         = useState<PickItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingMeta,     setLoadingMeta]     = useState(false);

  const products   = value.products   ?? [];
  const cats       = value.categories ?? [];
  const brandIds   = value.brands     ?? [];

  // Load categories + brands once
  useEffect(() => {
    setLoadingMeta(true);
    Promise.all([
      posApi.getCategories().catch(() => ({ categories: [] })),
      posApi.getBrands({ limit: 200 }).catch(() => ({ brands: [] })),
    ]).then(([catData, brandData]: any[]) => {
      const rawCats = catData?.categories || catData?.data?.categories || [];
      // Build display order: top-level first, then children indented
      const tops = rawCats.filter((c: any) => !c.parent);
      const subs = rawCats.filter((c: any) => !!c.parent);
      const ordered: (PickItem & { parent?: string })[] = [];
      tops.forEach((t: any) => {
        ordered.push({ id: t._id, name: t.name });
        subs.filter((s: any) => s.parent?.toString() === t._id?.toString())
            .forEach((s: any) => ordered.push({ id: s._id, name: s.name, indent: 1, parent: t._id }));
      });
      // any subs whose parent wasn't in tops
      subs.filter((s: any) => !tops.find((t: any) => t._id?.toString() === s.parent?.toString()))
          .forEach((s: any) => ordered.push({ id: s._id, name: s.name, indent: 1, parent: s.parent }));
      setCategories(ordered);

      const rawBrands = brandData?.brands || brandData?.data?.brands || [];
      setBrands(rawBrands.map((b: any) => ({ id: b._id, name: b.name })));
    }).finally(() => setLoadingMeta(false));
  }, []);

  // Product search
  useEffect(() => {
    if (!adminToken || !productQuery.trim()) { setProductResults([]); return; }
    setLoadingProducts(true);
    subproductService.getSubProducts(adminToken, { search: productQuery.trim(), limit: 20 })
      .then((d: any) => {
        const sps = d.data?.subProducts || d.subProducts || [];
        // Deduplicate by product._id so each product appears once
        const seen = new Set<string>();
        const items: PickItem[] = [];
        for (const sp of sps) {
          const pid = sp.product?._id;
          if (!pid || seen.has(pid)) continue;
          seen.add(pid);
          items.push({
            id:    pid,
            name:  sp.product?.name ?? sp.sku,
            image: sp.product?.images?.[0]?.thumbnail || sp.product?.images?.[0]?.url,
          });
        }
        setProductResults(items);
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, [productQuery, adminToken]);

  const totalSelected = products.length + cats.length + brandIds.length;

  function toggleProduct(item: PickItem) {
    const next = products.includes(item.id) ? products.filter(x => x !== item.id) : [...products, item.id];
    onChange({ ...value, products: next });
  }
  function toggleCat(id: string) {
    const next = cats.includes(id) ? cats.filter(x => x !== id) : [...cats, id];
    onChange({ ...value, categories: next });
  }
  function toggleBrand(id: string) {
    const next = brandIds.includes(id) ? brandIds.filter(x => x !== id) : [...brandIds, id];
    onChange({ ...value, brands: next });
  }

  // Collect label maps for chips
  const catMap   = Object.fromEntries(categories.map(c => [c.id, c.name]));
  const brandMap = Object.fromEntries(brands.map(b => [b.id, b.name]));

  // Product name cache for chips
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!adminToken || products.length === 0) return;
    const missing = products.filter(id => !productNames[id]);
    if (missing.length === 0) return;
    subproductService.getSubProducts(adminToken, { limit: 200 })
      .then((d: any) => {
        const map: Record<string, string> = {};
        const sps = d.data?.subProducts || d.subProducts || [];
        sps.forEach((sp: any) => { if (sp.product?._id) map[sp.product._id] = sp.product.name; });
        setProductNames(prev => ({ ...prev, ...map }));
      }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken, products.length]);

  const filteredBrands = brandQuery.trim()
    ? brands.filter(b => b.name.toLowerCase().includes(brandQuery.toLowerCase()))
    : brands;

  const TABS: { id: ItemTab; label: string; count: number }[] = [
    { id: 'products',   label: 'Products',   count: products.length },
    { id: 'categories', label: 'Categories', count: cats.length },
    { id: 'brands',     label: 'Brands',     count: brandIds.length },
  ];

  return (
    <div className="space-y-3">
      {/* Selected chips */}
      {totalSelected > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {products.map(id => (
            <Chip key={`p-${id}`} label={productNames[id] || id} color="#1d4ed8"
              onRemove={() => onChange({ ...value, products: products.filter(x => x !== id) })} />
          ))}
          {cats.map(id => (
            <Chip key={`c-${id}`} label={catMap[id] || id} color="#059669"
              onRemove={() => onChange({ ...value, categories: cats.filter(x => x !== id) })} />
          ))}
          {brandIds.map(id => (
            <Chip key={`b-${id}`} label={brandMap[id] || id} color="#7c3aed"
              onRemove={() => onChange({ ...value, brands: brandIds.filter(x => x !== id) })} />
          ))}
          <button type="button" onClick={() => onChange({ products: [], categories: [], brands: [] })}
            className="text-[10px] text-gray-400 hover:text-red-500 underline self-center ml-1">Clear all</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex overflow-hidden rounded-xl border border-gray-200">
        {TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-bold transition-colors
              ${tab === t.id ? 'bg-[#b20202] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            {t.label}
            {t.count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black
                ${tab === t.id ? 'bg-white/30 text-white' : 'bg-[#b20202] text-white'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Products tab */}
      {tab === 'products' && (
        <div className="space-y-2">
          <div className="relative">
            <PiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            {loadingProducts && <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-[#b20202]" />}
            <input value={productQuery} onChange={e => setProductQuery(e.target.value)}
              placeholder="Search products…"
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-[#b20202]" />
          </div>
          {productResults.length > 0 && (
            <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-50">
              {productResults.map(item => (
                <button key={item.id} type="button" onClick={() => toggleProduct(item)}
                  className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${products.includes(item.id) ? 'bg-blue-50/60' : 'hover:bg-gray-50'}`}>
                  <Checkbox checked={products.includes(item.id)} />
                  {item.image
                    ? <img src={item.image} alt="" className="h-7 w-7 rounded-lg object-cover shrink-0" />
                    : <div className="h-7 w-7 shrink-0 rounded-lg bg-gray-100 flex items-center justify-center"><PiPackage className="h-3.5 w-3.5 text-gray-400" /></div>}
                  <span className="text-sm font-medium text-gray-800">{item.name}</span>
                </button>
              ))}
            </div>
          )}
          {productQuery && !loadingProducts && productResults.length === 0 && (
            <p className="text-xs text-gray-400 px-1">No products found for "{productQuery}"</p>
          )}
          {!productQuery && <p className="text-xs text-gray-400">Type to search products by name</p>}
        </div>
      )}

      {/* Categories tab */}
      {tab === 'categories' && (
        <div className="max-h-60 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-50">
          {loadingMeta && <p className="px-4 py-3 text-xs text-gray-400">Loading…</p>}
          {!loadingMeta && categories.length === 0 && <p className="px-4 py-3 text-xs text-gray-400">No categories found</p>}
          {categories.map(cat => (
            <button key={cat.id} type="button" onClick={() => toggleCat(cat.id)}
              className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${cats.includes(cat.id) ? 'bg-emerald-50/60' : 'hover:bg-gray-50'}`}
              style={{ paddingLeft: cat.indent ? '2rem' : undefined }}>
              <Checkbox checked={cats.includes(cat.id)} />
              {cat.indent ? <span className="text-[10px] text-gray-300 mr-0.5">└</span> : null}
              <span className={`text-sm ${cat.indent ? 'text-gray-600' : 'font-semibold text-gray-800'}`}>{cat.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Brands tab */}
      {tab === 'brands' && (
        <div className="space-y-2">
          <div className="relative">
            <PiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={brandQuery} onChange={e => setBrandQuery(e.target.value)}
              placeholder="Filter brands…"
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-[#b20202]" />
          </div>
          <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-50">
            {loadingMeta && <p className="px-4 py-3 text-xs text-gray-400">Loading…</p>}
            {!loadingMeta && filteredBrands.length === 0 && <p className="px-4 py-3 text-xs text-gray-400">No brands found</p>}
            {filteredBrands.map(b => (
              <button key={b.id} type="button" onClick={() => toggleBrand(b.id)}
                className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${brandIds.includes(b.id) ? 'bg-violet-50/60' : 'hover:bg-gray-50'}`}>
                <Checkbox checked={brandIds.includes(b.id)} />
                <span className="text-sm font-medium text-gray-800">{b.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {totalSelected === 0 && (
        <p className="text-[10px] text-gray-400">Nothing selected — discount applies to all items regardless of category or brand</p>
      )}
    </div>
  );
}

function Chip({ label, color, onRemove }: { label: string; color: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border pl-2 pr-1.5 py-0.5"
      style={{ borderColor: `${color}40`, backgroundColor: `${color}12` }}>
      <span className="text-[11px] font-semibold" style={{ color }}>{label}</span>
      <button type="button" onClick={onRemove}
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full transition-colors hover:opacity-80"
        style={{ backgroundColor: `${color}30`, color }}>
        <PiX className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

// ── Available On section ──────────────────────────────────────────────────────
function AvailableOnSection({ value, onChange }: {
  value: POSDiscountAvailability; onChange: (v: POSDiscountAvailability) => void;
}) {
  const channels: { key: keyof POSDiscountAvailability; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: 'pos',     label: 'Point of Sale', icon: <PiShoppingCart className="h-4 w-4" />, desc: 'Cashiers can apply this in the POS terminal' },
    { key: 'sales',   label: 'Sales',         icon: <PiTag className="h-4 w-4" />,           desc: 'Available on manual sales orders' },
    { key: 'website', label: 'Website',       icon: <PiInfo className="h-4 w-4" />,          desc: 'Customers can use this on the webshop' },
  ];

  return (
    <div className="space-y-2">
      {channels.map(({ key, label, icon, desc }) => (
        <div key={key}
          onClick={() => onChange({ ...value, [key]: !value[key] })}
          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors
            ${value[key] ? 'border-[#b20202]/30 bg-red-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
        >
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
            ${value[key] ? 'bg-[#b20202] text-white' : 'bg-gray-100 text-gray-500'}`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${value[key] ? 'text-[#b20202]' : 'text-gray-800'}`}>{label}</p>
            <p className="text-[10px] text-gray-400">{desc}</p>
          </div>
          <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors
            ${value[key] ? 'border-[#b20202] bg-[#b20202]' : 'border-gray-300'}`}>
            {value[key] && <PiCheckCircle className="h-4 w-4 text-white" />}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Rules section ─────────────────────────────────────────────────────────────
function RulesSection({ value, onChange }: {
  value: POSDiscountRules; onChange: (v: POSDiscountRules) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">All conditions must be met for the discount to apply.</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold text-gray-400">Min. quantity in cart</label>
          <div className="flex items-center gap-2">
            <input type="number" min={0} value={value.minQty || ''} onChange={e => onChange({ ...value, minQty: parseInt(e.target.value)||0 })}
              placeholder="0 = no min"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#b20202]" />
            <span className="text-xs text-gray-400 shrink-0">items</span>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold text-gray-400">Min. order value (₦)</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₦</span>
            <input type="number" min={0} value={value.minOrderValue || ''} onChange={e => onChange({ ...value, minOrderValue: parseFloat(e.target.value)||0 })}
              placeholder="0 = no min"
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-7 pr-3 text-sm outline-none focus:border-[#b20202]" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reward section ────────────────────────────────────────────────────────────
function RewardSection({ value, onChange, color }: {
  value: POSDiscountReward; onChange: (v: POSDiscountReward) => void; color?: string;
}) {
  const accentColor = color || '#b20202';

  const applyOnOptions: { value: POSRewardApplyOn; label: string; desc: string }[] = [
    { value: 'order',         label: 'On Order',              desc: 'Applied to the total cart value' },
    { value: 'cheapest',      label: 'On Cheapest Item',      desc: 'Applied to the lowest-priced item' },
    { value: 'most_expensive',label: 'On Most Expensive Item',desc: 'Applied to the highest-priced item' },
  ];

  return (
    <div className="space-y-4">
      {/* Discount type + value */}
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-400">Discount</label>
        <div className="flex items-center gap-2">
          <TypeToggle value={value.discountType} onChange={t => onChange({ ...value, discountType: t })} color={accentColor} />
          <input type="number" min={0} max={value.discountType === 'pct' ? 100 : undefined}
            value={value.discountValue || ''}
            onChange={e => onChange({ ...value, discountValue: parseFloat(e.target.value)||0 })}
            placeholder={value.discountType === 'pct' ? 'e.g. 20' : 'e.g. 500'}
            className="flex-1 rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-bold outline-none focus:border-[#b20202]"
          />
          <span className="text-sm font-semibold text-gray-500">{value.discountType === 'pct' ? '%' : '₦'}</span>
        </div>
      </div>

      {/* Apply on */}
      <div>
        <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-gray-400">Apply on</label>
        <div className="space-y-1.5">
          {applyOnOptions.map(opt => (
            <div key={opt.value}
              onClick={() => onChange({ ...value, applyOn: opt.value })}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors
                ${value.applyOn === opt.value ? 'border-[#b20202]/30 bg-red-50/40' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
            >
              <div className={`h-4 w-4 shrink-0 rounded-full border-2 transition-colors
                ${value.applyOn === opt.value ? 'border-[#b20202] bg-[#b20202]' : 'border-gray-300'}`} />
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${value.applyOn === opt.value ? 'text-[#b20202]' : 'text-gray-800'}`}>{opt.label}</p>
                <p className="text-[10px] text-gray-400">{opt.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Max discount cap */}
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-400">
          Max discount cap <span className="font-normal normal-case text-gray-300">(optional — ₦0 = no cap)</span>
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₦</span>
          <input type="number" min={0} value={value.maxDiscount || ''}
            onChange={e => onChange({ ...value, maxDiscount: parseFloat(e.target.value)||0 })}
            placeholder="0 = unlimited"
            className="w-full rounded-xl border border-gray-200 py-2.5 pl-7 pr-3 text-sm outline-none focus:border-[#b20202]"
          />
        </div>
        {(value.maxDiscount ?? 0) > 0 && (
          <p className="mt-1 text-[10px] text-gray-400">
            Discount will not exceed {formatCurrency(value.maxDiscount ?? 0)} regardless of order size
          </p>
        )}
      </div>
    </div>
  );
}

// Default values
const DEFAULT_AVAILABILITY: POSDiscountAvailability = { pos: true, sales: false, website: false };
const DEFAULT_RULES: POSDiscountRules = { minQty: 0, minOrderValue: 0 };
const DEFAULT_REWARD: POSDiscountReward = { discountType: 'pct', discountValue: 10, applyOn: 'order', maxDiscount: 0 };

// ══════════════════════════════════════════════════════════════════════════════
// COUPONS
// ══════════════════════════════════════════════════════════════════════════════

function CouponModal({ initial, onSave, onClose, adminToken }: {
  initial?: POSCoupon; onSave: (c: POSCoupon) => void; onClose: () => void; adminToken?: string;
}) {
  const [code,        setCode]        = useState(initial?.code        ?? '');
  const [name,        setName]        = useState(initial?.name        ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [pricelistIds,      setPricelistIds]      = useState<string[]>(initial?.pricelistIds      ?? []);
  const [applyTo,            setApplyTo]            = useState<POSApplicableItems>(initial?.applyTo ?? {});
  const [availability,      setAvailability]      = useState<POSDiscountAvailability>(initial?.availableOn ?? DEFAULT_AVAILABILITY);
  const [rules,             setRules]             = useState<POSDiscountRules>(initial?.rules ?? DEFAULT_RULES);
  const [reward,            setReward]            = useState<POSDiscountReward>(initial?.reward ?? { ...DEFAULT_REWARD, discountValue: initial?.value ?? 10, discountType: initial?.type ?? 'pct' });
  const [validFrom,         setValidFrom]         = useState(initial?.validFrom   ?? '');
  const [validTo,           setValidTo]           = useState(initial?.validTo     ?? '');
  const [maxUsage,          setMaxUsage]          = useState(initial?.maxUsage    ?? 0);
  const [onePerOrder,       setOnePerOrder]       = useState(initial?.onePerOrder ?? false);
  const [active,            setActive]            = useState(initial?.active !== false);
  const [err,               setErr]               = useState('');

  // Section open state
  const [openValidity,  setOpenValidity]  = useState(true);
  const [openItems,     setOpenItems]     = useState(false);
  const [openAvailable, setOpenAvailable] = useState(true);
  const [openRules,     setOpenRules]     = useState(false);
  const [openReward,    setOpenReward]    = useState(true);

  function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    setCode(Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''));
  }

  function handleSave() {
    if (!code.trim())             { setErr('Code is required'); return; }
    if (!name.trim())             { setErr('Name is required'); return; }
    if (reward.discountValue <= 0){ setErr('Reward value must be > 0'); return; }
    if (reward.discountType === 'pct' && reward.discountValue > 100) { setErr('Percentage cannot exceed 100%'); return; }
    onSave({
      _id: initial?._id,
      code: code.trim().toUpperCase(), name: name.trim(), description,
      pricelistIds, applyTo,
      availableOn: availability, rules, reward,
      // keep legacy fields in sync
      type: reward.discountType, value: reward.discountValue,
      minOrderValue: rules.minOrderValue,
      maxUsage, validFrom, validTo, active, onePerOrder,
      usageCount: initial?.usageCount ?? 0,
    });
  }

  return (
    <ModalShell title={initial ? 'Edit Coupon' : 'New Coupon'} headerBg="#1d4ed8" onClose={onClose} onSave={handleSave} saveLabel={initial ? 'Save' : 'Create Coupon'}>
      <Field label="Coupon code" required>
        <div className="flex gap-2">
          <Input value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setErr(''); }}
            placeholder="e.g. SAVE20" hasError={!!err && !code} className="font-mono font-bold tracking-widest uppercase" />
          <button type="button" onClick={generateCode}
            className="shrink-0 rounded-xl border border-gray-200 px-3 text-xs font-semibold text-gray-500 hover:border-blue-300 hover:text-blue-600">
            Generate
          </button>
        </div>
      </Field>
      <Field label="Display name" required>
        <Input value={name} onChange={e => { setName(e.target.value); setErr(''); }} placeholder="e.g. Festive 20% Off" hasError={!!err && !name} />
      </Field>
      <Field label="Description" hint="(optional)">
        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Internal note" />
      </Field>
      <PricelistPicker value={pricelistIds} onChange={setPricelistIds} adminToken={adminToken} />

      <AccordionSection title={`Applicable Items${((applyTo.products?.length ?? 0) + (applyTo.categories?.length ?? 0) + (applyTo.brands?.length ?? 0)) > 0 ? ` (${(applyTo.products?.length ?? 0) + (applyTo.categories?.length ?? 0) + (applyTo.brands?.length ?? 0)})` : ''}`} icon={<PiPackage className="h-4 w-4" />} open={openItems} onToggle={() => setOpenItems(v => !v)}>
        <ItemPicker value={applyTo} onChange={setApplyTo} adminToken={adminToken} />
      </AccordionSection>

      <AccordionSection title="Validity & Usage" icon={<PiCalendar className="h-4 w-4" />} open={openValidity} onToggle={() => setOpenValidity(v => !v)}>
        <ValiditySection validFrom={validFrom} validTo={validTo} maxUsage={maxUsage} usageCount={initial?.usageCount}
          onValidFrom={setValidFrom} onValidTo={setValidTo} onMaxUsage={setMaxUsage} color="#1d4ed8" />
        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-700">One use per transaction</p>
            <p className="text-[10px] text-gray-400">Prevents stacking multiple coupon uses in one order</p>
          </div>
          <Toggle checked={onePerOrder} onChange={setOnePerOrder} />
        </div>
      </AccordionSection>

      <AccordionSection title="Available On" icon={<PiShoppingCart className="h-4 w-4" />} open={openAvailable} onToggle={() => setOpenAvailable(v => !v)}>
        <AvailableOnSection value={availability} onChange={setAvailability} />
      </AccordionSection>

      <AccordionSection title="Rules" icon={<PiInfo className="h-4 w-4" />} open={openRules} onToggle={() => setOpenRules(v => !v)}>
        <RulesSection value={rules} onChange={setRules} />
      </AccordionSection>

      <AccordionSection title="Reward" icon={<PiGift className="h-4 w-4" />} open={openReward} onToggle={() => setOpenReward(v => !v)}>
        <RewardSection value={reward} onChange={setReward} color="#1d4ed8" />
      </AccordionSection>

      <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
        <span className="text-sm font-semibold text-gray-700">Active</span>
        <Toggle checked={active} onChange={setActive} />
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
    </ModalShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DISCOUNT CODES
// ══════════════════════════════════════════════════════════════════════════════

const CODE_COLORS = ['#059669','#b20202','#1d4ed8','#d97706','#7c3aed','#be185d','#0891b2','#374151'];

function DiscountCodeModal({ initial, onSave, onClose, adminToken }: {
  initial?: POSDiscountCode; onSave: (d: POSDiscountCode) => void; onClose: () => void; adminToken?: string;
}) {
  const [code,         setCode]         = useState(initial?.code         ?? '');
  const [name,         setName]         = useState(initial?.name         ?? '');
  const [description,  setDescription]  = useState(initial?.description  ?? '');
  const [color,        setColor]        = useState(initial?.color        ?? '#059669');
  const [pricelistIds, setPricelistIds] = useState<string[]>(initial?.pricelistIds ?? []);
  const [applyTo,      setApplyTo]      = useState<POSApplicableItems>(initial?.applyTo ?? {});
  const [availability, setAvailability] = useState<POSDiscountAvailability>(initial?.availableOn ?? DEFAULT_AVAILABILITY);
  const [rules,        setRules]        = useState<POSDiscountRules>(initial?.rules ?? DEFAULT_RULES);
  const [reward,       setReward]       = useState<POSDiscountReward>(initial?.reward ?? { ...DEFAULT_REWARD, discountValue: initial?.value ?? 10, discountType: initial?.type ?? 'pct' });
  const [validFrom,    setValidFrom]    = useState(initial?.validFrom ?? '');
  const [validTo,      setValidTo]      = useState(initial?.validTo   ?? '');
  const [maxUsage,     setMaxUsage]     = useState(initial?.maxUsage  ?? 0);
  const [active,       setActive]       = useState(initial?.active !== false);
  const [copied,       setCopied]       = useState(false);
  const [err,          setErr]          = useState('');

  const [openValidity,  setOpenValidity]  = useState(false);
  const [openItems,     setOpenItems]     = useState(false);
  const [openAvailable, setOpenAvailable] = useState(true);
  const [openRules,     setOpenRules]     = useState(false);
  const [openReward,    setOpenReward]    = useState(true);

  function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    setCode(Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''));
    setErr('');
  }

  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function handleSave() {
    if (!code.trim())              { setErr('Code is required'); return; }
    if (!name.trim())              { setErr('Name is required'); return; }
    if (reward.discountValue <= 0) { setErr('Value must be > 0'); return; }
    onSave({
      _id: initial?._id,
      code: code.trim().toUpperCase(), name: name.trim(), description,
      color, pricelistIds, applyTo,
      availableOn: availability, rules, reward,
      type: reward.discountType, value: reward.discountValue,
      minOrderValue: rules.minOrderValue,
      validFrom, validTo, maxUsage, usageCount: initial?.usageCount ?? 0,
      active,
    });
  }

  const now    = new Date();
  const endD   = validTo   ? new Date(validTo)   : null;
  const startD = validFrom ? new Date(validFrom) : null;
  const expired   = endD   && endD < now;
  const scheduled = startD && startD > now;
  const daysLeft  = endD && !expired ? Math.ceil((endD.getTime() - now.getTime()) / 86400000) : null;

  const applyToCount = (applyTo.products?.length ?? 0) + (applyTo.categories?.length ?? 0) + (applyTo.brands?.length ?? 0);

  return (
    <ModalShell title={initial ? 'Edit Discount Code' : 'New Discount Code'} headerBg={color} onClose={onClose} onSave={handleSave} saveLabel={initial ? 'Save' : 'Create Code'}>

      {/* Color row */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {CODE_COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full border-2 transition-transform ${color === c ? 'scale-125 border-white shadow-md' : 'border-transparent'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <input type="color" value={color} onChange={e => setColor(e.target.value)}
          className="h-7 w-7 cursor-pointer rounded-lg border border-gray-200 p-0.5" title="Custom colour" />
      </div>

      {/* Code input with generate + copy */}
      <Field label="Discount code" required>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input value={code}
              onChange={e => { setCode(e.target.value.toUpperCase().replace(/\s/g, '')); setErr(''); }}
              placeholder="e.g. STAFF25"
              className={`w-full rounded-xl border px-3.5 py-2.5 font-mono text-sm font-bold tracking-widest uppercase outline-none transition-colors
                ${err && !code ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-[#059669]'}`} />
          </div>
          <button type="button" onClick={generateCode}
            className="shrink-0 rounded-xl border border-gray-200 px-3 text-xs font-semibold text-gray-500 hover:border-emerald-300 hover:text-emerald-600">
            Generate
          </button>
          <button type="button" onClick={copyCode} disabled={!code}
            className={`shrink-0 rounded-xl border px-3 text-xs font-semibold transition-colors
              ${copied ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-40'}`}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        {/* Live code preview pill */}
        {code && (
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-lg px-3 py-1.5 font-mono text-sm font-black tracking-widest text-white"
              style={{ backgroundColor: color }}>
              {code}
            </span>
            <span className="text-xs text-gray-400">— preview</span>
          </div>
        )}
      </Field>

      <Field label="Name" required>
        <Input value={name} onChange={e => { setName(e.target.value); setErr(''); }}
          placeholder="e.g. Staff Discount" hasError={!!err && !name} />
      </Field>
      <Field label="Description" hint="(optional)">
        <Textarea value={description} onChange={e => setDescription(e.target.value)}
          placeholder="e.g. For verified staff members only" />
      </Field>

      {/* Expiry/validity status banner */}
      {(validFrom || validTo) && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold
          ${expired ? 'bg-red-50 text-red-600' : scheduled ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
          <PiCalendar className="h-3.5 w-3.5 shrink-0" />
          {expired    && `Expired — ${endD!.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}`}
          {scheduled  && `Scheduled — activates ${startD!.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}`}
          {!expired && !scheduled && daysLeft !== null && `● Active — expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
          {!expired && !scheduled && daysLeft === null && '● Active — no expiry set'}
        </div>
      )}

      <PricelistPicker value={pricelistIds} onChange={setPricelistIds} adminToken={adminToken} />

      <AccordionSection title={`Applicable Items${applyToCount > 0 ? ` (${applyToCount})` : ''}`} icon={<PiPackage className="h-4 w-4" />} open={openItems} onToggle={() => setOpenItems(v => !v)}>
        <ItemPicker value={applyTo} onChange={setApplyTo} adminToken={adminToken} />
      </AccordionSection>

      <AccordionSection title="Validity & Usage" icon={<PiCalendar className="h-4 w-4" />} open={openValidity} onToggle={() => setOpenValidity(v => !v)}>
        <ValiditySection validFrom={validFrom} validTo={validTo} maxUsage={maxUsage} usageCount={initial?.usageCount}
          onValidFrom={setValidFrom} onValidTo={setValidTo} onMaxUsage={setMaxUsage} color={color} />
      </AccordionSection>

      <AccordionSection title="Available On" icon={<PiShoppingCart className="h-4 w-4" />} open={openAvailable} onToggle={() => setOpenAvailable(v => !v)}>
        <AvailableOnSection value={availability} onChange={setAvailability} />
      </AccordionSection>

      <AccordionSection title="Rules" icon={<PiInfo className="h-4 w-4" />} open={openRules} onToggle={() => setOpenRules(v => !v)}>
        <RulesSection value={rules} onChange={setRules} />
      </AccordionSection>

      <AccordionSection title="Reward" icon={<PiGift className="h-4 w-4" />} open={openReward} onToggle={() => setOpenReward(v => !v)}>
        <RewardSection value={reward} onChange={setReward} color={color} />
      </AccordionSection>

      <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
        <span className="text-sm font-semibold text-gray-700">Active</span>
        <Toggle checked={active} onChange={setActive} />
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
    </ModalShell>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// PROMOTIONS
// ══════════════════════════════════════════════════════════════════════════════

const PROMO_COLORS = ['#d97706','#b20202','#1d4ed8','#059669','#7c3aed','#be185d','#0891b2','#374151'];

function PromotionModal({ initial, onSave, onClose, adminToken }: {
  initial?: POSPromotion; onSave: (p: POSPromotion) => void; onClose: () => void; adminToken?: string;
}) {
  const [name,         setName]         = useState(initial?.name         ?? '');
  const [description,  setDescription]  = useState(initial?.description  ?? '');
  const [color,        setColor]        = useState(initial?.color        ?? '#d97706');
  const [stackable,    setStackable]    = useState(initial?.stackable    ?? false);
  const [priority,     setPriority]     = useState(initial?.priority     ?? 0);
  const [pricelistIds, setPricelistIds] = useState<string[]>(initial?.pricelistIds ?? []);
  const [applyTo,      setApplyTo]      = useState<POSApplicableItems>(initial?.applyTo ?? {});
  const [availability, setAvailability] = useState<POSDiscountAvailability>(initial?.availableOn ?? DEFAULT_AVAILABILITY);
  const [rules,        setRules]        = useState<POSDiscountRules>(initial?.rules ?? DEFAULT_RULES);
  const [reward,       setReward]       = useState<POSDiscountReward>(initial?.reward ?? { ...DEFAULT_REWARD, discountValue: initial?.value ?? 10, discountType: initial?.type ?? 'pct' });
  const [startDate,    setStartDate]    = useState(initial?.startDate ?? '');
  const [endDate,      setEndDate]      = useState(initial?.endDate   ?? '');
  const [maxUsage,     setMaxUsage]     = useState(initial?.maxUsage  ?? 0);
  const [active,       setActive]       = useState(initial?.active !== false);
  const [err,          setErr]          = useState('');

  const [openValidity,  setOpenValidity]  = useState(true);
  const [openItems,     setOpenItems]     = useState(false);
  const [openAvailable, setOpenAvailable] = useState(true);
  const [openRules,     setOpenRules]     = useState(false);
  const [openReward,    setOpenReward]    = useState(true);

  function handleSave() {
    if (!name.trim())              { setErr('Name is required'); return; }
    if (reward.discountValue <= 0) { setErr('Value must be > 0'); return; }
    onSave({
      _id: initial?._id, name: name.trim(), description,
      color, stackable, priority,
      pricelistIds, applyTo,
      availableOn: availability, rules, reward,
      type: reward.discountType, value: reward.discountValue,
      startDate, endDate, maxUsage, usageCount: initial?.usageCount ?? 0, active,
    });
  }

  const now    = new Date();
  const start  = startDate ? new Date(startDate) : null;
  const end    = endDate   ? new Date(endDate)   : null;
  const status = !active ? 'inactive' : end && end < now ? 'expired' : start && start > now ? 'scheduled' : 'live';

  // Timeline helpers
  function daysUntil(d: Date) { return Math.ceil((d.getTime() - now.getTime()) / 86400000); }
  function daysAgo(d: Date)   { return Math.ceil((now.getTime() - d.getTime()) / 86400000); }

  const applyToCount = (applyTo.products?.length ?? 0) + (applyTo.categories?.length ?? 0) + (applyTo.brands?.length ?? 0);

  return (
    <ModalShell title={initial ? 'Edit Promotion' : 'New Promotion'} headerBg={color} onClose={onClose} onSave={handleSave} saveLabel={initial ? 'Save' : 'Create Promotion'}>

      {/* Color picker row */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {PROMO_COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full border-2 transition-transform ${color === c ? 'scale-125 border-white shadow-md' : 'border-transparent'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <input type="color" value={color} onChange={e => setColor(e.target.value)}
          className="h-7 w-7 cursor-pointer rounded-lg border border-gray-200 p-0.5" title="Custom colour" />
        <span className="ml-auto text-[10px] font-mono text-gray-400">{color}</span>
      </div>

      <Field label="Promotion name" required>
        <Input value={name} onChange={e => { setName(e.target.value); setErr(''); }}
          placeholder="e.g. Christmas Sale, Weekend Special" hasError={!!err && !name} />
      </Field>
      <Field label="Description" hint="(optional)">
        <Textarea value={description} onChange={e => setDescription(e.target.value)}
          placeholder="e.g. 20% off all spirits this weekend" />
      </Field>

      {/* Status + date timeline */}
      {(startDate || endDate || status !== 'inactive') && (
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: `${color}40` }}>
          {/* Status banner */}
          <div className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold"
            style={{ backgroundColor: status === 'live' ? '#ecfdf5' : status === 'scheduled' ? '#eff6ff' : status === 'expired' ? '#fef2f2' : '#f9fafb',
                     color: status === 'live' ? '#059669' : status === 'scheduled' ? '#1d4ed8' : status === 'expired' ? '#dc2626' : '#6b7280' }}>
            <PiLightning className="h-3.5 w-3.5 shrink-0" />
            {status === 'live' && end    && `● Live — ${daysUntil(end)} day${daysUntil(end) !== 1 ? 's' : ''} remaining`}
            {status === 'live' && !end   && '● Live — no end date set'}
            {status === 'scheduled'      && `Scheduled — starts in ${daysUntil(start!)} day${daysUntil(start!) !== 1 ? 's' : ''} (${start!.toLocaleDateString()})`}
            {status === 'expired'        && `Expired ${daysAgo(end!)} day${daysAgo(end!) !== 1 ? 's' : ''} ago`}
            {status === 'inactive'       && 'Inactive (toggle active to enable)'}
          </div>
          {/* Visual timeline */}
          {(startDate || endDate) && (
            <div className="flex items-center gap-2 px-4 py-3 bg-white text-[11px] text-gray-500">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: start && start <= now ? color : '#d1d5db' }} />
                <span>{startDate ? new Date(startDate).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : 'No start'}</span>
              </div>
              <div className="flex-1 relative h-1 rounded-full bg-gray-100 mx-1">
                {startDate && endDate && (() => {
                  const total = new Date(endDate).getTime() - new Date(startDate).getTime();
                  const elapsed = now.getTime() - new Date(startDate).getTime();
                  const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
                  return <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />;
                })()}
                {!endDate && startDate && now >= new Date(startDate) && (
                  <div className="absolute inset-y-0 left-0 rounded-full w-full" style={{ backgroundColor: color, opacity: 0.4 }} />
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: end && end <= now ? color : '#d1d5db' }} />
                <span>{endDate ? new Date(endDate).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : 'No end'}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <PricelistPicker value={pricelistIds} onChange={setPricelistIds} adminToken={adminToken} />

      <AccordionSection title={`Applicable Items${applyToCount > 0 ? ` (${applyToCount})` : ''}`} icon={<PiPackage className="h-4 w-4" />} open={openItems} onToggle={() => setOpenItems(v => !v)}>
        <ItemPicker value={applyTo} onChange={setApplyTo} adminToken={adminToken} />
      </AccordionSection>

      <AccordionSection title="Validity & Usage" icon={<PiCalendar className="h-4 w-4" />} open={openValidity} onToggle={() => setOpenValidity(v => !v)}>
        <ValiditySection validFrom={startDate} validTo={endDate} maxUsage={maxUsage} usageCount={initial?.usageCount}
          onValidFrom={setStartDate} onValidTo={setEndDate} onMaxUsage={setMaxUsage} color={color} />
      </AccordionSection>

      <AccordionSection title="Available On" icon={<PiShoppingCart className="h-4 w-4" />} open={openAvailable} onToggle={() => setOpenAvailable(v => !v)}>
        <AvailableOnSection value={availability} onChange={setAvailability} />
      </AccordionSection>

      <AccordionSection title="Rules" icon={<PiInfo className="h-4 w-4" />} open={openRules} onToggle={() => setOpenRules(v => !v)}>
        <RulesSection value={rules} onChange={setRules} />
      </AccordionSection>

      <AccordionSection title="Reward" icon={<PiGift className="h-4 w-4" />} open={openReward} onToggle={() => setOpenReward(v => !v)}>
        <RewardSection value={reward} onChange={setReward} color={color} />
      </AccordionSection>

      {/* Behaviour row: stackable + priority */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 col-span-2 sm:col-span-1">
          <div>
            <p className="text-sm font-semibold text-gray-700">Stackable</p>
            <p className="text-[10px] text-gray-400">Applies alongside other active promotions</p>
          </div>
          <Toggle checked={stackable} onChange={setStackable} />
        </div>
        <div className="rounded-xl bg-gray-50 px-4 py-3 col-span-2 sm:col-span-1">
          <label className="mb-1 block text-[10px] font-semibold text-gray-400">Priority <span className="font-normal">(higher = applied first)</span></label>
          <input type="number" min={0} value={priority}
            onChange={e => setPriority(parseInt(e.target.value) || 0)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#d97706]" />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
        <span className="text-sm font-semibold text-gray-700">Active</span>
        <Toggle checked={active} onChange={setActive} />
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
    </ModalShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BUY X GET Y
// ══════════════════════════════════════════════════════════════════════════════

const BXGY_COLORS = ['#7c3aed','#b20202','#1d4ed8','#059669','#d97706','#be185d','#0891b2','#374151'];

const BXGY_PRESETS = [
  { label: 'Buy 2 Get 1 Free',     buyQty: 2, getQty: 1, getDiscountPct: 100 },
  { label: 'Buy 3 Get 1 Free',     buyQty: 3, getQty: 1, getDiscountPct: 100 },
  { label: 'Buy 2 Get 1 at 50%',   buyQty: 2, getQty: 1, getDiscountPct: 50  },
  { label: 'Buy 3 Get 2 Free',     buyQty: 3, getQty: 2, getDiscountPct: 100 },
  { label: 'Buy 4 Get 2 Free',     buyQty: 4, getQty: 2, getDiscountPct: 100 },
  { label: 'Buy 5 Get 1 Free',     buyQty: 5, getQty: 1, getDiscountPct: 100 },
];

function BuyXGetYModal({ initial, onSave, onClose, adminToken }: {
  initial?: POSBuyXGetY; onSave: (b: POSBuyXGetY) => void; onClose: () => void; adminToken?: string;
}) {
  const [name,         setName]         = useState(initial?.name         ?? '');
  const [description,  setDescription]  = useState(initial?.description  ?? '');
  const [color,        setColor]        = useState(initial?.color        ?? '#7c3aed');
  const [stackable,    setStackable]    = useState(initial?.stackable    ?? false);
  const [pricelistIds,  setPricelistIds]  = useState<string[]>(initial?.pricelistIds ?? []);
  const [applyTo,        setApplyTo]        = useState<POSApplicableItems>(initial?.applyTo ?? {});
  const [rewardApplyTo,  setRewardApplyTo]  = useState<POSApplicableItems>(initial?.rewardApplyTo ?? {});
  const [availability,   setAvailability]   = useState<POSDiscountAvailability>(initial?.availableOn ?? DEFAULT_AVAILABILITY);
  const [buyQty,         setBuyQty]         = useState(initial?.buyQty       ?? 2);
  const [getQty,         setGetQty]         = useState(initial?.getQty       ?? 1);
  const [getDiscountPct, setGetDiscountPct] = useState(initial?.getDiscountPct ?? 100);
  const [rules,          setRules]          = useState<POSDiscountRules>(initial?.rules ?? { minQty: 0, minOrderValue: initial?.minOrderValue ?? 0 });
  const [validFrom,      setValidFrom]      = useState(initial?.validFrom    ?? '');
  const [validTo,        setValidTo]        = useState(initial?.validTo      ?? '');
  const [maxUsage,       setMaxUsage]       = useState(initial?.maxUsage     ?? 0);
  const [active,         setActive]         = useState(initial?.active !== false);
  const [err,            setErr]            = useState('');

  const [openValidity,  setOpenValidity]  = useState(false);
  const [openAvailable, setOpenAvailable] = useState(true);
  const [openRules,     setOpenRules]     = useState(false);
  const [openReward,    setOpenReward]    = useState(true);

  function applyPreset(p: typeof BXGY_PRESETS[0]) {
    setBuyQty(p.buyQty);
    setGetQty(p.getQty);
    setGetDiscountPct(p.getDiscountPct);
    if (!name) setName(p.label);
  }

  function handleSave() {
    if (!name.trim()) { setErr('Name is required'); return; }
    onSave({
      _id: initial?._id, name: name.trim(), description,
      color, stackable,
      pricelistIds,
      applyTo, rewardApplyTo,
      // keep legacy fields in sync
      buyProducts: applyTo.products ?? [],
      getProducts: rewardApplyTo.products ?? [],
      availableOn: availability,
      buyQty, getQty, getDiscountPct,
      rules,
      minOrderValue: rules.minOrderValue,
      maxUsage, usageCount: initial?.usageCount ?? 0,
      validFrom, validTo, active,
    });
  }

  const now    = new Date();
  const endD   = validTo   ? new Date(validTo)   : null;
  const startD = validFrom ? new Date(validFrom) : null;
  const expired   = endD   && endD < now;
  const scheduled = startD && startD > now;
  const daysLeft  = endD && !expired ? Math.ceil((endD.getTime() - now.getTime()) / 86400000) : null;
  const offerLabel = getDiscountPct === 100
    ? `Buy ${buyQty}, get ${getQty} FREE`
    : `Buy ${buyQty}, get ${getQty} at ${getDiscountPct}% off`;

  const totalUnits  = buyQty + getQty;
  const savedAmount = getDiscountPct === 100
    ? `${getQty} item${getQty > 1 ? 's' : ''} free`
    : `${getDiscountPct}% off ${getQty} item${getQty > 1 ? 's' : ''}`;

  return (
    <ModalShell title={initial ? 'Edit Offer' : 'New Buy X Get Y'} headerBg={color} onClose={onClose} onSave={handleSave} saveLabel={initial ? 'Save' : 'Create Offer'}>

      {/* Color row */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {BXGY_COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full border-2 transition-transform ${color === c ? 'scale-125 border-white shadow-md' : 'border-transparent'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <input type="color" value={color} onChange={e => setColor(e.target.value)}
          className="h-7 w-7 cursor-pointer rounded-lg border border-gray-200 p-0.5" title="Custom colour" />
      </div>

      {/* Quick presets */}
      <div>
        <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-gray-400">Quick presets</label>
        <div className="flex flex-wrap gap-2">
          {BXGY_PRESETS.map(p => {
            const active = buyQty === p.buyQty && getQty === p.getQty && getDiscountPct === p.getDiscountPct;
            return (
              <button key={p.label} type="button" onClick={() => applyPreset(p)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors
                  ${active ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
                style={active ? { backgroundColor: color } : undefined}>
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <Field label="Offer name" required>
        <Input value={name} onChange={e => { setName(e.target.value); setErr(''); }}
          placeholder="e.g. Buy 2 Get 1 Free" hasError={!!err && !name} />
      </Field>
      <Field label="Description" hint="(optional)">
        <Textarea value={description} onChange={e => setDescription(e.target.value)}
          placeholder="e.g. On all spirits and cocktails" />
      </Field>

      {/* Qty builder */}
      <div className="rounded-2xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-gray-200">
          {/* Buy side */}
          <div className="px-5 py-4">
            <label className="mb-3 block text-[11px] font-bold uppercase tracking-wider text-gray-400">Customer buys</label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setBuyQty(Math.max(1, buyQty - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-lg text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors">−</button>
              <span className="flex-1 text-center text-3xl font-black" style={{ color }}>{buyQty}</span>
              <button type="button" onClick={() => setBuyQty(buyQty + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-lg text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors">+</button>
            </div>
            <p className="mt-2 text-center text-xs text-gray-400">item{buyQty > 1 ? 's' : ''} at full price</p>
          </div>
          {/* Get side */}
          <div className="px-5 py-4">
            <label className="mb-3 block text-[11px] font-bold uppercase tracking-wider text-gray-400">Customer gets</label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setGetQty(Math.max(1, getQty - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-lg text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors">−</button>
              <span className="flex-1 text-center text-3xl font-black" style={{ color }}>{getQty}</span>
              <button type="button" onClick={() => setGetQty(getQty + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-lg text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors">+</button>
            </div>
            <p className="mt-2 text-center text-xs text-gray-400">item{getQty > 1 ? 's' : ''} at discount</p>
          </div>
        </div>

        {/* Discount slider */}
        <div className="border-t border-gray-100 px-5 py-4 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Discount on the {getQty > 1 ? `${getQty} "get" items` : '"get" item'}</label>
            <span className="text-sm font-black" style={{ color }}>
              {getDiscountPct === 100 ? 'FREE' : `${getDiscountPct}% off`}
            </span>
          </div>
          <input type="range" min={0} max={100} step={5} value={getDiscountPct}
            onChange={e => setGetDiscountPct(parseInt(e.target.value))}
            className="w-full" style={{ accentColor: color }} />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0% (no discount)</span>
            <span>100% (free)</span>
          </div>
        </div>

        {/* Live offer card */}
        <div className="border-t border-gray-100 px-5 py-4" style={{ backgroundColor: `${color}0d` }}>
          <div className="flex items-center gap-4">
            {/* Visual: boxes */}
            <div className="flex items-center gap-1 shrink-0">
              {Array.from({ length: Math.min(buyQty, 5) }).map((_, i) => (
                <div key={i} className="h-8 w-8 rounded-lg border-2 flex items-center justify-center text-[10px] font-black text-white"
                  style={{ backgroundColor: color, borderColor: color }}>
                  ₦
                </div>
              ))}
              {buyQty > 5 && <span className="text-xs font-bold ml-1" style={{ color }}>×{buyQty}</span>}
              <span className="mx-2 text-sm font-black text-gray-400">+</span>
              {Array.from({ length: Math.min(getQty, 3) }).map((_, i) => (
                <div key={i} className="h-8 w-8 rounded-lg border-2 flex items-center justify-center text-[10px] font-black"
                  style={{ borderColor: color, color, backgroundColor: `${color}15` }}>
                  {getDiscountPct === 100 ? '🎁' : `${getDiscountPct}%`}
                </div>
              ))}
              {getQty > 3 && <span className="text-xs font-bold ml-1" style={{ color }}>×{getQty}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black" style={{ color }}>{offerLabel}</p>
              <p className="text-xs text-gray-500 mt-0.5">{totalUnits} items total · {savedAmount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Status banner */}
      {(validFrom || validTo) && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold
          ${expired ? 'bg-red-50 text-red-600' : scheduled ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
          <PiCalendar className="h-3.5 w-3.5 shrink-0" />
          {expired    && 'Expired'}
          {scheduled  && `Scheduled — starts ${startD!.toLocaleDateString('en-GB', { day:'numeric', month:'short' })}`}
          {!expired && !scheduled && daysLeft !== null && `● Active — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`}
          {!expired && !scheduled && daysLeft === null && '● Active — no end date'}
        </div>
      )}

      <PricelistPicker value={pricelistIds} onChange={setPricelistIds} adminToken={adminToken} />

      {/* ═══ Rules accordion — conditions (products/categories/brands + qty/value minimums) ═══ */}
      <AccordionSection title="Rules" icon={<PiInfo className="h-4 w-4" />} open={openRules} onToggle={() => setOpenRules(v => !v)}>
        <div className="space-y-4">
          <Field label="Applicable items" hint="— which items the customer must buy">
            <ItemPicker value={applyTo} onChange={setApplyTo} adminToken={adminToken} />
          </Field>
          <RulesSection value={rules} onChange={setRules} />
        </div>
      </AccordionSection>

      {/* ═══ Rewards accordion — benefit (get items) ═══ */}
      <AccordionSection title="Rewards" icon={<PiGift className="h-4 w-4" />} open={openReward} onToggle={() => setOpenReward(v => !v)}>
        <Field label="Discount applies to" hint="— which items receive the free/discounted quantity">
          <ItemPicker value={rewardApplyTo} onChange={setRewardApplyTo} adminToken={adminToken} />
        </Field>
      </AccordionSection>

      <AccordionSection title="Validity & Usage" icon={<PiCalendar className="h-4 w-4" />} open={openValidity} onToggle={() => setOpenValidity(v => !v)}>
        <ValiditySection validFrom={validFrom} validTo={validTo} maxUsage={maxUsage}
          onValidFrom={setValidFrom} onValidTo={setValidTo} onMaxUsage={setMaxUsage} color={color} />
      </AccordionSection>

      <AccordionSection title="Available On" icon={<PiShoppingCart className="h-4 w-4" />} open={openAvailable} onToggle={() => setOpenAvailable(v => !v)}>
        <AvailableOnSection value={availability} onChange={setAvailability} />
      </AccordionSection>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 col-span-2 sm:col-span-1">
          <div>
            <p className="text-sm font-semibold text-gray-700">Stackable</p>
            <p className="text-[10px] text-gray-400">Can apply alongside other active offers</p>
          </div>
          <Toggle checked={stackable} onChange={setStackable} />
        </div>
        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 col-span-2 sm:col-span-1">
          <span className="text-sm font-semibold text-gray-700">Active</span>
          <Toggle checked={active} onChange={setActive} />
        </div>
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
    </ModalShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB NAVIGATION
// ══════════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'coupons',      label: 'Coupons',           icon: <PiTicket className="h-4 w-4" />,      color: '#1d4ed8' },
  { id: 'loyalty',      label: 'Loyalty Cards',      icon: <PiCreditCard className="h-4 w-4" />,  color: '#d97706' },
  { id: 'promotions',   label: 'Promotions',         icon: <PiLightning className="h-4 w-4" />,        color: '#d97706' },
  { id: 'codes',        label: 'Discount Codes',     icon: <PiTag className="h-4 w-4" />,         color: '#059669' },
  { id: 'bxgy',         label: 'Buy X Get Y',        icon: <PiShoppingCart className="h-4 w-4" />,color: '#7c3aed' },
  { id: 'nextorder',    label: 'Next Order Coupons', icon: <PiGift className="h-4 w-4" />,        color: '#be185d' },
] as const;

type TabId = typeof TABS[number]['id'];

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function POSLoyalty() {
  const router  = useRouter();
  const { data: session } = useSession();
  const token = session?.user?.token as string | undefined;
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [tab,     setTab]     = useState<TabId>('coupons');

  // Modal state
  const [editCoupon,    setEditCoupon]    = useState<POSCoupon    | 'new' | null>(null);
  const [editCode,      setEditCode]      = useState<POSDiscountCode | 'new' | null>(null);
  const [editPromo,     setEditPromo]     = useState<POSPromotion | 'new' | null>(null);
  const [editBxgy,      setEditBxgy]      = useState<POSBuyXGetY  | 'new' | null>(null);

  // Data
  const [coupons,       setCoupons]       = useState<POSCoupon[]>([]);
  const [discountCodes, setDiscountCodes] = useState<POSDiscountCode[]>([]);
  const [promotions,    setPromotions]    = useState<POSPromotion[]>([]);
  const [buyXGetY,      setBuyXGetY]      = useState<POSBuyXGetY[]>([]);

  // Loyalty card config
  const [lcEnabled,       setLcEnabled]       = useState(false);
  const [lcPrefix,        setLcPrefix]        = useState('DH-');
  const [lcMultiplier,    setLcMultiplier]    = useState(1);
  const [lcWelcome,       setLcWelcome]       = useState(0);
  const [lcPointsExpiry,        setLcPointsExpiry]        = useState(0);
  const [lcMinRedemption,       setLcMinRedemption]       = useState(0);
  const [lcDoublePointsDays,    setLcDoublePointsDays]    = useState<number[]>([]);
  const [lcBonusMultiplierDays, setLcBonusMultiplierDays] = useState(2);
  const [lcTiers,               setLcTiers]               = useState<POSLoyaltyTier[]>([]);
  // Calculator state (loyalty tab)
  const [calcOrder,  setCalcOrder]  = useState(5000);
  const [calcPoints, setCalcPoints] = useState(0);
  const [calcFirst,  setCalcFirst]  = useState(false);

  // Next order coupon
  const [nocEnabled,       setNocEnabled]       = useState(false);
  const [nocType,          setNocType]          = useState<'pct'|'fixed'>('pct');
  const [nocValue,         setNocValue]         = useState(10);
  const [nocValidDays,     setNocValidDays]      = useState(30);
  const [nocMinOrder,      setNocMinOrder]      = useState(0);
  const [nocMinRedeemOrder,setNocMinRedeemOrder]= useState(0);
  const [nocPrefix,        setNocPrefix]        = useState('NOC-');
  const [nocColor,         setNocColor]         = useState('#be185d');
  const [nocOneUse,        setNocOneUse]        = useState(true);
  const [nocAvailableOn,   setNocAvailableOn]   = useState<POSDiscountAvailability>({ pos: true, sales: false, website: false });

  // Loyalty points (existing)
  const [loyaltyEnabled,          setLoyaltyEnabled]          = useState(false);
  const [loyaltyPointsPerNaira,   setLoyaltyPointsPerNaira]   = useState(0.01);
  const [loyaltyPointsValue,      setLoyaltyPointsValue]      = useState(1);
  const [loyaltyMaxRedemptionPct, setLoyaltyMaxRedemptionPct] = useState(50);

  useEffect(() => {
    if (!token) return;
    posApi.getPOSSettings(token)
      .then(d => {
        const s = d.posSettings || {};
        setCoupons(s.coupons        ?? []);
        setDiscountCodes(s.discountCodes ?? []);
        setPromotions(s.promotions   ?? []);
        setBuyXGetY(s.buyXGetY      ?? []);
        // Loyalty card
        setLcEnabled(s.loyaltyCard?.enabled         ?? false);
        setLcPrefix(s.loyaltyCard?.cardPrefix        ?? 'DH-');
        setLcMultiplier(s.loyaltyCard?.earnMultiplier ?? 1);
        setLcWelcome(s.loyaltyCard?.welcomeBonus     ?? 0);
        setLcPointsExpiry(s.loyaltyCard?.pointsExpiry          ?? 0);
        setLcMinRedemption(s.loyaltyCard?.minRedemption        ?? 0);
        setLcDoublePointsDays(s.loyaltyCard?.doublePointsDays  ?? []);
        setLcBonusMultiplierDays(s.loyaltyCard?.bonusMultiplierDays ?? 2);
        setLcTiers(s.loyaltyCard?.tiers ?? []);
        // Next order
        setNocEnabled(s.nextOrderCoupon?.enabled            ?? false);
        setNocType(s.nextOrderCoupon?.type                  ?? 'pct');
        setNocValue(s.nextOrderCoupon?.value                ?? 10);
        setNocValidDays(s.nextOrderCoupon?.validDays        ?? 30);
        setNocMinOrder(s.nextOrderCoupon?.minOrderForCoupon ?? 0);
        setNocMinRedeemOrder(s.nextOrderCoupon?.minRedeemOrder ?? 0);
        setNocPrefix(s.nextOrderCoupon?.codePrefix          ?? 'NOC-');
        setNocColor(s.nextOrderCoupon?.color                ?? '#be185d');
        setNocOneUse(s.nextOrderCoupon?.oneUse              ?? true);
        setNocAvailableOn(s.nextOrderCoupon?.availableOn    ?? { pos: true, sales: false, website: false });
        // Loyalty points
        setLoyaltyEnabled(s.loyaltyEnabled             ?? false);
        setLoyaltyPointsPerNaira(s.loyaltyPointsPerNaira ?? 0.01);
        setLoyaltyPointsValue(s.loyaltyPointsValue       ?? 1);
        setLoyaltyMaxRedemptionPct(s.loyaltyMaxRedemptionPct ?? 50);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function save(patch: Record<string, any>, msg = 'Saved') {
    if (!token) return;
    try {
      await posApi.updatePOSSettings(token, patch);
      toast.success(msg);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    }
  }

  // ── CRUD helpers ──────────────────────────────────────────────────────────

  function makeCrud<T extends { _id?: string; active?: boolean }>(
    list: T[], setList: (v: T[]) => void, key: string
  ) {
    function save_(next: T[]) {
      setList(next);
      save({ [key]: next }).catch(() => {});
    }
    return {
      add: (item: T) => {
        const next = [...list, { ...item, _id: item._id || uid() }];
        save_(next);
      },
      update: (item: T) => {
        save_(list.map(x => x._id === item._id ? item : x));
      },
      toggle: (id: string) => {
        save_(list.map(x => x._id === id ? { ...x, active: !x.active } : x));
      },
      delete: (id: string) => {
        const name = (list.find(x => x._id === id) as any)?.name || (list.find(x => x._id === id) as any)?.code || '';
        save_(list.filter(x => x._id !== id));
        if (name) toast.success(`"${name}" deleted`);
      },
    };
  }

  const couponCrud = makeCrud(coupons, setCoupons, 'coupons');
  const codeCrud   = makeCrud(discountCodes, setDiscountCodes, 'discountCodes');
  const promoCrud  = makeCrud(promotions, setPromotions, 'promotions');
  const bxgyCrud   = makeCrud(buyXGetY, setBuyXGetY, 'buyXGetY');

  function handleSaveCoupon(c: POSCoupon) {
    if (editCoupon === 'new') { couponCrud.add(c); toast.success('Coupon created'); }
    else { couponCrud.update(c); toast.success('Coupon saved'); }
    setEditCoupon(null);
  }
  function handleSaveCode(d: POSDiscountCode) {
    if (editCode === 'new') { codeCrud.add(d); toast.success('Code created'); }
    else { codeCrud.update(d); toast.success('Code saved'); }
    setEditCode(null);
  }
  function handleSavePromo(p: POSPromotion) {
    if (editPromo === 'new') { promoCrud.add(p); toast.success('Promotion created'); }
    else { promoCrud.update(p); toast.success('Promotion saved'); }
    setEditPromo(null);
  }
  function handleSaveBxgy(b: POSBuyXGetY) {
    if (editBxgy === 'new') { bxgyCrud.add(b); toast.success('Offer created'); }
    else { bxgyCrud.update(b); toast.success('Offer saved'); }
    setEditBxgy(null);
  }

  async function saveLoyaltyCard() {
    setSaving(true);
    await save({
      loyaltyEnabled, loyaltyPointsPerNaira, loyaltyPointsValue, loyaltyMaxRedemptionPct,
      loyaltyCard: {
        enabled: lcEnabled, cardPrefix: lcPrefix,
        earnMultiplier: lcMultiplier, welcomeBonus: lcWelcome,
        pointsExpiry: lcPointsExpiry, minRedemption: lcMinRedemption,
        doublePointsDays: lcDoublePointsDays, bonusMultiplierDays: lcBonusMultiplierDays,
        tiers: [...lcTiers].sort((a, b) => a.minPoints - b.minPoints),
      },
    }, 'Loyalty settings saved');
    setSaving(false);
  }

  async function saveNextOrder() {
    setSaving(true);
    await save({
      nextOrderCoupon: {
        enabled: nocEnabled, type: nocType, value: nocValue,
        validDays: nocValidDays, minOrderForCoupon: nocMinOrder,
        minRedeemOrder: nocMinRedeemOrder,
        codePrefix: nocPrefix, color: nocColor,
        oneUse: nocOneUse, availableOn: nocAvailableOn,
      },
    }, 'Next order coupon saved');
    setSaving(false);
  }


  const now = new Date();

  return (
    <div className="min-h-screen bg-gray-50">
      <POSNavHeader />

      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => router.push(routes.pos.index)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
            <PiArrowLeft className="h-4 w-4" /> Back
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Discount & Loyalty</h1>
            <p className="text-sm text-gray-500">Manage coupons, promotions, discount codes, buy X get Y offers, and loyalty programmes</p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-[#b20202]" />
          </div>
        ) : (
          <>
            {/* Tab bar */}
            <div className="flex gap-1 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1.5 shadow-sm scrollbar-none">
              {TABS.map(t => (
                <button key={t.id} type="button" onClick={() => setTab(t.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all
                    ${tab === t.id ? 'text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                  style={tab === t.id ? { backgroundColor: t.color } : undefined}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* ── COUPONS ─────────────────────────────────────────────── */}
            {tab === 'coupons' && (
              <SectionCard icon={<PiTicket className="h-5 w-5" />} color="#1d4ed8"
                title="Coupons" description="Code-based discounts with usage tracking and expiry"
                count={coupons.filter(c => c.active).length}
                onAdd={() => setEditCoupon('new')} addLabel="New Coupon">
                {coupons.length === 0 ? (
                  <EmptyState icon={<PiTicket className="h-7 w-7 text-gray-300" />}
                    title="No coupons yet"
                    body="Create coupon codes like SAVE20 or WELCOME10 for customers to redeem at checkout"
                    action={<button type="button" onClick={() => setEditCoupon('new')}
                      className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold text-white" style={{ backgroundColor: '#1d4ed8' }}>
                      <PiPlus className="h-4 w-4" /> Create first coupon
                    </button>} />
                ) : (
                  <div className="divide-y divide-gray-50">
                    {coupons.map(c => {
                      const expired  = c.validTo && new Date(c.validTo) < now;
                      const atLimit  = c.maxUsage > 0 && c.usageCount >= c.maxUsage;
                      return (
                        <ListRow key={c._id} active={c.active && !expired && !atLimit} faded={!c.active || expired || atLimit}
                          onToggle={() => couponCrud.toggle(c._id)} onEdit={() => setEditCoupon(c)} onDelete={() => couponCrud.delete(c._id)}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-lg bg-blue-50 px-2.5 py-1 font-mono text-xs font-bold text-blue-700 tracking-widest">{c.code}</span>
                            <span className="text-sm font-semibold text-gray-800">{c.name}</span>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                              {c.type === 'pct' ? `${c.value}%` : formatCurrency(c.value)} off
                            </span>
                            {expired && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-500">Expired</span>}
                            {atLimit && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">Limit reached</span>}
                          </div>
                          <p className="mt-0.5 text-[10px] text-gray-400">
                            {c.maxUsage > 0 ? `${c.usageCount}/${c.maxUsage} used` : 'Unlimited uses'}
                            {c.validTo && ` · Expires ${new Date(c.validTo).toLocaleDateString()}`}
                            {c.minOrderValue > 0 && ` · Min ₦${c.minOrderValue.toLocaleString()}`}
                          </p>
                        </ListRow>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            )}

            {/* ── LOYALTY CARDS ────────────────────────────────────────── */}
            {tab === 'loyalty' && (() => {
              const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
              const PRESETS = [
                { label: 'Bronze / Silver / Gold', tiers: [
                  { name: 'Bronze', minPoints: 0,    multiplier: 1,   color: '#92400e', benefits: 'Standard earn rate' },
                  { name: 'Silver', minPoints: 500,  multiplier: 1.5, color: '#6b7280', benefits: '1.5× earn, early access to promos' },
                  { name: 'Gold',   minPoints: 2000, multiplier: 2,   color: '#d97706', benefits: '2× earn, birthday bonus, priority service' },
                ]},
                { label: '+ Platinum', tiers: [
                  { name: 'Bronze',   minPoints: 0,    multiplier: 1,   color: '#92400e', benefits: 'Standard earn rate' },
                  { name: 'Silver',   minPoints: 500,  multiplier: 1.5, color: '#6b7280', benefits: '1.5× earn, early access' },
                  { name: 'Gold',     minPoints: 2000, multiplier: 2,   color: '#d97706', benefits: '2× earn, birthday bonus' },
                  { name: 'Platinum', minPoints: 5000, multiplier: 3,   color: '#7c3aed', benefits: '3× earn, VIP events, free delivery' },
                ]},
              ];

              // Which tier does a given points balance sit in?
              const sortedTiers = [...lcTiers].sort((a, b) => a.minPoints - b.minPoints);
              function tierForPoints(pts: number) {
                let current = null;
                for (const t of sortedTiers) { if (pts >= t.minPoints) current = t; }
                return current;
              }

              return (
              <div className="space-y-4">

                {/* ── Programme header with master toggle ── */}
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-3 px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
                        <PiCreditCard className="h-5 w-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Loyalty Programme</p>
                        <p className="text-xs text-gray-400">Points earned on every purchase, redeemable at checkout</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${loyaltyEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                        {loyaltyEnabled ? 'Active' : 'Inactive'}
                      </span>
                      <Toggle checked={loyaltyEnabled} onChange={v => { setLoyaltyEnabled(v); save({ loyaltyEnabled: v }); }} />
                    </div>
                  </div>

                  {/* Card programme sub-toggle */}
                  <div className={`flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 ${!loyaltyEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                    <div className="flex items-center gap-2">
                      <PiCreditCard className="h-4 w-4 text-amber-400" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Physical / Digital Cards</p>
                        <p className="text-xs text-gray-400">Issue numbered loyalty cards with a prefix (e.g. {lcPrefix}0001)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold ${lcEnabled ? 'text-emerald-600' : 'text-gray-400'}`}>{lcEnabled ? 'On' : 'Off'}</span>
                      <Toggle checked={lcEnabled} onChange={v => { setLcEnabled(v); save({ loyaltyCard: { enabled: v } }); }} />
                    </div>
                  </div>
                </div>

                <div className={`space-y-3 ${!loyaltyEnabled ? 'pointer-events-none opacity-40' : ''}`}>

                  {/* ── Earn Rules ── */}
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
                      <PiCoins className="h-4 w-4 text-amber-500" />
                      <p className="text-sm font-bold text-gray-800">Earn Rules</p>
                    </div>
                    <div className="divide-y divide-gray-50">
                      <div className="flex items-center justify-between gap-4 px-6 py-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Earn rate</p>
                          <p className="mt-0.5 text-xs text-gray-400">Points earned per ₦100 spent</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" min={0.01} step={0.01}
                            value={Math.round(loyaltyPointsPerNaira * 100 * 100) / 100}
                            onChange={e => setLoyaltyPointsPerNaira((parseFloat(e.target.value) || 0) / 100)}
                            className="w-20 rounded-xl border border-gray-200 px-3 py-2 text-center text-sm font-bold outline-none focus:border-[#d97706]" />
                          <span className="text-xs text-gray-400">pts / ₦100</span>
                        </div>
                      </div>

                      <div className={`flex items-center justify-between gap-4 px-6 py-4 ${!lcEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Card-holder multiplier</p>
                          <p className="mt-0.5 text-xs text-gray-400">Bonus for customers presenting a loyalty card (base rate when no tiers)</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <input type="range" min={1} max={5} step={0.5} value={lcMultiplier}
                            onChange={e => setLcMultiplier(parseFloat(e.target.value))}
                            className="w-28 accent-[#d97706]" />
                          <span className="w-8 text-right text-sm font-black text-amber-600">{lcMultiplier}×</span>
                        </div>
                      </div>

                      <div className={`flex items-center justify-between gap-4 px-6 py-4 ${!lcEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Welcome bonus</p>
                          <p className="mt-0.5 text-xs text-gray-400">One-time bonus points on a card's first use</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" min={0} value={lcWelcome || ''} onChange={e => setLcWelcome(parseInt(e.target.value) || 0)}
                            placeholder="0" className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-center text-sm font-bold outline-none focus:border-[#d97706]" />
                          <span className="text-xs text-gray-400">pts</span>
                        </div>
                      </div>

                      {/* Card number prefix — only shown when cards enabled */}
                      {lcEnabled && (
                        <div className="flex items-center justify-between gap-4 px-6 py-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">Card number prefix</p>
                            <p className="mt-0.5 text-xs text-gray-400">Prepended to every issued card number</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input value={lcPrefix} onChange={e => setLcPrefix(e.target.value.slice(0, 10))}
                              className="w-24 rounded-xl border border-gray-200 px-3 py-2 font-mono text-sm font-bold outline-none focus:border-[#d97706]" />
                            <span className="rounded-lg bg-amber-50 px-2.5 py-1.5 font-mono text-xs font-bold text-amber-700">{lcPrefix}0001</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Double-points days ── */}
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
                      <PiLightning className="h-4 w-4 text-amber-500" />
                      <p className="text-sm font-bold text-gray-800">Bonus Points Days</p>
                      {lcDoublePointsDays.length > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">{lcBonusMultiplierDays}× on {lcDoublePointsDays.map(d => DAYS[d]).join(', ')}</span>
                      )}
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <p className="text-xs text-gray-400">Select days when earn rate is multiplied (e.g. double-points Wednesday)</p>
                      <div className="flex gap-2 flex-wrap">
                        {DAYS.map((day, d) => {
                          const active = lcDoublePointsDays.includes(d);
                          return (
                            <button key={d} type="button"
                              onClick={() => setLcDoublePointsDays(prev => active ? prev.filter(x => x !== d) : [...prev, d])}
                              className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors
                                ${active ? 'border-[#d97706]/40 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                              {day}
                            </button>
                          );
                        })}
                      </div>
                      {lcDoublePointsDays.length > 0 && (
                        <div className="flex items-center gap-3 pt-1">
                          <span className="text-xs text-gray-500 shrink-0">Multiplier on those days:</span>
                          <input type="range" min={1.5} max={5} step={0.5} value={lcBonusMultiplierDays}
                            onChange={e => setLcBonusMultiplierDays(parseFloat(e.target.value))}
                            className="flex-1 accent-[#d97706]" />
                          <span className="w-8 text-right text-sm font-black text-amber-600">{lcBonusMultiplierDays}×</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Redeem Rules ── */}
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
                      <PiGift className="h-4 w-4 text-amber-500" />
                      <p className="text-sm font-bold text-gray-800">Redeem Rules</p>
                    </div>
                    <div className="divide-y divide-gray-50">
                      <div className="flex items-center justify-between gap-4 px-6 py-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Points value</p>
                          <p className="mt-0.5 text-xs text-gray-400">How much ₦1 point is worth when redeemed</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-400">₦</span>
                          <input type="number" min={0.01} step={0.01} value={loyaltyPointsValue}
                            onChange={e => setLoyaltyPointsValue(parseFloat(e.target.value) || 0)}
                            className="w-20 rounded-xl border border-gray-200 px-3 py-2 text-center text-sm font-bold outline-none focus:border-[#d97706]" />
                          <span className="text-xs text-gray-400">per pt</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4 px-6 py-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Max redemption per order</p>
                          <p className="mt-0.5 text-xs text-gray-400">Cap on the % of an order total that can be paid with points</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <input type="range" min={5} max={100} step={5} value={loyaltyMaxRedemptionPct}
                            onChange={e => setLoyaltyMaxRedemptionPct(parseInt(e.target.value))}
                            className="w-28 accent-[#d97706]" />
                          <span className="w-10 text-right text-sm font-black text-amber-600">{loyaltyMaxRedemptionPct}%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4 px-6 py-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Minimum balance to redeem</p>
                          <p className="mt-0.5 text-xs text-gray-400">Customer must accumulate at least this many points before redeeming any</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" min={0} value={lcMinRedemption || ''} onChange={e => setLcMinRedemption(parseInt(e.target.value) || 0)}
                            placeholder="0" className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-center text-sm font-bold outline-none focus:border-[#d97706]" />
                          <span className="text-xs text-gray-400">pts</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Points Expiry ── */}
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
                      <PiClock className="h-4 w-4 text-amber-500" />
                      <p className="text-sm font-bold text-gray-800">Points Expiry</p>
                    </div>
                    <div className="px-6 py-4 space-y-3">
                      <div className="flex gap-2">
                        {[{ label: 'Never expire', v: 0 }, { label: 'Expire after N days', v: -1 }].map(opt => (
                          <button key={opt.label} type="button"
                            onClick={() => setLcPointsExpiry(opt.v === 0 ? 0 : (lcPointsExpiry > 0 ? lcPointsExpiry : 365))}
                            className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors
                              ${(opt.v === 0 ? lcPointsExpiry === 0 : lcPointsExpiry > 0)
                                ? 'border-[#d97706]/40 bg-amber-50 text-amber-700'
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {lcPointsExpiry > 0 && (
                        <div className="flex items-center gap-3">
                          <input type="number" min={1} value={lcPointsExpiry}
                            onChange={e => setLcPointsExpiry(parseInt(e.target.value) || 1)}
                            className="w-24 rounded-xl border border-amber-200 px-3 py-2 text-center text-sm font-bold outline-none focus:border-[#d97706]" />
                          <span className="text-sm text-gray-500">days after being earned</span>
                        </div>
                      )}
                      {lcPointsExpiry === 0 && <p className="text-xs text-gray-400">Points never expire — customers keep them indefinitely</p>}
                    </div>
                  </div>

                  {/* ── Membership Tiers ── */}
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <PiTrophy className="h-4 w-4 text-amber-500" />
                        <p className="text-sm font-bold text-gray-800">Membership Tiers</p>
                        {lcTiers.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">{lcTiers.length}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {lcTiers.length === 0 && PRESETS.map(p => (
                          <button key={p.label} type="button" onClick={() => setLcTiers(p.tiers)}
                            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-100">
                            {p.label}
                          </button>
                        ))}
                        <button type="button"
                          onClick={() => setLcTiers(prev => [...prev, { name: '', minPoints: (prev[prev.length - 1]?.minPoints ?? 0) + 500, multiplier: Math.min(5, (prev[prev.length - 1]?.multiplier ?? 1) + 0.5), color: '#d97706', benefits: '' }])}
                          className="flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100">
                          <PiPlus className="h-3.5 w-3.5" /> Add tier
                        </button>
                      </div>
                    </div>

                    {/* Visual tier progression */}
                    {sortedTiers.length > 0 && (
                      <div className="flex items-center gap-0 px-5 py-4 overflow-x-auto">
                        {sortedTiers.map((tier, i) => (
                          <div key={i} className="flex items-center min-w-0">
                            <div className="flex flex-col items-center gap-1 min-w-[72px]">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full text-white font-black text-sm shadow-sm"
                                style={{ backgroundColor: tier.color || '#d97706' }}>
                                {tier.name ? tier.name[0].toUpperCase() : '?'}
                              </div>
                              <span className="text-[10px] font-bold text-gray-700 text-center leading-tight">{tier.name || '—'}</span>
                              <span className="text-[9px] text-gray-400">{tier.minPoints.toLocaleString()} pts</span>
                              <span className="text-[9px] font-black" style={{ color: tier.color || '#d97706' }}>{tier.multiplier}×</span>
                            </div>
                            {i < sortedTiers.length - 1 && (
                              <div className="flex-1 h-0.5 min-w-[24px] mx-1" style={{ background: `linear-gradient(to right, ${sortedTiers[i].color}, ${sortedTiers[i+1].color})` }} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {lcTiers.length === 0 ? (
                      <div className="px-6 py-8 text-center">
                        <PiCrown className="mx-auto h-8 w-8 text-gray-200 mb-2" />
                        <p className="text-sm text-gray-500 font-medium">No tiers configured</p>
                        <p className="text-xs text-gray-400 mt-1 mb-3">Use a preset above or add tiers manually</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {lcTiers.map((tier, i) => (
                          <div key={i} className="px-5 py-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <input type="color" value={tier.color || '#d97706'}
                                onChange={e => setLcTiers(prev => prev.map((t, j) => j === i ? { ...t, color: e.target.value } : t))}
                                className="h-8 w-8 cursor-pointer rounded-lg border border-gray-200 p-0.5" />
                              <input value={tier.name} placeholder="Tier name (e.g. Gold)"
                                onChange={e => setLcTiers(prev => prev.map((t, j) => j === i ? { ...t, name: e.target.value } : t))}
                                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold outline-none focus:border-[#d97706]" />
                              <button type="button" onClick={() => setLcTiers(prev => prev.filter((_, j) => j !== i))}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-400">
                                <PiTrash className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="mb-1 block text-[10px] font-semibold text-gray-400">Min. points to reach</label>
                                <input type="number" min={0} value={tier.minPoints || ''}
                                  onChange={e => setLcTiers(prev => prev.map((t, j) => j === i ? { ...t, minPoints: parseInt(e.target.value) || 0 } : t))}
                                  placeholder="0" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold outline-none focus:border-[#d97706]" />
                              </div>
                              <div>
                                <label className="mb-1 block text-[10px] font-semibold text-gray-400">Earn multiplier</label>
                                <div className="flex items-center gap-2">
                                  <input type="range" min={1} max={5} step={0.5} value={tier.multiplier}
                                    onChange={e => setLcTiers(prev => prev.map((t, j) => j === i ? { ...t, multiplier: parseFloat(e.target.value) } : t))}
                                    className="flex-1 accent-[#d97706]" />
                                  <span className="w-8 shrink-0 text-right text-sm font-black" style={{ color: tier.color || '#d97706' }}>{tier.multiplier}×</span>
                                </div>
                              </div>
                            </div>
                            <input value={tier.benefits || ''}
                              onChange={e => setLcTiers(prev => prev.map((t, j) => j === i ? { ...t, benefits: e.target.value } : t))}
                              placeholder="Tier perks, e.g. Free delivery, Birthday bonus, Priority support"
                              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#d97706]" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Interactive calculator ── */}
                  {(() => {
                    const ptsPerN100   = Math.round(loyaltyPointsPerNaira * 100 * 100) / 100;
                    const currentTier  = tierForPoints(calcPoints);
                    const mult         = currentTier?.multiplier ?? lcMultiplier;
                    const todayDay     = new Date().getDay();
                    const isBonusDay   = lcDoublePointsDays.includes(todayDay);
                    const finalMult    = isBonusDay ? mult * lcBonusMultiplierDays : mult;
                    const earnedPts    = Math.round(calcOrder / 100 * ptsPerN100 * finalMult);
                    const bonusPts     = calcFirst ? lcWelcome : 0;
                    const totalNew     = calcPoints + earnedPts + bonusPts;
                    const nextTier     = sortedTiers.find(t => t.minPoints > totalNew);
                    const canRedeem    = calcPoints >= lcMinRedemption;
                    const maxRedeem    = Math.round(calcOrder * loyaltyMaxRedemptionPct / 100);
                    const redeemNaira  = canRedeem ? Math.min(Math.round(calcPoints * loyaltyPointsValue), maxRedeem) : 0;
                    return (
                      <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/40">
                        <div className="flex items-center gap-2 border-b border-amber-200/60 px-5 py-3.5">
                          <PiStar className="h-4 w-4 text-amber-500" />
                          <p className="text-sm font-bold text-amber-800">Points Calculator</p>
                          <span className="text-xs text-amber-500">— simulate how settings apply to a customer</span>
                        </div>
                        <div className="p-5 space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-amber-600">Order amount</label>
                              <div className="relative">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-amber-500">₦</span>
                                <input type="number" min={0} value={calcOrder}
                                  onChange={e => setCalcOrder(parseFloat(e.target.value) || 0)}
                                  className="w-full rounded-xl border border-amber-200 bg-white py-2.5 pl-7 pr-3 text-sm font-bold outline-none focus:border-[#d97706]" />
                              </div>
                            </div>
                            <div>
                              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-amber-600">Existing points balance</label>
                              <input type="number" min={0} value={calcPoints}
                                onChange={e => setCalcPoints(parseInt(e.target.value) || 0)}
                                className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-[#d97706]" />
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-800 select-none">
                              <input type="checkbox" checked={calcFirst} onChange={e => setCalcFirst(e.target.checked)} className="rounded accent-[#d97706]" />
                              First card use (welcome bonus applies)
                            </label>
                            {isBonusDay && (
                              <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                                🎉 Today ({DAYS[todayDay]}) is a {lcBonusMultiplierDays}× bonus day!
                              </span>
                            )}
                          </div>
                          <div className="rounded-xl bg-white border border-amber-200 divide-y divide-amber-100 overflow-hidden">
                            {currentTier && (
                              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50/40">
                                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: currentTier.color }} />
                                <span className="text-xs text-gray-600">Current tier: <strong style={{ color: currentTier.color }}>{currentTier.name}</strong> — {finalMult}× earn rate{isBonusDay ? ` (${mult}× tier × ${lcBonusMultiplierDays}× bonus day)` : ''}</span>
                              </div>
                            )}
                            <div className="flex justify-between px-4 py-2.5 text-xs text-gray-600">
                              <span>Points earned on ₦{calcOrder.toLocaleString()} order</span>
                              <strong className="text-amber-700">+{earnedPts.toLocaleString()} pts</strong>
                            </div>
                            {bonusPts > 0 && (
                              <div className="flex justify-between px-4 py-2.5 text-xs text-emerald-600">
                                <span>Welcome bonus</span>
                                <strong>+{bonusPts.toLocaleString()} pts</strong>
                              </div>
                            )}
                            <div className="flex justify-between px-4 py-2.5 text-xs font-bold text-gray-800 bg-amber-50/60">
                              <span>New balance after this order</span>
                              <span className="text-amber-700">{totalNew.toLocaleString()} pts</span>
                            </div>
                            <div className="flex justify-between px-4 py-2.5 text-xs text-gray-600">
                              <span>
                                Can redeem now
                                {!canRedeem && lcMinRedemption > 0 && ` (need ${lcMinRedemption.toLocaleString()} pts min)`}
                              </span>
                              <strong className={canRedeem && redeemNaira > 0 ? 'text-emerald-600' : 'text-gray-400'}>
                                {canRedeem && redeemNaira > 0 ? `₦${redeemNaira.toLocaleString()} off` : '—'}
                              </strong>
                            </div>
                            {nextTier && (
                              <div className="flex justify-between px-4 py-2.5 text-xs text-blue-600">
                                <span>To reach <strong>{nextTier.name}</strong></span>
                                <strong>{Math.max(0, nextTier.minPoints - totalNew).toLocaleString()} more pts needed</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                </div>

                {/* ── Save ── */}
                <div className="flex justify-end">
                  <button type="button" onClick={saveLoyaltyCard} disabled={saving}
                    className="flex items-center gap-1.5 rounded-xl px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    style={{ backgroundColor: '#d97706' }}>
                    <PiFloppyDisk className="h-4 w-4" /> Save Loyalty Settings
                  </button>
                </div>
              </div>
              );
            })()}

            {/* ── PROMOTIONS ───────────────────────────────────────────── */}
            {tab === 'promotions' && (
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50">
                      <PiLightning className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">Promotions</p>
                        {promotions.filter(p => p.active && !(p.endDate && new Date(p.endDate) < now)).length > 0 && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            {promotions.filter(p => p.active && !(p.endDate && new Date(p.endDate) < now)).length} active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">Automatic discounts applied at checkout when conditions are met</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setEditPromo('new')}
                    className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100">
                    <PiPlus className="h-3.5 w-3.5" /> New Promotion
                  </button>
                </div>

                {promotions.length === 0 ? (
                  <EmptyState icon={<PiLightning className="h-7 w-7 text-gray-300" />}
                    title="No promotions yet"
                    body="Create time-bounded promotions like 'Christmas Sale 20% off' or 'Weekend Special'"
                    action={<button type="button" onClick={() => setEditPromo('new')}
                      className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold text-white" style={{ backgroundColor: '#d97706' }}>
                      <PiPlus className="h-4 w-4" /> Create first promotion
                    </button>} />
                ) : (
                  <div className="divide-y divide-gray-50">
                    {[...promotions]
                      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
                      .map(p => {
                        const promoColor = p.color || '#d97706';
                        const endD    = p.endDate   ? new Date(p.endDate)   : null;
                        const startD  = p.startDate ? new Date(p.startDate) : null;
                        const expired = endD   && endD < now;
                        const future  = startD && startD > now;
                        const status  = !p.active ? 'inactive' : expired ? 'expired' : future ? 'scheduled' : 'live';

                        const daysLeft = endD && status === 'live'
                          ? Math.ceil((endD.getTime() - now.getTime()) / 86400000)
                          : null;
                        const daysUntilStart = startD && status === 'scheduled'
                          ? Math.ceil((startD.getTime() - now.getTime()) / 86400000)
                          : null;

                        const usagePct = (p.maxUsage ?? 0) > 0
                          ? Math.min(100, Math.round(((p.usageCount ?? 0) / p.maxUsage!) * 100))
                          : null;

                        const applyCount = (p.applyTo?.products?.length ?? 0) + (p.applyTo?.categories?.length ?? 0) + (p.applyTo?.brands?.length ?? 0);

                        return (
                          <div key={p._id} className={`flex gap-0 ${!p.active || expired ? 'opacity-50' : ''}`}>
                            {/* Coloured left border */}
                            <div className="w-1 shrink-0 rounded-l-sm" style={{ backgroundColor: status === 'live' ? promoColor : '#e5e7eb' }} />

                            <div className="flex flex-1 items-start gap-3 px-5 py-4 min-w-0">
                              <div className="flex-1 min-w-0 space-y-1.5">
                                {/* Name + discount badge + status */}
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-bold text-gray-900">{p.name}</span>
                                  <span className="rounded-full px-2 py-0.5 text-[10px] font-black text-white"
                                    style={{ backgroundColor: promoColor }}>
                                    {p.reward?.discountType === 'pct' || p.type === 'pct'
                                      ? `${p.reward?.discountValue ?? p.value}% off`
                                      : `₦${formatCurrency(p.reward?.discountValue ?? p.value)} off`}
                                  </span>
                                  {status === 'live' && (
                                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                                      ● Live{daysLeft !== null ? ` · ${daysLeft}d left` : ''}
                                    </span>
                                  )}
                                  {status === 'scheduled' && (
                                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                                      Starts in {daysUntilStart}d
                                    </span>
                                  )}
                                  {status === 'expired' && (
                                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-500">Expired</span>
                                  )}
                                  {p.stackable && (
                                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-600">Stackable</span>
                                  )}
                                  {(p.priority ?? 0) > 0 && (
                                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">P{p.priority}</span>
                                  )}
                                </div>

                                {/* Dates */}
                                {(p.startDate || p.endDate) && (
                                  <p className="text-[10px] text-gray-400">
                                    {p.startDate && new Date(p.startDate).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                                    {p.startDate && p.endDate && ' → '}
                                    {p.endDate   && new Date(p.endDate).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                                  </p>
                                )}

                                {/* Usage progress */}
                                {usagePct !== null && (
                                  <div className="space-y-0.5">
                                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                                      <span>Usage</span>
                                      <span>{p.usageCount ?? 0} / {p.maxUsage}</span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-gray-100">
                                      <div className="h-1.5 rounded-full transition-all"
                                        style={{ width: `${usagePct}%`, backgroundColor: usagePct >= 90 ? '#ef4444' : promoColor }} />
                                    </div>
                                  </div>
                                )}

                                {/* Applies to + description */}
                                <div className="flex flex-wrap items-center gap-2">
                                  {applyCount > 0 ? (
                                    <span className="text-[10px] text-gray-400">
                                      Applies to {[
                                        p.applyTo?.products?.length   ? `${p.applyTo.products.length} product${p.applyTo.products.length > 1 ? 's' : ''}` : null,
                                        p.applyTo?.categories?.length ? `${p.applyTo.categories.length} categor${p.applyTo.categories.length > 1 ? 'ies' : 'y'}` : null,
                                        p.applyTo?.brands?.length     ? `${p.applyTo.brands.length} brand${p.applyTo.brands.length > 1 ? 's' : ''}` : null,
                                      ].filter(Boolean).join(', ')}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-gray-400">All products</span>
                                  )}
                                  {p.description && <span className="text-[10px] text-gray-400">· {p.description}</span>}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex shrink-0 items-center gap-1">
                                <button type="button" onClick={() => promoCrud.toggle(p._id)}
                                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${p.active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                                  {p.active ? <PiToggleRight className="h-5 w-5" /> : <PiToggleLeft className="h-5 w-5" />}
                                </button>
                                <button type="button" onClick={() => setEditPromo(p)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                                  <PiPencilSimple className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={() => promoCrud.delete(p._id)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500">
                                  <PiTrash className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* ── DISCOUNT CODES ───────────────────────────────────────── */}
            {tab === 'codes' && (
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50">
                      <PiTag className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">Discount Codes</p>
                        {discountCodes.filter(c => c.active).length > 0 && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            {discountCodes.filter(c => c.active).length} active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">Reusable codes cashiers enter at checkout — staff discounts, vendor codes, etc.</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setEditCode('new')}
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
                    <PiPlus className="h-3.5 w-3.5" /> New Code
                  </button>
                </div>

                {discountCodes.length === 0 ? (
                  <EmptyState icon={<PiTag className="h-7 w-7 text-gray-300" />}
                    title="No discount codes yet"
                    body="Create reusable codes like STAFF25 or MEMBER20 that cashiers can enter at checkout"
                    action={<button type="button" onClick={() => setEditCode('new')}
                      className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold text-white" style={{ backgroundColor: '#059669' }}>
                      <PiPlus className="h-4 w-4" /> Create first code
                    </button>} />
                ) : (
                  <div className="divide-y divide-gray-50">
                    {discountCodes.map(d => {
                      const codeColor  = d.color || '#059669';
                      const endD       = d.validTo   ? new Date(d.validTo)   : null;
                      const startD     = d.validFrom ? new Date(d.validFrom) : null;
                      const expired    = endD   && endD < now;
                      const scheduled  = startD && startD > now;
                      const daysLeft   = endD && !expired ? Math.ceil((endD.getTime() - now.getTime()) / 86400000) : null;
                      const usagePct   = (d.maxUsage ?? 0) > 0 ? Math.min(100, Math.round(((d.usageCount ?? 0) / d.maxUsage!) * 100)) : null;
                      const applyCount = (d.applyTo?.products?.length ?? 0) + (d.applyTo?.categories?.length ?? 0) + (d.applyTo?.brands?.length ?? 0);

                      function copyToClipboard() {
                        navigator.clipboard.writeText(d.code).catch(() => {});
                        toast.success(`Copied "${d.code}"`);
                      }

                      return (
                        <div key={d._id} className={`flex gap-0 ${!d.active || expired ? 'opacity-50' : ''}`}>
                          <div className="w-1 shrink-0 rounded-l-sm" style={{ backgroundColor: d.active && !expired ? codeColor : '#e5e7eb' }} />

                          <div className="flex flex-1 items-start gap-3 px-5 py-4 min-w-0">
                            <div className="flex-1 min-w-0 space-y-1.5">
                              {/* Code pill + name + discount + status */}
                              <div className="flex flex-wrap items-center gap-2">
                                <button type="button" onClick={copyToClipboard} title="Click to copy"
                                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-xs font-black tracking-widest text-white hover:opacity-80 transition-opacity"
                                  style={{ backgroundColor: codeColor }}>
                                  {d.code}
                                  <PiCopy className="h-3 w-3 opacity-70" />
                                </button>
                                <span className="text-sm font-semibold text-gray-900">{d.name}</span>
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                                  {(d.reward?.discountValue ?? d.value) > 0
                                    ? (d.reward?.discountType ?? d.type) === 'pct'
                                      ? `${d.reward?.discountValue ?? d.value}% off`
                                      : `₦${formatCurrency(d.reward?.discountValue ?? d.value)} off`
                                    : '—'}
                                </span>
                                {expired   && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-500">Expired</span>}
                                {scheduled && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">Scheduled</span>}
                                {!expired && !scheduled && daysLeft !== null && daysLeft <= 7 && (
                                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">Expires in {daysLeft}d</span>
                                )}
                              </div>

                              {/* Validity dates */}
                              {(d.validFrom || d.validTo) && (
                                <p className="text-[10px] text-gray-400">
                                  {d.validFrom && `From ${new Date(d.validFrom).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}`}
                                  {d.validFrom && d.validTo && ' → '}
                                  {d.validTo   && new Date(d.validTo).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                                </p>
                              )}

                              {/* Usage bar */}
                              {usagePct !== null && (
                                <div className="space-y-0.5">
                                  <div className="flex justify-between text-[10px] text-gray-400">
                                    <span>Usage</span>
                                    <span>{d.usageCount ?? 0} / {d.maxUsage}</span>
                                  </div>
                                  <div className="h-1.5 w-full rounded-full bg-gray-100">
                                    <div className="h-1.5 rounded-full transition-all"
                                      style={{ width: `${usagePct}%`, backgroundColor: usagePct >= 90 ? '#ef4444' : codeColor }} />
                                  </div>
                                </div>
                              )}

                              {/* Applies-to + description */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                {applyCount > 0 ? (
                                  <span className="text-[10px] text-gray-400">
                                    {[
                                      d.applyTo?.products?.length   ? `${d.applyTo.products.length} product${d.applyTo.products.length > 1 ? 's' : ''}` : null,
                                      d.applyTo?.categories?.length ? `${d.applyTo.categories.length} categor${d.applyTo.categories.length > 1 ? 'ies' : 'y'}` : null,
                                      d.applyTo?.brands?.length     ? `${d.applyTo.brands.length} brand${d.applyTo.brands.length > 1 ? 's' : ''}` : null,
                                    ].filter(Boolean).join(', ')}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-gray-400">All products</span>
                                )}
                                {d.description && <span className="text-[10px] text-gray-400">· {d.description}</span>}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex shrink-0 items-center gap-1">
                              <button type="button" onClick={() => codeCrud.toggle(d._id)}
                                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${d.active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                                {d.active ? <PiToggleRight className="h-5 w-5" /> : <PiToggleLeft className="h-5 w-5" />}
                              </button>
                              <button type="button" onClick={() => setEditCode(d)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                                <PiPencilSimple className="h-4 w-4" />
                              </button>
                              <button type="button" onClick={() => codeCrud.delete(d._id)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500">
                                <PiTrash className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── BUY X GET Y ─────────────────────────────────────────── */}
            {tab === 'bxgy' && (
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-50">
                      <PiShoppingCart className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">Buy X Get Y</p>
                        {buyXGetY.filter(b => b.active && !(b.validTo && new Date(b.validTo) < now)).length > 0 && (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                            {buyXGetY.filter(b => b.active && !(b.validTo && new Date(b.validTo) < now)).length} active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">Quantity deals — Buy 2 Get 1 Free, Buy 3 get 1 at 50% off, etc.</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setEditBxgy('new')}
                    className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100">
                    <PiPlus className="h-3.5 w-3.5" /> New Offer
                  </button>
                </div>

                {buyXGetY.length === 0 ? (
                  <EmptyState icon={<PiShoppingCart className="h-7 w-7 text-gray-300" />}
                    title="No Buy X Get Y offers yet"
                    body="Create quantity deals like 'Buy 2 get 1 free' or 'Buy 3 cocktails get 1 at 50% off'"
                    action={<button type="button" onClick={() => setEditBxgy('new')}
                      className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold text-white" style={{ backgroundColor: '#7c3aed' }}>
                      <PiPlus className="h-4 w-4" /> Create first offer
                    </button>} />
                ) : (
                  <div className="divide-y divide-gray-50">
                    {buyXGetY.map(b => {
                      const offerColor = b.color || '#7c3aed';
                      const endD      = b.validTo   ? new Date(b.validTo)   : null;
                      const startD    = b.validFrom ? new Date(b.validFrom) : null;
                      const expired   = endD   && endD < now;
                      const scheduled = startD && startD > now;
                      const daysLeft  = endD && !expired ? Math.ceil((endD.getTime() - now.getTime()) / 86400000) : null;
                      const usagePct   = (b.maxUsage ?? 0) > 0 ? Math.min(100, Math.round(((b.usageCount ?? 0) / b.maxUsage!) * 100)) : null;
                      const isLive     = b.active && !expired && !scheduled;

                      return (
                        <div key={b._id} className={`flex gap-0 ${!b.active || expired ? 'opacity-50' : ''}`}>
                          <div className="w-1 shrink-0 rounded-l-sm"
                            style={{ backgroundColor: isLive ? offerColor : '#e5e7eb' }} />

                          <div className="flex flex-1 items-start gap-3 px-5 py-4 min-w-0">
                            {/* Visual buy/get badge */}
                            <div className="hidden sm:flex shrink-0 flex-col items-center gap-0.5 rounded-xl border-2 px-3 py-2 text-center"
                              style={{ borderColor: `${offerColor}50`, backgroundColor: `${offerColor}0d` }}>
                              <span className="text-2xl font-black leading-none" style={{ color: offerColor }}>{b.buyQty}</span>
                              <span className="text-[9px] font-bold text-gray-400 leading-tight">BUY</span>
                              <div className="my-0.5 w-6 border-t border-dashed" style={{ borderColor: `${offerColor}60` }} />
                              <span className="text-2xl font-black leading-none" style={{ color: offerColor }}>{b.getQty}</span>
                              <span className="text-[9px] font-bold leading-tight" style={{ color: offerColor }}>
                                {b.getDiscountPct === 100 ? 'FREE' : `${b.getDiscountPct}%`}
                              </span>
                            </div>

                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-gray-900">{b.name}</span>
                                <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white"
                                  style={{ backgroundColor: offerColor }}>
                                  Buy {b.buyQty} Get {b.getQty} {b.getDiscountPct === 100 ? 'Free' : `at ${b.getDiscountPct}% off`}
                                </span>
                                {isLive && daysLeft !== null && daysLeft <= 7 && (
                                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">{daysLeft}d left</span>
                                )}
                                {expired   && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-500">Expired</span>}
                                {scheduled && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">Scheduled</span>}
                                {b.stackable && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">Stackable</span>}
                              </div>

                              {(b.validFrom || b.validTo) && (
                                <p className="text-[10px] text-gray-400">
                                  {b.validFrom && new Date(b.validFrom).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                                  {b.validFrom && b.validTo && ' → '}
                                  {b.validTo   && new Date(b.validTo).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                                </p>
                              )}

                              {usagePct !== null && (
                                <div className="space-y-0.5">
                                  <div className="flex justify-between text-[10px] text-gray-400">
                                    <span>Usage</span><span>{b.usageCount ?? 0} / {b.maxUsage}</span>
                                  </div>
                                  <div className="h-1.5 w-full rounded-full bg-gray-100">
                                    <div className="h-1.5 rounded-full transition-all"
                                      style={{ width: `${usagePct}%`, backgroundColor: usagePct >= 90 ? '#ef4444' : offerColor }} />
                                  </div>
                                </div>
                              )}

                              <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
                                <span>
                                  Buy: {(b.buyProducts?.length ?? 0) > 0 ? `${b.buyProducts!.length} product${b.buyProducts!.length > 1 ? 's' : ''}` : 'any'}
                                </span>
                                <span>·</span>
                                <span>
                                  Get: {(b.getProducts?.length ?? 0) > 0 ? `${b.getProducts!.length} product${b.getProducts!.length > 1 ? 's' : ''}` : 'same'}
                                </span>
                                {b.description && <><span>·</span><span>{b.description}</span></>}
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                              <button type="button" onClick={() => bxgyCrud.toggle(b._id)}
                                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${b.active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                                {b.active ? <PiToggleRight className="h-5 w-5" /> : <PiToggleLeft className="h-5 w-5" />}
                              </button>
                              <button type="button" onClick={() => setEditBxgy(b)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                                <PiPencilSimple className="h-4 w-4" />
                              </button>
                              <button type="button" onClick={() => bxgyCrud.delete(b._id)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500">
                                <PiTrash className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── NEXT ORDER COUPONS ───────────────────────────────────── */}
            {tab === 'nextorder' && (
              <div className="space-y-4">

                {/* Programme header */}
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-3 px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-50">
                        <PiGift className="h-5 w-5 text-pink-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Next Order Coupons</p>
                        <p className="text-xs text-gray-400">Automatically issue a discount coupon at the end of qualifying purchases</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${nocEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                        {nocEnabled ? 'Active' : 'Inactive'}
                      </span>
                      <Toggle checked={nocEnabled} onChange={v => { setNocEnabled(v); }} />
                    </div>
                  </div>
                </div>

                <div className={`space-y-3 ${!nocEnabled ? 'pointer-events-none opacity-40' : ''}`}>

                  {/* ── Earn Trigger ── */}
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
                      <PiLightning className="h-4 w-4 text-pink-500" />
                      <p className="text-sm font-bold text-gray-800">Earn Trigger</p>
                      <span className="text-xs text-gray-400">— when is the coupon issued?</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      <div className="flex items-center justify-between gap-4 px-6 py-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Min. qualifying order</p>
                          <p className="mt-0.5 text-xs text-gray-400">Customer must spend at least this on the current order to receive the coupon (₦0 = every order qualifies)</p>
                        </div>
                        <div className="relative shrink-0">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₦</span>
                          <input type="number" min={0} value={nocMinOrder || ''} onChange={e => setNocMinOrder(parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-32 rounded-xl border border-gray-200 py-2.5 pl-7 pr-3 text-sm font-bold outline-none focus:border-[#be185d]" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Coupon Details ── */}
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
                      <PiTicket className="h-4 w-4 text-pink-500" />
                      <p className="text-sm font-bold text-gray-800">Coupon Details</p>
                      <span className="text-xs text-gray-400">— what does the customer get?</span>
                    </div>
                    <div className="divide-y divide-gray-50">

                      {/* Color + prefix row */}
                      <div className="flex items-center justify-between gap-4 px-6 py-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Coupon colour & prefix</p>
                          <p className="mt-0.5 text-xs text-gray-400">Visual colour and code prefix for generated coupons</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <input type="color" value={nocColor} onChange={e => setNocColor(e.target.value)}
                            className="h-9 w-9 cursor-pointer rounded-xl border border-gray-200 p-1" />
                          <input value={nocPrefix} onChange={e => setNocPrefix(e.target.value.slice(0, 10).toUpperCase())}
                            className="w-28 rounded-xl border border-gray-200 px-3 py-2.5 font-mono text-sm font-bold uppercase outline-none focus:border-[#be185d]" />
                        </div>
                      </div>

                      {/* Discount */}
                      <div className="flex items-center justify-between gap-4 px-6 py-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Discount amount</p>
                          <p className="mt-0.5 text-xs text-gray-400">How much the generated coupon takes off the next order</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <TypeToggle value={nocType} onChange={setNocType} color={nocColor} />
                          <input type="number" min={0} max={nocType === 'pct' ? 100 : undefined} value={nocValue}
                            onChange={e => setNocValue(parseFloat(e.target.value) || 0)}
                            className="w-24 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold text-center outline-none focus:border-[#be185d]" />
                          <span className="text-sm text-gray-400 w-4">{nocType === 'pct' ? '%' : '₦'}</span>
                        </div>
                      </div>

                      {/* Expiry */}
                      <div className="flex items-center justify-between gap-4 px-6 py-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Valid for</p>
                          <p className="mt-0.5 text-xs text-gray-400">Days before the generated coupon expires</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input type="number" min={1} value={nocValidDays}
                            onChange={e => setNocValidDays(parseInt(e.target.value) || 1)}
                            className="w-20 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold text-center outline-none focus:border-[#be185d]" />
                          <span className="text-sm text-gray-400">days</span>
                        </div>
                      </div>

                      {/* Min redemption order */}
                      <div className="flex items-center justify-between gap-4 px-6 py-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Min. order to redeem</p>
                          <p className="mt-0.5 text-xs text-gray-400">The coupon can only be applied to orders above this amount (₦0 = no minimum)</p>
                        </div>
                        <div className="relative shrink-0">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₦</span>
                          <input type="number" min={0} value={nocMinRedeemOrder || ''} onChange={e => setNocMinRedeemOrder(parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-32 rounded-xl border border-gray-200 py-2.5 pl-7 pr-3 text-sm font-bold outline-none focus:border-[#be185d]" />
                        </div>
                      </div>

                      {/* One-use toggle */}
                      <div className="flex items-center justify-between gap-4 px-6 py-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Single use</p>
                          <p className="mt-0.5 text-xs text-gray-400">Each generated coupon can only be redeemed once</p>
                        </div>
                        <Toggle checked={nocOneUse} onChange={setNocOneUse} />
                      </div>
                    </div>
                  </div>

                  {/* ── Available On ── */}
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
                      <PiShoppingCart className="h-4 w-4 text-pink-500" />
                      <p className="text-sm font-bold text-gray-800">Redeemable On</p>
                      <span className="text-xs text-gray-400">— where can the coupon be used?</span>
                    </div>
                    <div className="px-5 py-4">
                      <AvailableOnSection value={nocAvailableOn} onChange={setNocAvailableOn} />
                    </div>
                  </div>

                  {/* ── Coupon ticket preview ── */}
                  <div className="overflow-hidden rounded-2xl border-2 border-dashed" style={{ borderColor: `${nocColor}60` }}>
                    <div className="px-5 py-3.5 flex items-center gap-2" style={{ backgroundColor: `${nocColor}0d` }}>
                      <PiTicket className="h-4 w-4" style={{ color: nocColor }} />
                      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: nocColor }}>Coupon preview — how it appears at receipt</p>
                    </div>
                    <div className="bg-white px-5 py-4">
                      {/* Ticket card */}
                      <div className="relative overflow-hidden rounded-2xl shadow-md max-w-sm mx-auto">
                        {/* Coloured left band */}
                        <div className="flex">
                          <div className="w-3 shrink-0" style={{ backgroundColor: nocColor }} />
                          <div className="flex-1 px-5 py-4 bg-white border border-gray-100 rounded-r-2xl">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Your next order</p>
                                <p className="text-xl font-black leading-tight" style={{ color: nocColor }}>
                                  {nocType === 'pct' ? `${nocValue}% OFF` : `₦${nocValue.toLocaleString()} OFF`}
                                </p>
                                {nocMinRedeemOrder > 0 && (
                                  <p className="text-[9px] text-gray-400 mt-0.5">on orders over ₦{nocMinRedeemOrder.toLocaleString()}</p>
                                )}
                              </div>
                              <div className="rounded-xl px-3 py-2 text-center" style={{ backgroundColor: `${nocColor}15` }}>
                                <p className="font-mono text-xs font-black tracking-widest" style={{ color: nocColor }}>{nocPrefix}A8X2P7K1</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between border-t border-dashed border-gray-200 pt-2.5 mt-2.5 text-[9px] text-gray-400">
                              <span>Valid for {nocValidDays} days from today</span>
                              {nocOneUse && <span>Single use</span>}
                              {nocAvailableOn.pos && <span>● POS</span>}
                              {nocAvailableOn.website && <span>● Online</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Flow description */}
                      <div className="mt-4 flex items-start gap-2 text-xs text-gray-400">
                        <PiArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>
                          {nocMinOrder > 0
                            ? `Issued when a customer spends ₦${nocMinOrder.toLocaleString()}+`
                            : 'Issued after every purchase'}
                          {' → '}code printed on receipt
                          {' → '}customer redeems on next visit
                          {nocMinRedeemOrder > 0 ? ` (orders ₦${nocMinRedeemOrder.toLocaleString()}+)` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Save */}
                <div className="flex justify-end">
                  <button type="button" onClick={saveNextOrder} disabled={saving}
                    className="flex items-center gap-1.5 rounded-xl px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    style={{ backgroundColor: nocColor }}>
                    <PiFloppyDisk className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Settings'}
                  </button>
                </div>
              </div>
            )}

          </>
        )}
      </div>

      {/* Modals */}
      {editCoupon && <CouponModal initial={editCoupon === 'new' ? undefined : editCoupon} onSave={handleSaveCoupon} onClose={() => setEditCoupon(null)} adminToken={token ?? undefined} />}
      {editCode   && <DiscountCodeModal initial={editCode === 'new' ? undefined : editCode} onSave={handleSaveCode} onClose={() => setEditCode(null)} adminToken={token ?? undefined} />}
      {editPromo  && <PromotionModal initial={editPromo === 'new' ? undefined : editPromo} onSave={handleSavePromo} onClose={() => setEditPromo(null)} adminToken={token ?? undefined} />}
      {editBxgy   && <BuyXGetYModal initial={editBxgy === 'new' ? undefined : editBxgy} onSave={handleSaveBxgy} onClose={() => setEditBxgy(null)} adminToken={token ?? undefined} />}
    </div>
  );
}
