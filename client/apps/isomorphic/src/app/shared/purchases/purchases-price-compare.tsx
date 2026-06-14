'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  PiScales,
  PiTrophyFill,
  PiClock,
  PiMagnifyingGlass,
  PiCaretRight,
  PiCaretDown,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import {
  vendorPricelistService,
  type MatrixGroup,
} from '@/services/vendorPricelist.service';
import { fmtNaira } from './purchases-analytics-helpers';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import { fraunces } from './purchases-fonts';
import { netPrice } from './purchases-pricelist-shared';

export function PriceCompare() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const { convert } = useExchangeRates();

  const [groups, setGroups] = useState<MatrixGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await vendorPricelistService.getMatrix(token);
      setGroups(res.data ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load matrix');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Normalise every vendor price to ₦ and compute best/spread per product.
  const rows = groups
    .map((g) => {
      const priced = g.vendors
        .map((v) => {
          const net = netPrice({
            unitPrice: v.unitPrice,
            discountPercent: v.discountPercent,
          } as never);
          const naira =
            v.currency === 'NGN' ? net : convert(net, v.currency, 'NGN');
          return { ...v, net, naira };
        })
        .sort((a, b) => {
          if (a.naira === null) return 1;
          if (b.naira === null) return -1;
          return a.naira - b.naira;
        });
      const rated = priced.filter((v) => v.naira !== null) as Array<
        (typeof priced)[number] & { naira: number }
      >;
      const best = rated[0] ?? null;
      const worst = rated[rated.length - 1] ?? null;
      const spread =
        best && worst && best.naira > 0
          ? Math.round(((worst.naira - best.naira) / best.naira) * 1000) / 10
          : 0;
      return { ...g, priced, best, spread, vendorCount: priced.length };
    })
    .filter((r) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        r.subProductName.toLowerCase().includes(q) ||
        (r.sku || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.spread - a.spread);

  const key = (g: MatrixGroup) => `${g.subProductId}::${g.sizeId || ''}`;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#ece4d6] bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b20202]/70">
              Sourcing
            </p>
            <h2
              className={`${fraunces.className} text-lg font-semibold text-[#2a2420]`}
            >
              Cheapest Vendor by Product
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Every product priced by more than one vendor, ranked by savings
              opportunity (spread), normalised to ₦.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[#ece4d6] bg-white px-3 py-2">
            <PiMagnifyingGlass className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product or SKU…"
              className="w-56 text-sm outline-none placeholder:text-gray-400"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#ece4d6] bg-white py-16 text-center text-sm text-gray-400">
          Loading price matrix…
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#ece4d6] bg-white/60 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#b20202]/5">
            <PiScales className="h-5 w-5 text-[#b20202]/40" />
          </span>
          <p className="text-sm text-gray-500">
            No products are priced across vendor pricelists yet
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#ece4d6] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#ece4d6] bg-[#FAF8F3] text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                <th className="px-4 py-2.5">Product</th>
                <th className="px-4 py-2.5">Best Vendor</th>
                <th className="px-4 py-2.5 text-right">Best ₦</th>
                <th className="px-4 py-2.5 text-right">Vendors</th>
                <th className="px-4 py-2.5 text-right">Spread</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1ece2]">
              {rows.map((r) => {
                const k = key(r);
                const isOpen = open === k;
                return (
                  <Fragment key={k}>
                    <tr
                      className="cursor-pointer hover:bg-[#FAF8F3]/60"
                      onClick={() => setOpen(isOpen ? null : k)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#2a2420]">
                          {r.subProductName}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {[r.sizeName, r.sku].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {r.best ? (
                          <span className="inline-flex items-center gap-1.5">
                            <PiTrophyFill className="h-3.5 w-3.5 text-[#3d6b5c]" />
                            {r.best.vendorName}
                          </span>
                        ) : (
                          <span className="text-gray-400">no rate</span>
                        )}
                      </td>
                      <td
                        className={`${fraunces.className} px-4 py-3 text-right font-semibold tabular-nums text-[#3d6b5c]`}
                      >
                        {r.best ? fmtNaira(r.best.naira as number) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                        {r.vendorCount}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.spread > 0 ? (
                          <span
                            className={
                              r.spread >= 15
                                ? 'font-semibold text-[#b20202]'
                                : 'text-gray-500'
                            }
                          >
                            {r.spread}%
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">
                        {isOpen ? (
                          <PiCaretDown className="h-4 w-4" />
                        ) : (
                          <PiCaretRight className="h-4 w-4" />
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={6} className="bg-[#FAF8F3]/40 px-4 py-3">
                          <table className="w-full text-xs">
                            <tbody>
                              {r.priced.map((v) => {
                                const isBest =
                                  r.best && v.pricelistId === r.best.pricelistId;
                                return (
                                  <tr
                                    key={v.pricelistId + v.vendorId}
                                    className={
                                      isBest ? 'text-[#3d6b5c]' : 'text-gray-600'
                                    }
                                  >
                                    <td className="py-1.5">
                                      <span className="font-medium">
                                        {v.vendorName}
                                      </span>
                                      <span className="ml-2 text-gray-400">
                                        {v.pricelistName}
                                      </span>
                                    </td>
                                    <td className="py-1.5 text-right tabular-nums">
                                      {v.leadTimeDays != null && (
                                        <span className="inline-flex items-center gap-1 text-gray-400">
                                          <PiClock className="h-3 w-3" />{' '}
                                          {v.leadTimeDays}d
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-1.5 text-right font-semibold tabular-nums">
                                      {v.naira === null ? (
                                        <span className="font-normal text-gray-400">
                                          no rate
                                        </span>
                                      ) : (
                                        fmtNaira(v.naira)
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
