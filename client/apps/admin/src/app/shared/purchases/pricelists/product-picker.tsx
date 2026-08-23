'use client';

import { useEffect, useRef, useState } from 'react';
import { PiMagnifyingGlass, PiPlus } from 'react-icons/pi';
import { useSession } from 'next-auth/react';
import { posApi } from '@/app/shared/point-of-sale/api';
import type { POSProduct } from '@/app/shared/point-of-sale/types';
import type { PricelistItem } from '@/services/vendorPricelist.service';
import { fmtCur } from '../purchases-analytics-helpers';
import { emptyLine } from './helpers';

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
        aria-label={label}
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
