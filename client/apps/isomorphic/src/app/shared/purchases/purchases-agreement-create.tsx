'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  PiArrowLeft,
  PiCheck,
  PiMagnifyingGlass,
  PiPlus,
  PiTrash,
  PiX,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { purchaseAgreementService } from '@/services/purchaseAgreement.service';
import { vendorService } from '@/services/vendor.service';
import { posApi } from '@/app/shared/point-of-sale/api';
import type { Vendor } from './types';
import { CURRENCIES, CURRENCY_SYMBOLS } from './types';
import BaseCurrencyEquivalent from './base-currency-equivalent';

const INPUT_CLS =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20';

interface LineItem {
  subProductId: string;
  subProductName: string;
  sku?: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  unitPrice: number;
  leadTimeDays: number;
}

function blankItem(): LineItem {
  return {
    subProductId: '',
    subProductName: '',
    quantity: 1,
    unitPrice: 0,
    leadTimeDays: 7,
  };
}

// ─── Vendor picker (loads once, filters locally) ────────────────────────────

function VendorPicker({
  token,
  selected,
  onSelect,
  onClear,
}: {
  token: string;
  selected: Vendor | null;
  onSelect: (v: Vendor) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function ensureLoaded() {
    if (loaded || !token) return;
    try {
      const list = await vendorService.getAll(token);
      setVendors(list);
      setLoaded(true);
    } catch {
      setVendors([]);
    }
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{selected.name}</p>
          {selected.email && (
            <p className="text-xs text-gray-500">{selected.email}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClear}
          title="Change vendor"
          className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
        >
          <PiX className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const results = vendors
    .filter((v) => v.name.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 8);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            ensureLoaded();
            setOpen(true);
          }}
          placeholder="Search vendors…"
          className={`pl-9 ${INPUT_CLS}`}
        />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400">
              {query ? `No vendors match "${query}"` : 'No vendors yet'}
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto">
              {results.map((v) => (
                <button
                  key={v._id}
                  type="button"
                  onMouseDown={() => {
                    onSelect(v);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="flex w-full flex-col items-start px-4 py-2 text-left hover:bg-gray-50"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {v.name}
                  </span>
                  {v.email && (
                    <span className="text-xs text-gray-500">{v.email}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Product picker (sizes flattened into individual options) ────────────────

interface ProductPick {
  subProductId: string;
  name: string;
  sku?: string;
  unitPrice: number;
  sizeId?: string;
  sizeName?: string;
}

function ProductPicker({
  value,
  token,
  onSelect,
}: {
  value: string;
  token: string;
  onSelect: (pick: ProductPick) => void;
}) {
  const [query, setQuery] = useState(value);
  const [options, setOptions] = useState<ProductPick[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!token || !open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await posApi.getProducts(token, {
          search: query.trim() || undefined,
          limit: 8,
        });
        const picks: ProductPick[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (res?.products ?? []).forEach((sp: any) => {
          const name = sp.product?.name ?? sp.name ?? sp.productName ?? '';
          const sizes = sp.sizes ?? [];
          if (sp.sellWithoutSizeVariants || sizes.length === 0) {
            picks.push({
              subProductId: sp._id,
              name,
              sku: sp.sku,
              unitPrice: sp.costPrice ?? sp.platformCostPrice ?? 0,
            });
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sizes.forEach((s: any) => {
              const sizeName = s.displayName ?? s.size ?? '';
              picks.push({
                subProductId: sp._id,
                name: `${name} – ${sizeName}`,
                sku: s.sku ?? sp.sku,
                unitPrice: s.costPrice ?? sp.costPrice ?? 0,
                sizeId: String(s._id ?? s.size ?? ''),
                sizeName,
              });
            });
          }
        });
        setOptions(picks.slice(0, 12));
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, token, open]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <PiMagnifyingGlass className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
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
        <div className="absolute left-0 z-30 mt-1 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          {options.length === 0 && !loading ? (
            <div className="px-3 py-3 text-xs text-gray-400">
              {query.trim()
                ? `No products match "${query}"`
                : 'Type to search products'}
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              {options.map((p, i) => (
                <button
                  key={`${p.subProductId}-${p.sizeId ?? i}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(p);
                    setQuery(p.name);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-gray-900">
                      {p.name}
                    </p>
                    {p.sku && (
                      <p className="font-mono text-[10px] text-gray-400">
                        {p.sku}
                      </p>
                    )}
                  </div>
                  {p.unitPrice > 0 && (
                    <span className="shrink-0 text-xs font-medium text-gray-600">
                      {p.unitPrice.toFixed(2)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PurchasesAgreementCreate() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [name, setName] = useState('');
  const [agreementType, setAgreementType] = useState<
    'blanket_order' | 'call_for_tender'
  >('blanket_order');
  const [selectionType, setSelectionType] = useState<
    'exclusive' | 'non_exclusive'
  >('exclusive');
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [currency, setCurrency] = useState('NGN');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [termsConditions, setTermsConditions] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([blankItem()]);
  const [saving, setSaving] = useState(false);

  const isTender = agreementType === 'call_for_tender';

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it))
    );
  }

  const validItems = items.filter((it) => it.subProductId && it.quantity > 0);
  const totalAmount = validItems.reduce(
    (sum, it) => sum + it.quantity * it.unitPrice,
    0
  );
  const totalQuantity = validItems.reduce((sum, it) => sum + it.quantity, 0);
  const symbol = CURRENCY_SYMBOLS[currency] ?? '';

  async function handleCreate() {
    if (!name.trim()) {
      toast.error('Agreement name is required');
      return;
    }
    if (!isTender && !vendor) {
      toast.error('Select a vendor for a blanket order');
      return;
    }
    if (!startDate || !endDate) {
      toast.error('Start and end dates are required');
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      toast.error('End date must be after the start date');
      return;
    }
    if (validItems.length === 0) {
      toast.error('Add at least one product line');
      return;
    }

    setSaving(true);
    try {
      const res = await purchaseAgreementService.createAgreement(
        {
          name: name.trim(),
          agreementType,
          selectionType,
          vendor: vendor?._id,
          // Server requires vendorName; tenders may not have a vendor yet
          vendorName: vendor?.name ?? 'Open Tender',
          currency,
          startDate,
          endDate,
          termsConditions: termsConditions.trim() || undefined,
          notes: notes.trim() || undefined,
          items: validItems.map((it) => ({
            subProductId: it.subProductId,
            subProductName: it.subProductName,
            sku: it.sku,
            sizeId: it.sizeId,
            sizeName: it.sizeName,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            leadTimeDays: it.leadTimeDays,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          })) as any,
        },
        token
      );
      if (!res.success || !res.data?._id) {
        throw new Error(res.message || 'Failed to create agreement');
      }
      toast.success(`Agreement ${res.data.agreementNumber} created`);
      router.push(routes.eCommerce.purchaseAgreementDetails(res.data._id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link
          href={routes.eCommerce.purchaseAgreements}
          className="flex items-center gap-1 hover:text-gray-700"
        >
          <PiArrowLeft className="h-4 w-4" /> Purchase Agreements
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">New</span>
      </div>
      <h1 className="mb-5 text-xl font-semibold text-gray-900">
        New Purchase Agreement
      </h1>

      <div className="space-y-4">
        {/* Details */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Details</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Agreement Name <span className="text-[#b20202]">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q3 Beer Supply 2026"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Agreement Type
              </label>
              <select
                value={agreementType}
                onChange={(e) =>
                  setAgreementType(
                    e.target.value as 'blanket_order' | 'call_for_tender'
                  )
                }
                className={INPUT_CLS}
              >
                <option value="blanket_order">Blanket Order</option>
                <option value="call_for_tender">Call for Tender</option>
              </select>
              <p className="mt-1 text-[11px] text-gray-400">
                {isTender
                  ? 'Invite multiple vendors to bid; pick a winner later'
                  : 'Lock in prices and quantities with one vendor'}
              </p>
            </div>
            {isTender ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Selection Type
                </label>
                <select
                  value={selectionType}
                  onChange={(e) =>
                    setSelectionType(
                      e.target.value as 'exclusive' | 'non_exclusive'
                    )
                  }
                  className={INPUT_CLS}
                >
                  <option value="exclusive">
                    Exclusive — one winning vendor
                  </option>
                  <option value="non_exclusive">
                    Non-exclusive — multiple winners allowed
                  </option>
                </select>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Vendor <span className="text-[#b20202]">*</span>
                </label>
                <VendorPicker
                  token={token}
                  selected={vendor}
                  onSelect={setVendor}
                  onClear={() => setVendor(null)}
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={INPUT_CLS}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c} ({CURRENCY_SYMBOLS[c]})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Start Date <span className="text-[#b20202]">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  End Date <span className="text-[#b20202]">*</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  className={INPUT_CLS}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              Products <span className="text-[#b20202]">*</span>
            </h2>
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, blankItem()])}
              className="flex items-center gap-1 text-sm font-medium text-[#b20202] hover:underline"
            >
              <PiPlus className="h-4 w-4" /> Add line
            </button>
          </div>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div
                key={i}
                className="grid grid-cols-2 items-end gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3 sm:grid-cols-[1fr_90px_120px_90px_90px_32px]"
              >
                <div className="col-span-2 sm:col-span-1">
                  <label className="mb-1 block text-[10px] font-medium text-gray-500">
                    Product
                  </label>
                  <ProductPicker
                    value={item.subProductName}
                    token={token}
                    onSelect={(p) =>
                      updateItem(i, {
                        subProductId: p.subProductId,
                        subProductName: p.name,
                        sku: p.sku,
                        sizeId: p.sizeId,
                        sizeName: p.sizeName,
                        unitPrice: p.unitPrice || item.unitPrice,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-gray-500">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(i, { quantity: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#b20202] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-gray-500">
                    Unit Price ({symbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) =>
                      updateItem(i, { unitPrice: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#b20202] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-gray-500">
                    Lead (days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={item.leadTimeDays}
                    onChange={(e) =>
                      updateItem(i, { leadTimeDays: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#b20202] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-gray-500">
                    Line Total
                  </label>
                  <p className="py-1.5 text-xs font-semibold text-gray-900">
                    {symbol}
                    {(item.quantity * item.unitPrice).toLocaleString(
                      undefined,
                      { maximumFractionDigits: 2 }
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setItems((prev) =>
                      prev.length > 1 ? prev.filter((_, j) => j !== i) : prev
                    )
                  }
                  title="Remove line"
                  className="mb-0.5 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <PiTrash className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-end gap-6 border-t border-gray-100 pt-4 text-sm">
            <span className="text-gray-500">
              {totalQuantity.toLocaleString()} unit
              {totalQuantity !== 1 ? 's' : ''}
            </span>
            <div className="text-right">
              <p className="font-semibold text-gray-900">
                Total: {symbol}
                {totalAmount.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </p>
              <BaseCurrencyEquivalent
                amount={totalAmount}
                currency={currency}
              />
            </div>
          </div>
        </div>

        {/* Terms & notes */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Terms & Conditions
              </label>
              <textarea
                value={termsConditions}
                onChange={(e) => setTermsConditions(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Delivery terms, payment schedule, penalties…"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={1000}
                className={INPUT_CLS}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Link
            href={routes.eCommerce.purchaseAgreements}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
          >
            <PiCheck className="h-4 w-4" />
            {saving ? 'Creating…' : 'Create Agreement'}
          </button>
        </div>
      </div>
    </div>
  );
}
