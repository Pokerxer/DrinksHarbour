'use client';

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  PiCheckCircle,
  PiDownloadSimple,
  PiPrinter,
  PiSpinner,
  PiTag,
  PiX,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import type { StockRow } from '@/services/warehouseStock.service';
import { pricelistService } from '@/services/pricelist.service';
import { subproductService } from '@/services/subproduct.service';
import ScopePicker from './inventory-pricelist-scope-picker';
import {
  downloadPricelistCsv,
  printCustomerPricelist,
  priceAndSortLines,
  resolveCatalogLines,
  applyAvailabilityFromStock,
  scopeIsEmpty,
  type CatalogProduct,
  type PricelistLite,
  type ScopeSelection,
} from './inventory-pricelist-print';

function plusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Persisted modal settings ──────────────────────────────────────────────────

const STORE_KEY = 'dh-inventory-pricelist-print';

interface StoredSettings {
  plId: string;
  title: string;
  validUntil: string;
  groupByCategory: boolean;
  showSku: boolean;
  showAvailability: boolean;
  discountPercent: number;
  businessName: string;
}

const DEFAULTS: StoredSettings = {
  plId: '',
  title: 'Price List',
  validUntil: plusDays(30),
  groupByCategory: true,
  showSku: false,
  showAvailability: false,
  discountPercent: 0,
  businessName: '',
};

function loadStored(): StoredSettings {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return DEFAULTS;
    const s = JSON.parse(raw) as Partial<StoredSettings>;
    return {
      plId: typeof s.plId === 'string' ? s.plId : '',
      title: typeof s.title === 'string' && s.title.trim() ? s.title : DEFAULTS.title,
      validUntil:
        typeof s.validUntil === 'string' && s.validUntil
          ? s.validUntil
          : DEFAULTS.validUntil,
      groupByCategory: s.groupByCategory ?? DEFAULTS.groupByCategory,
      showSku: s.showSku ?? DEFAULTS.showSku,
      showAvailability: s.showAvailability ?? DEFAULTS.showAvailability,
      discountPercent:
        typeof s.discountPercent === 'number' &&
        s.discountPercent >= 0 &&
        s.discountPercent <= 90
          ? s.discountPercent
          : 0,
      businessName: typeof s.businessName === 'string' ? s.businessName : '',
    };
  } catch {
    return DEFAULTS;
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface PricelistPrintModalProps {
  open: boolean;
  rows: StockRow[];
  onClose: () => void;
}

export default function PricelistPrintModal({
  open,
  rows,
  onClose,
}: PricelistPrintModalProps) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [pricelists, setPricelists] = useState<PricelistLite[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);

  const [plId, setPlId] = useState(DEFAULTS.plId);
  const [title, setTitle] = useState(DEFAULTS.title);
  const [validUntil, setValidUntil] = useState(DEFAULTS.validUntil);
  const [groupByCategory, setGroupByCategory] = useState(DEFAULTS.groupByCategory);
  const [showSku, setShowSku] = useState(DEFAULTS.showSku);
  const [showAvailability, setShowAvailability] = useState(
    DEFAULTS.showAvailability
  );
  const [discountPercent, setDiscountPercent] = useState(
    DEFAULTS.discountPercent
  );
  const [businessName, setBusinessName] = useState(DEFAULTS.businessName);

  // Scope selection ("What's on the list")
  const [scopeMode, setScopeMode] = useState<'current' | 'select'>('current');
  const [scope, setScope] = useState<ScopeSelection>({
    categories: [],
    subCategories: [],
    brands: [],
    productIds: [],
  });
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const catalogRequestedRef = useRef(false);

  // Restore last-used settings once per mount.
  useEffect(() => {
    const stored = loadStored();
    setPlId(stored.plId);
    setTitle(stored.title);
    setValidUntil(stored.validUntil);
    setGroupByCategory(stored.groupByCategory);
    setShowSku(stored.showSku);
    setShowAvailability(stored.showAvailability);
    setDiscountPercent(stored.discountPercent);
    setBusinessName(stored.businessName);
  }, []);

  // Persist on every change while open.
  useEffect(() => {
    if (!open) return;
    try {
      const s: StoredSettings = {
        plId,
        title,
        validUntil,
        groupByCategory,
        showSku,
        showAvailability,
        discountPercent,
        businessName,
      };
      localStorage.setItem(STORE_KEY, JSON.stringify(s));
    } catch {
      /* storage unavailable — settings simply won't persist */
    }
  }, [
    open,
    plId,
    title,
    validUntil,
    groupByCategory,
    showSku,
    showAvailability,
    discountPercent,
    businessName,
  ]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingLists(true);
    pricelistService
      .list(token)
      .then((res: unknown) => {
        if (!cancelled)
          setPricelists(((res as { data?: PricelistLite[] }).data) ?? []);
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load pricelists');
      })
      .finally(() => {
        if (!cancelled) setLoadingLists(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  // Only keep a stored pricelist id if it still exists.
  useEffect(() => {
    if (!loadingLists && plId && !pricelists.some((p) => p._id === plId)) {
      setPlId('');
    }
  }, [loadingLists, pricelists, plId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const selectedPl = useMemo(
    () => pricelists.find((p) => p._id === plId) ?? null,
    [pricelists, plId]
  );

  // Catalog loads lazily, once, when the user switches to product selection.
  useEffect(() => {
    if (scopeMode !== 'select' || catalogRequestedRef.current || !token) return;
    catalogRequestedRef.current = true;
    setCatalogLoading(true);
    subproductService
      .getSubProducts(token, { limit: 500 })
      .then((res: unknown) => {
        setCatalog(
          ((res as { data?: { subProducts?: CatalogProduct[] } }).data
            ?.subProducts ??
            (res as { subProducts?: CatalogProduct[] }).subProducts ??
            []) as CatalogProduct[]
        );
      })
      .catch(() => toast.error('Failed to load the product catalogue'))
      .finally(() => setCatalogLoading(false));
  }, [scopeMode, token]);

  // Lines to print: passed-in stock rows (current view) or scope-resolved
  // catalogue lines joined against stock for availability.
  const effectiveRows = useMemo(() => {
    if (scopeMode === 'current' || scopeIsEmpty(scope)) return rows;
    return applyAvailabilityFromStock(resolveCatalogLines(catalog, scope), rows);
  }, [scopeMode, scope, catalog, rows]);

  const effectiveDiscount =
    Number.isFinite(discountPercent) && discountPercent > 0
      ? Math.min(90, discountPercent)
      : 0;

  const summary = useMemo(() => {
    if (!open || effectiveRows.length === 0)
      return { products: 0, lines: 0, changed: 0 };
    const lines = priceAndSortLines(effectiveRows, selectedPl, effectiveDiscount);
    return {
      products: new Set(lines.map((l) => l.subProductId)).size,
      lines: lines.length,
      changed: lines.filter((l) => l.changed).length,
    };
  }, [open, effectiveRows, selectedPl, effectiveDiscount]);

  const buildOptions = useCallback(
    () => ({
      title: title.trim() || 'Price List',
      validUntil: validUntil || undefined,
      groupByCategory,
      showSku,
      showAvailability,
      discountPercent: effectiveDiscount,
      businessName: businessName.trim() || undefined,
    }),
    [
      title,
      validUntil,
      groupByCategory,
      showSku,
      showAvailability,
      effectiveDiscount,
      businessName,
    ]
  );

  if (!open) return null;

  function handlePrint() {
    const ok = printCustomerPricelist(
      effectiveRows,
      selectedPl,
      buildOptions()
    );
    if (!ok)
      toast.error('Print window blocked — allow pop-ups for this site');
  }

  function handleCsv() {
    try {
      downloadPricelistCsv(effectiveRows, selectedPl, buildOptions());
    } catch {
      toast.error('Could not generate the CSV');
    }
  }

  const toggleRow = (
    label: string,
    checked: boolean,
    set: (v: boolean) => void
  ) => (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => set(e.target.checked)}
        className="h-3.5 w-3.5 accent-[#b20202]"
      />
      {label}
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-900/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#fef2f2] text-[#b20202]">
              <PiTag className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                Print customer pricelist
              </h2>
              <p className="text-[11px] text-gray-400">
                {summary.products} product{summary.products === 1 ? '' : 's'}
                {' \u00b7 '}
                {summary.lines} line{summary.lines === 1 ? '' : 's'}
                {summary.changed > 0 && (
                  <span className="text-emerald-600">
                    {' '}
                    · {summary.changed} repriced
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          {/* Scope — what's on the list */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-gray-600">
              What&apos;s on the list
            </p>
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-gray-50 p-1">
              {(
                [
                  {
                    key: 'current' as const,
                    label:
                      rows.length > 0
                        ? `Current view (${rows.length} line${rows.length === 1 ? '' : 's'})`
                        : 'Current view',
                  },
                  { key: 'select' as const, label: 'Choose products…' },
                ]
              ).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  aria-pressed={scopeMode === m.key}
                  onClick={() => setScopeMode(m.key)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                    scopeMode === m.key
                      ? 'bg-[#b20202] text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {scopeMode === 'select' && (
              <div className="mt-2">
                <ScopePicker
                  catalog={catalog}
                  loading={catalogLoading}
                  selection={scope}
                  onChange={setScope}
                />
                {scopeIsEmpty(scope) ? (
                  <p className="mt-1.5 text-[11px] text-amber-600">
                    Pick at least one category, sub-category, brand or product
                    to build the list — or switch back to the current view.
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-gray-400">
                    Selections combine: matching any chosen category,
                    sub-category, brand or product includes it.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Price source — selectable cards */}
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <p className="text-xs font-semibold text-gray-600">Price source</p>
              <Link
                href={routes.pos.pricelists}
                className="text-[11px] font-medium text-[#b20202] hover:underline"
              >
                Manage pricelists →
              </Link>
            </div>
            {loadingLists ? (
              <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-5 text-xs text-gray-400">
                <PiSpinner className="h-4 w-4 animate-spin" /> Loading
                pricelists…
              </div>
            ) : (
              <div className="grid max-h-44 grid-cols-1 gap-1.5 overflow-y-auto rounded-xl bg-gray-50 p-1.5 sm:grid-cols-2">
                <button
                  type="button"
                  aria-pressed={plId === ''}
                  onClick={() => setPlId('')}
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    plId === ''
                      ? 'border-[#b20202] bg-white shadow-sm'
                      : 'border-transparent bg-white/60 hover:border-gray-200'
                  }`}
                >
                  <PiTag
                    className={`mt-0.5 h-4 w-4 shrink-0 ${plId === '' ? 'text-[#b20202]' : 'text-gray-300'}`}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-gray-800">
                      Standard retail
                    </span>
                    <span className="block text-[10px] text-gray-400">
                      Catalogue selling prices · NGN
                    </span>
                  </span>
                  {plId === '' && (
                    <PiCheckCircle className="ml-auto h-4 w-4 shrink-0 text-[#b20202]" />
                  )}
                </button>
                {pricelists.map((p) => {
                  const active = p._id === plId;
                  return (
                    <button
                      key={p._id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setPlId(p._id)}
                      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        active
                          ? 'border-[#b20202] bg-white shadow-sm'
                          : 'border-transparent bg-white/60 hover:border-gray-200'
                      }`}
                    >
                      <PiTag
                        className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-[#b20202]' : 'text-gray-300'}`}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-gray-800">
                          {p.name}
                        </span>
                        <span className="block text-[10px] text-gray-400">
                          {(p.rules?.length ?? 0) > 0
                            ? `${p.rules!.length} rule${p.rules!.length === 1 ? '' : 's'}`
                            : 'No rules'}
                          {p.currency && p.currency !== 'NGN'
                            ? ` · ${p.currency}`
                            : ''}
                        </span>
                      </span>
                      {active && (
                        <PiCheckCircle className="ml-auto h-4 w-4 shrink-0 text-[#b20202]" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-1 text-[11px] text-gray-400">
              Prices follow the same rules the POS applies at checkout.
            </p>
          </div>

          {/* Trade discount */}
          <div className="flex items-end justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-gray-700">
                Trade discount
              </p>
              <p className="text-[11px] text-gray-400">
                Optional % off applied on top of the price source
              </p>
            </div>
            <div className="relative w-24 shrink-0">
              <input
                type="number"
                min={0}
                max={90}
                step={1}
                value={discountPercent === 0 ? '' : discountPercent}
                placeholder="0"
                onChange={(e) => {
                  const v = e.target.value;
                  setDiscountPercent(v === '' ? 0 : Number(v));
                }}
                aria-label="Trade discount percent"
                className="h-[34px] w-full rounded-lg border border-gray-200 bg-white pr-6 text-right text-xs tabular-nums text-gray-800 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                %
              </span>
            </div>
          </div>

          {/* Document options */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Price List"
                className="h-[34px] w-full rounded-lg border border-gray-200 px-3 text-xs text-gray-800 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                Business name (optional)
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Shown above the title"
                className="h-[34px] w-full rounded-lg border border-gray-200 px-3 text-xs text-gray-800 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                Valid until (optional)
              </label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="h-[34px] w-full rounded-lg border border-gray-200 px-3 text-xs text-gray-800 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
              />
            </div>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2 pb-1.5">
              {toggleRow('Group by category', groupByCategory, setGroupByCategory)}
              {toggleRow('Show SKU codes', showSku, setShowSku)}
              {toggleRow(
                'Show availability',
                showAvailability,
                setShowAvailability
              )}
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-gray-400">
            Selected lines merge per product and size across warehouses. The PDF
            opens in a print window — choose “Save as PDF” as the destination.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-5 py-3.5">
          <button
            type="button"
            onClick={handleCsv}
            disabled={effectiveRows.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            <PiDownloadSimple className="h-3.5 w-3.5" /> Download CSV
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={effectiveRows.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiPrinter className="h-4 w-4" /> Print / Save PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
