'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PiGearSix, PiArrowRight, PiArrowsClockwise,
  PiShoppingCart, PiCurrencyNgn, PiCreditCard, PiBank,
  PiDeviceMobile, PiTimer, PiTrendUp, PiReceipt,
  PiStorefront, PiWarningCircle, PiCheckCircle,
  PiUserCircle, PiCalendar, PiChartBarHorizontal,
  PiTag, PiClockCounterClockwise, PiArrowUpRight,
  PiArrowDownRight, PiSealPercent, PiPackage,
} from 'react-icons/pi';
import { posApi } from '@/app/shared/point-of-sale/api';
import { usePOSAuth } from '@/app/shared/point-of-sale/store';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import { routes } from '@/config/routes';
import { POSDashboardData, POSSessionInfo, POSRecentOrder } from '@/app/shared/point-of-sale/types';
import POSNavHeader from './pos-nav-header';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const METHOD_ICON: Record<string, React.ReactNode> = {
  cash:          <PiCurrencyNgn  className="h-3.5 w-3.5" />,
  card:          <PiCreditCard   className="h-3.5 w-3.5" />,
  bank_transfer: <PiBank         className="h-3.5 w-3.5" />,
  mobile_money:  <PiDeviceMobile className="h-3.5 w-3.5" />,
};
const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', card: 'Card / POS', bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money', split: 'Split',
};

// ── Sparkline bar chart ───────────────────────────────────────────────────────
function SalesChart({ data }: { data: { date: string; sales: number; orders: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.sales), 1);
  return (
    <div className="flex h-32 items-end gap-1.5 pb-1 pt-3">
      {data.map((d, i) => {
        const pct     = Math.max(4, Math.round((d.sales / max) * 100));
        const day     = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' });
        const isToday = i === data.length - 1;
        return (
          <div key={d.date} className="group relative flex flex-1 flex-col items-center">
            {/* Tooltip */}
            <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-20">
              <div className="rounded-lg bg-gray-900 px-2.5 py-1.5 text-center whitespace-nowrap shadow-lg">
                <p className="text-[10px] font-bold text-white">{formatCurrency(d.sales)}</p>
                <p className="text-[9px] text-gray-400">{d.orders} order{d.orders !== 1 ? 's' : ''}</p>
              </div>
              <div className="h-1.5 w-1.5 rotate-45 bg-gray-900 -mt-0.5" />
            </div>
            <div className="relative w-full flex-1 flex items-end">
              <div
                className={`w-full rounded-t-md transition-all ${
                  isToday ? 'bg-[#b20202]' : 'bg-gray-200 group-hover:bg-gray-300'
                }`}
                style={{ height: `${pct}%` }}
              />
            </div>
            <p className={`mt-1 text-[9px] font-semibold ${isToday ? 'text-[#b20202]' : 'text-gray-400'}`}>{day}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, trend, icon, accent = false,
}: {
  label: string; value: string; sub?: string;
  trend?: { pct: number; up: boolean } | null;
  icon: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-3 rounded-2xl border p-5 ${
      accent ? 'border-[#b20202]/20 bg-gradient-to-br from-[#b20202]/5 to-[#b20202]/[0.02]' : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-center justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
          accent ? 'bg-[#b20202] text-white' : 'bg-gray-100 text-gray-500'
        }`}>
          {icon}
        </div>
        {trend != null && (
          <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            trend.up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
          }`}>
            {trend.up ? <PiArrowUpRight className="h-3 w-3" /> : <PiArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend.pct).toFixed(0)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
        <p className={`mt-0.5 text-2xl font-black tabular-nums leading-none ${accent ? 'text-[#b20202]' : 'text-gray-900'}`}>{value}</p>
        {sub && <p className="mt-1.5 text-[10px] text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

// ── Terminal card ─────────────────────────────────────────────────────────────
type TerminalInfo = {
  sessionOpen: boolean | null;
  closingDate: string | null;
  closingBalance: string | null;
  sessionSales?: number;
  sessionOrders?: number;
  cashierName?: string;
  openedAt?: string;
};

function TerminalCard({
  id, title, badge, description, color, info,
}: {
  id: string; title: string; badge: string; description: string;
  color: string; info: TerminalInfo;
}) {
  const router = useRouter();
  const open   = info.sessionOpen;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md">
      {/* Top accent bar */}
      <div className="h-1 w-full" style={{ backgroundColor: color }} />

      <div className="flex flex-1 flex-col p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{badge}</p>
            <h3 className="mt-0.5 text-base font-bold text-gray-900">{title}</h3>
            <p className="text-[11px] text-gray-400">{description}</p>
          </div>
          {open === null ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-gray-100" />
          ) : open ? (
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
            </span>
          ) : (
            <span className="h-3 w-3 rounded-full bg-gray-300" />
          )}
        </div>

        {/* Session stats */}
        {open ? (
          <div className="mb-4 space-y-2">
            {info.cashierName && (
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <PiUserCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium">{info.cashierName}</span>
                {info.openedAt && (
                  <span className="ml-auto text-gray-400">since {fmtTime(info.openedAt)}</span>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Session Sales</p>
                <p className="mt-0.5 text-base font-bold tabular-nums text-gray-900">
                  {info.sessionSales != null ? formatCurrency(info.sessionSales) : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Orders</p>
                <p className="mt-0.5 text-base font-bold tabular-nums text-gray-900">{info.sessionOrders ?? '—'}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-gray-50 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Last Balance</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-gray-900">{info.closingBalance ?? '—'}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Last Closed</p>
              <p className="mt-0.5 text-sm font-bold text-gray-900">{info.closingDate ?? '—'}</p>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push(`${routes.pos.lock}?terminal=${id}`)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: color }}
          >
            {open ? 'Continue Selling' : 'Open Session'}
            <PiArrowRight className="h-4 w-4" />
          </button>
          {open != null && (
            <span className={`inline-flex items-center gap-1 rounded-xl px-3 py-2.5 text-[10px] font-bold ${
              open ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {open ? <PiCheckCircle className="h-3.5 w-3.5" /> : <PiTimer className="h-3.5 w-3.5" />}
              {open ? 'Open' : 'Closed'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Recent order row ──────────────────────────────────────────────────────────
function OrderRow({ order }: { order: POSRecentOrder }) {
  const customer = order.customer
    ? `${order.customer.firstName ?? ''} ${order.customer.lastName ?? ''}`.trim() || 'Walk-in'
    : 'Walk-in';
  const isToday = new Date(order.placedAt || order.createdAt).toDateString() === new Date().toDateString();
  const time    = isToday
    ? fmtTime(order.placedAt || order.createdAt)
    : fmtDate(order.placedAt || order.createdAt);
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50">
        <PiReceipt className="h-4 w-4 text-gray-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">{order.orderNumber || '—'}</p>
        <p className="text-[10px] text-gray-400">{customer}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-sm font-bold tabular-nums text-gray-900">{formatCurrency(order.total)}</span>
        <span className="text-[10px] text-gray-400">{time}</span>
      </div>
    </div>
  );
}

// ── Quick action button ───────────────────────────────────────────────────────
function QuickAction({ icon, label, href, sub }: { icon: React.ReactNode; label: string; href: string; sub?: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-center transition-all hover:border-[#b20202]/30 hover:bg-red-50 hover:shadow-sm group"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-500 group-hover:bg-[#b20202] group-hover:text-white transition-colors">
        {icon}
      </span>
      <span className="text-xs font-semibold text-gray-800 group-hover:text-[#b20202]">{label}</span>
      {sub && <span className="text-[9px] text-gray-400">{sub}</span>}
    </Link>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────────
const TERMINALS = [
  { id: 'retail',    title: 'Retail',    badge: 'CASHIER TERMINAL',    description: 'Walk-in customer sales',     color: '#b20202' },
  { id: 'wholesale', title: 'Wholesale', badge: 'MANAGER TERMINAL',    description: 'Bulk & account-based orders', color: '#0369a1' },
];
const DEFAULT_TERM: TerminalInfo = { sessionOpen: null, closingDate: null, closingBalance: null };

export default function POSDashboard() {
  const { token } = usePOSAuth();
  const [dash, setDash]       = useState<POSDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [retail,    setRetail]    = useState<TerminalInfo>(DEFAULT_TERM);
  const [wholesale, setWholesale] = useState<TerminalInfo>(DEFAULT_TERM);

  function fetchAll(tk: string) {
    setLoading(true);
    posApi.getDashboard(tk)
      .then(d => setDash(d))
      .catch(() => {})
      .finally(() => setLoading(false));

    function fetchTerminal(type: 'retail' | 'wholesale', set: (s: TerminalInfo) => void) {
      posApi.getSessionInfo(tk, type)
        .then(data => {
          const s = data.currentSession;
          const l = data.lastSession;
          set({
            sessionOpen:    !!s,
            sessionSales:   s?.totalSales,
            sessionOrders:  s?.orderCount,
            cashierName:    s?.activeCashier
              ? (s.activeCashier.posName || `${s.activeCashier.firstName} ${s.activeCashier.lastName}`)
              : undefined,
            openedAt:       s?.openedAt,
            closingDate:    l ? fmtDate(l.closedAt) : null,
            closingBalance: l ? formatCurrency(l.totalSales) : null,
          });
        })
        .catch(() => set({ ...DEFAULT_TERM, sessionOpen: false }));
    }
    fetchTerminal('retail', setRetail);
    fetchTerminal('wholesale', setWholesale);
  }

  useEffect(() => { if (token) fetchAll(token); }, [token]);

  const today     = dash?.today;
  const yesterday = dash?.yesterday;
  const month     = dash?.thisMonth;
  const chart     = dash?.chartData ?? [];
  const orders    = dash?.recentOrders ?? [];
  const topProds  = dash?.topProducts ?? [];
  const breakdown = today?.breakdown ?? {};
  const brkEntries = Object.entries(breakdown)
    .filter(([, v]) => v.total > 0)
    .sort(([, a], [, b]) => b.total - a.total);

  const growth = yesterday?.totalSales && yesterday.totalSales > 0
    ? (((today?.totalSales ?? 0) - yesterday.totalSales) / yesterday.totalSales) * 100
    : null;

  const avgOrder = today?.orderCount ? (today.totalSales / today.orderCount) : 0;

  if (!token) {
    return (
      <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6">
        <div className="px-6 md:px-8"><POSNavHeader /></div>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <PiStorefront className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-base font-semibold text-gray-700">Not signed in to POS</h2>
          <p className="mt-1 text-sm text-gray-400">Log in to view the dashboard</p>
          <Link href={routes.pos.lock}
            className="mt-4 flex items-center gap-2 rounded-xl bg-[#b20202] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#9f0101]">
            <PiStorefront className="h-4 w-4" /> Open POS
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8">

      {/* ── Nav ── */}
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8">
        <POSNavHeader />
      </div>

      {/* ── Hero bar ── */}
      <div
        className="relative overflow-hidden px-6 py-7 md:px-10 lg:px-12"
        style={{ background: 'linear-gradient(135deg, #b20202 0%, #8a0101 100%)' }}
      >
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute right-48 bottom-0 h-32 w-32 rounded-full bg-white/5" />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/20">
              <Image src="/logo-short.svg" alt="" width={32} height={32} className="rounded-xl" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-200">DrinksHarbour</p>
              <h1 className="text-xl font-bold text-white">Point of Sale</h1>
              <p className="text-[11px] text-red-200">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => token && fetchAll(token)}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-50"
              title="Refresh"
            >
              <PiArrowsClockwise className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {today != null && (
              <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-red-200">Today's Revenue</p>
                  <p className="text-2xl font-black tabular-nums text-white">{formatCurrency(today.totalSales)}</p>
                </div>
                {growth !== null && (
                  <div className={`flex items-center gap-0.5 rounded-full px-2 py-1 text-[10px] font-bold ${
                    growth >= 0 ? 'bg-green-500/30 text-green-200' : 'bg-red-400/30 text-red-200'
                  }`}>
                    {growth >= 0 ? <PiArrowUpRight className="h-3 w-3" /> : <PiArrowDownRight className="h-3 w-3" />}
                    {Math.abs(growth).toFixed(0)}% vs yesterday
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Page body ── */}
      <div className="flex-1 bg-gray-50 px-6 pb-12 pt-6 md:px-10 lg:px-12">

        {/* ── Quick actions ── */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <QuickAction icon={<PiShoppingCart className="h-4.5 w-4.5" />} label="Start Selling" href={routes.pos.lock} sub="Open cashier" />
          <QuickAction icon={<PiReceipt      className="h-4.5 w-4.5" />} label="Orders"        href={routes.pos.orders} sub="View history" />
          <QuickAction icon={<PiTimer        className="h-4.5 w-4.5" />} label="Sessions"      href={routes.pos.sessions} sub="Open / closed" />
          <QuickAction icon={<PiTag          className="h-4.5 w-4.5" />} label="Pricelists"    href={routes.pos.pricelists} sub="Manage pricing" />
          <QuickAction icon={<PiPackage      className="h-4.5 w-4.5" />} label="Products"      href={`${routes.eCommerce.subProducts}?from=pos`} sub="Manage stock" />
          <QuickAction icon={<PiGearSix      className="h-4.5 w-4.5" />} label="Settings"      href={routes.pos.settings} sub="Configure POS" />
        </div>

        {/* ── KPI row ── */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Today's Sales" accent
            value={formatCurrency(today?.totalSales ?? 0)}
            sub={`${today?.orderCount ?? 0} orders`}
            trend={growth !== null ? { pct: growth, up: growth >= 0 } : null}
            icon={<PiCurrencyNgn className="h-5 w-5" />}
          />
          <KpiCard
            label="Avg Order Value"
            value={formatCurrency(avgOrder)}
            sub="per transaction today"
            icon={<PiChartBarHorizontal className="h-5 w-5" />}
          />
          <KpiCard
            label="This Month"
            value={formatCurrency(month?.totalSales ?? 0)}
            sub={`${month?.orderCount ?? 0} orders`}
            icon={<PiCalendar className="h-5 w-5" />}
          />
          <KpiCard
            label="Yesterday"
            value={formatCurrency(yesterday?.totalSales ?? 0)}
            sub={`${yesterday?.orderCount ?? 0} orders`}
            icon={<PiClockCounterClockwise className="h-5 w-5" />}
          />
        </div>

        {/* ── Main 2-col grid ── */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* LEFT column */}
          <div className="space-y-6 lg:col-span-2">

            {/* Terminals */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800">Terminals</h2>
                <Link href={routes.pos.settings} className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#b20202]">
                  <PiGearSix className="h-3.5 w-3.5" /> Configure
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {TERMINALS.map(t => (
                  <TerminalCard
                    key={t.id}
                    {...t}
                    info={t.id === 'retail' ? retail : wholesale}
                  />
                ))}
              </div>
            </section>

            {/* 7-day chart */}
            {chart.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-sm font-bold text-gray-800">Revenue — Last 7 Days</p>
                    <p className="text-[10px] text-gray-400">Hover each bar for order details</p>
                  </div>
                  <PiTrendUp className="h-5 w-5 text-gray-200" />
                </div>
                <SalesChart data={chart.slice(-7)} />
              </div>
            )}

            {/* Top products today */}
            {topProds.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-800">Top Sellers Today</p>
                  <PiSealPercent className="h-4 w-4 text-gray-300" />
                </div>
                <div className="space-y-2">
                  {topProds.map((p, i) => {
                    const maxRev = topProds[0].revenue;
                    const pct    = maxRev > 0 ? Math.round((p.revenue / maxRev) * 100) : 0;
                    return (
                      <div key={p._id ?? i}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[9px] font-bold text-gray-500">
                              {i + 1}
                            </span>
                            <span className="truncate text-xs font-semibold text-gray-700">{p.name}</span>
                          </div>
                          <div className="shrink-0 flex items-center gap-3">
                            <span className="text-[10px] text-gray-400">{p.qty} sold</span>
                            <span className="text-xs font-bold tabular-nums text-gray-900">{formatCurrency(p.revenue)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-[#b20202]/60 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT column */}
          <div className="space-y-6">

            {/* Payment method breakdown */}
            {brkEntries.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="mb-3 text-sm font-bold text-gray-800">Today by Method</p>
                <div className="space-y-3">
                  {brkEntries.map(([method, { total, count }]) => {
                    const pct = today?.totalSales ? Math.round((total / today.totalSales) * 100) : 0;
                    return (
                      <div key={method}>
                        <div className="mb-1 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400">{METHOD_ICON[method] ?? <PiCurrencyNgn className="h-3.5 w-3.5" />}</span>
                            <span className="text-xs font-medium text-gray-700">{METHOD_LABEL[method] ?? method}</span>
                            <span className="text-[10px] text-gray-400">({count}×)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400">{pct}%</span>
                            <span className="text-xs font-bold tabular-nums text-gray-900">{formatCurrency(total)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-[#b20202]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent orders */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-gray-800">Recent Orders</p>
                <Link href={routes.pos.orders} className="text-[11px] font-semibold text-[#b20202] hover:underline">
                  View all →
                </Link>
              </div>
              {orders.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <PiShoppingCart className="mb-2 h-8 w-8 text-gray-200" />
                  <p className="text-xs text-gray-400">No orders yet today</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {orders.slice(0, 8).map(o => <OrderRow key={o._id} order={o} />)}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
