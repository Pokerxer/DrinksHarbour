'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { POSProduct, POSSize } from '@/app/shared/point-of-sale/types';
import {
  getImageUrl, getProductDisplayName, formatCurrency,
  findMatchingPricelistRules, applyRuleTransform,
} from '@/app/shared/point-of-sale/utils';
import { usePOSCart, usePOSAuth, usePOSAvailablePricelists, usePOSPricelist } from '@/app/shared/point-of-sale/store';
import { RULE_TYPE_META } from '@/app/shared/point-of-sale/pricelist-constants';
import Image from 'next/image';
import toast from 'react-hot-toast';
import {
  PiPlus, PiMinus, PiX, PiShoppingCart,
  PiInfo, PiPackage, PiBarcode, PiTag,
  PiWarning, PiCheckCircle, PiProhibit, PiTagChevron,
  PiArrowDown, PiArrowUp, PiCurrencyNgn,
} from 'react-icons/pi';

type ProductCardProps = {
  product: POSProduct;
  onAddToCart: (product: POSProduct, sizeId?: string, quantity?: number) => void;
  className?: string;
  flash?: boolean;
};

// ── Pricelist comparison panel ────────────────────────────────────────────────
function PricelistBreakdown({
  product,
  hasSizes,
  validSizes,
}: {
  product: POSProduct;
  hasSizes: boolean;
  validSizes: POSSize[];
}) {
  const { token } = usePOSAuth();
  const { pricelists, loaded, load } = usePOSAvailablePricelists();
  const { selectedPricelist, setSelectedPricelist } = usePOSPricelist();
  const [activeSizeId, setActiveSizeId] = useState<string>(validSizes[0]?._id ?? '');

  useEffect(() => { if (token) load(token); }, [token, load]);

  // True base: use _priceBeforePricelist when a pricelist is active so we
  // always compare against the actual raw standard price.
  const trueBase = useMemo(() => (
    Number((product as any)._priceBeforePricelist) ||
    Number(product.baseSellingPrice) ||
    0
  ), [product]);

  // Use only the actual vendor costPrice (sp.costPrice). The platform-computed
  // cost is derived FROM the selling price, so using it for formula rules creates
  // a circular result (derivedCost × markup = sellingPrice again). Formula rules
  // require the true purchase cost to produce a meaningful different price.
  const costPrice = Number((product as any).costPrice) || 0;

  // Per-size true bases and costs
  const sizeBases = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const sz of validSizes) {
      map[sz._id] =
        Number((sz as any)._priceBeforePricelist) ||
        Number(sz.sellingPrice) ||
        0;
    }
    return map;
  }, [validSizes]);

  const sizeCosts = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const sz of validSizes) {
      const szCost = Number((sz as any).costPrice) || 0;
      // Only fall back to product-level cost if size has no cost of its own
      map[sz._id] = szCost > 0 ? szCost : costPrice;
    }
    return map;
  }, [validSizes, costPrice]);

  type RuleStep = { priceType: string; label: string; meta: any };

  function buildRuleSteps(rules: any[]): RuleStep[] {
    return rules.map(r => {
      const meta = (RULE_TYPE_META as any)[r.priceType] ?? { label: r.priceType, color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' };
      let label = meta.label;
      if (r.priceType === 'formula')    label = `+${r.markupPercentage}% on cost`;
      if (r.priceType === 'fixed')      label = `Fixed ${formatCurrency(r.fixedPrice)}`;
      if (r.priceType === 'flash_sale') label = `${r.flashSalePercentage}% flash`;
      if (r.priceType === 'discount') {
        label = r.discountType === 'fixed'
          ? `-${formatCurrency(r.discountAmount)}`
          : `-${r.discountPercentage}%${r.minQuantity > 0 ? ` (qty ${r.minQuantity}+)` : ''}`;
      }
      return { priceType: r.priceType, label, meta };
    });
  }

  function buildBundleHints(pl: any): string[] {
    const now = new Date();
    const bundleRules = (pl.rules || []).filter((r: any) =>
      r.priceType === 'bundle' &&
      (!r.endDate || new Date(r.endDate) >= now) &&
      (!r.startDate || new Date(r.startDate) <= now)
    );
    return bundleRules.map((r: any) => {
      const qty  = r.bundleQuantity ?? 2;
      const disc = r.bundleDiscount ?? 0;
      const dt   = r.bundleDiscountType || 'percentage';
      if (dt === 'markup_on_cost') return `📦 Buy ${qty}+ · Cost +${disc}% markup`;
      if (dt === 'no_discount')    return `📦 Buy ${qty}+ · No extra discount`;
      if (dt === 'fixed')          return `📦 Buy ${qty}+ · ${formatCurrency(disc)} off`;
      return `📦 Buy ${qty}+ · ${disc}% off`;
    });
  }

  type PlRow = {
    id: string;
    name: string;
    isActive: boolean;
    ruleSteps: RuleStep[];
    bundleHints: string[];
    price: number;
    saving: number;
    pct: number;
    needsCost: boolean;
    effectiveCost: number;
    sizePrices: Record<string, { price: number; saving: number; pct: number; cost: number }>;
    plRef: any;
  };

  const rows = useMemo<PlRow[]>(() => {
    const list: PlRow[] = [];

    // Standard row (no pricelist)
    const stdSzPrices: Record<string, { price: number; saving: number; pct: number; cost: number }> = {};
    for (const sz of validSizes) stdSzPrices[sz._id] = { price: sizeBases[sz._id] || 0, saving: 0, pct: 0, cost: sizeCosts[sz._id] || 0 };
    list.push({
      id: '__standard__', name: 'Standard Price',
      isActive: !selectedPricelist,
      ruleSteps: [], bundleHints: [],
      price: trueBase, saving: 0, pct: 0, needsCost: false, effectiveCost: costPrice,
      sizePrices: stdSzPrices, plRef: null,
    });

    for (const pl of pricelists) {
      const priceRules  = findMatchingPricelistRules(pl.rules || [], product._id, 1, 'price');
      const bundleHints = buildBundleHints(pl);

      // For sized products the relevant cost is the active size's cost;
      // for no-size products it's the product-level cost.
      const hasFormula  = priceRules.some(r => r.priceType === 'formula');
      const needsCost   = hasFormula && costPrice <= 0 && Object.values(sizeCosts).every(c => c <= 0);

      let plPrice = trueBase;
      for (const rule of priceRules) plPrice = applyRuleTransform(plPrice, rule, costPrice);
      const saving = trueBase - plPrice;
      const pct    = trueBase > 0 ? Math.round(Math.abs(saving) / trueBase * 100) : 0;

      const szPrices: Record<string, { price: number; saving: number; pct: number; cost: number }> = {};
      for (const sz of validSizes) {
        const szBase = sizeBases[sz._id] || 0;
        const szCost = sizeCosts[sz._id] || costPrice;
        let szP = szBase;
        for (const rule of priceRules) szP = applyRuleTransform(szP, rule, szCost);
        const szSaving = szBase - szP;
        szPrices[sz._id] = {
          price: szP,
          saving: szSaving,
          pct: szBase > 0 ? Math.round(Math.abs(szSaving) / szBase * 100) : 0,
          cost: szCost,
        };
      }

      list.push({
        id: pl._id, name: pl.name,
        isActive: selectedPricelist?._id === pl._id,
        ruleSteps: buildRuleSteps(priceRules),
        bundleHints,
        price: plPrice, saving, pct, needsCost,
        effectiveCost: costPrice,
        sizePrices: szPrices, plRef: pl,
      });
    }

    return list;
  }, [pricelists, product, validSizes, sizeBases, sizeCosts, trueBase, costPrice, selectedPricelist]);

  function applyPricelist(pl: any) {
    setSelectedPricelist(pl);
    toast.success(`Pricelist: ${pl.name}`, { icon: '🏷️' });
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-xs text-gray-400">
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500" />
        Loading pricelists…
      </div>
    );
  }

  if (pricelists.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-6">
        <PiTagChevron className="h-8 w-8 text-gray-200" />
        <p className="text-xs text-gray-400">No selectable pricelists configured.</p>
        <p className="text-[10px] text-gray-300">Mark a pricelist as Selectable in admin.</p>
      </div>
    );
  }

  const activeSize = validSizes.find(s => s._id === activeSizeId);

  return (
    <div className="space-y-3">

      {/* Size selector — only for multi-size products */}
      {hasSizes && validSizes.length > 1 && (
        <div>
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-400">Size variant</p>
          <div className="flex flex-wrap gap-1.5">
            {validSizes.map(sz => (
              <button
                key={sz._id}
                type="button"
                onClick={() => setActiveSizeId(sz._id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  activeSizeId === sz._id
                    ? 'bg-[#b20202] text-white shadow-sm'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {sz.displayName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pricelist rows */}
      <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200">
        {rows.map((row) => {
          const szEntry   = hasSizes && activeSizeId ? row.sizePrices[activeSizeId] : null;
          const dp        = szEntry?.price    ?? row.price;
          const ds        = szEntry?.saving   ?? row.saving;
          const dp_pct    = szEntry?.pct      ?? row.pct;
          const usedCost  = szEntry?.cost     ?? row.effectiveCost;

          const isCheaper = ds > 0.5;
          const isMarkup  = ds < -0.5;
          const noChange  = !isCheaper && !isMarkup;
          const isStd     = row.id === '__standard__';
          const hasFormula = row.ruleSteps.some(s => s.priceType === 'formula');

          return (
            <div
              key={row.id}
              className={`px-3.5 py-3 transition-colors ${
                row.isActive
                  ? 'bg-emerald-50'
                  : isStd
                  ? 'bg-gray-50/60'
                  : 'bg-white hover:bg-gray-50/40'
              }`}
            >
              {/* Top row: name + badges + price */}
              <div className="flex items-start gap-2">
                {/* Name + active badge */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-[11px] font-bold leading-tight ${
                      row.isActive ? 'text-emerald-700' : isStd ? 'text-gray-500' : 'text-gray-800'
                    }`}>
                      {row.name}
                    </span>
                    {row.isActive && (
                      <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
                        Active
                      </span>
                    )}
                    {!isStd && !row.ruleSteps.length && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-400">
                        No rule for this product
                      </span>
                    )}
                    {/* Rule type badges */}
                    {row.ruleSteps.map((step, i) => (
                      <span
                        key={i}
                        className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                        style={{ background: step.meta.bg, color: step.meta.color, border: `1px solid ${step.meta.border}` }}
                      >
                        {step.label}
                      </span>
                    ))}
                    {row.needsCost && (
                      <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[9px] text-orange-500">
                        ⚠ No cost price
                      </span>
                    )}
                  </div>
                  {/* Formula breakdown */}
                  {hasFormula && !row.needsCost && usedCost > 0 && !noChange && (
                    <p className="mt-0.5 text-[9px] text-gray-400 tabular-nums">
                      Cost {formatCurrency(usedCost)} × (1 + markup%) = {formatCurrency(dp)}
                    </p>
                  )}
                  {hasFormula && row.needsCost && (
                    <p className="mt-0.5 text-[9px] text-orange-400">
                      Set vendor cost price on this product to calculate
                    </p>
                  )}
                </div>

                {/* Price + delta */}
                <div className="shrink-0 text-right">
                  <p className={`text-sm font-extrabold tabular-nums leading-tight ${
                    row.isActive ? 'text-emerald-700' : 'text-gray-900'
                  }`}>
                    {formatCurrency(dp)}
                  </p>
                  {noChange ? (
                    <p className="text-[9px] leading-tight text-gray-300">
                      {!isStd && row.ruleSteps.length > 0 ? '= standard' : '—'}
                    </p>
                  ) : (
                    <p className={`text-[10px] font-semibold tabular-nums leading-tight ${
                      isCheaper ? 'text-emerald-600' : 'text-orange-500'
                    }`}>
                      {isCheaper ? '↓' : '↑'} {formatCurrency(Math.abs(ds))}
                      {dp_pct > 0 && <span className="ml-0.5 opacity-70">({dp_pct}%)</span>}
                    </p>
                  )}
                </div>
              </div>

              {/* Bundle hints */}
              {row.bundleHints.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {row.bundleHints.map((hint, i) => (
                    <span
                      key={i}
                      className="rounded bg-purple-50 px-1.5 py-0.5 text-[9px] font-semibold text-purple-600"
                    >
                      {hint}
                    </span>
                  ))}
                </div>
              )}

              {/* Apply button — non-standard, non-active rows */}
              {!isStd && !row.isActive && (
                <button
                  type="button"
                  onClick={() => applyPricelist(row.plRef)}
                  className="mt-2 w-full rounded-lg border border-gray-200 py-1.5 text-[10px] font-semibold text-gray-500 transition-colors hover:border-[#b20202] hover:bg-red-50 hover:text-[#b20202]"
                >
                  Use this pricelist
                </button>
              )}
            </div>
          );
        })}
      </div>

      {hasSizes && activeSize && (
        <p className="text-right text-[10px] text-gray-400">
          Prices for <strong>{activeSize.displayName}</strong>
        </p>
      )}
    </div>
  );
}

// ── Product info modal ────────────────────────────────────────────────────────
function ProductInfoModal({
  product,
  onClose,
  onAddToCart,
}: {
  product: POSProduct;
  onClose: () => void;
  onAddToCart: (sizeId?: string) => void;
}) {
  const imageUrl = getImageUrl(product);
  const name     = getProductDisplayName(product);
  const hasSizes = (product.sizes?.length ?? 0) > 0 && !product.sellWithoutSizeVariants;
  const validSizes: POSSize[] = hasSizes ? (product.sizes || []).filter(Boolean) : [];

  // Tab: 'info' | 'prices'
  const [tab, setTab] = useState<'info' | 'prices'>('info');

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const stockLabel = hasSizes ? null : (() => {
    if (product.availableStock <= 0)
      return { text: 'Out of stock', color: 'text-red-600', bg: 'bg-red-50', icon: <PiProhibit className="h-3.5 w-3.5" /> };
    if (product.availableStock <= 5)
      return { text: `Low stock — ${product.availableStock} left`, color: 'text-amber-600', bg: 'bg-amber-50', icon: <PiWarning className="h-3.5 w-3.5" /> };
    return { text: `${product.availableStock} in stock`, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <PiCheckCircle className="h-3.5 w-3.5" /> };
  })();

  const images = product.product?.images || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-2xl shadow-2xl max-h-[90vh]">

        {/* ── Image strip ── */}
        <div className="relative h-44 shrink-0 overflow-hidden bg-gray-100">
          {imageUrl ? (
            <Image src={imageUrl} alt={name} fill className="object-cover" sizes="512px" priority />
          ) : (
            <div className="flex h-full items-center justify-center text-7xl text-gray-200">&#127863;</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60"
          >
            <PiX className="h-4 w-4" />
          </button>
          {product.isOnSale && (
            <span className="absolute left-3 top-3 rounded-full bg-[#b20202] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
              Sale
            </span>
          )}
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
              {product.product?.brand?.name || product.product?.type || ''}
            </p>
            <h2 className="text-base font-bold text-white leading-tight">{name}</h2>
          </div>
          {images.length > 1 && (
            <div className="absolute bottom-3 right-4 flex gap-1">
              {images.slice(0, 4).map((img, i) => (
                <div key={i} className="h-7 w-7 overflow-hidden rounded-lg border border-white/30 bg-gray-200">
                  <img src={img.thumbnail || img.url} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Tab bar ── */}
        <div className="flex shrink-0 border-b border-gray-200">
          {(['info', 'prices'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-colors ${
                tab === t
                  ? 'border-b-2 border-[#b20202] text-[#b20202]'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {t === 'info' ? <><PiInfo className="h-3.5 w-3.5" /> Product Info</> : <><PiTagChevron className="h-3.5 w-3.5" /> Pricelist Prices</>}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── INFO TAB ── */}
          {tab === 'info' && (
            <>
              {/* Meta row */}
              <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
                {[
                  { label: 'Category', value: (product.product?.type || '—').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) },
                  { label: 'SKU', value: product.sku || '—', mono: true },
                  { label: 'Status', value: product.status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—' },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                    <p className={`mt-0.5 text-xs font-semibold text-gray-800 truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Stock (no-size) */}
              {!hasSizes && stockLabel && (
                <div className={`mx-4 mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${stockLabel.bg} ${stockLabel.color}`}>
                  {stockLabel.icon}
                  {stockLabel.text}
                </div>
              )}

              {/* Price section (no-size) */}
              {!hasSizes && (
                <div className="flex items-center justify-between px-5 py-4">
                  <span className="text-sm font-semibold text-gray-500">Current Price</span>
                  <div className="flex flex-col items-end">
                    {product.originalPrice && (
                      <span className="text-xs tabular-nums text-gray-400 line-through leading-tight">
                        {formatCurrency(product.originalPrice)}
                      </span>
                    )}
                    <span className="text-xl font-extrabold text-gray-900 tabular-nums leading-tight">
                      {formatCurrency(product.baseSellingPrice)}
                    </span>
                  </div>
                </div>
              )}

              {/* Sizes table */}
              {hasSizes && validSizes.length > 0 && (
                <div className="px-4 py-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <PiPackage className="h-3.5 w-3.5" />
                    Sizes & Stock
                  </p>
                  <div className="overflow-hidden rounded-xl border border-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          <th className="px-3 py-2 text-left">Size</th>
                          <th className="px-3 py-2 text-right">Price</th>
                          <th className="px-3 py-2 text-right">Stock</th>
                          <th className="px-3 py-2 text-left">Barcode / SKU</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {validSizes.map((size) => {
                          const oos = size.availableStock <= 0;
                          const low = !oos && size.availableStock <= 5;
                          return (
                            <tr key={size._id} className={oos ? 'opacity-40' : ''}>
                              <td className={`px-3 py-2.5 font-semibold ${oos ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                {size.displayName}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">
                                {(size as any).originalPrice && (
                                  <span className="block text-[10px] text-gray-400 line-through leading-tight">
                                    {formatCurrency((size as any).originalPrice)}
                                  </span>
                                )}
                                <span className="font-bold">{formatCurrency(size.sellingPrice)}</span>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold
                                  ${oos ? 'bg-red-50 text-red-500' : low ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                  {oos ? 'OOS' : size.availableStock}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                {(size.barcode || size.sku) ? (
                                  <span className="flex items-center gap-1 font-mono text-[10px] text-gray-500">
                                    <PiBarcode className="h-3 w-3 shrink-0 text-gray-400" />
                                    {size.barcode || size.sku}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Vendor */}
              {product.vendor && (
                <div className="flex items-center justify-between border-t border-gray-50 px-5 py-3">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <PiTag className="h-3.5 w-3.5" />
                    Vendor
                  </span>
                  <span className="text-xs font-semibold text-gray-700">
                    {product.vendor.posName ||
                      `${product.vendor.firstName ?? ''} ${product.vendor.lastName ?? ''}`.trim() ||
                      product.vendor.email || '—'}
                  </span>
                </div>
              )}
            </>
          )}

          {/* ── PRICES TAB ── */}
          {tab === 'prices' && (
            <div className="px-4 py-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                What this product would cost under each pricelist
              </p>
              <PricelistBreakdown
                product={product}
                hasSizes={hasSizes}
                validSizes={validSizes}
              />
            </div>
          )}
        </div>

        {/* ── Footer: Add to cart ── */}
        <div className="shrink-0 border-t border-gray-100 px-5 py-4">
          {hasSizes && validSizes.length > 1 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Add to cart</p>
              <div className="grid grid-cols-2 gap-2">
                {validSizes.filter(s => s.availableStock > 0).map((size) => (
                  <button
                    key={size._id}
                    type="button"
                    onClick={() => { onAddToCart(size._id); onClose(); }}
                    className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-left text-sm hover:border-[#b20202] hover:bg-red-50 transition-colors"
                  >
                    <span className="font-semibold text-gray-800">{size.displayName}</span>
                    <span className="font-bold text-[#b20202]">{formatCurrency(size.sellingPrice)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                onAddToCart(validSizes.length === 1 ? validSizes[0]._id : undefined);
                onClose();
              }}
              disabled={
                hasSizes
                  ? validSizes.every(s => s.availableStock <= 0)
                  : product.availableStock <= 0
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-opacity disabled:opacity-40 hover:opacity-90"
              style={{ backgroundColor: '#b20202' }}
            >
              <PiShoppingCart className="h-4 w-4" />
              Add to Cart
              <span className="ml-1 rounded-md bg-white/20 px-1.5 py-0.5 text-xs font-semibold">
                {formatCurrency(
                  validSizes.length === 1
                    ? validSizes[0].sellingPrice
                    : product.baseSellingPrice
                )}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Size picker modal ─────────────────────────────────────────────────────────
function SizePickerModal({
  product,
  onAdd,
  onClose,
  allowOverselling = false,
}: {
  product: POSProduct;
  onAdd: (sizeId: string, qty: number) => void;
  onClose: () => void;
  allowOverselling?: boolean;
}) {
  const validSizes: POSSize[] = (product.sizes || []).filter(Boolean);
  const defaultSize = validSizes.find((s) => allowOverselling || s.availableStock > 0) ?? validSizes[0];
  const [selectedSizeId, setSelectedSizeId] = useState<string>(defaultSize?._id ?? '');
  const [qty, setQty] = useState(1);

  const selectedSize = validSizes.find((s) => s._id === selectedSizeId);
  const imageUrl = getImageUrl(product);
  const name = getProductDisplayName(product);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function changeQty(delta: number) {
    const max = selectedSize?.availableStock ?? 999;
    setQty((q) => Math.max(1, Math.min(q + delta, max)));
  }

  function handleAdd() {
    if (!selectedSizeId) return;
    onAdd(selectedSizeId, qty);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white sm:rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
          {imageUrl && (
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-50">
              <Image src={imageUrl} alt={name} fill className="object-cover" sizes="56px" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {product.product?.brand?.name || product.product?.type || ''}
            </p>
            <h3 className="text-sm font-bold leading-snug text-gray-900 line-clamp-2">{name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200"
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>

        {/* Size list */}
        <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
          {validSizes.map((size) => {
            const oos = size.availableStock <= 0;
            const low = !oos && size.availableStock <= 5;
            const sel = selectedSizeId === size._id;
            return (
              <button
                key={size._id}
                type="button"
                disabled={oos && !allowOverselling}
                onClick={() => { setSelectedSizeId(size._id); setQty(1); }}
                className={`flex w-full items-center justify-between px-5 py-3 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                  ${sel ? 'bg-red-50' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors
                    ${sel ? 'border-[#b20202] bg-[#b20202]' : 'border-gray-300'}`}
                  >
                    {sel && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${sel ? 'text-[#b20202]' : 'text-gray-800'} ${oos ? 'line-through' : ''}`}>
                      {size.displayName}
                    </p>
                    {(size.barcode || size.sku) && (
                      <p className="text-[10px] font-mono text-gray-400 mt-0.5">{size.barcode || size.sku}</p>
                    )}
                    {low && <p className="text-[10px] font-semibold text-amber-500">Only {size.availableStock} left</p>}
                    {oos && <p className="text-[10px] text-gray-400">Out of stock</p>}
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  {(size as any).originalPrice && (
                    <span className="text-[10px] tabular-nums text-gray-400 line-through leading-tight">
                      {formatCurrency((size as any).originalPrice)}
                    </span>
                  )}
                  <span className={`text-sm font-bold tabular-nums leading-tight ${sel ? 'text-[#b20202]' : 'text-gray-700'}`}>
                    {formatCurrency(size.sellingPrice)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Qty + Add */}
        <div className="border-t border-gray-100 px-5 py-4">
          <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
            <span>Quantity</span>
            {selectedSize && selectedSize.availableStock > 0 && (
              <span className="font-medium text-gray-400">{selectedSize.availableStock} in stock</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50">
              <button type="button" onClick={() => changeQty(-1)} disabled={qty <= 1}
                className="flex h-10 w-10 items-center justify-center text-gray-500 hover:text-gray-700 disabled:opacity-30">
                <PiMinus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-base font-bold text-gray-900 tabular-nums">{qty}</span>
              <button type="button" onClick={() => changeQty(1)} disabled={qty >= (selectedSize?.availableStock ?? 999)}
                className="flex h-10 w-10 items-center justify-center text-gray-500 hover:text-gray-700 disabled:opacity-30">
                <PiPlus className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!selectedSizeId || ((!allowOverselling) && (selectedSize?.availableStock ?? 0) <= 0)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-40 hover:opacity-90"
              style={{ backgroundColor: '#b20202' }}
            >
              <PiShoppingCart className="h-4 w-4" />
              Add to Cart
              {selectedSize && qty > 0 && (
                <span className="ml-1 rounded-md bg-white/20 px-1.5 py-0.5 text-xs font-semibold">
                  {formatCurrency(selectedSize.sellingPrice * qty)}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Product card ──────────────────────────────────────────────────────────────
export default function POSProductCard({ product, onAddToCart, className, flash = false }: ProductCardProps) {
  const { items, updateQuantity } = usePOSCart();
  const { tenant } = usePOSAuth();
  const allowOverselling = tenant?.posSettings?.allowOverselling === true;

  const [showPicker, setShowPicker] = useState(false);
  const [showInfo,   setShowInfo]   = useState(false);

  // Badge bump animation: increments on each cart change to trigger CSS keyframe
  const [bumpKey, setBumpKey] = useState(0);
  const prevQtyRef = useRef(0);

  const hasSizes    = (product.sizes?.length ?? 0) > 0 && !product.sellWithoutSizeVariants;
  const validSizes: POSSize[] = hasSizes ? (product.sizes || []).filter(Boolean) : [];
  const singleSize  = hasSizes && validSizes.length === 1 ? validSizes[0] : null;

  // All cart lines for this subproduct
  const cartLines = items.filter((i) => i.subProductId === product._id);
  const cartQty   = cartLines.reduce((s, i) => s + i.quantity, 0);
  const inCart    = cartQty > 0;

  // Animate badge when qty increases
  useEffect(() => {
    if (cartQty > prevQtyRef.current) setBumpKey((k) => k + 1);
    prevQtyRef.current = cartQty;
  }, [cartQty]);

  // ── Stock state ─────────────────────────────────────────────────────────────
  const allSizesOOS      = hasSizes && validSizes.every((s) => s.availableStock <= 0);
  const stockDepleted    = hasSizes
    ? allSizesOOS
    : product.availableStock <= 0;
  // When overselling is allowed, nothing is truly "blocked" — just flagged
  const isOutOfStock     = stockDepleted && !allowOverselling;
  const isOOSButAllowed  = stockDepleted &&  allowOverselling;

  const stockCount = hasSizes
    ? validSizes.reduce((s, z) => s + (z.availableStock || 0), 0)
    : product.availableStock;
  const isLowStock = !isOutOfStock && stockCount > 0 && stockCount <= 5;

  // ── Price display ───────────────────────────────────────────────────────────
  const saleActive   = product.isOnSale;
  const isFlashSale  = product.isFlashSale;
  const flashQtyLeft = product.flashSale?.remainingQuantity;
  const bestBundle   = product.activeBundles?.[0];

  let priceDisplay: string;
  let originalDisplay: string | null = null;

  if (singleSize) {
    priceDisplay    = formatCurrency(singleSize.sellingPrice || product.baseSellingPrice);
    if (singleSize.originalPrice) originalDisplay = formatCurrency(singleSize.originalPrice);
  } else if (hasSizes && validSizes.length > 1) {
    const prices = validSizes.map((s) => s.sellingPrice).filter((p) => p > 0);
    if (prices.length === 0) {
      priceDisplay = formatCurrency(product.baseSellingPrice);
    } else {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      priceDisplay = min === max ? formatCurrency(min) : `${formatCurrency(min)} – ${formatCurrency(max)}`;
    }
    if (product.originalPrice) originalDisplay = formatCurrency(product.originalPrice);
  } else {
    priceDisplay = formatCurrency(product.baseSellingPrice);
    if (product.originalPrice) originalDisplay = formatCurrency(product.originalPrice);
  }

  const imageUrl   = getImageUrl(product);
  const name       = getProductDisplayName(product);
  const vendorName = product.vendor
    ? (product.vendor.posName || `${product.vendor.firstName ?? ''} ${product.vendor.lastName ?? ''}`.trim()) || null
    : null;

  // ── Tap logic ───────────────────────────────────────────────────────────────
  //
  // No sizes / single size  → always add+increment directly
  // Multi-size, 1 variant in cart → increment that variant directly
  // Multi-size, 0 or 2+ variants in cart → open picker
  //
  function handleCardClick() {
    if (isOutOfStock) return;

    // No-size product
    if (!hasSizes) {
      onAddToCart(product, undefined, 1);
      return;
    }

    // Single size: add / increment directly, never show picker
    if (singleSize) {
      if (singleSize.availableStock <= 0 && !allowOverselling) return;
      const existing = cartLines.find((l) => l.sizeId === singleSize._id);
      if (existing) {
        if (existing.quantity < singleSize.availableStock) {
          updateQuantity(existing.subProductId, existing.quantity + 1, existing.sizeId);
        }
      } else {
        onAddToCart(product, singleSize._id, 1);
      }
      return;
    }

    // Multiple sizes
    const activeLines = cartLines.filter((l) => l.sizeId); // lines with a size
    if (activeLines.length === 1) {
      // Exactly one size variant in cart → increment it directly
      const line = activeLines[0];
      const sizeDoc = validSizes.find((s) => s._id === line.sizeId);
      if (sizeDoc && (allowOverselling || line.quantity < sizeDoc.availableStock)) {
        updateQuantity(line.subProductId, line.quantity + 1, line.sizeId);
        return;
      }
    }

    // 0 or 2+ size variants in cart → open picker
    setShowPicker(true);
  }

  function handlePickerAdd(sizeId: string, qty: number) {
    (onAddToCart as (p: POSProduct, sizeId?: string, qty?: number) => void)(product, sizeId, qty);
  }

  // Whether this product needs the picker at all (shown in subtitle)
  const needsPicker = hasSizes && validSizes.length > 1;

  return (
    <>
      <button
        type="button"
        onClick={handleCardClick}
        disabled={isOutOfStock}
        className={[
          'group relative flex flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm',
          'transition-all duration-150 active:scale-[0.96]',
          !isOutOfStock && 'hover:-translate-y-0.5 hover:shadow-lg',
          flash
            ? 'border-emerald-400 ring-2 ring-emerald-300 scale-[0.97]'
            : inCart
            ? 'border-[#b20202]/50 ring-1 ring-[#b20202]/20 shadow-[#b20202]/10'
            : 'border-gray-100 hover:border-gray-200',
          isOutOfStock ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
          className ?? '',
        ].filter(Boolean).join(' ')}
      >
        {/* ── Image ── */}
        <div className="relative aspect-square w-full overflow-hidden bg-gray-50">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 20vw"
              className={`object-cover transition-transform duration-300 group-hover:scale-[1.04] ${isOutOfStock ? 'grayscale' : ''}`}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl text-gray-200 select-none">
              &#127863;
            </div>
          )}

          {/* Info button — top-left (span to avoid nested <button>) */}
          <span
            role="button"
            tabIndex={0}
            aria-label="Product details"
            title="Product details"
            onClick={(e) => { e.stopPropagation(); setShowInfo(true); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setShowInfo(true); } }}
            className="absolute left-2 top-2 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-all hover:bg-black/60 hover:scale-110"
          >
            <PiInfo className="h-3.5 w-3.5" />
          </span>

          {/* Sale / Flash badge */}
          {isFlashSale && !isOutOfStock && (
            <span className="absolute left-2 top-9 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
              ⚡ Flash
              {flashQtyLeft != null && flashQtyLeft <= 20 && (
                <span className="ml-0.5 text-amber-100">· {flashQtyLeft} left</span>
              )}
            </span>
          )}
          {saleActive && !isFlashSale && !isOutOfStock && (
            <span className="absolute left-2 top-9 rounded-full bg-[#b20202] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
              Sale
            </span>
          )}

          {/* Low-stock badge */}
          {isLowStock && (
            <span className="absolute right-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
              {stockCount} left
            </span>
          )}

          {/* Hard OOS overlay (overselling disabled) */}
          {isOutOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="rounded-xl bg-white/95 px-3 py-1.5 text-xs font-bold text-gray-800 shadow">
                Out of Stock
              </span>
            </div>
          )}

          {/* Soft OOS indicator (overselling allowed) */}
          {isOOSButAllowed && (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-amber-500/80 py-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-white">
                Stock 0 · Selling on
              </span>
            </div>
          )}

          {/* Cart quantity badge — animates on each increment */}
          {inCart && (
            <div
              key={bumpKey}
              className="absolute bottom-2 right-2 flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-[#b20202] px-1.5 text-xs font-bold text-white shadow-md ring-2 ring-white"
              style={{
                animation: bumpKey > 0 ? 'pos-badge-bump 220ms cubic-bezier(0.34,1.56,0.64,1)' : undefined,
              }}
            >
              {cartQty}
            </div>
          )}

          {/* Hover "+" button (only when not in cart yet) */}
          {!inCart && !isOutOfStock && (
            <div className="absolute inset-0 flex items-end justify-end p-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#b20202] text-white shadow-lg">
                <PiPlus className="h-4 w-4" />
              </span>
            </div>
          )}

          {/* Bottom accent bar */}
          <div className="absolute inset-x-0 bottom-0 h-0.5 origin-center scale-x-0 bg-[#b20202] transition-transform duration-200 group-hover:scale-x-100" />
        </div>

        {/* ── Info ── */}
        <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
          {/* Brand + vendor */}
          <div className="mb-0.5 flex items-center justify-between gap-1">
            <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {product.product?.brand?.name || product.product?.type || ' '}
            </p>
            {vendorName && (
              <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-500">
                {vendorName}
              </span>
            )}
          </div>

          {/* Name */}
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-gray-900">{name}</h3>

          {/* Size subtitle */}
          {hasSizes && (
            <p className="mt-1 text-[10px] text-gray-400">
              {singleSize
                ? singleSize.displayName
                : `${validSizes.length} sizes · tap to pick`}
              {validSizes.filter((s) => s.availableStock > 0).length < validSizes.length && (
                <span className="ml-1 text-amber-500">
                  · {validSizes.filter((s) => s.availableStock > 0).length} available
                </span>
              )}
            </p>
          )}

          {/* Price row */}
          <div className="mt-auto pt-2">
            <div className="flex items-baseline justify-between">
              <div className="flex flex-col">
                <span className={`text-sm font-extrabold tabular-nums leading-tight ${
                  inCart ? 'text-[#b20202]' : isFlashSale ? 'text-amber-600' : 'text-gray-900'
                }`}>
                  {priceDisplay}
                </span>
                {originalDisplay && (
                <span className="text-[10px] tabular-nums text-gray-400 line-through leading-tight">
                  {originalDisplay}
                </span>
              )}
              {/* Applied pricelist rule badges */}
              {(product as any)._appliedPricelistSteps?.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {(product as any)._appliedPricelistSteps.map((step: any, i: number) => {
                    const rt = step.rule?.priceType;
                    const colors: Record<string, string> = {
                      discount: 'bg-emerald-50 text-emerald-700',
                      flash_sale: 'bg-amber-50 text-amber-700',
                      fixed: 'bg-blue-50 text-blue-700',
                      formula: 'bg-indigo-50 text-indigo-700',
                    };
                    const cls = colors[rt] || 'bg-gray-100 text-gray-500';
                    const label = rt === 'flash_sale'
                      ? `⚡${step.rule.flashSalePercentage}%`
                      : rt === 'discount'
                      ? (step.rule.discountType === 'fixed' ? `-₦${step.rule.discountAmount}` : `-${step.rule.discountPercentage}%`)
                      : rt === 'fixed' ? 'Fixed' : rt === 'formula' ? `+${step.rule.markupPercentage}%` : rt;
                    return (
                      <span key={i} className={`rounded px-1 py-0.5 text-[8px] font-bold ${cls}`}>{label}</span>
                    );
                  })}
                </div>
              )}
              </div>
              {/* Picker / tap hints */}
              {needsPicker && cartLines.length !== 1 && !inCart && (
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-400">
                  PICK SIZE
                </span>
              )}
              {needsPicker && cartLines.length === 1 && (
                <span className="rounded bg-[#b20202]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#b20202]">
                  TAP +1
                </span>
              )}
            </div>
            {/* Bundle deal hint */}
            {bestBundle && bestBundle.discount > 0 && (
              <span className="mt-1 inline-flex items-center gap-1 rounded bg-purple-50 px-1.5 py-0.5 text-[9px] font-bold text-purple-600">
                📦 Buy {bestBundle.quantity}+ · {bestBundle.discount}% off
              </span>
            )}
          </div>
        </div>
      </button>

      {/* ── Size picker (multi-size only) ── */}
      {showPicker && (
        <SizePickerModal
          product={product}
          onAdd={handlePickerAdd}
          onClose={() => setShowPicker(false)}
          allowOverselling={allowOverselling}
        />
      )}

      {/* ── Product info modal ── */}
      {showInfo && (
        <ProductInfoModal
          product={product}
          onClose={() => setShowInfo(false)}
          onAddToCart={(sizeId) => {
            (onAddToCart as (p: POSProduct, sizeId?: string, qty?: number) => void)(product, sizeId, 1);
          }}
        />
      )}

      {/* Badge bump keyframe — injected once */}
      <style>{`
        @keyframes pos-badge-bump {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.45); }
          100% { transform: scale(1); }
        }
      `}</style>
    </>
  );
}
