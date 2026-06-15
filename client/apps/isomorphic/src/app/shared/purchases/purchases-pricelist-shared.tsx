'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import {
  PiMagnifyingGlass,
  PiPlus,
  PiTrash,
  PiStar,
  PiStarFill,
  PiPackage,
  PiCaretUp,
  PiCaretDown,
  PiClockCounterClockwise,
} from 'react-icons/pi';
import { useSession } from 'next-auth/react';
import { posApi } from '@/app/shared/point-of-sale/api';
import type { POSProduct } from '@/app/shared/point-of-sale/types';
import type {
  PricelistItem,
  HistoryEntry,
} from '@/services/vendorPricelist.service';
import { fmtCur } from './purchases-analytics-helpers';
import { fraunces } from './purchases-fonts';

/** A fresh, empty price line. */
export function emptyLine(): PricelistItem {
  return {
    subProductId: '',
    subProductName: '',
    productName: '',
    unitPrice: 0,
    discountPercent: 0,
    minQuantity: 1,
    leadTimeDays: 0,
    packagingQty: 1,
    isPreferred: false,
    priceHistory: [],
  };
}

/** Net price after the line discount. */
export function netPrice(line: PricelistItem): number {
  return line.unitPrice * (1 - (line.discountPercent || 0) / 100);
}

/** Lines whose latest change magnitude meets/exceeds this are "alerts". */
export const BIG_JUMP_THRESHOLD = 25;

/** Latest signed % change for a line (from history, else previousPrice). */
export function lineDelta(line: PricelistItem): number | null {
  const hist = line.priceHistory;
  if (hist && hist.length > 0) {
    const pct = hist[hist.length - 1].changePercent;
    return typeof pct === 'number' ? pct : null;
  }
  if (line.previousPrice && line.previousPrice > 0) {
    return (
      Math.round(
        ((line.unitPrice - line.previousPrice) / line.previousPrice) * 1000
      ) / 10
    );
  }
  return null;
}

export function isBigJump(line: PricelistItem): boolean {
  const d = lineDelta(line);
  return d !== null && Math.abs(d) >= BIG_JUMP_THRESHOLD;
}

// ── Product picker ───────────────────────────────────────────────────────────

export function ProductPicker({
  onPick,
  label = 'Add Product',
}: {
  onPick: (line: PricelistItem) => void;
  label?: string;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<POSProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<POSProduct | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActive(null);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!open || !token) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await posApi.getProducts(token, {
          search: query.trim() || undefined,
          limit: 25,
        });
        setResults(res.products ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, open, token]);

  function pickProduct(p: POSProduct) {
    if (p.sizes && p.sizes.length > 0) {
      setActive(p);
      return;
    }
    commit(p);
  }

  function commit(p: POSProduct, size?: POSProduct['sizes'][number]) {
    const base = size?.costPrice ?? p.costPrice ?? 0;
    onPick({
      ...emptyLine(),
      subProductId: p._id,
      subProductName: p.product?.name ?? '',
      productName: p.product?.name ?? '',
      sku: size?.sku ?? p.sku,
      sizeId: size?._id,
      sizeName: size?.displayName,
      basePrice: base,
      unitPrice: base,
    });
    setOpen(false);
    setActive(null);
    setQuery('');
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#9a0101]"
      >
        <PiPlus className="h-3.5 w-3.5" /> {label}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[26rem] overflow-hidden rounded-xl border border-[#ece4d6] bg-white shadow-xl">
          <div className="flex items-center gap-2 border-b border-[#ece4d6] px-3 py-2.5">
            <PiMagnifyingGlass className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products by name or SKU…"
              className="w-full text-sm outline-none placeholder:text-gray-400"
            />
          </div>

          {active ? (
            <div className="max-h-80 overflow-y-auto p-2">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Pick a size — {active.product?.name}
              </p>
              {active.sizes.map((s) => (
                <button
                  key={s._id}
                  type="button"
                  onClick={() => commit(active, s)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-[#FAF8F3]"
                >
                  <span className="text-[#2a2420]">{s.displayName}</span>
                  <span className="tabular-nums text-gray-400">
                    {fmtCur(s.costPrice ?? 0, 'NGN')}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setActive(null)}
                className="mt-1 px-3 py-1 text-[11px] font-medium text-gray-400 hover:text-gray-600"
              >
                ← Back to products
              </button>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto p-2">
              {loading ? (
                <div className="py-8 text-center text-sm text-gray-400">
                  Searching…
                </div>
              ) : results.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">
                  No products found
                </div>
              ) : (
                results.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => pickProduct(p)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-[#FAF8F3]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-[#2a2420]">
                        {p.product?.name}
                      </span>
                      <span className="block truncate text-[11px] text-gray-400">
                        {p.sku}
                        {p.product?.brand?.name
                          ? ` · ${p.product.brand.name}`
                          : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-gray-400">
                      {p.sizes?.length
                        ? `${p.sizes.length} sizes`
                        : fmtCur(p.costPrice ?? 0, 'NGN')}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Line items editor ──────────────────────────────────────────────────────────

export function LineItemsEditor({
  lines,
  currency,
  onChange,
}: {
  lines: PricelistItem[];
  currency: string;
  onChange: (lines: PricelistItem[]) => void;
}) {
  const [openHistory, setOpenHistory] = useState<number | null>(null);
  function update(i: number, patch: Partial<PricelistItem>) {
    onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function remove(i: number) {
    onChange(lines.filter((_, idx) => idx !== i));
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#ece4d6] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#ece4d6] px-5 py-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b20202]/70">
            Catalogue
          </p>
          <h2
            className={`${fraunces.className} text-base font-semibold text-[#2a2420]`}
          >
            Price Lines{' '}
            <span className="text-sm font-normal text-gray-400">
              ({lines.length})
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange([...lines, emptyLine()])}
            className="flex items-center gap-1 rounded-lg border border-[#ece4d6] px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#FAF8F3]"
          >
            <PiPlus className="h-3.5 w-3.5" /> Blank Line
          </button>
          <ProductPicker onPick={(line) => onChange([...lines, line])} />
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#b20202]/5">
            <PiPackage className="h-5 w-5 text-[#b20202]/40" />
          </span>
          <p className="text-sm text-gray-500">
            No price lines yet — add a product to start
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#ece4d6] bg-[#FAF8F3] text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                <th className="px-4 py-2.5">Product</th>
                <th className="px-3 py-2.5 text-right">Unit Price</th>
                <th className="px-3 py-2.5 text-right">Disc %</th>
                <th className="px-3 py-2.5 text-right">Net</th>
                <th className="px-3 py-2.5 text-right">Min Qty</th>
                <th className="px-3 py-2.5 text-right">Lead (d)</th>
                <th className="px-3 py-2.5 text-center">Pref</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1ece2]">
              {lines.map((line, i) => (
                <Fragment key={i}>
                  <tr className="hover:bg-[#FAF8F3]/60">
                    <td className="px-4 py-2">
                      {line.subProductId ? (
                        <>
                          <p className="font-medium text-[#2a2420]">
                            {line.subProductName || line.productName}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {[line.sizeName, line.sku]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <DeltaBadge delta={lineDelta(line)} />
                            {line.priceHistory &&
                              line.priceHistory.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenHistory(openHistory === i ? null : i)
                                  }
                                  className="text-[10px] font-medium text-gray-400 underline-offset-2 hover:text-[#b20202] hover:underline"
                                >
                                  {openHistory === i
                                    ? 'Hide history'
                                    : `History (${line.priceHistory.length})`}
                                </button>
                              )}
                          </div>
                        </>
                      ) : (
                        <input
                          value={line.productName}
                          onChange={(e) =>
                            update(i, { productName: e.target.value })
                          }
                          placeholder="Product name"
                          className="w-44 rounded border border-[#ece4d6] px-2 py-1 text-xs focus:border-[#b20202] focus:outline-none"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(e) =>
                          update(i, { unitPrice: Number(e.target.value) })
                        }
                        className="w-28 rounded border border-[#ece4d6] px-2 py-1 text-right text-xs tabular-nums focus:border-[#b20202] focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={line.discountPercent}
                        onChange={(e) =>
                          update(i, { discountPercent: Number(e.target.value) })
                        }
                        className="w-16 rounded border border-[#ece4d6] px-2 py-1 text-right text-xs tabular-nums focus:border-[#b20202] focus:outline-none"
                      />
                    </td>
                    <td
                      className={`${fraunces.className} px-3 py-2 text-right font-semibold tabular-nums text-[#2a2420]`}
                    >
                      {fmtCur(netPrice(line), currency)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="1"
                        value={line.minQuantity ?? 1}
                        onChange={(e) =>
                          update(i, { minQuantity: Number(e.target.value) })
                        }
                        className="w-16 rounded border border-[#ece4d6] px-2 py-1 text-right text-xs tabular-nums focus:border-[#b20202] focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        value={line.leadTimeDays ?? 0}
                        onChange={(e) =>
                          update(i, { leadTimeDays: Number(e.target.value) })
                        }
                        className="w-14 rounded border border-[#ece4d6] px-2 py-1 text-right text-xs tabular-nums focus:border-[#b20202] focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          update(i, { isPreferred: !line.isPreferred })
                        }
                        title={
                          line.isPreferred
                            ? 'Preferred vendor line'
                            : 'Mark preferred'
                        }
                        className="text-gray-300 transition-colors hover:text-[#c8932c]"
                      >
                        {line.isPreferred ? (
                          <PiStarFill className="h-4 w-4 text-[#c8932c]" />
                        ) : (
                          <PiStar className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <PiTrash className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                  {openHistory === i && (
                    <tr>
                      <td colSpan={8} className="bg-[#FAF8F3]/40">
                        <PriceHistoryPanel
                          history={line.priceHistory}
                          currency={currency}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) return null;
  const up = delta > 0;
  const big = Math.abs(delta) >= BIG_JUMP_THRESHOLD;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
        up
          ? big
            ? 'bg-red-100 text-red-600'
            : 'bg-red-50 text-red-500'
          : 'bg-[#3d6b5c]/12 text-[#3d6b5c]'
      }`}
      title={`${up ? 'Up' : 'Down'} ${Math.abs(delta)}% vs previous`}
    >
      {up ? (
        <PiCaretUp className="h-2.5 w-2.5" />
      ) : (
        <PiCaretDown className="h-2.5 w-2.5" />
      )}
      {Math.abs(delta)}%
    </span>
  );
}

export function PriceHistoryPanel({
  history,
  currency,
}: {
  history?: HistoryEntry[];
  currency: string;
}) {
  if (!history || history.length === 0) {
    return (
      <p className="px-4 py-3 text-xs text-gray-400">No price history yet.</p>
    );
  }
  const rows = [...history].reverse();
  return (
    <div className="px-4 py-3">
      <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        <PiClockCounterClockwise className="h-3.5 w-3.5" /> Price history
      </p>
      <div className="space-y-1">
        {rows.map((h, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-gray-500">
              {h.date ? new Date(h.date).toLocaleDateString() : '—'}
              <span className="ml-2 rounded bg-[#FAF8F3] px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                {h.source === 'po' ? `PO ${h.poNumber || ''}`.trim() : 'Manual'}
              </span>
            </span>
            <span className="flex items-center gap-2 tabular-nums">
              <span className="font-medium text-[#2a2420]">
                {fmtCur(h.unitPrice, currency)}
              </span>
              <DeltaBadge
                delta={
                  typeof h.changePercent === 'number' ? h.changePercent : null
                }
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
