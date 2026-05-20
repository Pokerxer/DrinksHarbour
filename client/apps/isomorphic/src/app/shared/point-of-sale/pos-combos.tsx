// @ts-nocheck
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  PiPlus, PiPencilSimple, PiTrash, PiX, PiPackage,
  PiArrowsClockwise, PiCheckCircle, PiWarningCircle,
  PiToggleLeft, PiToggleRight, PiCurrencyNgn, PiListPlus,
  PiMinus, PiMagnifyingGlass, PiArrowRight, PiStar,
  PiDotsSixVertical, PiInfo,
} from 'react-icons/pi';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import POSNavHeader from '@/app/shared/point-of-sale/pos-nav-header';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ── API ───────────────────────────────────────────────────────────────────────

async function apiReq(method: string, path: string, token: string, body?: any) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Request failed');
  return json.data;
}

const fetchCombos  = (t: string) => apiReq('GET', '/api/pos-combos', t);
const createCombo  = (t: string, b: any) => apiReq('POST', '/api/pos-combos', t, b);
const updateCombo  = (t: string, id: string, b: any) => apiReq('PATCH', `/api/pos-combos/${id}`, t, b);
const deleteCombo  = (t: string, id: string) => apiReq('DELETE', `/api/pos-combos/${id}`, t);
const fetchProducts = async (t: string) => {
  const r = await fetch(`${API}/api/pos/products?limit=200`, { headers: { Authorization: `Bearer ${t}` } });
  return (await r.json()).data?.products || [];
};

// ── Types ─────────────────────────────────────────────────────────────────────

type ChoiceLine = {
  _id?: string;
  label: string;
  minSelect: number;
  maxSelect: number;
  required: boolean;
  products: string[];
};

type Combo = {
  _id: string;
  name: string;
  description: string;
  price: number;
  active: boolean;
  choiceLines: ChoiceLine[];
  triggerProducts: any[];
};

type Product = {
  _id: string;
  sku: string;
  baseSellingPrice: number;
  availableStock: number;
  product: { name: string; images?: { thumbnail?: string; url?: string }[] };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const blankLine = (): ChoiceLine => ({ label: '', minSelect: 1, maxSelect: 1, required: true, products: [] });

const GROUP_COLORS = [
  { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500',   border: 'border-blue-200'   },
  { bg: 'bg-violet-50', text: 'text-violet-700',  dot: 'bg-violet-500', border: 'border-violet-200' },
  { bg: 'bg-amber-50',  text: 'text-amber-700',   dot: 'bg-amber-500',  border: 'border-amber-200'  },
  { bg: 'bg-emerald-50',text: 'text-emerald-700', dot: 'bg-emerald-500',border: 'border-emerald-200'},
  { bg: 'bg-rose-50',   text: 'text-rose-700',    dot: 'bg-rose-500',   border: 'border-rose-200'   },
];
const gc = (i: number) => GROUP_COLORS[i % GROUP_COLORS.length];

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({ value, min, max, onChange }: { value: number; min: number; max?: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      <button type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-100 disabled:opacity-30">
        <PiMinus className="h-2.5 w-2.5" />
      </button>
      <span className="w-7 text-center text-sm font-bold text-gray-800">{value}</span>
      <button type="button"
        onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
        disabled={max !== undefined && value >= max}
        className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-100 disabled:opacity-30">
        <PiPlus className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

// ── Inline product picker for a choice group ──────────────────────────────────

function GroupProductPicker({
  all, selected, onAdd, onRemove,
}: { all: Product[]; selected: string[]; onAdd: (id: string) => void; onRemove: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtered = all.filter(p =>
    !selected.includes(p._id) &&
    (p.product?.name?.toLowerCase().includes(q.toLowerCase()) || p.sku?.toLowerCase().includes(q.toLowerCase()))
  );
  const selectedProducts = all.filter(p => selected.includes(p._id));

  return (
    <div className="space-y-2">
      {/* Selected product chips */}
      {selectedProducts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedProducts.map(p => {
            const img = p.product?.images?.[0]?.thumbnail || p.product?.images?.[0]?.url;
            return (
              <div key={p._id}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs shadow-sm">
                {img
                  ? <img src={img} className="h-5 w-5 rounded object-cover" alt="" />
                  : <span className="text-base leading-none">🍾</span>
                }
                <span className="font-medium text-gray-700 max-w-[120px] truncate">{p.product?.name || p.sku}</span>
                <span className="text-[10px] text-gray-400">{formatCurrency(p.baseSellingPrice)}</span>
                <button type="button" onClick={() => onRemove(p._id)} className="ml-0.5 text-gray-300 hover:text-red-400">
                  <PiX className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add products dropdown */}
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:border-[#b20202] hover:text-[#b20202] transition-colors"
        >
          <PiPlus className="h-3 w-3" />
          Add products
        </button>

        {open && (
          <div className="absolute left-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="border-b border-gray-100 p-2">
              <div className="relative">
                <PiMagnifyingGlass className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Search products…"
                  className="w-full rounded-lg border border-gray-200 py-1.5 pl-7 pr-2.5 text-xs outline-none focus:border-[#b20202]"
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="py-4 text-center text-xs text-gray-400">
                  {q ? 'No matching products' : 'All products already added'}
                </p>
              )}
              {filtered.map(p => {
                const img = p.product?.images?.[0]?.thumbnail || p.product?.images?.[0]?.url;
                return (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => { onAdd(p._id); setQ(''); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                  >
                    {img
                      ? <img src={img} className="h-8 w-8 shrink-0 rounded-lg object-cover" alt="" />
                      : <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm">🍾</div>
                    }
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-gray-800">{p.product?.name || p.sku}</p>
                      <p className="text-[10px] text-gray-400">{formatCurrency(p.baseSellingPrice)}</p>
                    </div>
                    <PiPlus className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── POS Preview panel ─────────────────────────────────────────────────────────

function POSPreview({
  name, price, lines, allProducts,
}: { name: string; price: number; lines: ChoiceLine[]; allProducts: Product[] }) {
  // Simulate cashier selections (first product in each group)
  const [selections, setSelections] = useState<Record<number, string[]>>({});

  const getProduct = (id: string) => allProducts.find(p => p._id === id);

  function toggle(lineIdx: number, productId: string, maxSelect: number) {
    setSelections(prev => {
      const current = prev[lineIdx] || [];
      if (current.includes(productId)) {
        return { ...prev, [lineIdx]: current.filter(x => x !== productId) };
      }
      if (current.length >= maxSelect) {
        // Replace oldest if at max
        return { ...prev, [lineIdx]: [...current.slice(1), productId] };
      }
      return { ...prev, [lineIdx]: [...current, productId] };
    });
  }

  // Price calculation
  const selectedTotal = lines.reduce((sum, line, i) => {
    const sel = selections[i] || [];
    return sum + sel.reduce((s, id) => s + (getProduct(id)?.baseSellingPrice || 0), 0);
  }, 0);
  const finalPrice = price > 0 ? price : selectedTotal;

  // Min/max price range (if dynamic)
  const minPrice = lines.reduce((sum, line) => {
    const sorted = [...line.products]
      .map(id => getProduct(id)?.baseSellingPrice || 0)
      .sort((a, b) => a - b);
    return sum + sorted.slice(0, line.minSelect).reduce((s, v) => s + v, 0);
  }, 0);
  const maxPrice = lines.reduce((sum, line) => {
    const sorted = [...line.products]
      .map(id => getProduct(id)?.baseSellingPrice || 0)
      .sort((a, b) => b - a);
    return sum + sorted.slice(0, line.maxSelect).reduce((s, v) => s + v, 0);
  }, 0);

  return (
    <div className="flex h-full flex-col">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">POS Preview</p>

      <div className="flex-1 overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50">
        {/* Combo header */}
        <div className="border-b border-gray-200 bg-white px-4 py-3">
          <p className="font-bold text-gray-900">{name || 'Combo name…'}</p>
          {price > 0 ? (
            <p className="text-sm font-semibold text-[#b20202]">{formatCurrency(price)}</p>
          ) : (
            <p className="text-xs text-gray-400">
              {minPrice === maxPrice
                ? formatCurrency(minPrice)
                : `${formatCurrency(minPrice)} – ${formatCurrency(maxPrice)}`}
            </p>
          )}
        </div>

        {/* Choice groups */}
        <div className="divide-y divide-gray-100">
          {lines.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-gray-400">Add choice groups to see preview</p>
          )}
          {lines.map((line, i) => {
            const color = gc(i);
            const sel = selections[i] || [];
            const isSatisfied = sel.length >= line.minSelect;

            return (
              <div key={i} className="px-4 py-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${color.dot}`}>
                    {i + 1}
                  </span>
                  <span className="text-xs font-bold text-gray-800">{line.label || `Group ${i + 1}`}</span>
                  <span className="ml-auto text-[10px] text-gray-400">
                    {line.minSelect === line.maxSelect
                      ? `Pick ${line.minSelect}`
                      : `Pick ${line.minSelect}–${line.maxSelect}`}
                    {!line.required && <span className="ml-1 text-gray-300">(optional)</span>}
                  </span>
                  {isSatisfied && <PiCheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                </div>

                <div className="space-y-1">
                  {line.products.length === 0 && (
                    <p className="text-[11px] italic text-gray-300">No products added</p>
                  )}
                  {line.products.map(pid => {
                    const p = getProduct(pid);
                    if (!p) return null;
                    const chosen = sel.includes(pid);
                    const isMulti = line.maxSelect > 1;
                    const img = p.product?.images?.[0]?.thumbnail || p.product?.images?.[0]?.url;

                    return (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => toggle(i, pid, line.maxSelect)}
                        className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-all ${
                          chosen
                            ? `${color.border} ${color.bg} shadow-sm`
                            : 'border-gray-100 bg-white hover:border-gray-200'
                        }`}
                      >
                        {/* Radio/checkbox indicator */}
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-${isMulti ? 'md' : 'full'} border-2 transition-colors ${
                          chosen ? `${color.dot} border-current` : 'border-gray-300'
                        }`}>
                          {chosen && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                        {img
                          ? <img src={img} className="h-8 w-8 shrink-0 rounded-lg object-cover" alt="" />
                          : <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm">🍾</div>
                        }
                        <div className="flex-1 min-w-0">
                          <p className={`truncate text-xs font-semibold ${chosen ? color.text : 'text-gray-700'}`}>
                            {p.product?.name || p.sku}
                          </p>
                          <p className="text-[10px] text-gray-400">{formatCurrency(p.baseSellingPrice)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Running total */}
        {lines.length > 0 && (
          <div className="sticky bottom-0 border-t border-gray-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Combo Total</span>
              <span className="text-base font-black text-gray-900">{formatCurrency(finalPrice)}</span>
            </div>
            {price === 0 && selectedTotal > 0 && (
              <p className="mt-0.5 text-[10px] text-gray-400">Dynamic — sum of selections</p>
            )}
          </div>
        )}
      </div>

      <p className="mt-2 text-[10px] text-gray-400 text-center">
        Click products above to simulate cashier selection
      </p>
    </div>
  );
}

// ── Combo modal ───────────────────────────────────────────────────────────────

function ComboModal({ initial, products, onSave, onClose }: {
  initial?: Combo;
  products: Product[];
  onSave: (d: any) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName]         = useState(initial?.name || '');
  const [desc, setDesc]         = useState(initial?.description || '');
  const [priceMode, setPriceMode] = useState<'fixed' | 'dynamic'>(
    initial?.price && initial.price > 0 ? 'fixed' : 'dynamic'
  );
  const [fixedPrice, setFixedPrice] = useState(String(initial?.price || ''));
  const [active, setActive]     = useState(initial?.active !== false);
  const [lines, setLines]       = useState<ChoiceLine[]>(
    initial?.choiceLines?.length
      ? initial.choiceLines.map(l => ({ ...l, required: l.required !== false, products: l.products?.map((p: any) => p._id || p) || [] }))
      : [blankLine()]
  );
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Combo name is required';
    if (priceMode === 'fixed' && (!fixedPrice || parseFloat(fixedPrice) <= 0))
      e.price = 'Enter a price greater than 0';
    lines.forEach((l, i) => {
      if (!l.label.trim()) e[`line_${i}_label`] = 'Group label required';
      if (l.products.length === 0) e[`line_${i}_products`] = 'Add at least one product';
      if (l.maxSelect < l.minSelect) e[`line_${i}_max`] = 'Max must be ≥ min';
      if (l.maxSelect > l.products.length) e[`line_${i}_max`] = `Max can't exceed ${l.products.length} product${l.products.length !== 1 ? 's' : ''}`;
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) { toast.error('Fix the errors before saving'); return; }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: desc,
        price: priceMode === 'fixed' ? parseFloat(fixedPrice) : 0,
        active,
        choiceLines: lines,
      });
      onClose();
    } catch (e: any) { toast.error(e.message || 'Save failed'); }
    finally { setSaving(false); }
  }

  function addLine() {
    setLines(prev => {
      const next = [...prev, blankLine()];
      return next;
    });
  }

  function removeLine(i: number) { setLines(l => l.filter((_, idx) => idx !== i)); }

  function patchLine(i: number, patch: Partial<ChoiceLine>) {
    setLines(l => l.map((line, idx) => {
      if (idx !== i) return line;
      const updated = { ...line, ...patch };
      // Auto-clamp maxSelect when products change
      if (patch.products) {
        updated.maxSelect = Math.min(updated.maxSelect, Math.max(1, patch.products.length));
        updated.minSelect = Math.min(updated.minSelect, updated.maxSelect);
      }
      return updated;
    }));
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 backdrop-blur-sm p-0 sm:items-center sm:p-4">
      <div className="flex w-full max-w-5xl flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:rounded-2xl sm:max-h-[92vh]">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#b20202]/10">
              <PiPackage className="h-5 w-5 text-[#b20202]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">{initial ? 'Edit Combo' : 'New Combo'}</h2>
              <p className="text-[11px] text-gray-400">Build the choice groups — preview updates live on the right</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <PiX className="h-5 w-5" />
          </button>
        </div>

        {/* Body — two panels */}
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT: Builder */}
          <div className="flex w-full flex-col overflow-y-auto border-r border-gray-100 lg:w-[58%]">
            <div className="space-y-6 px-5 py-5">

              {/* ── Basic info ── */}
              <section className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Basic Info</p>

                <div className="space-y-3">
                  {/* Name */}
                  <div>
                    <input
                      value={name}
                      onChange={e => { setName(e.target.value); setErrors(prev => ({ ...prev, name: '' })); }}
                      placeholder="Combo name…"
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-base font-semibold placeholder-gray-300 outline-none transition-colors ${
                        errors.name ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-[#b20202]'
                      }`}
                    />
                    {errors.name && <p className="mt-1 text-[11px] text-red-500">{errors.name}</p>}
                  </div>

                  <textarea
                    value={desc}
                    onChange={e => setDesc(e.target.value)}
                    rows={2}
                    placeholder="Description (optional)…"
                    className="w-full resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-700 placeholder-gray-300 outline-none focus:border-[#b20202]"
                  />

                  {/* Price mode + active */}
                  <div className="flex flex-wrap gap-3">
                    {/* Price mode */}
                    <div className="flex-1 min-w-[160px]">
                      <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">Pricing</label>
                      <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                        {(['dynamic', 'fixed'] as const).map(mode => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setPriceMode(mode)}
                            className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                              priceMode === mode
                                ? 'bg-[#b20202] text-white'
                                : 'bg-white text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {mode === 'dynamic' ? 'Sum of choices' : 'Fixed price'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Fixed price input */}
                    {priceMode === 'fixed' && (
                      <div className="flex-1 min-w-[140px]">
                        <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">Price (₦)</label>
                        <div className="relative">
                          <PiCurrencyNgn className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <input
                            type="number" min={0} value={fixedPrice}
                            onChange={e => { setFixedPrice(e.target.value); setErrors(prev => ({ ...prev, price: '' })); }}
                            placeholder="e.g. 45000"
                            className={`w-full rounded-xl border py-2 pl-8 pr-3 text-sm outline-none ${
                              errors.price ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-[#b20202]'
                            }`}
                          />
                        </div>
                        {errors.price && <p className="mt-1 text-[11px] text-red-500">{errors.price}</p>}
                      </div>
                    )}

                    {/* Active toggle */}
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">Status</label>
                      <button
                        type="button"
                        onClick={() => setActive(v => !v)}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                          active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-500'
                        }`}
                      >
                        {active ? <PiToggleRight className="h-4 w-4" /> : <PiToggleLeft className="h-4 w-4" />}
                        {active ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* ── Choice groups ── */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Choice Groups
                    <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">
                      {lines.length}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={addLine}
                    className="flex items-center gap-1 rounded-lg border border-dashed border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-500 hover:border-[#b20202] hover:text-[#b20202] transition-colors"
                  >
                    <PiListPlus className="h-3.5 w-3.5" /> Add group
                  </button>
                </div>

                <div className="space-y-3">
                  {lines.length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-8 text-center">
                      <PiListPlus className="mb-2 h-8 w-8 text-gray-200" />
                      <p className="text-xs text-gray-400">No choice groups yet</p>
                      <p className="text-[11px] text-gray-300">Click "Add group" to define what cashiers can pick</p>
                    </div>
                  )}

                  {lines.map((line, i) => {
                    const color = gc(i);
                    const lineErrors = {
                      label:    errors[`line_${i}_label`],
                      products: errors[`line_${i}_products`],
                      max:      errors[`line_${i}_max`],
                    };
                    const hasLineError = Object.values(lineErrors).some(Boolean);

                    return (
                      <div key={i} className={`overflow-hidden rounded-2xl border ${hasLineError ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-white'}`}>

                        {/* Group header bar */}
                        <div className={`flex items-center gap-3 border-b px-3.5 py-3 ${hasLineError ? 'border-red-200 bg-red-50/50' : 'border-gray-100 bg-gray-50/50'}`}>
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${color.dot}`}>
                            {i + 1}
                          </span>
                          <input
                            value={line.label}
                            onChange={e => { patchLine(i, { label: e.target.value }); setErrors(prev => ({ ...prev, [`line_${i}_label`]: '' })); }}
                            placeholder={`Group ${i + 1} label (e.g. Choose your spirit)`}
                            className={`flex-1 bg-transparent text-sm font-semibold text-gray-800 outline-none placeholder-gray-300 ${lineErrors.label ? 'text-red-500' : ''}`}
                          />
                          <button type="button" onClick={() => removeLine(i)}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-300 hover:bg-red-50 hover:text-red-400 transition-colors">
                            <PiTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Group body */}
                        <div className="space-y-3 p-3.5">

                          {/* Config row: min/max/required */}
                          <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-gray-500">Min</span>
                              <Stepper
                                value={line.minSelect}
                                min={line.required ? 1 : 0}
                                max={line.maxSelect}
                                onChange={v => patchLine(i, { minSelect: v })}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-gray-500">Max</span>
                              <Stepper
                                value={line.maxSelect}
                                min={line.minSelect}
                                max={line.products.length || undefined}
                                onChange={v => patchLine(i, { maxSelect: v })}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const req = !line.required;
                                patchLine(i, { required: req, minSelect: req ? Math.max(1, line.minSelect) : 0 });
                              }}
                              className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${
                                line.required
                                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                                  : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50'
                              }`}
                            >
                              <PiStar className="h-3 w-3" />
                              {line.required ? 'Required' : 'Optional'}
                            </button>
                            {lineErrors.max && <p className="text-[11px] text-red-500">{lineErrors.max}</p>}
                          </div>

                          {/* Product chips + picker */}
                          <div>
                            {lineErrors.products && (
                              <p className="mb-1.5 text-[11px] text-red-500">{lineErrors.products}</p>
                            )}
                            <GroupProductPicker
                              all={products}
                              selected={line.products}
                              onAdd={id => {
                                patchLine(i, { products: [...line.products, id] });
                                setErrors(prev => ({ ...prev, [`line_${i}_products`]: '' }));
                              }}
                              onRemove={id => patchLine(i, { products: line.products.filter(x => x !== id) })}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

            </div>
          </div>

          {/* RIGHT: POS Preview */}
          <div className="hidden flex-col bg-gray-50/50 p-5 lg:flex lg:w-[42%]">
            <POSPreview
              name={name}
              price={priceMode === 'fixed' ? (parseFloat(fixedPrice) || 0) : 0}
              lines={lines}
              allProducts={products}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between border-t border-gray-100 bg-white px-5 py-4">
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            {hasErrors && (
              <span className="flex items-center gap-1 text-red-500">
                <PiWarningCircle className="h-3.5 w-3.5" /> Fix errors above
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
              style={{ backgroundColor: '#b20202' }}>
              {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              {initial ? 'Save changes' : 'Create combo'}
              {!saving && <PiArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Combo card ────────────────────────────────────────────────────────────────

function ComboCard({ combo, onEdit, onDelete, onToggle }: {
  combo: Combo; onEdit: () => void; onDelete: () => void; onToggle: () => void;
}) {
  const totalGroups = combo.choiceLines?.length ?? 0;
  const totalItems  = combo.choiceLines?.reduce((s, l) => s + (l.products?.length ?? 0), 0) ?? 0;

  return (
    <div className={`group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
      combo.active ? 'border-gray-200' : 'border-gray-100 opacity-60'
    }`}>
      {/* Top color bar */}
      <div className="h-1 w-full bg-[#b20202]" />

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b20202]/10">
              <PiPackage className="h-5 w-5 text-[#b20202]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{combo.name}</p>
              {combo.description && (
                <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{combo.description}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button type="button" onClick={onToggle} title={combo.active ? 'Deactivate' : 'Activate'}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${combo.active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'}`}>
              {combo.active ? <PiToggleRight className="h-4.5 w-4.5" /> : <PiToggleLeft className="h-4.5 w-4.5" />}
            </button>
            <button type="button" onClick={onEdit}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
              <PiPencilSimple className="h-4 w-4" />
            </button>
            <button type="button" onClick={onDelete}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500">
              <PiTrash className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="mb-3 grid grid-cols-3 divide-x divide-gray-100 rounded-xl border border-gray-100 text-center">
          {[
            { label: 'Price', value: combo.price > 0 ? formatCurrency(combo.price) : 'Dynamic' },
            { label: 'Groups', value: String(totalGroups) },
            { label: 'Items', value: String(totalItems) },
          ].map(s => (
            <div key={s.label} className="py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{s.label}</p>
              <p className="mt-0.5 text-sm font-bold text-gray-800">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Choice groups preview */}
        <div className="space-y-1.5">
          {(combo.choiceLines || []).slice(0, 3).map((line, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${gc(i).bg}`}>
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${gc(i).dot}`}>{i + 1}</span>
              <span className={`flex-1 truncate text-xs font-semibold ${gc(i).text}`}>{line.label}</span>
              <span className="shrink-0 text-[10px] text-gray-400">
                {line.minSelect === line.maxSelect ? `×${line.minSelect}` : `${line.minSelect}–${line.maxSelect}`}
                {' · '}
                {line.products?.length ?? 0} options
              </span>
            </div>
          ))}
          {totalGroups > 3 && (
            <p className="text-[11px] text-gray-400 pl-1">+{totalGroups - 3} more group{totalGroups - 3 !== 1 ? 's' : ''}…</p>
          )}
        </div>

        {/* Footer badges */}
        <div className="mt-3 flex items-center justify-between">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            combo.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'
          }`}>
            {combo.active ? <PiCheckCircle className="h-3 w-3" /> : <PiWarningCircle className="h-3 w-3" />}
            {combo.active ? 'Active' : 'Inactive'}
          </span>
          <button type="button" onClick={onEdit}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#b20202] opacity-0 transition-opacity group-hover:opacity-100">
            Edit <PiArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function POSCombos() {
  const { data: session } = useSession();
  const token = session?.user?.token as string | undefined;

  const [combos,   setCombos]   = useState<Combo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [editing,  setEditing]  = useState<Combo | null | 'new'>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [cd, pd] = await Promise.all([fetchCombos(token), fetchProducts(token)]);
      setCombos(cd.combos || []);
      setProducts(pd);
    } catch (e: any) { toast.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data: any) {
    if (editing === 'new') {
      await createCombo(token!, data);
      toast.success('Combo created');
    } else if (editing) {
      await updateCombo(token!, (editing as Combo)._id, data);
      toast.success('Combo updated');
    }
    await load();
  }

  async function handleDelete(combo: Combo) {
    if (!confirm(`Delete "${combo.name}"?`)) return;
    try {
      await deleteCombo(token!, combo._id);
      toast.success('Deleted');
      await load();
    } catch (e: any) { toast.error(e.message || 'Delete failed'); }
  }

  async function handleToggle(combo: Combo) {
    try {
      await updateCombo(token!, combo._id, { active: !combo.active });
      await load();
    } catch (e: any) { toast.error(e.message); }
  }

  const active   = combos.filter(c => c.active);
  const inactive = combos.filter(c => !c.active);

  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8">
        <POSNavHeader />
      </div>

      <div className="flex-1 px-6 pb-12 pt-6 md:px-10 lg:px-12">

        {/* Page header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Combo Choices</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Configurable combos with choice groups — cashiers pick products at the POS terminal
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={load} disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:bg-gray-50 disabled:opacity-40">
              <PiArrowsClockwise className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={() => setEditing('new')}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm"
              style={{ backgroundColor: '#b20202' }}>
              <PiPlus className="h-4 w-4" /> New Combo
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-gray-100" />)}
          </div>
        ) : combos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#b20202]/10">
              <PiPackage className="h-8 w-8 text-[#b20202]" />
            </div>
            <p className="text-base font-bold text-gray-700">No combos yet</p>
            <p className="mt-1 max-w-sm text-sm text-gray-400">
              Create your first combo to let cashiers configure bundled products with choice groups at the POS
            </p>
            <button type="button" onClick={() => setEditing('new')}
              className="mt-5 flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
              style={{ backgroundColor: '#b20202' }}>
              <PiPlus className="h-4 w-4" /> Create first combo
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {active.length > 0 && (
              <section>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Active ({active.length})</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {active.map(c => (
                    <ComboCard key={c._id} combo={c} onEdit={() => setEditing(c)} onDelete={() => handleDelete(c)} onToggle={() => handleToggle(c)} />
                  ))}
                </div>
              </section>
            )}
            {inactive.length > 0 && (
              <section>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Inactive ({inactive.length})</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {inactive.map(c => (
                    <ComboCard key={c._id} combo={c} onEdit={() => setEditing(c)} onDelete={() => handleDelete(c)} onToggle={() => handleToggle(c)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {editing !== null && (
        <ComboModal
          initial={editing === 'new' ? undefined : editing as Combo}
          products={products}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
