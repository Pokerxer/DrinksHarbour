// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  PiPlus, PiPencilSimple, PiTrash, PiX, PiPackage,
  PiArrowsClockwise, PiCheckCircle, PiWarningCircle,
  PiDotsSixVertical, PiToggleLeft, PiToggleRight,
  PiCurrencyNgn, PiListPlus, PiMinus,
} from 'react-icons/pi';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import POSNavHeader from '@/app/shared/point-of-sale/pos-nav-header';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ── API helpers ───────────────────────────────────────────────────────────────

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

async function fetchCombos(token: string)             { return apiReq('GET',    '/api/pos-combos', token); }
async function createCombo(token: string, body: any)  { return apiReq('POST',   '/api/pos-combos', token, body); }
async function updateCombo(token: string, id: string, body: any) { return apiReq('PATCH', `/api/pos-combos/${id}`, token, body); }
async function deleteCombo(token: string, id: string) { return apiReq('DELETE', `/api/pos-combos/${id}`, token); }
async function fetchProducts(token: string) {
  const res = await fetch(`${API}/api/pos/products?limit=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  return json.data?.products || [];
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ChoiceLine = {
  _id?: string;
  label: string;
  minSelect: number;
  maxSelect: number;
  products: string[];
};

type Combo = {
  _id: string;
  name: string;
  description: string;
  price: number;
  active: boolean;
  choiceLines: ChoiceLine[];
  triggerProducts: string[];
};

type Product = {
  _id: string;
  sku: string;
  baseSellingPrice: number;
  product: { name: string; images?: { thumbnail?: string; url?: string }[] };
};

// ── Blank line ────────────────────────────────────────────────────────────────

const blankLine = (): ChoiceLine => ({ label: '', minSelect: 1, maxSelect: 1, products: [] });

// ── Product picker (multi-select checkboxes) ──────────────────────────────────

function ProductPicker({
  all, selected, onChange,
}: { all: Product[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState('');
  const filtered = q
    ? all.filter(p => p.product?.name?.toLowerCase().includes(q.toLowerCase()) || p.sku?.toLowerCase().includes(q.toLowerCase()))
    : all;

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50">
      <div className="p-2 border-b border-gray-200">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search products…"
          className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#b20202]"
        />
      </div>
      <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
        {filtered.length === 0 && (
          <p className="py-4 text-center text-xs text-gray-400">No products found</p>
        )}
        {filtered.map(p => {
          const checked = selected.includes(p._id);
          const img = p.product?.images?.[0]?.thumbnail || p.product?.images?.[0]?.url;
          return (
            <label key={p._id} className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors ${checked ? 'bg-red-50' : 'hover:bg-gray-100'}`}>
              <input type="checkbox" className="accent-[#b20202]" checked={checked} onChange={() => toggle(p._id)} />
              {img
                ? <img src={img} alt="" className="h-7 w-7 shrink-0 rounded-lg object-cover" />
                : <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-200 text-xs text-gray-400">🍾</div>
              }
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-gray-800">{p.product?.name || p.sku}</p>
                <p className="text-[10px] text-gray-400">{formatCurrency(p.baseSellingPrice)}</p>
              </div>
              {checked && <PiCheckCircle className="h-4 w-4 shrink-0 text-[#b20202]" />}
            </label>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="border-t border-gray-200 px-3 py-1.5 text-[10px] text-gray-400">
          {selected.length} product{selected.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  );
}

// ── Combo form modal ──────────────────────────────────────────────────────────

function ComboModal({
  initial, products, onSave, onClose,
}: {
  initial?: Combo;
  products: Product[];
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName]               = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [price, setPrice]             = useState(String(initial?.price ?? 0));
  const [active, setActive]           = useState(initial?.active !== false);
  const [lines, setLines]             = useState<ChoiceLine[]>(
    initial?.choiceLines?.length ? initial.choiceLines.map(l => ({
      ...l,
      products: l.products?.map((p: any) => p._id || p) || [],
    })) : [blankLine()]
  );
  const [triggerProducts, setTriggerProducts] = useState<string[]>(
    initial?.triggerProducts?.map((p: any) => p._id || p) || []
  );
  const [saving, setSaving] = useState(false);
  const [expandedLine, setExpandedLine] = useState<number | null>(0);

  function addLine() {
    setLines(l => [...l, blankLine()]);
    setExpandedLine(lines.length);
  }

  function removeLine(i: number) {
    setLines(l => l.filter((_, idx) => idx !== i));
    setExpandedLine(null);
  }

  function patchLine(i: number, patch: Partial<ChoiceLine>) {
    setLines(l => l.map((line, idx) => idx === i ? { ...line, ...patch } : line));
  }

  async function handleSave() {
    if (!name.trim()) return toast.error('Name is required');
    if (lines.some(l => !l.label.trim())) return toast.error('All choice groups need a label');
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description, price: parseFloat(price) || 0, active, choiceLines: lines, triggerProducts });
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[90vh]">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">{initial ? 'Edit Combo' : 'New Combo'}</h2>
            <p className="text-[11px] text-gray-400">Define choice groups the cashier picks from</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <PiX className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Combo Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Premium Gift Set"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#b20202]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Fixed Price (₦)</label>
              <div className="relative">
                <PiCurrencyNgn className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  min={0}
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="0 = sum of choices"
                  className="w-full rounded-xl border border-gray-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-[#b20202]"
                />
              </div>
              <p className="mt-0.5 text-[10px] text-gray-400">0 = add up selected product prices</p>
            </div>
            <div className="flex flex-col justify-end">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Status</label>
              <button
                type="button"
                onClick={() => setActive(v => !v)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                  active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-500'
                }`}
              >
                {active ? <PiToggleRight className="h-5 w-5" /> : <PiToggleLeft className="h-5 w-5" />}
                {active ? 'Active' : 'Inactive'}
              </button>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                placeholder="Optional description…"
                className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#b20202]"
              />
            </div>
          </div>

          {/* Choice groups */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-700">Choice Groups</p>
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:border-[#b20202] hover:text-[#b20202]"
              >
                <PiListPlus className="h-3.5 w-3.5" /> Add group
              </button>
            </div>

            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-gray-200">
                  {/* Line header */}
                  <div
                    className="flex cursor-pointer items-center gap-2 bg-gray-50 px-3 py-2.5"
                    onClick={() => setExpandedLine(expandedLine === i ? null : i)}
                  >
                    <PiDotsSixVertical className="h-4 w-4 shrink-0 text-gray-300" />
                    <span className="flex-1 text-xs font-semibold text-gray-700 truncate">
                      {line.label || `Group ${i + 1}`}
                    </span>
                    <span className="text-[10px] text-gray-400">{line.products.length} product{line.products.length !== 1 ? 's' : ''}</span>
                    <span className="text-[10px] text-gray-400">Pick {line.minSelect}–{line.maxSelect}</span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); removeLine(i); }}
                      className="ml-1 text-gray-300 hover:text-red-400"
                    >
                      <PiTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Expanded line editor */}
                  {expandedLine === i && (
                    <div className="px-3 py-3 space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-3 sm:col-span-1">
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Group Label *</label>
                          <input
                            value={line.label}
                            onChange={e => patchLine(i, { label: e.target.value })}
                            placeholder="e.g. Choose your spirit"
                            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-[#b20202]"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Min picks</label>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => patchLine(i, { minSelect: Math.max(0, line.minSelect - 1) })} className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50">
                              <PiMinus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center text-sm font-bold">{line.minSelect}</span>
                            <button type="button" onClick={() => patchLine(i, { minSelect: Math.min(line.maxSelect, line.minSelect + 1) })} className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50">
                              <PiPlus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Max picks</label>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => patchLine(i, { maxSelect: Math.max(line.minSelect, line.maxSelect - 1) })} className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50">
                              <PiMinus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center text-sm font-bold">{line.maxSelect}</span>
                            <button type="button" onClick={() => patchLine(i, { maxSelect: line.maxSelect + 1 })} className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50">
                              <PiPlus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                          Available products
                        </label>
                        <ProductPicker
                          all={products}
                          selected={line.products}
                          onChange={ids => patchLine(i, { products: ids })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {lines.length === 0 && (
                <p className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-xs text-gray-400">
                  No choice groups yet — add one above
                </p>
              )}
            </div>
          </div>

          {/* Trigger products */}
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">
              Trigger Products
              <span className="ml-1 font-normal text-gray-400">(optional — open this combo picker when added to cart)</span>
            </label>
            <ProductPicker
              all={products}
              selected={triggerProducts}
              onChange={setTriggerProducts}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: '#b20202' }}
          >
            {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
            {initial ? 'Save changes' : 'Create combo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Combo card ────────────────────────────────────────────────────────────────

function ComboCard({ combo, onEdit, onDelete, onToggle }: {
  combo: Combo;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  return (
    <div className={`flex flex-col rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md ${combo.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
      <div className="flex items-start justify-between border-b border-gray-100 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b20202]/10">
            <PiPackage className="h-5 w-5 text-[#b20202]" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{combo.name}</p>
            {combo.description && (
              <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{combo.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggle}
            title={combo.active ? 'Deactivate' : 'Activate'}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              combo.active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'
            }`}
          >
            {combo.active ? <PiToggleRight className="h-5 w-5" /> : <PiToggleLeft className="h-5 w-5" />}
          </button>
          <button type="button" onClick={onEdit} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <PiPencilSimple className="h-4 w-4" />
          </button>
          <button type="button" onClick={onDelete} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500">
            <PiTrash className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Price */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Price</span>
          <span className="font-bold text-gray-800">
            {combo.price > 0 ? formatCurrency(combo.price) : 'Sum of choices'}
          </span>
        </div>

        {/* Choice groups */}
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {combo.choiceLines?.length ?? 0} Choice Group{(combo.choiceLines?.length ?? 0) !== 1 ? 's' : ''}
          </p>
          <div className="space-y-1.5">
            {(combo.choiceLines || []).map((line, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-1.5">
                <span className="text-xs font-medium text-gray-700 truncate max-w-[60%]">{line.label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-gray-400">
                    Pick {line.minSelect}–{line.maxSelect}
                  </span>
                  <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold text-gray-600">
                    {line.products?.length ?? 0} items
                  </span>
                </div>
              </div>
            ))}
            {!combo.choiceLines?.length && (
              <p className="text-[11px] text-gray-400">No groups configured</p>
            )}
          </div>
        </div>

        {/* Status badge */}
        <div className="flex justify-end">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            combo.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'
          }`}>
            {combo.active ? <PiCheckCircle className="h-3 w-3" /> : <PiWarningCircle className="h-3 w-3" />}
            {combo.active ? 'Active' : 'Inactive'}
          </span>
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
      const [comboData, prodData] = await Promise.all([
        fetchCombos(token),
        fetchProducts(token),
      ]);
      setCombos(comboData.combos || []);
      setProducts(prodData);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
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
      toast.success('Combo deleted');
      await load();
    } catch (e: any) { toast.error(e.message || 'Delete failed'); }
  }

  async function handleToggle(combo: Combo) {
    try {
      await updateCombo(token!, combo._id, { active: !combo.active });
      await load();
    } catch (e: any) { toast.error(e.message || 'Update failed'); }
  }

  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8">
        <POSNavHeader />
      </div>

      <div className="flex-1 px-6 pb-10 pt-6 md:px-10 lg:px-12">

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Combo Choices</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Define configurable combos — cashiers pick from choice groups at the POS terminal
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:bg-gray-50 disabled:opacity-40"
            >
              <PiArrowsClockwise className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setEditing('new')}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white"
              style={{ backgroundColor: '#b20202' }}
            >
              <PiPlus className="h-4 w-4" /> New Combo
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : combos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-20 text-center">
            <PiPackage className="mb-3 h-12 w-12 text-gray-200" />
            <p className="text-base font-semibold text-gray-600">No combos yet</p>
            <p className="mt-1 text-sm text-gray-400">
              Create your first combo to let cashiers configure bundled products at the POS
            </p>
            <button
              type="button"
              onClick={() => setEditing('new')}
              className="mt-4 flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
              style={{ backgroundColor: '#b20202' }}
            >
              <PiPlus className="h-4 w-4" /> Create first combo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {combos.map(combo => (
              <ComboCard
                key={combo._id}
                combo={combo}
                onEdit={() => setEditing(combo)}
                onDelete={() => handleDelete(combo)}
                onToggle={() => handleToggle(combo)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
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
