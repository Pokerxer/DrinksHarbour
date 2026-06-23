'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiCheck, PiArrowLeft } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import {
  vendorPricelistService,
  type PricelistItem,
} from '@/services/vendorPricelist.service';
import { fmtCur } from './purchases-analytics-helpers';
import { fraunces } from './purchases-fonts';
import { LineItemsEditor, netPrice } from './purchases-pricelist-shared';

const CURRENCIES = ['NGN', 'USD', 'EUR', 'GBP'];

export default function PurchasesPricelistCreate() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [name, setName] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<PricelistItem[]>([]);
  const [saving, setSaving] = useState(false);

  const catalogueValue = useMemo(
    () => lines.reduce((s, l) => s + netPrice(l), 0),
    [lines]
  );

  async function handleCreate() {
    if (!name.trim()) {
      toast.error('Pricelist name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await vendorPricelistService.createPricelist(
        {
          name,
          vendorName,
          currency,
          discountPercent,
          notes,
          isActive: true,
          items: lines,
        },
        token
      );
      toast.success('Pricelist created');
      router.push(routes.eCommerce.vendorPricelistDetails(res.data._id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full rounded-lg border border-[#ece4d6] px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/15';

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-2xl border border-[#ece4d6] bg-white px-6 py-5 shadow-sm">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#b20202] via-[#d9a05b] to-[#b20202]" />
        <Link
          href={routes.eCommerce.vendorPricelists}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-[#b20202]"
        >
          <PiArrowLeft className="h-3.5 w-3.5" /> Pricelists
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#b20202]/70">
              Configuration
            </p>
            <h1
              className={`${fraunces.className} mt-1 text-[26px] font-semibold leading-tight text-[#2a2420] sm:text-[30px]`}
            >
              New Vendor Pricelist
            </h1>
          </div>
          {lines.length > 0 && (
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Catalogue Value
              </p>
              <p
                className={`${fraunces.className} text-lg font-semibold tabular-nums text-[#2a2420]`}
              >
                {fmtCur(catalogueValue, currency)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Metadata ── */}
      <div className="rounded-2xl border border-[#ece4d6] bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Pricelist Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q3 Beverage Supply"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Vendor
            </label>
            <input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={inputCls}
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Global Discount %
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Notes
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes…"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* ── Line items ── */}
      <LineItemsEditor lines={lines} currency={currency} onChange={setLines} />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleCreate}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
        >
          <PiCheck className="h-4 w-4" />
          {saving ? 'Creating…' : 'Create Pricelist'}
        </button>
      </div>
    </div>
  );
}
