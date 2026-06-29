// client/apps/admin/src/app/shared/sales/product-line-search.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { PiMagnifyingGlass, PiCaretRight, PiPlus } from 'react-icons/pi';
import { subproductService } from '@/services/subproduct.service';
import { scanService } from '@/services/scan.service';
import { routes } from '@/config/routes';
import type { POSBundleDeal } from '@/app/shared/point-of-sale/types';

export interface ProductLineSelection {
  name: string;
  sku: string;
  subProductId: string;
  productId?: string;
  sellingPrice: number;
  costPrice: number;
  taxRate: number;
  sizeId?: string;
  sizeName?: string;
  availableStock?: number;
  bundleDeals?: POSBundleDeal[];
  originalPrice?: number;
}

interface SizeOption {
  size: string;
  displayName?: string;
  sku?: string;
  sellingPrice: number;
  costPrice: number;
  availableStock?: number;
}

interface ProductOption {
  _id: string;
  productId?: string;
  name: string;
  sku: string;
  sellingPrice: number;
  // Parent SubProduct's baseSellingPrice — used as a fallback when a size's
  // sellingPrice was persisted as 0 (legacy size-writer bug, see A2/A3).
  baseSellingPrice: number;
  costPrice: number;
  taxRate: number;
  availableStock?: number;
  sellWithoutSizeVariants: boolean;
  sizes: SizeOption[];
  bundleDeals: POSBundleDeal[];
}

function mapProducts(raw: any[]): ProductOption[] {
  return raw.map((sp: any) => ({
    _id: sp._id,
    productId: sp.product?._id ?? sp.product,
    name: sp.product?.name ?? sp.name ?? '',
    sku: sp.sku ?? '',
    sellingPrice: sp.baseSellingPrice ?? 0,
    baseSellingPrice: sp.baseSellingPrice ?? 0,
    costPrice: sp.costPrice ?? 0,
    taxRate: sp.taxRate ?? 0,
    availableStock: sp.availableStock ?? sp.totalStock ?? undefined,
    sellWithoutSizeVariants: sp.sellWithoutSizeVariants ?? false,
    bundleDeals: sp.bundleDeals ?? [],
    sizes: (sp.sizes ?? []).map((s: any) => ({
      size: String(s._id ?? s.size ?? ''),
      displayName: s.displayName ?? s.size ?? '',
      sku: s.sku ?? sp.sku ?? '',
      sellingPrice: s.sellingPrice ?? 0,
      costPrice: s.costPrice ?? sp.costPrice ?? 0,
      availableStock: s.availableStock ?? s.stock ?? 0,
    })),
  }));
}

export default function ProductLineSearch({
  token,
  query,
  onSelect,
}: {
  token: string;
  query: string;
  onSelect: (info: ProductLineSelection) => void;
}) {
  const [text, setText] = useState(query);
  const [initial, setInitial] = useState<ProductOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [fuzzy, setFuzzy] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(query);
  }, [query]);

  async function ensureInitial() {
    if (initialLoaded || !token) return;
    setLoading(true);
    try {
      const res = await subproductService.getSubProducts(token, { limit: 50 });
      const list = mapProducts(res?.data?.subProducts ?? []);
      setInitial(list);
      setProducts(list);
      setInitialLoaded(true);
    } catch {
      setInitial([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    if (text.trim().length < 2) {
      setProducts(initial);
      setFuzzy(false);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await subproductService.getSubProducts(token, {
          search: text.trim(),
          limit: 50,
        });
        const exact = mapProducts(res?.data?.subProducts ?? []);
        if (exact.length > 0) {
          setProducts(exact);
          setFuzzy(false);
        } else {
          // Fallback: alias-expansion + Brand/Category fuzzy search (no AI)
          const smart = await scanService.smartSearch(token, text.trim());
          setProducts(
            smart.map((item: any) => ({
              _id: item._id,
              productId: item.product?._id ?? item.productId,
              name: item.product?.name ?? item.name ?? '',
              sku: item.sku ?? '',
              sellingPrice: item.baseSellingPrice ?? 0,
              baseSellingPrice: item.baseSellingPrice ?? 0,
              costPrice: item.costPrice ?? 0,
              taxRate: item.taxRate ?? 0,
              sellWithoutSizeVariants: item.sellWithoutSizeVariants ?? false,
              bundleDeals: item.bundleDeals ?? [],
              sizes: (item.sizes ?? []).map((s: any) => ({
                size: String(s._id ?? s.size ?? ''),
                displayName: s.displayName ?? s.size ?? '',
                sku: s.sku ?? item.sku ?? '',
                sellingPrice: s.sellingPrice ?? 0,
                costPrice: s.costPrice ?? item.costPrice ?? 0,
                availableStock: s.availableStock ?? s.stock ?? 0,
              })),
            }))
          );
          setFuzzy(true);
        }
        setExpandedId(null);
      } catch {
        setProducts([]);
        setFuzzy(false);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [text, token, initial]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function pickSizeless(p: ProductOption) {
    onSelect({
      name: p.name,
      sku: p.sku,
      subProductId: p._id,
      productId: p.productId,
      sellingPrice: p.sellingPrice,
      costPrice: p.costPrice,
      taxRate: p.taxRate,
      availableStock:
        p.availableStock ?? p.sizes[0]?.availableStock ?? undefined,
      bundleDeals: p.bundleDeals,
      originalPrice: p.sellingPrice,
    });
    setText(p.name);
    setOpen(false);
  }

  function pickSize(p: ProductOption, s: SizeOption) {
    const displaySize = s.displayName ?? s.size;
    // Fall back to the parent SubProduct's baseSellingPrice when this size's
    // sellingPrice was persisted as 0 (legacy size-writer bug, repaired in
    // A2/A3). Prevents the line's unit price showing as 0 in the sales table.
    const sizePrice =
      s.sellingPrice || p.sellingPrice || p.baseSellingPrice || 0;
    onSelect({
      name: `${p.name} – ${displaySize}`,
      sku: s.sku ?? p.sku,
      subProductId: p._id,
      productId: p.productId,
      sellingPrice: sizePrice,
      costPrice: s.costPrice,
      taxRate: p.taxRate,
      sizeId: s.size,
      sizeName: displaySize,
      availableStock: s.availableStock ?? undefined,
      bundleDeals: p.bundleDeals,
      originalPrice: sizePrice,
    });
    setText(`${p.name} – ${displaySize}`);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <PiMagnifyingGlass className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setExpandedId(null);
          }}
          onFocus={() => {
            ensureInitial();
            setOpen(true);
          }}
          placeholder="Search product…"
          className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-xs text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
        />
        {loading && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-pulse text-[10px] text-gray-400">
            …
          </span>
        )}
      </div>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          {fuzzy && products.length > 0 && (
            <div className="flex items-center gap-1.5 border-b border-gray-100 bg-amber-50 px-3 py-1.5">
              <span className="text-[10px] font-semibold text-amber-600">
                ~ Fuzzy matches
              </span>
              <span className="text-[10px] text-amber-500">
                — no exact results found
              </span>
            </div>
          )}
          {products.length === 0 && !loading ? (
            <div className="px-3 py-3 text-xs text-gray-400">
              {text.trim().length >= 2
                ? `No products match "${text}"`
                : 'No products in your catalogue yet'}
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {products.map((p) => {
                const hasSizes =
                  !p.sellWithoutSizeVariants && p.sizes.length > 0;
                const isExpanded = expandedId === p._id;
                return (
                  <div key={p._id}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (hasSizes) setExpandedId(isExpanded ? null : p._id);
                        else pickSizeless(p);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 ${isExpanded ? 'bg-gray-50' : ''}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-gray-900">
                          {p.name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2">
                          {p.sku && (
                            <span className="font-mono text-[10px] text-gray-400">
                              {p.sku}
                            </span>
                          )}
                          {hasSizes && (
                            <span className="text-[10px] text-gray-400">
                              {p.sizes.length} size
                              {p.sizes.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      {hasSizes ? (
                        <PiCaretRight
                          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      ) : (
                        p.sellingPrice > 0 && (
                          <span className="shrink-0 text-xs font-medium text-gray-600">
                            {p.sellingPrice.toFixed(2)}
                          </span>
                        )
                      )}
                    </button>

                    {hasSizes && isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50/60 pb-1 pl-4 pt-1">
                        {p.sizes.map((s) => (
                          <button
                            key={s.size}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              pickSize(p, s);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-gray-800">
                                {s.displayName ?? s.size}
                              </p>
                              <div className="mt-0.5 flex items-center gap-2">
                                {s.sku && (
                                  <span className="font-mono text-[10px] text-gray-400">
                                    {s.sku}
                                  </span>
                                )}
                                {(s.availableStock ?? 0) > 0 ? (
                                  <span className="text-[10px] text-emerald-600">
                                    {s.availableStock} in stock
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-gray-400">
                                    Out of stock
                                  </span>
                                )}
                              </div>
                            </div>
                            {s.sellingPrice > 0 && (
                              <span className="shrink-0 text-xs font-semibold text-gray-700">
                                {s.sellingPrice.toFixed(2)}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="border-t border-gray-100">
            <a
              href={routes.eCommerce.createSubProduct}
              target="_blank"
              rel="noreferrer"
              onMouseDown={(e) => e.stopPropagation()}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-medium text-[#b20202] hover:bg-gray-50"
            >
              <PiPlus className="h-3.5 w-3.5" />
              Create new product
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
