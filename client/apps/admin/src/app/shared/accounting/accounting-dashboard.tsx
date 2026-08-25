'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { PiArrowsClockwise, PiTrendUp, PiWarningCircle } from 'react-icons/pi';
import {
  accountingService,
  type AccountingDashboard as DashboardPayload,
} from '@/services/accounting.service';
import toast from 'react-hot-toast';
import AccountingNavHeader from './accounting-nav-header';
import AccountingDashboardKpis from './accounting-dashboard-kpis';
import AccountingDashboardChart from './accounting-dashboard-chart';
import AccountingDashboardModules from './accounting-dashboard-modules';
import AccountingDashboardTaxCard from './accounting-dashboard-tax-card';
import AccountingDashboardRecent from './accounting-dashboard-recent';
import { fmtMoney } from './accounting-helpers';

/** /accounting — module dashboard mirroring the Point-of-Sale dashboard. */
export default function AccountingDashboard() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await accountingService.dashboard(token);
      setData(res.data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const monthly = data?.monthly ?? [];
  // Revenue trend: second half of the window vs first half.
  const half = Math.floor(monthly.length / 2);
  const earlyAvg =
    monthly.slice(0, half).reduce((s, m) => s + m.revenue, 0) / (half || 1);
  const lateAvg =
    monthly.slice(half).reduce((s, m) => s + m.revenue, 0) /
    (monthly.length - half || 1);
  const trendPct = earlyAvg > 0 ? ((lateAvg - earlyAvg) / earlyAvg) * 100 : null;

  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8 4xl:-mx-10">
      {/* ── Nav ── */}
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8 4xl:px-10">
        <AccountingNavHeader />
      </div>

      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden px-6 py-8 md:px-10 lg:px-14"
        style={{
          background:
            'linear-gradient(135deg, #b20202 0%, #8f0101 60%, #6e0101 100%)',
        }}
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-10 right-40 h-48 w-48 rounded-full bg-white/5" />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/20">
              <Image
                src="/logo-short.svg"
                alt="DrinksHarbour"
                width={38}
                height={38}
                className="rounded-xl"
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-red-200">
                DrinksHarbour
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-white">Accounting</h1>
              <p className="mt-0.5 text-sm text-red-200">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Hero stats */}
          <div className="flex items-center gap-3">
            {loading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            <button
              type="button"
              onClick={() => load()}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-50"
              title="Refresh"
            >
              <PiArrowsClockwise className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {data && (
              <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 backdrop-blur-sm">
                <div className="text-center">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-red-200">
                    Revenue MTD
                  </p>
                  <p className="text-xl font-black tabular-nums text-white">
                    {fmtMoney(data.kpis.revenueMtd)}
                  </p>
                </div>
                {trendPct !== null && (
                  <div
                    className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${trendPct >= 0 ? 'bg-green-500/30 text-green-200' : 'bg-red-500/30 text-red-200'}`}
                  >
                    <PiTrendUp className={`h-3 w-3 ${trendPct < 0 ? 'rotate-180' : ''}`} />
                    {Math.abs(trendPct).toFixed(0)}%
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 bg-gray-50 px-6 pb-10 pt-6 md:px-10 lg:px-14">
        {!token ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <PiWarningCircle className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-base font-semibold text-gray-700">Not signed in</h2>
            <p className="mt-1 text-sm text-gray-400">
              Sign in as a tenant admin to view the accounting dashboard
            </p>
          </div>
        ) : (
          <>
            {/* ── Stats row ── */}
            {loading && !data ? (
              <div className="mb-6 grid grid-cols-2 animate-pulse gap-4 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5">
                    <div className="h-10 w-full rounded-lg bg-gray-200" />
                  </div>
                ))}
              </div>
            ) : (
              data && <AccountingDashboardKpis data={data.kpis} />
            )}

            {/* ── Main grid ── */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* LEFT: module cards + chart */}
              <div className="space-y-6 lg:col-span-2">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-semibold text-gray-700">Modules</h2>
                </div>

                <AccountingDashboardModules data={data} />

                {monthly.length > 0 && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-800">
                          Revenue vs Expenses — Last 6 Months
                        </p>
                        <p className="text-[10px] text-gray-400">
                          Revenue bars · line = expenses · hover for details
                        </p>
                      </div>
                      <PiTrendUp className="h-5 w-5 text-gray-200" />
                    </div>
                    <AccountingDashboardChart data={monthly} />
                  </div>
                )}
              </div>

              {/* RIGHT: VAT breakdown + recent entries */}
              <div className="space-y-6">
                {data && <AccountingDashboardTaxCard profitLoss={data.profitLoss} />}
                {data && <AccountingDashboardRecent entries={data.recentEntries} />}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
