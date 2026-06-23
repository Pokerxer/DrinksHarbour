'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  PiX, PiCheckCircle, PiWarningCircle, PiPackage,
  PiShoppingCartSimple, PiMinus, PiPlus,
} from 'react-icons/pi';
import { POSCombo, POSComboSubProduct, POSComboSize, POSCartItem } from '../types';
import { formatCurrency } from '../utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function effectiveSizes(sp: POSComboSubProduct, allowedSizes: string[]): POSComboSize[] {
  if (sp.sellWithoutSizeVariants || !sp.sizes?.length) return [];
  if (!allowedSizes?.length) return sp.sizes;
  return sp.sizes.filter(s => allowedSizes.includes(String(s._id)));
}

function spThumb(sp: POSComboSubProduct) {
  return sp?.product?.images?.[0]?.thumbnail || sp?.product?.images?.[0]?.url || '';
}

function computeComboPrice(combo: POSCombo, selling: number, cost: number): number {
  switch (combo.priceMode ?? 'dynamic') {
    case 'fixed':                return combo.price;
    case 'markup_on_cost':       return Math.round(cost    * (1 + (combo.markupPercentage    ?? 0) / 100) * 100) / 100;
    case 'discount_off_selling': return Math.round(selling * (1 - (combo.discountPercentage  ?? 0) / 100) * 100) / 100;
    default:                     return selling;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

// picks[lineIdx][itemIdx] = { val: sizeId | true, qty: number }
export type PickEntry = { val: string | true; qty: number };
export type PickMap   = Record<number, Record<number, PickEntry>>;

// ── Product row ───────────────────────────────────────────────────────────────

function ProductRow({
  sp, sizes, sel, isRadio, atCap, minQty, maxQty, onPick, onQty,
}: {
  sp: POSComboSubProduct;
  sizes: POSComboSize[];
  sel: PickEntry | undefined;
  isRadio: boolean;
  atCap: boolean;
  minQty: number;
  maxQty: number;
  onPick: (val: string | true | null) => void;
  onQty: (qty: number) => void;
}) {
  const picked   = sel !== undefined;
  const noSizes  = sizes.length === 0;
  const img      = spThumb(sp);
  const disabled = !picked && atCap;
  const qty      = sel?.qty ?? minQty;
  const showQty  = picked && maxQty > 1;

  const priceLabel = useMemo(() => {
    if (noSizes) return formatCurrency(sp.baseSellingPrice);
    const prices = sizes.map(s => s.sellingPrice).filter(v => v > 0).sort((a, b) => a - b);
    if (!prices.length) return formatCurrency(sp.baseSellingPrice);
    return prices[0] === prices[prices.length - 1]
      ? formatCurrency(prices[0])
      : `${formatCurrency(prices[0])} – ${formatCurrency(prices[prices.length - 1])}`;
  }, [sp, sizes, noSizes]);

  const selectedSize = typeof sel?.val === 'string' ? sizes.find(s => String(s._id) === sel.val) : null;

  function handleRowClick() {
    if (disabled) return;
    if (noSizes) {
      picked ? onPick(null) : onPick(true);
    } else if (picked) {
      onPick(null);
    }
  }

  return (
    <div className={`overflow-hidden rounded-xl border transition-all
      ${picked
        ? 'border-[#b20202] bg-red-50/40 shadow-sm'
        : disabled
          ? 'border-gray-100 bg-gray-50/60 opacity-40'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      {/* Main row */}
      <div
        className={`flex items-center gap-3 px-3 py-3 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer select-none'}`}
        onClick={handleRowClick}
      >
        <div className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 transition-colors
          ${picked ? 'border-[#b20202] bg-[#b20202]' : 'border-gray-300 bg-white'}
          ${isRadio ? 'rounded-full' : 'rounded-md'}`}
        >
          {picked && <PiCheckCircle className="h-4 w-4 text-white" />}
        </div>

        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gray-100">
          {img
            ? <Image src={img} alt={sp.product?.name || ''} fill sizes="48px" className="object-cover" />
            : <div className="flex h-full w-full items-center justify-center"><PiPackage className="h-6 w-6 text-gray-300" /></div>
          }
        </div>

        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-semibold leading-tight ${picked ? 'text-[#b20202]' : 'text-gray-800'}`}>
            {sp.product?.name || sp.sku}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">{priceLabel}</p>
        </div>

        {picked && selectedSize && (
          <span className="shrink-0 rounded-lg bg-[#b20202] px-2 py-0.5 text-[10px] font-bold text-white">
            {selectedSize.displayName}
          </span>
        )}
        {picked && noSizes && <PiCheckCircle className="h-5 w-5 shrink-0 text-[#b20202]" />}
        {!picked && !noSizes && !disabled && (
          <span className="shrink-0 text-[10px] text-gray-400">Pick size →</span>
        )}
      </div>

      {/* Size chips */}
      {sizes.length > 0 && (
        <div className={`flex flex-wrap gap-1.5 border-t px-3 py-2.5 ${picked ? 'border-[#b20202]/20 bg-red-50/30' : 'border-gray-100 bg-gray-50/50'}`}>
          {sizes.map(size => {
            const oos    = size.availableStock <= 0;
            const active = sel?.val === String(size._id);
            return (
              <button
                key={size._id}
                type="button"
                disabled={oos && !active}
                onClick={e => {
                  e.stopPropagation();
                  if (active) { onPick(null); return; }
                  if (!disabled || picked) onPick(size._id);
                }}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all
                  ${active
                    ? 'bg-[#b20202] text-white shadow-sm'
                    : oos
                      ? 'border border-gray-200 bg-white text-gray-300 line-through cursor-not-allowed'
                      : 'border border-gray-200 bg-white text-gray-600 hover:border-[#b20202]/50 hover:text-[#b20202]'
                  }`}
              >
                <span>{size.displayName}</span>
                {!oos && <span className={active ? 'text-white/80' : 'text-gray-400'}>{formatCurrency(size.sellingPrice)}</span>}
                {oos && <span className="text-[9px] font-normal">(OOS)</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Quantity stepper — shown when picked and maxQty > 1 */}
      {showQty && (
        <div className="flex items-center gap-3 border-t border-[#b20202]/20 bg-red-50/20 px-3 py-2">
          <span className="text-[11px] font-semibold text-gray-500">Quantity:</span>
          <div className="flex items-center overflow-hidden rounded-lg border border-[#b20202]/30 bg-white">
            <button
              type="button"
              disabled={qty <= minQty}
              onClick={e => { e.stopPropagation(); onQty(Math.max(minQty, qty - 1)); }}
              className="flex h-7 w-7 items-center justify-center text-[#b20202] hover:bg-[#b20202]/10 disabled:opacity-30 transition-colors"
            >
              <PiMinus className="h-3 w-3" />
            </button>
            <span className="min-w-[28px] text-center text-sm font-bold text-gray-800">{qty}</span>
            <button
              type="button"
              disabled={qty >= maxQty}
              onClick={e => { e.stopPropagation(); onQty(Math.min(maxQty, qty + 1)); }}
              className="flex h-7 w-7 items-center justify-center text-[#b20202] hover:bg-[#b20202]/10 disabled:opacity-30 transition-colors"
            >
              <PiPlus className="h-3 w-3" />
            </button>
          </div>
          <span className="text-[10px] text-gray-400">
            {minQty === maxQty ? `Exactly ${minQty}` : `${minQty}–${maxQty} allowed`}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepPill({
  label, n, minSelect, required, active,
}: {
  label: string; n: number; minSelect: number; required: boolean; active?: boolean;
}) {
  const done = n >= minSelect && n > 0;
  return (
    <div className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors
      ${done
        ? 'bg-emerald-100 text-emerald-700'
        : active
          ? 'bg-[#b20202]/10 text-[#b20202] ring-1 ring-[#b20202]/30'
          : 'bg-gray-100 text-gray-500'
      }`}
    >
      {done
        ? <PiCheckCircle className="h-3.5 w-3.5 shrink-0" />
        : required
          ? <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-current" />
          : <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-current opacity-50" />
      }
      <span className="max-w-[80px] truncate">{label}</span>
      {n > 0 && <span className="opacity-70">{n}</span>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export type ComboPickMap = PickMap;

export default function POSComboPicker({
  combo,
  onAdd,
  onClose,
  initialPicks,
  editInstanceId,
}: {
  combo: POSCombo;
  onAdd: (items: POSCartItem[]) => void;
  onClose: () => void;
  initialPicks?: PickMap;
  editInstanceId?: string;
}) {
  const [picks, setPicks]             = useState<PickMap>(initialPicks ?? {});
  const [activeGroup, setActiveGroup] = useState(0);
  const groupRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ── Selection helpers ─────────────────────────────────────────────────────

  function groupCount(li: number) {
    return Object.keys(picks[li] || {}).length;
  }

  function getPick(li: number, ii: number): PickEntry | undefined {
    return picks[li]?.[ii];
  }

  function setPick(li: number, ii: number, val: string | true | null) {
    const line    = combo.choiceLines[li];
    const itemDef = line.items[ii];
    const minQty  = itemDef?.minQty ?? 1;
    setPicks(prev => {
      const prevLine = { ...(prev[li] || {}) };
      if (val === null) {
        delete prevLine[ii];
        return { ...prev, [li]: prevLine };
      }
      const entry: PickEntry = { val, qty: minQty };
      if (line.maxSelect <= 1) {
        return { ...prev, [li]: { [ii]: entry } };
      }
      const count   = Object.keys(prevLine).length;
      const already = prevLine[ii] !== undefined;
      if (!already && count >= line.maxSelect) return prev;
      return { ...prev, [li]: { ...prevLine, [ii]: entry } };
    });

    // Auto-advance to next incomplete required group after selection
    const isNowComplete = line.maxSelect <= 1; // single-select: one pick = done
    if (isNowComplete && val !== null) {
      const next = combo.choiceLines.findIndex((l, i) => {
        if (i <= li) return false;
        const n = groupCount(i);
        return l.required && n < l.minSelect;
      });
      if (next !== -1) {
        setActiveGroup(next);
        setTimeout(() => {
          groupRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      }
    }
  }

  function setPickQty(li: number, ii: number, qty: number) {
    setPicks(prev => {
      const entry = prev[li]?.[ii];
      if (!entry) return prev;
      return { ...prev, [li]: { ...prev[li], [ii]: { ...entry, qty } } };
    });
  }

  // ── Totals ────────────────────────────────────────────────────────────────

  const { selling, cost } = useMemo(() => {
    let selling = 0, cost = 0;
    combo.choiceLines.forEach((line, li) =>
      line.items.forEach((item, ii) => {
        const p = getPick(li, ii);
        if (!p) return;
        const sp  = item.subProduct;
        if (!sp) return;
        const qty = p.qty || 1;
        let unitSell = sp.baseSellingPrice;
        let unitCost = sp.costPrice ?? 0;
        if (typeof p.val === 'string') {
          const sz = sp.sizes?.find(s => String(s._id) === p.val);
          if (sz) { unitSell = sz.sellingPrice; unitCost = sz.costPrice ?? unitCost; }
        }
        selling += unitSell * qty;
        cost    += unitCost * qty;
      })
    );
    return { selling, cost };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks, combo.choiceLines]);

  const mode       = combo.priceMode ?? 'dynamic';
  const comboPrice = computeComboPrice(combo, selling, cost);
  // Total units across all selections (respects per-item qty)
  const addCount = combo.choiceLines.reduce((s, _, li) =>
    s + Object.values(picks[li] || {}).reduce((ls, e) => ls + (e.qty || 1), 0), 0);

  // ── Validation ────────────────────────────────────────────────────────────

  const lineStatus = combo.choiceLines.map((line, li) => {
    const n = groupCount(li);
    if (line.required && n < line.minSelect)
      return { ok: false, msg: n === 0 ? 'Select at least one' : `Need ${line.minSelect - n} more` };
    // Check per-item minQty for all selected items
    for (let ii = 0; ii < line.items.length; ii++) {
      const p      = getPick(li, ii);
      if (!p) continue;
      const iMin   = line.items[ii]?.minQty ?? 1;
      if (p.qty < iMin) return { ok: false, msg: `${line.items[ii]?.subProduct?.product?.name ?? 'Item'}: needs at least ${iMin}` };
    }
    return { ok: true, msg: '' };
  });
  const canAdd = lineStatus.every(s => s.ok);

  // ── Build cart items ──────────────────────────────────────────────────────

  function buildItems(): POSCartItem[] {
    const instanceId = editInstanceId ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const comboRef   = { comboId: combo._id, comboName: combo.name, instanceId };
    const raw: POSCartItem[] = [];

    combo.choiceLines.forEach((line, li) =>
      line.items.forEach((item, ii) => {
        const p  = getPick(li, ii);
        if (!p) return;
        const sp = item.subProduct;
        if (!sp) return;

        let sizeId: string | undefined;
        let price     = sp.baseSellingPrice;
        let variant   = '';
        let sku       = sp.sku ?? '';
        let stock     = sp.availableStock ?? 0;
        let costPrice = sp.costPrice;

        if (typeof p.val === 'string') {
          const sz = sp.sizes?.find(s => String(s._id) === p.val);
          if (sz) {
            sizeId    = sz._id;
            price     = sz.sellingPrice;
            variant   = sz.displayName;
            sku       = sz.sku ?? sp.sku ?? '';
            stock     = sz.availableStock;
            costPrice = sz.costPrice ?? sp.costPrice;
          }
        }

        raw.push({
          subProductId: String(sp._id),
          productId:    String(sp.product?._id ?? sp._id),
          sizeId,
          name:     sp.product?.name || 'Product',
          variant,
          sku,
          image:    spThumb(sp),
          price,
          quantity: p.qty || 1,
          discount: 0,
          stock,
          costPrice,
          comboRef,
        });
      })
    );

    // Express combo pricing as a uniform discount % — NOT by reducing item.price.
    // The server re-prices every item from the DB (ignoring client item.price) but
    // DOES apply item.discount (percentage) to compute lineSubtotal correctly.
    // Using discount % means the server total == comboPrice and the receipt shows
    // the saving as "disc -X%" rather than silently absorbing it into change.
    if ((mode === 'fixed' || mode === 'markup_on_cost' || mode === 'discount_off_selling') && raw.length > 0) {
      const target   = comboPrice;
      const itemsSum = raw.reduce((s, i) => s + i.price * (i.quantity || 1), 0);

      if (target > 0 && itemsSum > 0 && target < itemsSum) {
        // Uniform % that makes Σ(price × qty × (1 - disc/100)) == comboPrice
        const discPct = Math.round((1 - target / itemsSum) * 10000) / 100;
        raw.forEach(i => { i.discount = Math.min(100, Math.max(0, discPct)); });
      }
      // target >= itemsSum (markup > selling price margin): items stay at regular price
    }

    return raw;
  }

  // ── Selection summary list ────────────────────────────────────────────────

  const selectionSummary = useMemo(() => {
    const lines: { label: string; items: string[] }[] = [];
    combo.choiceLines.forEach((line, li) => {
      const chosen: string[] = [];
      line.items.forEach((item, ii) => {
        const p  = getPick(li, ii);
        if (!p) return;
        const sp = item.subProduct;
        if (!sp) return;
        const name = sp.product?.name || sp.sku;
        const qty    = p.qty > 1 ? `×${p.qty} ` : '';
        if (typeof p.val === 'string') {
          const sz = sp.sizes?.find(s => String(s._id) === p.val);
          chosen.push(`${qty}${name}${sz ? ` (${sz.displayName})` : ''}`);
        } else {
          chosen.push(`${qty}${name}`);
        }
      });
      if (chosen.length) lines.push({ label: line.label, items: chosen });
    });
    return lines;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks, combo.choiceLines]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex w-full max-h-[96dvh] sm:max-h-[88vh] sm:max-w-xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl">

        {/* ── Header ── */}
        <div className="shrink-0 border-b border-gray-100">
          <div className="flex items-start gap-3 px-5 pt-5 pb-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 leading-tight">{combo.name}</h2>
              {combo.description && (
                <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{combo.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <PiX className="h-5 w-5" />
            </button>
          </div>

          {/* Step pills */}
          <div className="flex gap-2 overflow-x-auto px-5 pb-4 scrollbar-none">
            {combo.choiceLines.map((line, li) => (
              <button
                key={li}
                type="button"
                onClick={() => {
                  setActiveGroup(li);
                  groupRefs.current[li]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                <StepPill
                  label={line.label || `Group ${li + 1}`}
                  n={groupCount(li)}
                  minSelect={line.minSelect}
                  required={line.required}
                  active={activeGroup === li}
                />
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-gray-100">
            {combo.choiceLines.map((line, li) => {
              const n = groupCount(li);
              const { ok, msg } = lineStatus[li];
              const isRadio = line.maxSelect <= 1;

              return (
                <div
                  key={line._id || li}
                  ref={el => { groupRefs.current[li] = el; }}
                  className="px-5 py-4"
                  onClick={() => setActiveGroup(li)}
                >
                  {/* Group header */}
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold
                        ${n >= line.minSelect && n > 0 ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                        {n >= line.minSelect && n > 0 ? '✓' : li + 1}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{line.label}</p>
                        <p className="text-[11px] text-gray-400">
                          {isRadio
                            ? line.required ? 'Choose 1' : 'Choose 1 (optional)'
                            : `Choose ${line.minSelect}–${line.maxSelect}`}
                        </p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold
                      ${n >= line.minSelect && n > 0
                        ? 'bg-emerald-100 text-emerald-700'
                        : n > 0
                          ? 'bg-[#b20202]/10 text-[#b20202]'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {n}/{line.maxSelect}
                    </span>
                  </div>

                  {/* Product rows */}
                  <div className="space-y-2">
                    {line.items.map((item, ii) => {
                      const sp = item.subProduct;
                      if (!sp) return null;
                      const sizes  = effectiveSizes(sp, (item.allowedSizes || []).map(String));
                      const entry  = getPick(li, ii);
                      const picked = entry !== undefined;
                      const atCap  = !picked && n >= line.maxSelect;
                      const iMin   = item.minQty ?? 1;
                      const iMax   = item.maxQty ?? 1;
                      return (
                        <ProductRow
                          key={`${li}-${ii}`}
                          sp={sp}
                          sizes={sizes}
                          sel={entry}
                          isRadio={isRadio}
                          atCap={atCap}
                          minQty={iMin}
                          maxQty={iMax}
                          onPick={val => setPick(li, ii, val)}
                          onQty={qty => setPickQty(li, ii, qty)}
                        />
                      );
                    })}
                  </div>

                  {!ok && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-[#b20202]">
                      <PiWarningCircle className="h-3.5 w-3.5 shrink-0" />
                      {msg}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-4">
          {/* Selection summary */}
          {selectionSummary.length > 0 && (
            <div className="mb-3 rounded-xl bg-gray-50 px-3 py-2.5">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Your selections</p>
              {selectionSummary.map((s, i) => (
                <div key={i} className="flex items-baseline gap-1.5 text-xs">
                  <span className="shrink-0 font-semibold text-gray-500">{s.label}:</span>
                  <span className="text-gray-700">{s.items.join(', ')}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            {/* Price */}
            <div>
              {mode === 'discount_off_selling' && selling > 0 && selling !== comboPrice && (
                <p className="text-xs text-gray-400 line-through">{formatCurrency(selling)}</p>
              )}
              {mode === 'markup_on_cost' && cost > 0 && (
                <p className="text-[11px] text-gray-400">{formatCurrency(cost)} cost + {combo.markupPercentage ?? 0}%</p>
              )}
              <p className="text-xl font-black text-gray-900">
                {comboPrice > 0
                  ? formatCurrency(comboPrice)
                  : addCount > 0 ? '—' : 'Select items above'}
              </p>
            </div>

            {/* Add button */}
            <button
              type="button"
              disabled={!canAdd || addCount === 0}
              onClick={() => { if (canAdd && addCount > 0) onAdd(buildItems()); }}
              className={`flex h-12 min-w-[160px] items-center justify-center gap-2 rounded-2xl px-6 text-sm font-bold transition-all
                ${canAdd && addCount > 0
                  ? 'bg-[#b20202] text-white shadow-md hover:bg-[#950000] active:scale-[0.97]'
                  : 'cursor-not-allowed bg-gray-100 text-gray-400'
                }`}
            >
              <PiShoppingCartSimple className="h-5 w-5" />
              {canAdd && addCount > 0
                ? editInstanceId
                  ? 'Update Cart'
                  : `Add ${addCount} item${addCount > 1 ? 's' : ''}`
                : 'Select items'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
