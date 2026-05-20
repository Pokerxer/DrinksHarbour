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
  PiCaretDown, PiCaretUp,
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

const fetchCombos   = (t: string) => apiReq('GET', '/api/pos-combos', t);
const createCombo   = (t: string, b: any) => apiReq('POST', '/api/pos-combos', t, b);
const updateCombo   = (t: string, id: string, b: any) => apiReq('PATCH', `/api/pos-combos/${id}`, t, b);
const deleteCombo   = (t: string, id: string) => apiReq('DELETE', `/api/pos-combos/${id}`, t);
const fetchProducts = async (t: string) => {
  // Dedicated endpoint: admin JWT, returns products with platform-computed prices
  const r = await fetch(`${API}/api/pos-combos/products`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  const json = await r.json();
  return json.data?.products || [];
};

// ── Types ─────────────────────────────────────────────────────────────────────

/** One selectable item inside a choice group.
 *  allowedSizes = [] means ALL sizes are selectable.
 *  allowedSizes = [id, …] restricts to those specific size variants. */
type ChoiceItem = {
  subProduct: string;   // SubProduct._id
  allowedSizes: string[]; // Size._id[]
};

type ChoiceLine = {
  _id?: string;
  label: string;
  minSelect: number;
  maxSelect: number;
  required: boolean;
  items: ChoiceItem[];
};

type PosSize = { _id: string; displayName: string; sellingPrice: number; availableStock: number };

type Product = {
  _id: string;
  sku: string;
  baseSellingPrice: number;
  availableStock: number;
  sellWithoutSizeVariants: boolean;
  sizes: PosSize[];
  product: { name: string; images?: { thumbnail?: string; url?: string }[] };
};

type Combo = {
  _id: string;
  name: string;
  description: string;
  price: number;
  active: boolean;
  choiceLines: any[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const blankLine = (): ChoiceLine => ({ label: '', minSelect: 1, maxSelect: 1, required: true, items: [] });

/** Normalise server choiceLines to the ChoiceLine type used by the builder.
 *  Each item in the DB has its own Mongoose _id (from the embedded array).
 *  We must read item.subProduct (the referenced SubProduct), NOT item._id. */
function normaliseLines(raw: any[]): ChoiceLine[] {
  return (raw || []).map(l => {
    const items: ChoiceItem[] = (l.items || []).map((it: any) => {
      if (typeof it === 'string') {
        return { subProduct: it, allowedSizes: [] };
      }
      // it is an embedded doc with its own _id + a subProduct reference
      if (it.subProduct !== undefined) {
        return {
          subProduct: it.subProduct?._id
            ? String(it.subProduct._id)
            : String(it.subProduct),
          allowedSizes: (it.allowedSizes || []).map((s: any) => s?._id ? String(s._id) : String(s)),
        };
      }
      // Fallback: plain ObjectId or minimal object
      return { subProduct: String(it._id || it), allowedSizes: [] };
    });

    // Backward-compat: old combos stored products:[ObjectId]
    if (!items.length && l.products?.length) {
      for (const p of l.products) {
        items.push({ subProduct: String(p?._id || p), allowedSizes: [] });
      }
    }
    return { ...l, required: l.required !== false, items };
  });
}

const GROUP_COLORS = [
  { dot: 'bg-blue-500',   text: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200'   },
  { dot: 'bg-violet-500', text: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200' },
  { dot: 'bg-amber-500',  text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200'  },
  { dot: 'bg-emerald-500',text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200'},
  { dot: 'bg-rose-500',   text: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-200'   },
];
const gc = (i: number) => GROUP_COLORS[i % GROUP_COLORS.length];

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({ value, min, max, onChange }: { value: number; min: number; max?: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-100 disabled:opacity-30">
        <PiMinus className="h-2.5 w-2.5" />
      </button>
      <span className="w-7 text-center text-sm font-bold text-gray-800">{value}</span>
      <button type="button" onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
        disabled={max !== undefined && value >= max}
        className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-100 disabled:opacity-30">
        <PiPlus className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

// ── Product chip with size config ─────────────────────────────────────────────

function ProductChip({ item, product, onRemove, onSizesChange }: {
  item: ChoiceItem;
  product: Product;
  onRemove: () => void;
  onSizesChange: (sizeIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const img = product.product?.images?.[0]?.thumbnail || product.product?.images?.[0]?.url;
  const hasSizes = (product.sizes?.length ?? 0) > 0 && !product.sellWithoutSizeVariants;
  const selectedSizes = item.allowedSizes;

  // Price display: use computed sellingPrice from the API (platform-enriched)
  const relevantSizes = hasSizes
    ? (selectedSizes.length > 0
        ? product.sizes.filter(s => selectedSizes.includes(String(s._id)))
        : product.sizes)
    : [];
  const price = hasSizes && relevantSizes.length > 0
    ? (() => {
        const prices = relevantSizes.map(s => s.sellingPrice).filter(v => v > 0).sort((a, b) => a - b);
        if (!prices.length) return formatCurrency(product.baseSellingPrice);
        const lo = prices[0], hi = prices[prices.length - 1];
        return lo === hi ? formatCurrency(lo) : `${formatCurrency(lo)} – ${formatCurrency(hi)}`;
      })()
    : formatCurrency(product.baseSellingPrice);

  function toggleSize(sid: string) {
    if (selectedSizes.length === 0) {
      // "All sizes" mode — unchecking one size means we restrict to all EXCEPT this one
      const remaining = product.sizes.map(s => String(s._id)).filter(id => id !== sid);
      onSizesChange(remaining);
    } else if (selectedSizes.includes(sid)) {
      // Remove this size from the allowed list
      const next = selectedSizes.filter(x => x !== sid);
      // If none left, treat as "nothing allowed" (keep as empty — user should reset)
      onSizesChange(next);
    } else {
      // Add this size back to the allowed list
      const next = [...selectedSizes, sid];
      // If all sizes are now included, auto-reset to "all allowed" (empty = unrestricted)
      onSizesChange(next.length >= product.sizes.length ? [] : next);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Chip row */}
      <div className="flex items-center gap-2 px-2.5 py-2">
        {img
          ? <img src={img} className="h-7 w-7 shrink-0 rounded-lg object-cover" alt="" />
          : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm">🍾</span>
        }
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-gray-800">{product.product?.name || product.sku}</p>
          <p className="text-[10px] text-gray-400">{price}</p>
        </div>

        {/* Size config button (only for sized products) */}
        {hasSizes && (
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
              open ? 'border-[#b20202] bg-red-50 text-[#b20202]'
                   : selectedSizes.length > 0
                   ? 'border-blue-200 bg-blue-50 text-blue-700'
                   : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {selectedSizes.length > 0 ? `${selectedSizes.length} size${selectedSizes.length !== 1 ? 's' : ''}` : 'All sizes'}
            {open ? <PiCaretUp className="h-2.5 w-2.5" /> : <PiCaretDown className="h-2.5 w-2.5" />}
          </button>
        )}
        <button type="button" onClick={onRemove} className="text-gray-300 hover:text-red-400">
          <PiX className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Size picker panel */}
      {hasSizes && open && (
        <div className="border-t border-gray-100 bg-gray-50 px-3 py-2.5">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Available sizes for this group
            <span className="ml-1 font-normal normal-case text-gray-300">(uncheck to restrict)</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {product.sizes.map(size => {
              const sid    = String(size._id);
              const active = selectedSizes.length === 0 || selectedSizes.includes(sid);
              const oos    = size.availableStock <= 0;
              return (
                <button
                  key={sid}
                  type="button"
                  onClick={() => toggleSize(sid)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
                    active
                      ? 'border-blue-200 bg-blue-50 text-blue-800'
                      : 'border-gray-200 bg-white text-gray-400 line-through opacity-60'
                  }`}
                >
                  {active && <PiCheckCircle className="h-3 w-3 text-blue-500" />}
                  {size.displayName}
                  <span className="text-[10px] font-normal opacity-70">{formatCurrency(size.sellingPrice)}</span>
                  {oos && <span className="rounded bg-amber-100 px-1 text-[9px] text-amber-600">low stock</span>}
                </button>
              );
            })}
          </div>
          {selectedSizes.length > 0 && (
            <button type="button" onClick={() => onSizesChange([])}
              className="mt-1.5 text-[10px] text-gray-400 underline hover:text-gray-600">
              Reset to all sizes
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Product search dropdown ───────────────────────────────────────────────────

function ProductAddDropdown({ all, existingIds, onAdd }: {
  all: Product[];
  existingIds: string[];
  onAdd: (id: string) => void;
}) {
  const [q, setQ]       = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtered = all.filter(p =>
    !existingIds.includes(p._id) &&
    (!q || p.product?.name?.toLowerCase().includes(q.toLowerCase()) || p.sku?.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => { setOpen(o => !o); setQ(''); }}
        className="flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-gray-500 hover:border-[#b20202] hover:text-[#b20202] transition-colors">
        <PiPlus className="h-3.5 w-3.5" /> Add product
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="border-b border-gray-100 p-2.5">
            <div className="relative">
              <PiMagnifyingGlass className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)}
                placeholder="Search by name or SKU…"
                className="w-full rounded-xl border border-gray-200 py-2 pl-8 pr-3 text-xs outline-none focus:border-[#b20202]" />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="py-6 text-center text-xs text-gray-400">
                {q ? 'No matching products' : 'All products already added'}
              </p>
            )}
            {filtered.map(p => {
              const img = p.product?.images?.[0]?.thumbnail || p.product?.images?.[0]?.url;
              const hasSizes = (p.sizes?.length ?? 0) > 0 && !p.sellWithoutSizeVariants;
              return (
                <button key={p._id} type="button"
                  onClick={() => { onAdd(p._id); setOpen(false); setQ(''); }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors">
                  {img
                    ? <img src={img} className="h-9 w-9 shrink-0 rounded-xl object-cover" alt="" />
                    : <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-base">🍾</div>
                  }
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-gray-800">{p.product?.name || p.sku}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400">{formatCurrency(p.baseSellingPrice)}</span>
                      {hasSizes && (
                        <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-600">
                          {p.sizes.length} sizes
                        </span>
                      )}
                    </div>
                  </div>
                  <PiPlus className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── POS Preview ───────────────────────────────────────────────────────────────

type Selection = { subProduct: string; size?: string };

function POSPreview({ name, price, lines, allProducts }: {
  name: string; price: number; lines: ChoiceLine[]; allProducts: Product[];
}) {
  // selections[lineIdx] = array of { subProduct, size? }
  const [selections, setSelections] = useState<Record<number, Selection[]>>({});

  const getProduct = (id: string) => allProducts.find(p => String(p._id) === String(id));

  // Reset preview selections whenever the group structure changes
  useEffect(() => { setSelections({}); }, [lines]);

  function selectProduct(lineIdx: number, spId: string, maxSelect: number) {
    setSelections(prev => {
      const current = prev[lineIdx] || [];
      if (current.some(s => s.subProduct === spId)) {
        return { ...prev, [lineIdx]: current.filter(s => s.subProduct !== spId) };
      }
      const newSel: Selection = { subProduct: spId };
      if (current.length >= maxSelect) {
        return { ...prev, [lineIdx]: [...current.slice(1), newSel] };
      }
      return { ...prev, [lineIdx]: [...current, newSel] };
    });
  }

  function selectSize(lineIdx: number, spId: string, sizeId: string) {
    setSelections(prev => {
      const current = (prev[lineIdx] || []).map(s =>
        s.subProduct === spId
          ? { ...s, size: String(s.size) === String(sizeId) ? undefined : sizeId }
          : s
      );
      return { ...prev, [lineIdx]: current };
    });
  }

  // Running total using computed prices (size-specific if a size is chosen)
  const dynamicTotal = lines.reduce((sum, line, i) => {
    const sel = selections[i] || [];
    return sum + sel.reduce((s, entry) => {
      const p = getProduct(entry.subProduct);
      if (!p) return s;
      if (entry.size) {
        const sz = p.sizes?.find(sz => String(sz._id) === String(entry.size));
        return s + (sz?.sellingPrice || p.baseSellingPrice);
      }
      return s + p.baseSellingPrice;
    }, 0);
  }, 0);
  const finalPrice = price > 0 ? price : dynamicTotal;

  // Price range
  const minPrice = lines.reduce((sum, line) => {
    const prices = line.items.flatMap(it => {
      const p = getProduct(it.subProduct);
      if (!p) return [0];
      const sizes = it.allowedSizes.length > 0 ? p.sizes?.filter(s => it.allowedSizes.includes(String(s._id))) : p.sizes;
      if (sizes?.length) return sizes.map(s => s.sellingPrice);
      return [p.baseSellingPrice];
    }).sort((a, b) => a - b);
    return sum + prices.slice(0, line.minSelect).reduce((s, v) => s + v, 0);
  }, 0);

  return (
    <div className="flex h-full flex-col">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">POS Preview</p>
      <div className="flex-1 overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50">

        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-4 py-3">
          <p className="font-bold text-gray-900">{name || 'Combo name…'}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {price > 0 ? <span className="font-semibold text-[#b20202]">{formatCurrency(price)}</span>
              : <span>{formatCurrency(minPrice)} and up</span>}
          </p>
        </div>

        {lines.length === 0 && (
          <p className="px-4 py-8 text-center text-xs text-gray-400">Add choice groups to preview</p>
        )}

        <div className="divide-y divide-gray-100">
          {lines.map((line, li) => {
            const color  = gc(li);
            const sel    = selections[li] || [];
            const done   = sel.length >= line.minSelect;

            return (
              <div key={li} className="px-4 py-3">
                {/* Group header */}
                <div className="mb-2 flex items-center gap-2">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${color.dot}`}>
                    {li + 1}
                  </span>
                  <span className="flex-1 text-xs font-bold text-gray-800">{line.label || `Group ${li + 1}`}</span>
                  <span className="text-[10px] text-gray-400">
                    {line.minSelect === line.maxSelect ? `×${line.minSelect}` : `${line.minSelect}–${line.maxSelect}`}
                    {!line.required && <span className="ml-1 text-gray-300">opt</span>}
                  </span>
                  {done && <PiCheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
                </div>

                {/* Product choices */}
                <div className="space-y-1.5">
                  {line.items.length === 0 && (
                    <p className="text-[11px] italic text-gray-300">No products</p>
                  )}
                  {line.items.map(item => {
                    const p = getProduct(item.subProduct);
                    if (!p) return null;
                    const chosen   = sel.some(s => s.subProduct === item.subProduct);
                    const selEntry = sel.find(s => s.subProduct === item.subProduct);
                    const isMulti  = line.maxSelect > 1;
                    const img      = p.product?.images?.[0]?.thumbnail || p.product?.images?.[0]?.url;

                    // Which sizes are available for this item in this group
                    const hasSizes = (p.sizes?.length ?? 0) > 0 && !p.sellWithoutSizeVariants;
                    const availSizes = hasSizes
                      ? (item.allowedSizes.length > 0
                          ? p.sizes.filter(s => item.allowedSizes.includes(String(s._id)))
                          : p.sizes)
                      : [];

                    // Price to show: use selected size price, or price range if sizes available
                    const selectedSz = selEntry?.size
                      ? p.sizes?.find(s => String(s._id) === String(selEntry.size))
                      : null;
                    const rowPrice = selectedSz
                      ? selectedSz.sellingPrice
                      : hasSizes && availSizes.length > 0
                      ? (() => {
                          const prices = availSizes.map(s => s.sellingPrice).sort((a, b) => a - b);
                          const lo = prices[0], hi = prices[prices.length - 1];
                          return lo; // use lowest for display; full range shown below
                        })()
                      : p.baseSellingPrice;
                    const priceRange = hasSizes && availSizes.length > 1 && !selectedSz
                      ? (() => {
                          const prices = availSizes.map(s => s.sellingPrice).sort((a, b) => a - b);
                          return prices[0] === prices[prices.length - 1]
                            ? formatCurrency(prices[0])
                            : `${formatCurrency(prices[0])} – ${formatCurrency(prices[prices.length - 1])}`;
                        })()
                      : null;

                    return (
                      <div key={item.subProduct}>
                        {/* Product row */}
                        <button type="button" onClick={() => selectProduct(li, item.subProduct, line.maxSelect)}
                          className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-all ${
                            chosen ? `${color.border} ${color.bg} shadow-sm` : 'border-gray-100 bg-white hover:border-gray-200'
                          }`}>
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
                            <p className="text-[10px] text-gray-400">
                              {priceRange || formatCurrency(rowPrice)}
                            </p>
                          </div>
                          {hasSizes && chosen && !selEntry?.size && (
                            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">
                              Pick size
                            </span>
                          )}
                        </button>

                        {/* Size picker — shown inline when product is selected and has sizes */}
                        {chosen && hasSizes && availSizes.length > 0 && (
                          <div className={`ml-4 mt-1 rounded-xl border p-2.5 ${color.bg} ${color.border}`}>
                            <p className={`mb-1.5 text-[10px] font-bold ${color.text}`}>Choose size</p>
                            <div className="flex flex-wrap gap-1.5">
                              {availSizes.map(size => {
                                const selected = String(selEntry?.size) === String(size._id);
                                const oos      = size.availableStock <= 0;
                                return (
                                  <button key={size._id} type="button"
                                    onClick={() => selectSize(li, item.subProduct, String(size._id))}
                                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
                                      selected
                                        ? `${color.dot} border-current text-white`
                                        : `border-gray-200 bg-white ${color.text} hover:${color.bg}`
                                    } ${oos && !selected ? 'opacity-50' : ''}`}>
                                    <span>{size.displayName}</span>
                                    <span className={`text-[10px] font-normal ${selected ? 'opacity-80' : 'opacity-60'}`}>
                                      {formatCurrency(size.sellingPrice)}
                                    </span>
                                    {oos && (
                                      <span className="rounded bg-red-100 px-1 text-[9px] text-red-500">low</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
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
              <span className="text-xs font-semibold text-gray-500">Total</span>
              <span className="text-base font-black text-gray-900">{formatCurrency(finalPrice)}</span>
            </div>
            {price === 0 && <p className="mt-0.5 text-[10px] text-gray-400">Updates as you pick options</p>}
          </div>
        )}
      </div>
      <p className="mt-2 text-center text-[10px] text-gray-400">
        Click to simulate cashier selection
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
  const [name, setName]       = useState(initial?.name || '');
  const [desc, setDesc]       = useState(initial?.description || '');
  const [priceMode, setPM]    = useState<'fixed'|'dynamic'>(initial?.price && initial.price > 0 ? 'fixed' : 'dynamic');
  const [fixedPrice, setFP]   = useState(String(initial?.price || ''));
  const [active, setActive]   = useState(initial?.active !== false);
  const [lines, setLines]     = useState<ChoiceLine[]>(
    initial?.choiceLines?.length ? normaliseLines(initial.choiceLines) : [blankLine()]
  );
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim())                          e.name  = 'Name is required';
    if (priceMode === 'fixed' && !(parseFloat(fixedPrice) > 0)) e.price = 'Enter a price > 0';
    lines.forEach((l, i) => {
      if (!l.label.trim())        e[`l${i}label`]    = 'Label required';
      if (l.items.length === 0)   e[`l${i}items`]    = 'Add at least one product';
      if (l.maxSelect > l.items.length) e[`l${i}max`] = `Max can't exceed ${l.items.length}`;
    });
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSave() {
    if (!validate()) { toast.error('Fix the errors before saving'); return; }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: desc, price: priceMode === 'fixed' ? parseFloat(fixedPrice) : 0, active, choiceLines: lines });
      onClose();
    } catch (e: any) { toast.error(e.message || 'Save failed'); }
    finally { setSaving(false); }
  }

  function addLine() { setLines(l => [...l, blankLine()]); }
  function removeLine(i: number) { setLines(l => l.filter((_, idx) => idx !== i)); }

  function patchLine(i: number, patch: Partial<ChoiceLine>) {
    setLines(l => l.map((line, idx) => {
      if (idx !== i) return line;
      const u = { ...line, ...patch };
      if (patch.items) {
        u.maxSelect = Math.min(u.maxSelect, Math.max(1, patch.items.length));
        u.minSelect = Math.min(u.minSelect, u.maxSelect);
      }
      return u;
    }));
  }

  function addProduct(lineIdx: number, spId: string) {
    const line = lines[lineIdx];
    const newItems = [...line.items, { subProduct: spId, allowedSizes: [] }];
    patchLine(lineIdx, { items: newItems });
    setErrors(p => ({ ...p, [`l${lineIdx}items`]: '' }));
  }

  function removeProduct(lineIdx: number, spId: string) {
    patchLine(lineIdx, { items: lines[lineIdx].items.filter(it => it.subProduct !== spId) });
  }

  function updateItemSizes(lineIdx: number, spId: string, sizeIds: string[]) {
    patchLine(lineIdx, {
      items: lines[lineIdx].items.map(it =>
        it.subProduct === spId ? { ...it, allowedSizes: sizeIds } : it
      ),
    });
  }

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
              <p className="text-[11px] text-gray-400">Build groups · restrict sizes per product · preview on the right</p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <PiX className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT: builder */}
          <div className="flex w-full flex-col overflow-y-auto border-r border-gray-100 lg:w-[58%]">
            <div className="space-y-6 px-5 py-5">

              {/* Basic info */}
              <section className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Basic Info</p>
                <div>
                  <input value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
                    placeholder="Combo name…"
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-base font-semibold placeholder-gray-300 outline-none ${errors.name ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-[#b20202]'}`} />
                  {errors.name && <p className="mt-1 text-[11px] text-red-500">{errors.name}</p>}
                </div>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
                  placeholder="Description (optional)…"
                  className="w-full resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-700 placeholder-gray-300 outline-none focus:border-[#b20202]" />

                <div className="flex flex-wrap gap-3">
                  {/* Price mode */}
                  <div className="flex-1 min-w-[160px]">
                    <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">Pricing</label>
                    <div className="flex overflow-hidden rounded-xl border border-gray-200">
                      {(['dynamic','fixed'] as const).map(m => (
                        <button key={m} type="button" onClick={() => setPM(m)}
                          className={`flex-1 py-2 text-xs font-semibold transition-colors ${priceMode === m ? 'bg-[#b20202] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                          {m === 'dynamic' ? 'Sum of choices' : 'Fixed price'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {priceMode === 'fixed' && (
                    <div className="flex-1 min-w-[130px]">
                      <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">Price (₦)</label>
                      <div className="relative">
                        <PiCurrencyNgn className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input type="number" min={0} value={fixedPrice}
                          onChange={e => { setFP(e.target.value); setErrors(p => ({ ...p, price: '' })); }}
                          placeholder="45000"
                          className={`w-full rounded-xl border py-2 pl-8 pr-3 text-sm outline-none ${errors.price ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-[#b20202]'}`} />
                      </div>
                      {errors.price && <p className="mt-1 text-[11px] text-red-500">{errors.price}</p>}
                    </div>
                  )}
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">Status</label>
                    <button type="button" onClick={() => setActive(v => !v)}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-500'}`}>
                      {active ? <PiToggleRight className="h-4 w-4" /> : <PiToggleLeft className="h-4 w-4" />}
                      {active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>
              </section>

              {/* Choice groups */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Choice Groups
                    <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">{lines.length}</span>
                  </p>
                  <button type="button" onClick={addLine}
                    className="flex items-center gap-1 rounded-lg border border-dashed border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-500 hover:border-[#b20202] hover:text-[#b20202] transition-colors">
                    <PiListPlus className="h-3.5 w-3.5" /> Add group
                  </button>
                </div>

                {lines.length === 0 && (
                  <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-200 py-8 text-center">
                    <PiListPlus className="mb-2 h-8 w-8 text-gray-200" />
                    <p className="text-xs text-gray-400">No groups yet — click "Add group"</p>
                  </div>
                )}

                <div className="space-y-3">
                  {lines.map((line, i) => {
                    const color = gc(i);
                    const le = { label: errors[`l${i}label`], items: errors[`l${i}items`], max: errors[`l${i}max`] };

                    return (
                      <div key={i} className={`overflow-hidden rounded-2xl border ${Object.values(le).some(Boolean) ? 'border-red-200' : 'border-gray-200'} bg-white`}>

                        {/* Group header */}
                        <div className={`flex items-center gap-3 border-b px-3.5 py-3 ${Object.values(le).some(Boolean) ? 'border-red-200 bg-red-50/40' : 'border-gray-100 bg-gray-50/40'}`}>
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${color.dot}`}>{i + 1}</span>
                          <input value={line.label}
                            onChange={e => { patchLine(i, { label: e.target.value }); setErrors(p => ({ ...p, [`l${i}label`]: '' })); }}
                            placeholder={`Group ${i + 1} label…`}
                            className={`flex-1 bg-transparent text-sm font-semibold outline-none placeholder-gray-300 ${le.label ? 'text-red-500' : 'text-gray-800'}`} />
                          <button type="button" onClick={() => removeLine(i)}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-300 hover:bg-red-50 hover:text-red-400">
                            <PiTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Group body */}
                        <div className="space-y-3 p-3.5">
                          {/* Min / Max / Required */}
                          <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-gray-500">Min</span>
                              <Stepper value={line.minSelect} min={line.required ? 1 : 0} max={line.maxSelect}
                                onChange={v => patchLine(i, { minSelect: v })} />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-gray-500">Max</span>
                              <Stepper value={line.maxSelect} min={line.minSelect} max={line.items.length || undefined}
                                onChange={v => patchLine(i, { maxSelect: v })} />
                              {le.max && <p className="text-[11px] text-red-500">{le.max}</p>}
                            </div>
                            <button type="button"
                              onClick={() => {
                                const req = !line.required;
                                patchLine(i, { required: req, minSelect: req ? Math.max(1, line.minSelect) : 0 });
                              }}
                              className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${line.required ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-gray-200 bg-white text-gray-400'}`}>
                              <PiStar className="h-3 w-3" />
                              {line.required ? 'Required' : 'Optional'}
                            </button>
                          </div>

                          {/* Product chips */}
                          <div className="space-y-2">
                            {le.items && <p className="text-[11px] text-red-500">{le.items}</p>}
                            {line.items.map(item => {
                              const p = products.find(pr => String(pr._id) === String(item.subProduct));
                              if (!p) return null;
                              return (
                                <ProductChip key={item.subProduct}
                                  item={item}
                                  product={p}
                                  onRemove={() => removeProduct(i, item.subProduct)}
                                  onSizesChange={sizes => updateItemSizes(i, item.subProduct, sizes)}
                                />
                              );
                            })}
                            <ProductAddDropdown
                              all={products}
                              existingIds={line.items.map(it => it.subProduct)}
                              onAdd={spId => addProduct(i, spId)}
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

          {/* RIGHT: preview */}
          <div className="hidden flex-col bg-gray-50/50 p-5 lg:flex lg:w-[42%]">
            <POSPreview name={name} price={priceMode === 'fixed' ? (parseFloat(fixedPrice) || 0) : 0}
              lines={lines} allProducts={products} />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between border-t border-gray-100 bg-white px-5 py-4">
          <div className="text-[11px] text-red-500">
            {Object.keys(errors).some(k => errors[k]) && (
              <span className="flex items-center gap-1"><PiWarningCircle className="h-3.5 w-3.5" /> Fix errors above</span>
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
  const lines = normaliseLines(combo.choiceLines || []);
  const totalItems = lines.reduce((s, l) => s + l.items.length, 0);

  return (
    <div className={`group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${combo.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
      <div className="h-1 w-full bg-[#b20202]" />
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b20202]/10">
              <PiPackage className="h-5 w-5 text-[#b20202]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900">{combo.name}</p>
              {combo.description && <p className="mt-0.5 line-clamp-1 text-[11px] text-gray-400">{combo.description}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button type="button" onClick={onToggle}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${combo.active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'}`}>
              {combo.active ? <PiToggleRight className="h-5 w-5" /> : <PiToggleLeft className="h-5 w-5" />}
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

        {/* Stats */}
        <div className="mb-3 grid grid-cols-3 divide-x divide-gray-100 rounded-xl border border-gray-100 text-center">
          {[
            { l: 'Price',  v: combo.price > 0 ? formatCurrency(combo.price) : 'Dynamic' },
            { l: 'Groups', v: String(lines.length) },
            { l: 'Items',  v: String(totalItems) },
          ].map(s => (
            <div key={s.l} className="py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{s.l}</p>
              <p className="mt-0.5 text-sm font-bold text-gray-800">{s.v}</p>
            </div>
          ))}
        </div>

        {/* Group chips */}
        <div className="space-y-1.5">
          {lines.slice(0, 3).map((line, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${gc(i).bg}`}>
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${gc(i).dot}`}>{i + 1}</span>
              <span className={`flex-1 truncate text-xs font-semibold ${gc(i).text}`}>{line.label}</span>
              <span className="shrink-0 text-[10px] text-gray-400">
                {line.minSelect === line.maxSelect ? `×${line.minSelect}` : `${line.minSelect}–${line.maxSelect}`}
                {' · '}{line.items.length} option{line.items.length !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
          {lines.length > 3 && <p className="pl-1 text-[11px] text-gray-400">+{lines.length - 3} more…</p>}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${combo.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
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
      // Fetch independently so a products failure doesn't block showing combos
      const [cd, pd] = await Promise.allSettled([fetchCombos(token), fetchProducts(token)]);
      if (cd.status === 'fulfilled') setCombos(cd.value?.combos || []);
      else toast.error('Could not load combos: ' + cd.reason?.message);
      if (pd.status === 'fulfilled') setProducts(pd.value || []);
      else toast.error('Could not load products: ' + pd.reason?.message);
    } catch (e: any) { toast.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data: any) {
    if (editing === 'new') { await createCombo(token!, data); toast.success('Combo created'); }
    else if (editing)      { await updateCombo(token!, (editing as Combo)._id, data); toast.success('Combo updated'); }
    await load();
  }

  async function handleDelete(c: Combo) {
    if (!confirm(`Delete "${c.name}"?`)) return;
    try { await deleteCombo(token!, c._id); toast.success('Deleted'); await load(); }
    catch (e: any) { toast.error(e.message); }
  }

  async function handleToggle(c: Combo) {
    try { await updateCombo(token!, c._id, { active: !c.active }); await load(); }
    catch (e: any) { toast.error(e.message); }
  }

  const active   = combos.filter(c => c.active);
  const inactive = combos.filter(c => !c.active);

  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8"><POSNavHeader /></div>

      <div className="flex-1 px-6 pb-12 pt-6 md:px-10 lg:px-12">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Combo Choices</h1>
            <p className="mt-0.5 text-sm text-gray-500">Configurable combos with choice groups — cashiers pick products and sizes at the POS</p>
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
            <p className="mt-1 max-w-sm text-sm text-gray-400">Create combos with choice groups — cashiers pick products and sizes when adding to the cart</p>
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
                  {active.map(c => <ComboCard key={c._id} combo={c} onEdit={() => setEditing(c)} onDelete={() => handleDelete(c)} onToggle={() => handleToggle(c)} />)}
                </div>
              </section>
            )}
            {inactive.length > 0 && (
              <section>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Inactive ({inactive.length})</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {inactive.map(c => <ComboCard key={c._id} combo={c} onEdit={() => setEditing(c)} onDelete={() => handleDelete(c)} onToggle={() => handleToggle(c)} />)}
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
